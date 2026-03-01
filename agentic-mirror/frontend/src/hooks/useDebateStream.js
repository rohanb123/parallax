/**
 * useDebateStream — SSE Consumer Hook
 * See AGENT.md §7 — POST /debate SSE stream
 * See AGENT.md §14 Rule 4 — SSE over WebSockets
 *
 * Manages a fetch-based SSE connection to the /debate endpoint.
 * Parses SSE events (DebateRoundEvent and FinalEvent) and
 * updates React state for each round.
 *
 * AGENT.md §14 Rule 10 — if the stream errors, preserve last valid state.
 */

import { useState, useCallback, useRef } from "react";

const API_BASE = "http://localhost:8000";

export function useDebateStream() {
  // ── State ──
  const [rounds, setRounds] = useState([]);           // Array of DebateRoundEvent
  const [scores, setScores] = useState({});            // Latest scores
  const [dominantAgent, setDominantAgent] = useState("");
  const [currentSpeaker, setCurrentSpeaker] = useState(""); // Agent currently "talking"
  const [isDebating, setIsDebating] = useState(false);
  const [finalResult, setFinalResult] = useState(null); // FinalEvent or null
  const [error, setError] = useState(null);

  const abortRef = useRef(null);

  /**
   * Drip-feed dialogue entries one at a time with a short delay,
   * setting currentSpeaker for each agent so the UI can highlight them.
   */
  const dripDialogue = useCallback(async (dialogue, signal) => {
    for (const turn of dialogue) {
      if (signal?.aborted) return;
      setCurrentSpeaker(turn.agent);
      // Small delay so each agent visually "speaks" in sequence
      await new Promise((r) => setTimeout(r, 600));
    }
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
    setCurrentSpeaker("");
    setIsDebating(true);
    setFinalResult(null);
    setError(null);

    try {
      const res = await fetch("http://localhost:8000/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dilemma, bias_overrides: biasOverrides }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!res.body) throw new Error("No response body (stream not supported)");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // store a "cancel" handle in the ref so stopDebate can cancel reading
      eventSourceRef.current = { cancel: () => reader.cancel() };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() || "";

        for (const frame of frames) {
          const dataLine = frame
            .split("\n")
            .find((l) => l.startsWith("data:"));
          if (!dataLine) continue;

          const jsonStr = dataLine.replace(/^data:\s*/, "");
          let event;
          try {
            event = JSON.parse(jsonStr);
          } catch {
            continue;
          }

          if (event.type === "final") { // after the final round countains final result, update ui
            setFinalResult(event);
            setIsDebating(false);
            eventSourceRef.current?.cancel?.(); // stop the stream
            eventSourceRef.current = null;
          } else if (event.type === "round") { // after a normal round update ui
            setRounds((prev) => [...prev, event]);
            setScores(event.scores || {});
            setDominantAgent(event.dominant_agent || "");
          } else if (event.type === "error") { // error
            setError(event.message || "Stream error");
            setIsDebating(false);
          } // add some more ui updates like "Optimistic thinking..." or 
        }   // "Rationalist is thinking..." or "Compiling final rec..."
      }

      setIsDebating(false);
      eventSourceRef.current = null;
    } catch (e) {
      setError(String(e));
      setIsDebating(false);
      eventSourceRef.current = null;
    }
  }, []);
    // Create abort controller for cleanup
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const body = { dilemma, bias_overrides: biasOverrides };
      if (primaryConcern) body.primary_concern = primaryConcern;

      const response = await fetch(`${API_BASE}/debate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE lines — each event is "data: {...}\n\n"
        const lines = buffer.split("\n");
        buffer = "";

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();

          // If this line doesn't start with "data:" it might be incomplete
          if (line.startsWith("data:")) {
            const jsonStr = line.slice(5).trim();
            try {
              const event = JSON.parse(jsonStr);

              if (event.type === "error") {
                setError(event.message);
                setIsDebating(false);
                setCurrentSpeaker("");
                return;
              }

              if (event.type === "final") {
                setFinalResult(event);
                setIsDebating(false);
                setCurrentSpeaker("");
                return;
              }

              // type === "round"
              setRounds((prev) => [...prev, event]);
              setScores(event.scores || {});
              setDominantAgent(event.dominant_agent || "");

              // Drip-feed dialogue to animate speaker highlights
              if (event.dialogue) {
                await dripDialogue(event.dialogue, controller.signal);
              }
            } catch {
              // Partial JSON — put back into buffer
              buffer = lines.slice(i).join("\n");
              break;
            }
          } else if (line.length > 0) {
            // Incomplete line — put back into buffer
            buffer = lines.slice(i).join("\n");
            break;
          }
        }
      }

      // Stream ended without final event
      setIsDebating(false);
      setCurrentSpeaker("");
    } catch (err) {
      if (err.name === "AbortError") return; // User cancelled
      setError(err.message || "Connection failed");
      setIsDebating(false);
      setCurrentSpeaker("");
    }
  }, [dripDialogue]);

  /**
   * Stop an in-progress debate.
   */
  const stopDebate = useCallback(() => {
    if (eventSourceRef.current?.cancel) {
      eventSourceRef.current.cancel();
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    eventSourceRef.current = null;
    setIsDebating(false);
    setCurrentSpeaker("");
  }, []);

  return {
      rounds,
      scores,
      dominantAgent,
      isDebating,
      finalResult,
      error,
      startDebate,
      stopDebate,
    };
    rounds,
    scores,
    dominantAgent,
    currentSpeaker,
    isDebating,
    finalResult,
    error,
    startDebate,
    stopDebate,
  };
}
