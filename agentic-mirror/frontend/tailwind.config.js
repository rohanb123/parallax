/** @type {import('tailwindcss').Config} */

/*
 * Tailwind CSS Configuration — See AGENT.md §11 & §14 Rule 7
 *
 * Dark mode only (class-based). Extends with agent identity colors.
 * Background: #0A0A0F — no light mode toggle needed.
 */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // AGENT.md §11 — Agent Color & Visual Identity Map
        "agent-loss":     "#E53E3E", // Loss Aversion — Deep red
        "agent-sunk":     "#D69E2E", // Sunk Cost — Amber
        "agent-optimism": "#00B5D8", // Optimism Bias — Electric cyan
        "agent-status":   "#A855F7", // Status Quo — Bright purple
        "agent-rational": "#E2E8F0", // Rationalist — White/silver

        // App background
        "mirror-bg": "#0A0A0F",
      },
    },
  },
  plugins: [],
};
