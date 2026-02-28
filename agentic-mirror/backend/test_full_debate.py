"""
Agentic Mirror — Full 3-Round Debate Test
==========================================
Runs a complete debate end-to-end: 3 rounds of 4 bias agents + Rationalist
scoring, then a final verdict with bias-corrected recommendation.

Usage:
    cd agentic-mirror/backend
    python test_full_debate.py

Estimated cost: ~$0.04   |   Estimated time: ~30-45s
"""

import asyncio
import json
import sys
import time

from debate_graph import run_debate

DIVIDER = "═" * 72
THIN_DIVIDER = "─" * 72
SECTION_DIVIDER = "━" * 72

AGENT_LABELS = {
    "loss_aversion": "Loss Aversion",
    "sunk_cost": "Sunk Cost Fallacy",
    "optimism_bias": "Optimism Bias",
    "status_quo": "Status Quo Bias",
}

AGENT_ICONS = {
    "loss_aversion": "🛑",
    "sunk_cost": "⚓",
    "optimism_bias": "🚀",
    "status_quo": "🏠",
}

SAMPLE_DILEMMA = (
    "I've spent 4 years in law school and I'm about to graduate, but I really "
    "want to quit and start a tech startup. My savings would only last about "
    "6 months, and my parents would be devastated. But I feel like if I don't "
    "try now, I'll regret it forever."
)


def print_banner():
    print()
    print(DIVIDER)
    print("    AGENTIC MIRROR — Full Debate Simulation")
    print("    3 rounds  •  4 bias agents  •  1 rationalist")
    print(DIVIDER)
    print()


def print_dilemma():
    print(SECTION_DIVIDER)
    print("  USER DILEMMA")
    print(SECTION_DIVIDER)
    print()
    wrapped = SAMPLE_DILEMMA
    print(f"  \"{wrapped}\"")
    print()
    print(f"  Starting debate... (this will take ~30-45 seconds)")
    print()


def print_round_header(round_num: int):
    print()
    print(SECTION_DIVIDER)
    print(f"  ROUND {round_num} OF 3")
    print(SECTION_DIVIDER)


def print_dialogue(dialogue: list[dict]):
    print()
    for turn in dialogue:
        agent = turn["agent"]
        text = turn["text"]
        icon = AGENT_ICONS.get(agent, "•")
        label = AGENT_LABELS.get(agent, agent)
        print(f"  {icon} {label}:")
        for line in text.strip().split("\n"):
            print(f"     {line}")
        print()


def print_scores(scores: dict, dominant: str):
    print(f"  {THIN_DIVIDER}")
    print(f"  RATIONALIST SCORES")
    print(f"  {THIN_DIVIDER}")
    print()

    sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    for agent, score in sorted_scores:
        label = AGENT_LABELS.get(agent, agent)
        icon = AGENT_ICONS.get(agent, "•")
        bar_filled = score // 2
        bar = "█" * bar_filled + "░" * (50 - bar_filled)
        marker = " ◄ DOMINANT" if agent == dominant else ""
        print(f"  {icon} {label:<22} {bar} {score:>3}%{marker}")

    print()


def print_key_phrases(phrases: list[str]):
    if phrases:
        print(f"  Key phrases detected:")
        for p in phrases:
            print(f"    → \"{p}\"")
        print()


def print_summary(summary: str):
    if summary:
        print(f"  Rationalist says: {summary}")
        print()


def print_final(event: dict, elapsed: float):
    print()
    print(DIVIDER)
    print("    FINAL VERDICT")
    print(DIVIDER)
    print()

    bias = event["dominant_bias"].replace("_", " ").title()
    pct = event["dominance_percentage"]
    rec = event.get("bias_corrected_recommendation")

    print(f"  Dominant Bias:  {bias}")
    print(f"  Dominance:      {pct}%")
    print()

    if rec:
        print(f"  {THIN_DIVIDER}")
        print(f"  BIAS-CORRECTED RECOMMENDATION")
        print(f"  {THIN_DIVIDER}")
        print()
        for line in rec.strip().split("\n"):
            print(f"  {line}")
        print()

    print(f"  {THIN_DIVIDER}")
    print(f"  STATS")
    print(f"  {THIN_DIVIDER}")
    print()
    print(f"  Total time:        {elapsed:.1f}s")
    print(f"  API calls made:    16  (4 bias × 3 rounds + 3 rationalist + 1 recommendation)")
    print(f"  Estimated cost:    ~$0.04")
    print()
    print(DIVIDER)
    print("    Debate complete.")
    print(DIVIDER)
    print()


async def main():
    print_banner()
    print_dilemma()

    start = time.time()
    round_num = 0

    async for event in run_debate(SAMPLE_DILEMMA):
        if event["type"] == "round":
            round_num = event["round"]
            round_time = time.time() - start

            print_round_header(round_num)
            print(f"  ({round_time:.1f}s elapsed)")
            print_dialogue(event["dialogue"])
            print_scores(event["scores"], event["dominant_agent"])
            print_key_phrases(event.get("key_phrases", []))
            print_summary(event.get("rationalist_summary", ""))

        elif event["type"] == "final":
            elapsed = time.time() - start
            print_final(event, elapsed)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n  Debate cancelled by user.")
        sys.exit(0)
    except Exception as e:
        print(f"\n  ERROR: {e}")
        print("  Make sure ANTHROPIC_API_KEY is set in backend/.env")
        sys.exit(1)
