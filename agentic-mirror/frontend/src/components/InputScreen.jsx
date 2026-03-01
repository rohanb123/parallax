/**
 * InputScreen — Home Page / Dilemma Input UI
 *
 * Features:
 *   - Title with ambient glow
 *   - Centered prompt input with arrow submit button
 *   - Value picker (Time, Money, Identity, Social)
 *   - Navigates to /main on submit
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const VALUES = [
  { id: "time", label: "Time", icon: "⏳" },
  { id: "money", label: "Money", icon: "💰" },
  { id: "identity", label: "Identity", icon: "🪞" },
  { id: "social", label: "Social", icon: "🤝" },
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
  const navigate = useNavigate();

  const handleSubmit = () => {
    if (!text.trim()) return;
    navigate("/main", { state: { dilemma: text.trim(), primaryConcern: selectedValue } });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen px-4 bg-[#0A0A0F] overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-radial from-white/[0.03] to-transparent blur-3xl" />
      </div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="text-center mb-12 relative z-10"
      >
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-white mb-3">
          Agentic Mirror
        </h1>
        <p className="text-white/40 text-lg">
          See which cognitive biases shape your decisions
        </p>
      </motion.div>

      {/* Input box */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="relative w-full max-w-xl z-10 mb-8"
      >
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your dilemma..."
          className="w-full px-6 py-4 pr-14
                     glass glass-texture
                     rounded-2xl
                     text-white placeholder-white/30
                     text-base
                     outline-none
                     focus:border-white/25 focus:bg-white/[0.1]
                     transition-all duration-300"
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim()}
          className="absolute right-3 top-1/2 -translate-y-1/2
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
        className="flex gap-3 z-10"
      >
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
              <span className="text-base">{value.icon}</span>
              <span>{value.label}</span>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Hint text */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.8 }}
        className="mt-8 text-white/20 text-xs z-10"
      >
        Press Enter or click the arrow to begin
      </motion.p>
    </div>
  );
}
