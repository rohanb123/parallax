"""
Agentic Mirror — Agent Demo Test
=================================
Runs a single Round 1 debate with all 4 bias agents + the Rationalist
so you can see exactly what each agent says and how scoring works.

Usage:
    cd agentic-mirror/backend
    python test_agents_demo.py
"""

import asyncio
import json
import sys
import time

from agents import call_agent, build_round_prompt, BIAS_AGENTS, AGENT_SYSTEM_PROMPTS

DIVIDER = "═" * 70
THIN_DIVIDER = "─" * 70

AGENT_LABELS = {
    "loss_aversion": "LOSS AVERSION",
    "sunk_cost": "SUNK COST FALLACY",
    "optimism_bias": "OPTIMISM BIAS",
    "status_quo": "STATUS QUO BIAS",
    "rationalist": "THE RATIONALIST",
}

SAMPLE_DILEMMA = (
    "I've spent 4 years in law school and I'm about to graduate, but I really "
    "want to quit and start a tech startup. My savings would only last about "
    "6 months, and my parents would be devastated. But I feel like if I don't "
    "try now, I'll regret it forever."
)


def print_header():
    print()
    print(DIVIDER)
    print("  AGENTIC MIRROR — Agent Prompt Demo")
    print("  Testing all 5 agents on a sample dilemma")
    print(DIVIDER)
    print()


def print_section(title: str):
    print()
    print(THIN_DIVIDER)
    print(f"  {title}")
    print(THIN_DIVIDER)
    print()


def print_agent_response(agent_name: str, response: str):
    label = AGENT_LABELS.get(agent_name, agent_name.upper())
    print(f"  [{label}]")
    print()
    for line in response.strip().split("\n"):
        print(f"    {line}")
    print()


async def run_demo():
    print_header()

    # ── Show the dilemma ──
    print_section("USER DILEMMA")
    for line in SAMPLE_DILEMMA.split(". "):
        print(f"    {line.strip()}.")
    print()

    # ── Show what the prompt looks like ──
    print_section("GENERATED PROMPT (Round 1, Loss Aversion)")
    prompt = build_round_prompt(
        agent_name="loss_aversion",
        dilemma=SAMPLE_DILEMMA,
        round_num=1,
        history=[],
        last_scores=None,
    )
    for line in prompt.split("\n"):
        print(f"    {line}")
    print()

    # ── Call all 4 bias agents in parallel ──
    print_section("ROUND 1 — BIAS AGENT RESPONSES")
    print("  Calling all 4 bias agents in parallel...")
    print()

    start = time.time()

    prompts = {}
    for agent in BIAS_AGENTS:
        prompts[agent] = build_round_prompt(
            agent_name=agent,
            dilemma=SAMPLE_DILEMMA,
            round_num=1,
            history=[],
            last_scores=None,
        )

    tasks = {
        agent: call_agent(agent, prompts[agent])
        for agent in BIAS_AGENTS
    }
    results = {}
    for agent, task in tasks.items():
        results[agent] = await task

    bias_elapsed = time.time() - start
    print(f"  (4 agents responded in {bias_elapsed:.1f}s)")
    print()

    for agent in BIAS_AGENTS:
        print_agent_response(agent, results[agent])

    # ── Call the Rationalist ──
    print_section("ROUND 1 — RATIONALIST SCORING")
    print("  Sending all 4 arguments to the Rationalist...")
    print()

    rationalist_prompt = "USER DILEMMA:\n" + SAMPLE_DILEMMA + "\n\n"
    rationalist_prompt += "AGENT ARGUMENTS:\n"
    for agent in BIAS_AGENTS:
        label = AGENT_LABELS[agent]
        rationalist_prompt += f"\n{label}:\n{results[agent]}\n"

    start = time.time()
    raw_response = await call_agent("rationalist", rationalist_prompt)
    rationalist_elapsed = time.time() - start

    print(f"  (Rationalist responded in {rationalist_elapsed:.1f}s)")
    print()

    parsed = json.loads(raw_response)

    print("  SCORES:")
    print()
    for agent, score in parsed["scores"].items():
        label = AGENT_LABELS.get(agent, agent)
        bar = "█" * (score // 2) + "░" * (50 - score // 2)
        print(f"    {label:<22} {bar} {score}%")
    print()

    print(f"  DOMINANT AGENT:  {AGENT_LABELS.get(parsed['dominant_agent'], parsed['dominant_agent'])}")
    print()

    print("  KEY PHRASES:")
    for phrase in parsed.get("key_phrases", []):
        print(f"    • \"{phrase}\"")
    print()

    print("  RATIONALIST SUMMARY:")
    print(f"    {parsed.get('rationalist_summary', 'N/A')}")
    print()

    # ── Summary ──
    print_section("COST ESTIMATE")
    total_time = bias_elapsed + rationalist_elapsed
    print(f"    API calls made:     5 (4 bias + 1 rationalist)")
    print(f"    Total wall time:    {total_time:.1f}s")
    print(f"    Estimated cost:     ~$0.01 (single round)")
    print(f"    Full debate (3 rds): ~$0.04")
    print()
    print(DIVIDER)
    print("  Demo complete.")
    print(DIVIDER)
    print()


if __name__ == "__main__":
    try:
        asyncio.run(run_demo())
    except KeyboardInterrupt:
        print("\n  Cancelled.")
        sys.exit(0)
    except Exception as e:
        print(f"\n  ERROR: {e}")
        print("  Make sure your ANTHROPIC_API_KEY is set in backend/.env")
        sys.exit(1)
