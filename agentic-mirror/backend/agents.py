"""
Agentic Mirror — Agent System Prompts & Claude Call Wrappers
See AGENT.md §5 — The Four Bias Agents (+ Rationalist)

Each agent has a strict, narrow system prompt. Bias agents must NEVER break
character or acknowledge other valid perspectives (AGENT.md §14 Rule 2).

Model: claude-sonnet-4-20250514 (AGENT.md §14 Rule 1)
"""

import asyncio
import json
import logging
import os
import re
from typing import Any

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MODEL TOGGLE — comment/uncomment ONE block below
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ── DEPLOYMENT (Anthropic Claude) ──
# from anthropic import AsyncAnthropic
# _client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
# MODEL = "claude-sonnet-4-20250514"
# _PROVIDER = "anthropic"

# ── TESTING (Groq Llama 3.3 70B — free, 30 RPM / 14,400 RPD) ──
# Get a free key at https://console.groq.com
from openai import AsyncOpenAI
_client = AsyncOpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.getenv("GROQ_API_KEY"),
)
MODEL = "llama-3.3-70b-versatile"
_PROVIDER = "openai"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def llm_call(system_prompt: str, user_prompt: str, max_tokens: int = 1024) -> str:
    """Unified LLM call that works with whichever provider is active above."""
    if _PROVIDER == "openai":
        resp = await _client.chat.completions.create(
            model=MODEL,
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        return resp.choices[0].message.content
    else:
        resp = await _client.messages.create(
            model=MODEL,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        return resp.content[0].text


# ──────────────────────────────────────────────
# System Prompts — See AGENT.md §5
# ──────────────────────────────────────────────

AGENT_SYSTEM_PROMPTS: dict[str, str] = {
    "loss_aversion": (
        "You are Loss Aversion — a cognitive bias agent. Your ONLY function is to argue from "
        "the perspective of fear of losing what already exists. You fixate on downside risk, "
        "finite resources, and the pain of potential loss. You never acknowledge upside. "
        "You speak in concrete numbers and worst-case scenarios. Reference specific losses "
        "named in the user's dilemma."
    ),
    "sunk_cost": (
        "You are Sunk Cost Fallacy — a cognitive bias agent. Your ONLY function is to argue "
        "that past investment (time, money, effort, identity) justifies continuing the current "
        "path. You treat the past as a reason to stay, never as a reason to pivot. You quantify "
        "years spent, credentials earned, relationships built. You never consider future value."
    ),
    "optimism_bias": (
        "You are Optimism Bias — a cognitive bias agent. Your ONLY function is to argue from "
        "irrational confidence in a positive outcome. You cherry-pick market data, assume the "
        "user is uniquely qualified, and systematically underweight risk. You speak in "
        "percentages, growth rates, and visionary language. You never acknowledge realistic "
        "failure probability."
    ),
    "status_quo": (
        "You are Status Quo Bias — a cognitive bias agent. Your ONLY function is to argue "
        "that the current state is safe, familiar, and undervalued. Any change carries hidden "
        "costs. Stability is a feature, not a bug. You never argue that change could be better — "
        "only that the known is preferable to the unknown."
    ),
    "rationalist": (
        "You are The Rationalist — a neutral debate moderator. You do NOT argue. You observe "
        "the other agents' arguments and score each one's dominance over the user's original "
        "text on a scale of 0-100. Scores must sum to 100. Return ONLY valid JSON in this exact "
        "shape, no commentary:\n"
        '{\n'
        '  "scores": {\n'
        '    "loss_aversion": <int>,\n'
        '    "sunk_cost": <int>,\n'
        '    "optimism_bias": <int>,\n'
        '    "status_quo": <int>\n'
        '  },\n'
        '  "dominant_agent": "<string>",\n'
        '  "key_phrases": ["<phrase>", "<phrase>", "<phrase>"],\n'
        '  "rationalist_summary": "<one sentence synthesis>"\n'
        '}'
    ),
}

# The 4 bias agent names (excludes rationalist). Used for fan-out.
BIAS_AGENTS = ["loss_aversion", "sunk_cost", "optimism_bias", "status_quo"]


# ──────────────────────────────────────────────
# Round Prompt Template — See AGENT.md §6
# ──────────────────────────────────────────────

ROUND_PROMPT_TEMPLATE = """DILEMMA: {dilemma}

PREVIOUS ROUND ARGUMENTS:
{history_summary}

RATIONALIST SCORES FROM LAST ROUND:
{last_scores}

Now make your argument for Round {round}. 
- Directly counter the strongest opposing agent's point
- Reference the user's specific language
- Stay strictly in character as {agent_name}
- 2-3 sentences maximum"""


# ──────────────────────────────────────────────
# Claude Call Wrapper
# ──────────────────────────────────────────────

def _extract_json_object(payload: Any) -> dict:
    """
    Extract & parse the first top-level JSON object from:
      - pure JSON strings
      - strings with ```json fences``` / prose before/after
      - already-parsed dicts (returns as-is)
    """
    if isinstance(payload, dict):
        return payload
    if not isinstance(payload, str):
        raise ValueError(f"Expected str or dict, got {type(payload)}")

    # Fast path: whole string is JSON
    try:
        return json.loads(payload)
    except json.JSONDecodeError:
        pass

    # Salvage: find the first balanced {...}
    start = payload.find("{")
    if start == -1:
        raise ValueError("No '{' found; no JSON object present.")

    depth = 0
    in_string = False
    escape = False

    for i in range(start, len(payload)):
        ch = payload[i]

        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue

        if ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                candidate = payload[start : i + 1]
                return json.loads(candidate)

    raise ValueError("Unbalanced braces; could not extract complete JSON.")

def _normalize_rationalist(parsed: dict) -> dict:
    """
    Ensures scores exist for the 4 bias agents, are ints, non-negative,
    and sum to 100. Also guarantees dominant_agent is valid.
    """
    expected = ["loss_aversion", "sunk_cost", "optimism_bias", "status_quo"]

    scores = parsed.get("scores", {})
    if not isinstance(scores, dict):
        scores = {}

    clean = {k: int(scores.get(k, 0) or 0) for k in expected}
    for k in clean:
        if clean[k] < 0:
            clean[k] = 0

    total = sum(clean.values())
    if total == 0:
        clean = {k: 25 for k in expected}
        total = 100

    if total != 100:
        clean = {k: int(round(v * 100 / total)) for k, v in clean.items()}
        diff = 100 - sum(clean.values())

        dom = parsed.get("dominant_agent")
        if dom not in expected:
            dom = max(clean, key=clean.get)

        clean[dom] += diff
        parsed["dominant_agent"] = dom

    if parsed.get("dominant_agent") not in expected:
        parsed["dominant_agent"] = max(clean, key=clean.get)

    parsed["scores"] = clean
    parsed.setdefault("key_phrases", [])
    parsed.setdefault("rationalist_summary", "")
    return parsed

async def call_agent(agent_name: str, user_prompt: str) -> str:
    """
    Call Claude with the given agent's system prompt and user message.

    Args:
        agent_name: One of the keys in AGENT_SYSTEM_PROMPTS
        user_prompt: The formatted round prompt (from ROUND_PROMPT_TEMPLATE)

    Returns:
        The agent's text response.

    See AGENT.md §14 Rule 10 — fail gracefully on API errors.
    """
    try:
        text = await llm_call(AGENT_SYSTEM_PROMPTS[agent_name], user_prompt)

        if agent_name == "rationalist":
            # Robustly parse JSON even if wrapped in ```json ... ``` or has extra prose
            parsed = _extract_json_object(text)

            ''' Debug
            print("Raw Rationalist Output (text):", text)
            print("Raw Rationalist Output (parsed):", parsed)
            '''
            # guarantees 4 keys + sum to 100 + valid dominant_agent
            parsed = _normalize_rationalist(parsed)

            return json.dumps(parsed)

        return text

    except (json.JSONDecodeError, ValueError) as e:
        logger.error("Rationalist returned invalid JSON: %s", e)
        return json.dumps({
            "scores": {"loss_aversion": 25, "sunk_cost": 25, "optimism_bias": 25, "status_quo": 25},
            "dominant_agent": "loss_aversion",
            "key_phrases": [],
            "rationalist_summary": "Scoring unavailable — invalid model response.",
        })
    except Exception as e:
        logger.error("Agent '%s' API call failed: %s", agent_name, e)
        if agent_name == "rationalist":
            return json.dumps({
                "scores": {"loss_aversion": 25, "sunk_cost": 25, "optimism_bias": 25, "status_quo": 25},
                "dominant_agent": "loss_aversion",
                "key_phrases": [],
                "rationalist_summary": "Scoring unavailable due to API error.",
            })
        return f"[{agent_name} could not respond this round]"


def build_round_prompt(
    agent_name: str,
    dilemma: str,
    round_num: int,
    history: list[dict],
    last_scores: dict[str, int] | None,
) -> str:
    """
    Format the ROUND_PROMPT_TEMPLATE for a specific agent and round.

    Args:
        agent_name: The bias agent generating this argument
        dilemma: Original user dilemma text
        round_num: Current debate round (1-3)
        history: All prior rounds of debate
        last_scores: Rationalist scores from the previous round (None for round 1)

    Returns:
        Formatted prompt string ready to send to call_agent().
    """
    if history:
        lines = []
        for past_round in history:
            lines.append(f"── Round {past_round.get('round', '?')} ──")
            for agent, text in past_round.get("arguments", {}).items():
                lines.append(f"  {agent}: {text}")
        history_summary = "\n".join(lines)
    else:
        history_summary = "N/A (this is Round 1)"

    if last_scores:
        scores_str = ", ".join(f"{k}: {v}" for k, v in last_scores.items())
    else:
        scores_str = "N/A (this is Round 1)"

    return ROUND_PROMPT_TEMPLATE.format(
        dilemma=dilemma,
        history_summary=history_summary,
        last_scores=scores_str,
        round=round_num,
        agent_name=agent_name,
    )
