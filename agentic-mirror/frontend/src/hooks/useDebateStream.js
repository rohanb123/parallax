/**
 * useDebateStream — SSE Consumer Hook
 * See AGENT.md §7 — POST /debate SSE stream
 * See AGENT.md §14 Rule 4 — SSE over WebSockets
 *
 * Manages an EventSource connection to the /debate endpoint.
 * Parses SSE events (DebateRoundEvent and FinalEvent) and
 * updates React state for each round.
 *
 * AGENT.md §14 Rule 10 — if the stream errors, preserve last valid state.
 */

import { useState, useCallback, useRef } from "react";

export function useDebateStream() {
  // ── State ──
  const [rounds, setRounds] = useState([]);           // Array of DebateRoundEvent
  const [scores, setScores] = useState({});            // Latest scores
  const [dominantAgent, setDominantAgent] = useState("");
  const [isDebating, setIsDebating] = useState(false);
  const [finalResult, setFinalResult] = useState(null); // FinalEvent or null
  const [error, setError] = useState(null);

  const eventSourceRef = useRef(null);

  /**
   * Start a new debate session.
   *
   * @param {string} dilemma — The user's dilemma text
   * @param {Record<string, number>} biasOverrides — Slider values (0-100 per agent)
   */
  const startDebate = useCallback(async (dilemma, biasOverrides = {}) => {
    // Reset state
    setRounds([]);
    setScores({});
    setDominantAgent("");
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

  /**
   * Stop an in-progress debate.
   */
  const stopDebate = useCallback(() => {
    if (eventSourceRef.current?.cancel) {
      eventSourceRef.current.cancel();
    }
    eventSourceRef.current = null;
    setIsDebating(false);
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
}
