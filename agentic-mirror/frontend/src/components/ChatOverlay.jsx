/**
 * ChatOverlay — Layer 3 glass sheet. Fixed, collapsible. Backdrop blur only behind panel.
 */

import { motion, AnimatePresence } from "framer-motion";
import { AGENT_COLORS, AGENT_DISPLAY_NAMES } from "../utils/agentColors";

const PANEL_HEIGHT = "42vh";
const PANEL_WIDTH = "min(420px, 92vw)";
const EASE = [0.25, 0.46, 0.45, 0.94];

export default function ChatOverlay({ rounds = [], open, onClose, finalResult }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: PANEL_HEIGHT, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="fixed bottom-0 right-[50%] translate-x-1/2 md:right-6 md:translate-x-0 z-[60] flex flex-col rounded-t-2xl overflow-hidden glass-panel-strong"
          style={{
            width: PANEL_WIDTH,
            maxHeight: PANEL_HEIGHT,
            borderBottom: "none",
            boxShadow: "0 1px 0 0 rgba(255,255,255,0.12) inset, 0 -8px 40px -8px rgba(0,0,0,0.3)",
          }}
        >
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.08] shrink-0">
            <span className="text-white/60 text-sm font-medium">
              Debate transcript
            </span>
            <button
              type="button"
              onClick={onClose}
              className="text-white/45 hover:text-white/75 text-sm transition-colors duration-300"
            >
              Minimize
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            {rounds.length === 0 && (
              <p className="text-white/35 text-sm italic">Waiting for debate…</p>
            )}
            {rounds.map((r, idx) => (
              <div key={idx} className="space-y-2">
                <div className="text-white/40 text-xs font-medium">
                  Round {r.round}
                </div>
                {(r.dialogue || []).map((turn, i) => (
                  <div key={i} className="flex gap-2">
                    <span
                      className="shrink-0 w-2 h-2 rounded-full mt-1.5"
                      style={{
                        backgroundColor: AGENT_COLORS[turn.agent] || "#888",
                      }}
                    />
                    <div>
                      <span className="text-white/55 text-xs">
                        {AGENT_DISPLAY_NAMES[turn.agent] || turn.agent}
                      </span>
                      <p className="text-white/88 text-sm mt-0.5">
                        {turn.text}
                      </p>
                    </div>
                  </div>
                ))}
                {r.rationalist_summary && (
                  <p className="text-white/45 text-sm italic pl-4 border-l-2 border-white/10">
                    {r.rationalist_summary}
                  </p>
                )}
              </div>
            ))}
            {finalResult && (
              <div className="pt-2 mt-2 border-t border-white/10">
                <div className="text-white/50 text-xs font-medium mb-1">
                  Verdict
                </div>
                <p className="text-white/90 text-sm">
                  {finalResult.dominant_bias} ({finalResult.dominance_percentage}%)
                </p>
                {finalResult.bias_corrected_recommendation && (
                  <p className="text-white/60 text-sm mt-1 italic">
                    {finalResult.bias_corrected_recommendation}
                  </p>
                )}
              </div>
            )}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
