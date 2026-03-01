/**
 * HelpPanel — Fixed bottom-left Help button + Apple Liquid Glass info sheet.
 * Replaces hover tooltips with a persistent, accessible reference panel.
 * Backdrop blur on panel only — no global blur.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const EASE = [0.25, 0.46, 0.45, 0.94];

/** Bias list for help panel: name, color label, hex for swatch, definition */
const BIAS_NODES = [
  {
    name: "Loss Aversion",
    colorName: "Red",
    swatch: "#E53E3E",
    definition:
      "We feel losses more strongly than gains, which can overweight worst-case outcomes.",
  },
  {
    name: "Sunk Cost Fallacy",
    colorName: "Yellow",
    swatch: "#D69E2E",
    definition:
      "Past effort and investment can make it hard to change course, even when future value is unclear.",
  },
  {
    name: "Optimism Bias",
    colorName: "Cyan",
    swatch: "#00B5D8",
    definition:
      "We tend to overestimate positive outcomes and underestimate risks.",
  },
  {
    name: "Status Quo Bias",
    colorName: "Purple",
    swatch: "#A855F7",
    definition:
      "We prefer the current path because it feels familiar and safe, even when change might be better.",
  },
];

export default function HelpPanel() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) close();
    };
    const timer = setTimeout(() => window.addEventListener("mousedown", onClick), 80);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open, close]);

  return (
    <div
      className="fixed z-[70] w-11 h-11"
      style={{ left: 24, top: 24 }}
      ref={panelRef}
    >
      {/* ── Help toggle button (same style as Chat button) ── */}
      <motion.button
        type="button"
        onClick={toggle}
        aria-label="Help"
        className="w-11 h-11 rounded-full flex items-center justify-center
                   glass glass-texture
                   text-white/80 text-sm font-medium
                   hover:bg-white/[0.12] hover:border-white/25
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C4B5FD]/60
                   transition-colors duration-300 cursor-pointer select-none"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.98 }}
        style={{ fontSize: open ? 18 : 17 }}
      >
        {open ? "×" : "?"}
      </motion.button>

      {/* ── Info panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="help-glass-panel absolute top-14 left-0
                       max-h-[60vh] overflow-y-auto rounded-2xl p-5"
            style={{
              width: "min(420px, calc(100vw - 48px))",
              minWidth: 360,
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="help-panel-title text-white/95">
                About Parallax
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close help panel"
                className="text-white/35 hover:text-white/70 text-sm transition-colors duration-200 cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* A — Title + purpose */}
            <section className="mb-5">
              <p className="help-body">
                Parallax helps you externalize a difficult decision by
                visualizing how different cognitive biases pull your reasoning.
              </p>
              <p className="help-body mt-1.5">
                It supports reflection — it doesn&apos;t decide for you.
              </p>
            </section>

            {/* B — How to read the pyramid */}
            <section className="mb-5">
              <h3 className="help-section-title">How to read the pyramid</h3>
              <p className="help-body mb-2">
                Four corner nodes represent different bias &quot;forces.&quot;
              </p>
              <p className="help-body mb-2">
                The center node is your Decision State. As the debate
                progresses, the Decision State drifts toward the biases that
                are currently most influential.
              </p>
              <p className="help-body font-medium text-white/80">
                Closer = stronger pull.
              </p>
            </section>

            <div className="h-px bg-white/[0.07] my-5" aria-hidden="true" />

            {/* C — Bias nodes (color-coded list) */}
            <section className="mb-5">
              <h3 className="help-section-title mb-3">Bias nodes</h3>
              <ul className="space-y-3.5 list-none pl-0">
                {BIAS_NODES.map((bias) => (
                  <li key={bias.name} className="flex gap-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full mt-[5px] shrink-0"
                      style={{ backgroundColor: bias.swatch }}
                      aria-hidden="true"
                    />
                    <div>
                      <span className="help-body font-medium text-white/90">
                        {bias.name} ({bias.colorName}):{" "}
                      </span>
                      <span className="help-body text-white/70">
                        {bias.definition}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <div className="h-px bg-[#C4B5FD]/20 my-5" aria-hidden="true" />

            {/* D — Optional mini note (tip) */}
            <p className="help-body text-white/60 italic text-[12px]">
              Tip: If one bias dominates, try writing a &quot;counter-argument&quot;
              as if you were advising a friend.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
