/**
 * InputScreen — Home Page / Dilemma Input UI
 *
 * Features:
 *   - Title with ambient glow
 *   - Centered prompt input with arrow submit button
 *   - Value picker (Time, Money, Identity, Social)
 *   - Navigates to /main on submit
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Canvas } from "@react-three/fiber";
import IdleScene from "./IdleScene";

/**
 * Per-letter config for the title "parallax".
 * `y` = vertical offset in px (staggered baseline effect).
 * Each letter animates in individually with a cascading delay.
 */
const TITLE_LETTERS = [
  { char: "p", y: 2 },
  { char: "a", y: -4 },
  { char: "r", y: 1 },
  { char: "a", y: -3 },
  { char: "l", y: 5 },
  { char: "l", y: -2 },
  { char: "a", y: 3 },
  { char: "x", y: -5 },
];

const VALUES = [
  { id: "time", label: "Time" },
  { id: "money", label: "Money" },
  { id: "identity", label: "Identity" },
  { id: "social", label: "Social" },
];

/** Right arrow SVG icon */
function ArrowIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export default function InputScreen() {
  const [text, setText] = useState("");
  const [selectedValue, setSelectedValue] = useState(null);
  const [isExiting, setIsExiting] = useState(false);
  const navigate = useNavigate();
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 24;
    const maxHeight = lineHeight * 7;
    if (el.scrollHeight > maxHeight) {
      el.style.height = maxHeight + "px";
      el.style.overflowY = "auto";
    } else {
      el.style.height = el.scrollHeight + "px";
      el.style.overflowY = "hidden";
    }
  }, [text]);

  const handleSubmit = useCallback(() => {
    if (!text.trim() || isExiting) return;
    setIsExiting(true);
    // Allow exit animation to play, then navigate
    setTimeout(() => {
      navigate("/main", { state: { dilemma: text.trim(), primaryConcern: selectedValue } });
    }, 800);
  }, [text, selectedValue, isExiting, navigate]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen px-4 bg-[#0A0A0F] overflow-hidden">
      {/* Ambient 3D background — idle bias spheres + aurora floor */}
      <div className="absolute inset-0" style={{ zIndex: 0 }}>
        <Canvas
          camera={{ position: [0, 0, 10], fov: 45 }}
          gl={{ antialias: true, alpha: false }}
          style={{ width: "100%", height: "100%" }}
          dpr={[1, 1.5]}
        >
          <IdleScene />
        </Canvas>
      </div>

      {/* Dimming overlay — softens 3D scene so glass UI pops */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 1, background: "radial-gradient(ellipse at center, transparent 0%, rgba(10,10,15,0.45) 70%)" }}
      />

      {/* UI content layer — above the 3D canvas */}
      <AnimatePresence>
        {!isExiting && (
          <motion.div
            key="input-ui"
            className="relative flex flex-col items-center justify-center w-full"
            style={{ zIndex: 10 }}
            exit={{ opacity: 0, scale: 0.95, filter: "blur(8px)" }}
            transition={{ duration: 0.6, ease: "easeIn" }}
          >
            {/* Title — staggered baseline monospace */}
            <div className="text-center mb-12">
              <h1 className="flex items-baseline justify-center mb-3" aria-label="parallax">
                {TITLE_LETTERS.map((l, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, y: -20 + l.y }}
                    animate={{ opacity: 1, y: l.y }}
                    transition={{
                      duration: 0.5,
                      delay: 0.15 + i * 0.07,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="title-letter"
                  >
                    {l.char}
                  </motion.span>
                ))}
                {/* Blinking cursor */}
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 1, 0] }}
                  transition={{
                    duration: 1.0,
                    delay: 0.15 + TITLE_LETTERS.length * 0.07 + 0.3,
                    repeat: Infinity,
                    repeatDelay: 0.2,
                    times: [0, 0.1, 0.5, 0.6],
                  }}
                  className="title-cursor"
                />
              </h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.8 }}
                className="text-white/30 text-sm font-mono tracking-widest uppercase"
              >
                cognitive bias debugger
              </motion.p>
            </div>

            {/* Input box */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="relative w-full max-w-xl mb-8"
            >
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your dilemma..."
                rows={1}
                className="w-full px-6 py-4 pr-14
                           glass glass-texture
                           rounded-2xl
                           text-white placeholder-white/30
                           text-base
                           outline-none
                           resize-none overflow-hidden
                           focus:border-white/25 focus:bg-white/[0.1]
                           transition-all duration-300"
              />
              <button
                onClick={handleSubmit}
                disabled={!text.trim()}
                className="absolute right-3 top-4
                           w-10 h-10 rounded-xl
                           flex items-center justify-center
                           glass-subtle
                           text-white/60 hover:text-white
                           hover:bg-white/[0.12]
                           disabled:opacity-20 disabled:cursor-not-allowed
                           transition-all duration-200 cursor-pointer"
              >
                <ArrowIcon />
              </button>
            </motion.div>

            {/* Value Picker */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex flex-col items-center gap-3"
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-white/30">
                Primary Concern
              </span>
              <div className="flex gap-3">
              {VALUES.map((value) => {
                const isSelected = selectedValue === value.id;
                return (
                  <motion.button
                    key={value.id}
                    onClick={() => setSelectedValue(value.id)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.97 }}
                    className={`
                      px-5 py-3 rounded-xl
                      flex items-center gap-2
                      text-sm font-medium
                      transition-all duration-300 cursor-pointer
                      ${
                        isSelected
                          ? "glass glass-texture text-white shadow-[0_0_30px_rgba(255,255,255,0.2),0_0_60px_rgba(255,255,255,0.08)] border-white/50"
                          : "glass-subtle glass-texture text-white/50 hover:bg-white/[0.08] hover:border-white/20 hover:text-white/70"
                      }
                    `}
                  >
                    <span>{value.label}</span>
                  </motion.button>
                );
              })}
              </div>
            </motion.div>

            {/* Hint text */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 0.8 }}
              className="mt-8 text-white/20 text-xs"
            >
              Press Enter or click the arrow to begin
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* "Scanning..." text that appears during exit transition */}
      <AnimatePresence>
        {isExiting && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="absolute inset-0 flex items-center justify-center"
            style={{ zIndex: 10 }}
          >
            <div className="text-center">
              <motion.p
                className="text-xl font-semibold text-white/70 tracking-wider"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              >
                Scanning your cognition...
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
