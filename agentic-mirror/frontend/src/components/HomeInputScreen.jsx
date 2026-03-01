/**
 * HomeInputScreen — Layer 1 bg, Layer 3 glass panels. Spacious, minimal, lavender accents.
 */

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

const STORAGE_KEY = "agentic-mirror-previous-dilemmas";
const MAX_PREVIOUS = 5;
const CONCERN_OPTIONS = ["Money", "Time", "Identity", "Social"];
const EASE = [0.25, 0.46, 0.45, 0.94];

function loadPreviousDilemmas() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_PREVIOUS) : [];
  } catch {
    return [];
  }
}

function savePreviousDilemma(text) {
  if (!text?.trim()) return;
  const prev = loadPreviousDilemmas();
  const filtered = prev.filter((t) => t.trim() !== text.trim());
  const next = [text.trim(), ...filtered].slice(0, MAX_PREVIOUS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export default function HomeInputScreen({ onSubmit }) {
  const [text, setText] = useState("");
  const [primaryConcern, setPrimaryConcern] = useState("Money");
  const [previousOpen, setPreviousOpen] = useState(false);
  const [previousList, setPreviousList] = useState(loadPreviousDilemmas);
  const textareaRef = useRef(null);

  useEffect(() => {
    setPreviousList(loadPreviousDilemmas());
  }, []);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    savePreviousDilemma(trimmed);
    onSubmit(trimmed, primaryConcern);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSelectPrevious = (item) => {
    setText(item);
    setPreviousOpen(false);
  };

  return (
    <div className="min-h-screen space-bg flex items-center justify-center p-8 relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="relative w-full max-w-[580px] flex flex-col items-center gap-10"
      >
        <h1 className="brand-glass text-2xl font-medium tracking-tight">
          Parallax
        </h1>

        <div className="w-full flex flex-col gap-8">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your dilemma…"
            rows={5}
            className="w-full resize-y min-h-[180px] max-h-[360px] rounded-2xl glass-panel px-5 py-4 text-white/90 placeholder:text-white/35 focus:ring-2 focus:ring-[var(--lavender)]/25 focus:border-white/15 transition-all duration-300 outline-none text-[15px] leading-relaxed"
          />

          <div className="flex rounded-xl p-0.5 glass-panel w-fit mx-auto">
            {CONCERN_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setPrimaryConcern(opt)}
                className={`glass-button px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  primaryConcern === opt
                    ? "text-white border-white/20 shadow-[0_1px_0_0_rgba(255,255,255,0.12)_inset]"
                    : "text-white/55 hover:text-white/75"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="glass-button w-full max-w-[300px] mx-auto py-3.5 rounded-xl text-sm font-medium text-white disabled:opacity-40 disabled:pointer-events-none focus:ring-2 focus:ring-[var(--lavender)]/25"
          >
            Run Mirror
          </button>
        </div>

        {previousList.length > 0 && (
          <div className="relative mt-1">
            <button
              type="button"
              onClick={() => setPreviousOpen((o) => !o)}
              className="text-white/35 hover:text-white/55 text-sm transition-colors duration-300"
            >
              Recent
            </button>
            {previousOpen && (
              <ul className="absolute top-full left-1/2 -translate-x-1/2 mt-2 rounded-xl glass-panel-strong overflow-hidden z-10 min-w-[220px] max-h-48 overflow-y-auto py-1">
                {previousList.map((item, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => handleSelectPrevious(item)}
                      className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 truncate transition-colors duration-200"
                    >
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
