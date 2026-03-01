/**
 * Agent Color & Identity Map
 * See AGENT.md §11 — Agent Color & Visual Identity Map
 *
 * Single source of truth for agent colors, names, and identifiers.
 * Used by Parliament, ForceGraph, DebateStream, Heatmap, BiasSliders, ResultBanner.
 */

/** Hex colors per agent — AGENT.md §11 */
export const AGENT_COLORS = {
  loss_aversion: "#E53E3E",  // Deep red
  sunk_cost:     "#D69E2E",  // Amber
  optimism_bias: "#00B5D8",  // Electric cyan
  status_quo:    "#A855F7",  // Bright purple
  rationalist:   "#E2E8F0",  // White/silver
};

/** Human-readable display names */
export const AGENT_DISPLAY_NAMES = {
  loss_aversion: "Loss Aversion",
  sunk_cost:     "Sunk Cost Fallacy",
  optimism_bias: "Optimism Bias",
  status_quo:    "Status Quo Bias",
  rationalist:   "The Rationalist",
};

/** Ordered list of bias agent keys (excludes Rationalist) */
export const BIAS_AGENT_KEYS = [
  "loss_aversion",
  "sunk_cost",
  "optimism_bias",
  "status_quo",
];

/** All agent keys including Rationalist */
export const AGENT_NAMES = [
  ...BIAS_AGENT_KEYS,
  "rationalist",
];
