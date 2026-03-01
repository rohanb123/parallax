/**
 * useDebateStream — SSE Consumer Hook
 * See AGENT.md §7 — POST /debate SSE stream
 * See AGENT.md §14 Rule 4 — SSE over WebSockets
 *
 * Manages a fetch-based SSE connection to the /debate endpoint.
 * Parses SSE events (DebateRoundEvent and FinalEvent) and
 * updates React state for each round.
 *
 * Dialogue entries are flattened into a sequential queue so the UI
 * can step through them one at a time with chat bubbles + camera focus.
 *
 * AGENT.md §14 Rule 10 — if the stream errors, preserve last valid state.
 */

import { useState, useCallback, useRef } from "react";

const API_BASE = "http://localhost:8000";

/**
 * Normalize a dialogue turn from the backend.
 * Handles multiple response shapes:
 *   1. { agent, text, summary }            — backend parsed correctly
 *   2. { agent, argument, summary }         — backend sent argument key
 *   3. { agent, text: "{\"argument\": ...}" } — raw JSON leaked through
 * Always returns { agent, text, summary }.
 */
function normalizeTurn(turn) {
  let text = turn.text ?? turn.argument ?? "";
  let summary = turn.summary ?? "";

  // If text looks like JSON containing argument/summary, parse it
  if (typeof text === "string" && text.trimStart().startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.argument) {
        text = parsed.argument;
        if (!summary && parsed.summary) summary = parsed.summary;
      }
    } catch (_) {
      // not JSON — keep as-is
    }
  }

  return { agent: turn.agent, text, summary };
}

export function useDebateStream() {
  // ── State ──
  const [rounds, setRounds] = useState([]);
  const [scores, setScores] = useState({});
  const [dominantAgent, setDominantAgent] = useState("");
  const [isDebating, setIsDebating] = useState(false);
  const [finalResult, setFinalResult] = useState(null);
  const [error, setError] = useState(null);

  // ── Dialogue queue ──
  // Flat list of { agent, text, round } entries in arrival order
  const [dialogueQueue, setDialogueQueue] = useState([]);
  // Index into dialogueQueue for the currently displayed chat bubble (null = closed)
  const [activeDialogueIndex, setActiveDialogueIndex] = useState(null);

  const readerRef = useRef(null);

  // Derived: current speaker is whoever's bubble is open
  const currentSpeaker =
    activeDialogueIndex != null && dialogueQueue[activeDialogueIndex]
      ? dialogueQueue[activeDialogueIndex].agent
      : "";

  /** Advance to the next dialogue entry, or stay on last */
  const advanceDialogue = useCallback(() => {
    setDialogueQueue((q) => {
      setActiveDialogueIndex((prev) => {
        if (prev == null) return null;
        const nextIdx = prev + 1;
        return nextIdx < q.length ? nextIdx : prev;
      });
      return q;
    });
  }, []);

  /** Go back to the previous dialogue entry */
  const retreatDialogue = useCallback(() => {
    setActiveDialogueIndex((prev) => {
      if (prev == null || prev <= 0) return prev;
      return prev - 1;
    });
  }, []);

  /** Close the chat bubble (camera returns to default) */
  const closeDialogue = useCallback(() => {
    setActiveDialogueIndex(null);
  }, []);

  /** Jump to a specific dialogue index */
  const goToDialogue = useCallback((index) => {
    setDialogueQueue((q) => {
      if (index >= 0 && index < q.length) {
        setActiveDialogueIndex(index);
      }
      return q;
    });
  }, []);

  /**
   * Start a new debate session.
   *
   * @param {string} dilemma — The user's dilemma text
   * @param {string|null} primaryConcern — Primary concern category
   * @param {Record<string, number>} biasOverrides — Slider values (0-100 per agent)
   */
  const startDebate = useCallback(async (dilemma, primaryConcern = null, biasOverrides = {}) => {
    // Reset state
    setRounds([]);
    setScores({});
    setDominantAgent("");
    setIsDebating(true);
    setFinalResult(null);
    setError(null);
    setDialogueQueue([]);
    setActiveDialogueIndex(null);

    try {
      const body = { dilemma, bias_overrides: biasOverrides };
      if (primaryConcern) body.primary_concern = primaryConcern;

      const res = await fetch(`${API_BASE}/debate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!res.body) throw new Error("No response body (streaming not supported)");

      const reader = res.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          console.log("[SSE] Stream ended");
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Split on double-newline (SSE frame boundary)
        const frames = buffer.split("\n\n");
        buffer = frames.pop() || "";

        console.log(`[SSE] Received ${frames.length} frame(s)`);

        for (const frame of frames) {
          const dataLine = frame
            .split("\n")
            .find((l) => l.startsWith("data:"));
          if (!dataLine) {
            console.log("[SSE] No data line in frame:", frame.substring(0, 50));
            continue;
          }

          const jsonStr = dataLine.replace(/^data:\s*/, "");
          let event;
          try {
            event = JSON.parse(jsonStr);
            console.log("[SSE] Parsed event:", event.type, event.round || "");
          } catch (err) {
            console.error("[SSE] JSON parse error:", err, "raw:", jsonStr.substring(0, 100));
            continue;
          }

          if (event.type === "error") {
            console.error("[SSE] Error event received:", event.message);
            setError(event.message || "Stream error");
            setIsDebating(false);
            readerRef.current = null;
            return;
          }

          if (event.type === "final") {
            console.log("[SSE] Final event received");
            setFinalResult(event);
            setIsDebating(false);
            readerRef.current = null;
            return;
          }

          if (event.type === "round") {
            console.log("[SSE] Round event received:", event.round);

            // Normalize dialogue turns so both rounds state and queue see clean data
            const normalizedDialogue = (event.dialogue || []).map(normalizeTurn);
            const normalizedEvent = { ...event, dialogue: normalizedDialogue };

            setRounds((prev) => {
              const updated = [...prev, normalizedEvent];
              console.log("[SSE] Rounds updated to:", updated.length, "rounds");
              return updated;
            });
            setScores(event.scores || {});
            setDominantAgent(event.dominant_agent || "");

            // Flatten dialogue turns into the sequential queue (skip rationalist)
            if (normalizedDialogue.length > 0) {
              const newEntries = normalizedDialogue
                .filter((turn) => turn.agent !== "rationalist")
                .map((turn) => ({
                  agent: turn.agent,
                  text: turn.text,
                  summary: turn.summary || "",
                  round: event.round,
                }));

              setDialogueQueue((prev) => {
                const prevLen = prev.length;
                const updated = [...prev, ...newEntries];

                // Auto-open the first new entry if no bubble is currently shown
                setActiveDialogueIndex((currentIdx) => {
                  if (currentIdx == null) {
                    return prevLen; // index of first newly added entry
                  }
                  return currentIdx; // keep current bubble open
                });

                return updated;
              });
            }
          }
        }
      }

      setIsDebating(false);
      readerRef.current = null;
    } catch (e) {
      setError(String(e));
      setIsDebating(false);
      readerRef.current = null;
    }
  }, []);

  /**
   * Stop an in-progress debate.
   */
  const stopDebate = useCallback(() => {
    if (readerRef.current) {
      readerRef.current.cancel();
      readerRef.current = null;
    }
    setIsDebating(false);
    setActiveDialogueIndex(null);
  }, []);

  return {
    rounds,
    scores,
    dominantAgent,
    currentSpeaker,
    isDebating,
    finalResult,
    error,
    startDebate,
    stopDebate,
    // Dialogue queue API
    dialogueQueue,
    activeDialogueIndex,
    advanceDialogue,
    retreatDialogue,
    closeDialogue,
    goToDialogue,
  };
}
