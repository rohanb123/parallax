"""
Agentic Mirror — Pydantic Request/Response Models
See AGENT.md §7 — API Endpoints

All models mirror the exact JSON shapes defined in AGENT.md.
"""

from pydantic import BaseModel, field_validator
from typing import Optional


# ──────────────────────────────────────────────
# Request Models
# ──────────────────────────────────────────────

class DebateRequest(BaseModel):
    """POST /debate request body. See AGENT.md §7."""
    dilemma: str
    primary_concern: Optional[str] = None
    bias_overrides: Optional[dict[str, int]] = {
        "loss_aversion": 100,
        "sunk_cost": 100,
        "optimism_bias": 100,
        "status_quo": 100,
    }


class EmbeddingsRequest(BaseModel):
    """POST /embeddings request body. Called after debate ends. See AGENT.md §7."""
    sentences: list[str]
    user_input: str


# ──────────────────────────────────────────────
# Response / Event Models
# ──────────────────────────────────────────────

class DialogueTurn(BaseModel):
    """A single agent's argument within a debate round."""
    agent: str
    text: str
    summary: str = ""


class DebateRoundEvent(BaseModel):
    """
    SSE event emitted after each debate round. See AGENT.md §7.
    Contains all agent dialogue, Rationalist scores, and key phrases.
    """
    round: int
    dialogue: list[DialogueTurn]
    scores: dict[str, int]
    dominant_agent: str
    key_phrases: list[str]
    rationalist_summary: str

    @field_validator("scores")
    @classmethod
    def scores_must_sum_to_100(cls, v):
        """See AGENT.md §14 Rule 3 — Scores always sum to 100."""
        total = sum(v.values())
        if total != 100:
            raise ValueError(f"Scores must sum to 100, got {total}")
        return v


class FinalEvent(BaseModel):
    """
    Final SSE event emitted after round 3. See AGENT.md §7.
    Includes the dominant bias and optional bias-corrected recommendation.
    """
    type: str = "final"
    dominant_bias: str
    dominance_percentage: int
    bias_corrected_recommendation: Optional[str] = None
    embedding_snapshot: str = "trigger_fetch"


class EmbeddingPoint(BaseModel):
    """A single point in the 2D PCA-reduced embedding space."""
    x: float
    y: float
    label: str
    agent: str


class EmbeddingsResponse(BaseModel):
    """POST /embeddings response body. See AGENT.md §7."""
    points: list[EmbeddingPoint]
    user_point: dict[str, float]  # {"x": float, "y": float}
    axes: dict[str, str]          # {"x": "Risk vs Safety", "y": "Past vs Future"}
