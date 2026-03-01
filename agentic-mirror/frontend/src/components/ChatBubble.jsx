/**
 * ChatBubble — 3D-anchored chat bubble rendered above an agent sphere.
 *
 * Displays dialogue text with a typewriter effect, fast-forward, close, and next buttons.
 * Uses @react-three/drei <Html> to project a DOM element into the 3D scene.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Html } from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";

/** Typing speed in milliseconds per character */
const CHAR_DELAY = 18;

/** Auto-advance delay in ms after typing finishes */
const AUTO_ADVANCE_DELAY = 3000;

/**
 * @param {Object} props
 * @param {[number,number,number]} props.position — 3D position of the agent sphere
 * @param {string} props.agentName — Display name of the agent
 * @param {string} props.color — Agent hex color
 * @param {string} props.text — Full dialogue text to type out
 * @param {string} props.summary — Short summary (≤10 words) to display in bubble
 * @param {number} props.roundNum — Round number for display
 * @param {function} props.onClose — Called when ✕ is clicked
 * @param {function} props.onNext — Called when → is clicked
 * @param {function} props.onPrev — Called when ← is clicked
 * @param {boolean} props.hasNext — Whether there's a next entry in the queue
 * @param {boolean} props.hasPrev — Whether there's a previous entry in the queue
 * @param {boolean} props.visible — Whether the bubble should be shown
 */
export default function ChatBubble({
  position = [0, 0, 0],
  agentName = "",
  color = "#E2E8F0",
  text = "",
  summary = "",
  roundNum = 1,
  onClose,
  onNext,
  onPrev,
  hasNext = false,
  hasPrev = false,
  visible = true,
}) {
  const [displayedText, setDisplayedText] = useState("");
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const intervalRef = useRef(null);
  const charIndexRef = useRef(0);

  // Use summary for the bubble display, fall back to full text
  const bubbleText = summary || text;

  // Reset typing when text or visibility changes
  useEffect(() => {
    // Clear any running interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!visible || !bubbleText) {
      setDisplayedText("");
      setIsTypingComplete(false);
      charIndexRef.current = 0;
      return;
    }

    // Start typewriter
    setDisplayedText("");
    setIsTypingComplete(false);
    charIndexRef.current = 0;

    intervalRef.current = setInterval(() => {
      charIndexRef.current += 1;
      if (charIndexRef.current >= bubbleText.length) {
        setDisplayedText(bubbleText);
        setIsTypingComplete(true);
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      } else {
        setDisplayedText(bubbleText.slice(0, charIndexRef.current));
      }
    }, CHAR_DELAY);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [bubbleText, visible]);

  /** Skip the typewriter and show full text immediately */
  const handleFastForward = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setDisplayedText(bubbleText);
    setIsTypingComplete(true);
  }, [bubbleText]);

  // Auto-advance: 3 seconds after typing completes, go to next if no user input
  const autoAdvanceRef = useRef(null);

  useEffect(() => {
    // Clear any pending auto-advance
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }

    if (isTypingComplete && hasNext && visible) {
      autoAdvanceRef.current = setTimeout(() => {
        onNext?.();
      }, AUTO_ADVANCE_DELAY);
    }

    return () => {
      if (autoAdvanceRef.current) {
        clearTimeout(autoAdvanceRef.current);
        autoAdvanceRef.current = null;
      }
    };
  }, [isTypingComplete, hasNext, visible, onNext]);

  /** Reset auto-advance timer (called on any user interaction) */
  const resetAutoAdvance = useCallback(() => {
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
    // Restart the timer
    if (isTypingComplete && hasNext && visible) {
      autoAdvanceRef.current = setTimeout(() => {
        onNext?.();
      }, AUTO_ADVANCE_DELAY);
    }
  }, [isTypingComplete, hasNext, visible, onNext]);

  if (!visible) return null;

  // Position the bubble above the sphere
  const bubblePos = [position[0], position[1] + 1.8, position[2]];

  return (
    <Html
      position={bubblePos}
      center
      distanceFactor={8}
      zIndexRange={[1, 0]}
      style={{ pointerEvents: "auto" }}
    >
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.7, y: 10 }}
            transition={{ type: "spring", damping: 22, stiffness: 300 }}
            className="relative"
            style={{ width: "300px" }}
          >
            {/* Bubble container */}
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: "rgba(17, 17, 24, 0.85)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: `1px solid ${color}33`,
                boxShadow: `0 0 30px ${color}22, 0 8px 32px rgba(0,0,0,0.5)`,
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-3 py-2"
                style={{ borderBottom: `1px solid ${color}22` }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: color,
                      boxShadow: `0 0 8px ${color}`,
                    }}
                  />
                  <span
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color }}
                  >
                    {agentName}
                  </span>
                  <span className="text-[10px] text-white/30 ml-1">
                    R{roundNum}
                  </span>
                </div>
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="w-5 h-5 flex items-center justify-center rounded-full
                             text-white/40 hover:text-white/80 hover:bg-white/10
                             transition-all duration-200 cursor-pointer"
                  title="Close"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <line x1="1" y1="1" x2="9" y2="9" />
                    <line x1="9" y1="1" x2="1" y2="9" />
                  </svg>
                </button>
              </div>

              {/* Text body */}
              <div
                className="px-3 py-2.5 max-h-[150px] overflow-y-auto"
                style={{ scrollbarWidth: "thin", scrollbarColor: `${color}44 transparent` }}
              >
                <p className="text-[13px] text-white/75 leading-relaxed">
                  {displayedText}
                  {!isTypingComplete && (
                    <span
                      className="inline-block w-[2px] h-[14px] ml-0.5 align-middle"
                      style={{
                        backgroundColor: color,
                        animation: "blink 0.8s step-end infinite",
                      }}
                    />
                  )}
                </p>
              </div>

              {/* Footer controls */}
              {hasPrev && (
                <div
                  className="flex items-center px-3 py-1.5"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
                >
                  <button
                    onClick={() => { onPrev?.(); resetAutoAdvance(); }}
                    className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md
                               text-white/50 hover:text-white/80 hover:bg-white/10
                               transition-all duration-200 cursor-pointer"
                    title="Previous"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    <span>Prev</span>
                  </button>
                </div>
              )}
            </div>

            {/* Caret / pointer triangle pointing down toward the sphere */}
            <div
              className="absolute left-1/2 -translate-x-1/2 -bottom-[7px]"
              style={{
                width: 0,
                height: 0,
                borderLeft: "8px solid transparent",
                borderRight: "8px solid transparent",
                borderTop: `8px solid rgba(17, 17, 24, 0.85)`,
              }}
            />

            {/* Inline keyframe for cursor blink */}
            <style>{`
              @keyframes blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0; }
              }
            `}</style>
          </motion.div>
        )}
      </AnimatePresence>
    </Html>
  );
}
