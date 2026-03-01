/**
 * DebateStream — Scrolling Debate Dialogue Panel
 * See AGENT.md §8 — CenterPanel > DebateStream
 *
 * Displays the real-time debate between bias agents as a scrolling chat log.
 * Each agent's text is color-coded per AGENT.md §11.
 * Auto-scrolls to the latest message as SSE events arrive.
 */

import { useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AGENT_COLORS, AGENT_DISPLAY_NAMES } from "../utils/agentColors";

/**
 * @param {Object} props
 * @param {Array<{round: number, dialogue: Array<{agent: string, text: string}>, rationalist_summary?: string}>} props.rounds
 * @param {Object|null} props.finalResult
 * @param {string} props.currentSpeaker
 * @param {string|null} props.error
 * @param {function} props.onDialogueClick — Called with flat queue index when a dialogue card is clicked
 * @param {number|null} props.activeDialogueIndex — Currently active dialogue index in the flat queue
 */
export default function DebateStream({ rounds = [], finalResult = null, currentSpeaker = "", error = null, onDialogueClick = null, activeDialogueIndex = null }) {
  // Build a mapping from (roundIndex, turnIndex) → flat dialogue queue index
  // Must skip rationalist entries to match the dialogueQueue which filters them out
  // Computed during render (useMemo) so it's immediately available on remount
  const flatIndexMap = useMemo(() => {
    const map = new Map();
    let flatIdx = 0;
    for (let r = 0; r < rounds.length; r++) {
      const dialogue = rounds[r].dialogue || [];
      for (let t = 0; t < dialogue.length; t++) {
        if (dialogue[t].agent === "rationalist") continue;
        map.set(`${r}-${t}`, flatIdx);
        flatIdx++;
      }
    }
    return map;
  }, [rounds]);
  const scrollRef = useRef(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [rounds, finalResult]);

  return (
    <div ref={scrollRef} className="px-6 sm:px-10 md:px-16 lg:px-24 py-4 overflow-y-auto h-full space-y-8">
      {rounds.length === 0 && !error && (
        <p className="text-white/40 text-sm italic">
          Waiting for debate to begin...
        </p>
      )}

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <AnimatePresence mode="popLayout">
        {rounds.map((round) => (
          <motion.div
            key={`round-${round.round}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            {/* Round separator */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">
                Round {round.round}
              </span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            {/* Agent dialogue entries */}
            {round.dialogue?.map((turn, i) => {
              const agentColor = AGENT_COLORS[turn.agent] || "#E2E8F0";
              const displayName = AGENT_DISPLAY_NAMES[turn.agent] || turn.agent;
              const isSpeaking = currentSpeaker === turn.agent;
              const roundIdx = rounds.indexOf(round);
              const flatIdx = flatIndexMap.get(`${roundIdx}-${i}`);
              const isActive = activeDialogueIndex != null && flatIdx === activeDialogueIndex;

              return (
                <motion.div
                  key={`${round.round}-${turn.agent}-${i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.05 }}
                  onClick={() => onDialogueClick?.(flatIdx)}
                  className={`rounded-xl px-4 py-3 transition-all duration-300 cursor-pointer hover:bg-white/[0.06] ${
                    isActive
                      ? "bg-white/[0.10] ring-1"
                      : isSpeaking
                        ? "bg-white/[0.08] shadow-lg"
                        : "bg-white/[0.03]"
                  }`}
                  style={
                    isActive
                      ? { boxShadow: `0 0 24px ${agentColor}33`, ringColor: agentColor }
                      : isSpeaking
                        ? { boxShadow: `0 0 20px ${agentColor}22` }
                        : {}
                  }
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: agentColor,
                        boxShadow: isSpeaking ? `0 0 8px ${agentColor}` : "none",
                      }}
                    />
                    <span
                      className="text-xs font-semibold uppercase tracking-wide"
                      style={{ color: agentColor }}
                    >
                      {displayName}
                    </span>
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed">
                    {turn.text}
                  </p>
                </motion.div>
              );
            })}

            {/* Rationalist summary */}
            {round.rationalist_summary && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="rounded-xl px-4 py-3 bg-white/[0.02] border border-white/[0.06]"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-2 h-2 rounded-full bg-white/40" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                    Rationalist
                  </span>
                </div>
                <p className="text-sm text-white/50 leading-relaxed italic">
                  {round.rationalist_summary}
                </p>
              </motion.div>
            )}
          </motion.div>
        ))}

        {/* Final result */}
        {finalResult && (
          <motion.div
            key="final"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-3"
          >
            {/* Separator */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-white/[0.1]" />
              <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
                Result
              </span>
              <div className="flex-1 h-px bg-white/[0.1]" />
            </div>

            {/* Dominant bias */}
            <div className="rounded-xl px-4 py-4 glass-subtle">
              <p className="text-xs text-white/40 mb-1 uppercase tracking-wide font-semibold">
                Dominant Bias
              </p>
              <p className="text-lg font-bold" style={{
                color: AGENT_COLORS[finalResult.dominant_bias] || "#E2E8F0"
              }}>
                {AGENT_DISPLAY_NAMES[finalResult.dominant_bias] || finalResult.dominant_bias}
                <span className="text-white/40 text-sm font-normal ml-2">
                  {finalResult.dominance_percentage}%
                </span>
              </p>
            </div>

            {/* Recommendation */}
            {finalResult.bias_corrected_recommendation && (
              <div className="rounded-xl px-4 py-4 glass-subtle">
                <p className="text-xs text-white/40 mb-2 uppercase tracking-wide font-semibold">
                  Bias-Corrected Recommendation
                </p>
                <p className="text-sm text-white/70 leading-relaxed">
                  {finalResult.bias_corrected_recommendation}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
