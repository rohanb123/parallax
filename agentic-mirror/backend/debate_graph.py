"""
Agentic Mirror — Debate Loop Engine
====================================
Runs the 3-round multi-agent debate using plain asyncio.

Loop structure:
    For each round (1-3):
        1. Fan-out  — 4 bias agents argue in parallel via asyncio.gather
        2. Fan-in   — Rationalist scores all arguments
        3. Yield    — SSE event with dialogue, scores, key phrases
    After round 3:
        4. Yield FinalEvent with dominant bias + recommendation

Hard-coded to 3 rounds.
"""

import asyncio
import json
import logging
from typing import AsyncGenerator, TypedDict

from agents import BIAS_AGENTS, call_agent, build_round_prompt, client, MODEL

logger = logging.getLogger(__name__)


AGENT_LABELS = {
    "loss_aversion": "LOSS AVERSION",
    "sunk_cost": "SUNK COST FALLACY",
    "optimism_bias": "OPTIMISM BIAS",
    "status_quo": "STATUS QUO BIAS",
}

MAX_ROUNDS = 3


class DebateState(TypedDict):
    dilemma: str
    round: int
    agent_outputs: dict[str, str]
    history: list[dict]
    scores: dict[str, int]
    dominant_agent: str
    key_phrases: list[str]
    bias_overrides: dict[str, int]


async def run_debate(
    dilemma: str,
    bias_overrides: dict[str, int] | None = None,
) -> AsyncGenerator[dict, None]:
    """
    Run a full 3-round debate, yielding SSE-ready event dicts.

    Args:
        dilemma: The user's decision dilemma text.
        bias_overrides: Per-agent weight overrides (0-100). Defaults to 100 each.

    Yields:
        dict with "type": "round" — after each of the 3 rounds
        dict with "type": "final" — after the last round
    """
    if bias_overrides is None:
        bias_overrides = {agent: 100 for agent in BIAS_AGENTS}

    history: list[dict] = []
    scores: dict[str, int] | None = None
    dominant_agent = ""
    key_phrases: list[str] = []
    rationalist_summary = ""

    for round_num in range(1, MAX_ROUNDS + 1):

        # ── Fan-out: call all 4 bias agents in parallel ──
        active_agents = [a for a in BIAS_AGENTS if bias_overrides.get(a, 100) > 0]

        prompts = {
            agent: build_round_prompt(agent, dilemma, round_num, history, scores)
            for agent in active_agents
        }

        results = await asyncio.gather(*[
            call_agent(agent, prompts[agent])
            for agent in active_agents
        ])

        agent_outputs = dict(zip(active_agents, results))

        for agent in active_agents:
            override = bias_overrides.get(agent, 100)
            if 0 < override < 100:
                agent_outputs[agent] = f"[weight: {override}%] {agent_outputs[agent]}"

        # ── Fan-in: send all arguments to the Rationalist ──
        rationalist_prompt = f"USER DILEMMA:\n{dilemma}\n\nAGENT ARGUMENTS (Round {round_num}):\n"
        for agent in BIAS_AGENTS:
            label = AGENT_LABELS[agent]
            if agent in agent_outputs:
                rationalist_prompt += f"\n{label}:\n{agent_outputs[agent]}\n"
            else:
                rationalist_prompt += f"\n{label}:\n[Agent suppressed by user]\n"

        raw_response = await call_agent("rationalist", rationalist_prompt)

        try:
            parsed = json.loads(raw_response)
        except json.JSONDecodeError:
            logger.error("Rationalist returned unparseable response in round %d", round_num)
            parsed = {
                "scores": {a: 25 for a in BIAS_AGENTS},
                "dominant_agent": "none",
                "key_phrases": [],
                "rationalist_summary": "Scoring unavailable.",
            }

        scores = parsed["scores"]
        dominant_agent = parsed["dominant_agent"]
        key_phrases = parsed.get("key_phrases", [])
        rationalist_summary = parsed.get("rationalist_summary", "")

        history.append({
            "round": round_num,
            "arguments": agent_outputs,
        })

        # ── Yield round event ──
        yield {
            "type": "round",
            "round": round_num,
            "dialogue": [
                {"agent": agent, "text": text}
                for agent, text in agent_outputs.items()
            ],
            "scores": scores,
            "dominant_agent": dominant_agent,
            "key_phrases": key_phrases,
            "rationalist_summary": rationalist_summary,
        }

    # ── Generate bias-corrected recommendation ──
    recommendation = None
    try:
        rec_prompt = (
            f"A user described this dilemma:\n\"{dilemma}\"\n\n"
            f"After analysis, their dominant cognitive bias is {dominant_agent.replace('_', ' ')} "
            f"at {scores.get(dominant_agent, 0)}%.\n"
            f"Key biased phrases: {key_phrases}\n\n"
            f"In 2-3 sentences, give them a concrete, actionable recommendation that "
            f"corrects for this bias. Be direct and practical, not generic."
        )
        message = await client.messages.create(
            model=MODEL,
            max_tokens=300,
            system=(
                "You are a neutral decision-making advisor. Give clear, actionable advice "
                "that helps the user see past their cognitive bias. No JSON, just plain text."
            ),
            messages=[{"role": "user", "content": rec_prompt}],
        )
        recommendation = message.content[0].text
    except Exception as e:
        logger.warning("Failed to generate recommendation: %s", e)

    # ── Yield final event ──
    dominant_score = scores.get(dominant_agent, 0) if scores else 0

    yield {
        "type": "final",
        "dominant_bias": dominant_agent,
        "dominance_percentage": dominant_score,
        "bias_corrected_recommendation": recommendation,
        "embedding_snapshot": "trigger_fetch",
    }
