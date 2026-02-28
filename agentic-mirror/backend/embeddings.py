"""
Agentic Mirror — Embeddings + PCA Pipeline
See AGENT.md §9 — The Embeddings Pipeline

Uses OpenAI text-embedding-3-small for embedding generation.
PCA is the default dimensionality reduction (AGENT.md §14 Rule 9).
UMAP available as optional upgrade, not default.
"""

import logging
import os

import numpy as np
from anthropic import Anthropic
from openai import OpenAI
from sklearn.decomposition import PCA
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
anthropic_client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Generate embeddings for a list of text strings using OpenAI.

    Args:
        texts: List of sentences/phrases to embed.

    Returns:
        List of embedding vectors (each is a list of floats).

    See AGENT.md §9 — uses text-embedding-3-small model.
    """
    try:
        response = openai_client.embeddings.create(
            input=texts,
            model="text-embedding-3-small",
        )
        return [item.embedding for item in response.data]
    except Exception as e:
        logger.error("Embedding API call failed: %s", e)
        raise


def reduce_to_2d(embeddings: list[list[float]]) -> list[tuple[float, float]]:
    """
    Reduce high-dimensional embeddings to 2D using PCA.

    Args:
        embeddings: List of embedding vectors from embed_texts().

    Returns:
        List of (x, y) tuples in 2D PCA space.

    See AGENT.md §14 Rule 9 — PCA first (fast, deterministic).
    """
    # TODO: Convert to numpy array
    # TODO: Fit PCA(n_components=2) and transform
    # TODO: Return as list of tuples
    pass


def reduce_to_2d_umap(embeddings: list[list[float]]) -> list[tuple[float, float]]:
    """
    Optional: Reduce to 2D using UMAP (slower, non-deterministic, better clusters).
    Not the default — see AGENT.md §14 Rule 9.

    Args:
        embeddings: List of embedding vectors.

    Returns:
        List of (x, y) tuples in 2D UMAP space.
    """
    # TODO: Import umap
    # TODO: Fit UMAP(n_components=2) and transform
    # TODO: Return as list of tuples
    pass


def label_axes(
    variance_ratio: np.ndarray,
    components: np.ndarray,
    texts: list[str] | None = None,
    embeddings: np.ndarray | None = None,
) -> dict[str, str]:
    """
    Name the PCA axes based on top-loading sentences.

    Args:
        variance_ratio: PCA explained variance ratio.
        components: PCA component loadings.
        texts: Original sentences (optional, enables Claude-based labeling).
        embeddings: Original embedding matrix (optional, used with texts).

    Returns:
        {"x": "Risk vs Safety", "y": "Past vs Future"} (example).

    See AGENT.md §9 — uses a fast Claude call to name axes based on
    top-loading sentences in each principal component.
    """
    if texts is None or embeddings is None:
        return {
            "x": f"PC1 ({variance_ratio[0]:.0%} variance)",
            "y": f"PC2 ({variance_ratio[1]:.0%} variance)",
        }

    emb_array = np.array(embeddings)
    projections = emb_array @ components.T  # (n_texts, 2)

    axis_labels = {}
    for i, axis in enumerate(["x", "y"]):
        ranked = np.argsort(np.abs(projections[:, i]))[::-1]
        top_texts = [texts[j] for j in ranked[:5]]
        positive = [texts[j] for j in ranked[:5] if projections[j, i] > 0]
        negative = [texts[j] for j in ranked[:5] if projections[j, i] < 0]

        try:
            prompt = (
                f"These sentences load POSITIVELY on a PCA axis:\n"
                f"{positive}\n\n"
                f"These sentences load NEGATIVELY:\n"
                f"{negative}\n\n"
                f"Name this axis as 'Concept A vs Concept B' (max 5 words total). "
                f"Return ONLY the axis name, nothing else."
            )
            response = anthropic_client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=30,
                messages=[{"role": "user", "content": prompt}],
            )
            axis_labels[axis] = response.content[0].text.strip()
        except Exception as e:
            logger.warning("Claude axis labeling failed for %s: %s", axis, e)
            axis_labels[axis] = f"PC{i+1} ({variance_ratio[i]:.0%} variance)"

    return axis_labels
