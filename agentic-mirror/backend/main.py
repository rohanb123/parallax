"""
Agentic Mirror — FastAPI Application Entry Point
See AGENT.md §7 — API Endpoints
See AGENT.md §13 — Environment Setup

Endpoints:
    POST /debate      — Starts a debate session, streams SSE events
    POST /embeddings  — Returns 2D PCA-reduced embedding coordinates

Run locally: uvicorn main:app --reload --port 8000
"""

import json
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv

from schemas import DebateRequest, EmbeddingsRequest, EmbeddingsResponse
from debate_graph import run_debate
from embeddings import embed_texts, reduce_to_2d, label_axes

load_dotenv()

app = FastAPI(
    title="Agentic Mirror",
    description="A cognitive debugger that visualizes hidden biases in human decision-making.",
    version="0.1.0",
)

# CORS — allow frontend dev server (Vite on port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────
# POST /debate — See AGENT.md §7
# ──────────────────────────────────────────────

@app.post("/debate")
async def debate(request: DebateRequest):
    """
    Starts a new multi-agent debate session.

    Streams SSE events — one per round (DebateRoundEvent) and a
    final event (FinalEvent) after round 3.

    Uses Server-Sent Events over WebSockets (AGENT.md §14 Rule 4).
    See AGENT.md §14 Rule 10 for graceful failure handling.
    """

    async def event_stream():
        try:
            async for event in run_debate(request.dilemma, request.bias_overrides, request.primary_concern):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            error_event = {"type": "error", "message": str(e)}
            yield f"data: {json.dumps(error_event)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


# ──────────────────────────────────────────────
# POST /embeddings — See AGENT.md §7
# ──────────────────────────────────────────────

@app.post("/embeddings", response_model=EmbeddingsResponse)
async def embeddings(request: EmbeddingsRequest):
    """
    Called after the debate ends. Embeds debate sentences + user input,
    reduces to 2D via PCA, and returns coordinates for the heatmap.

    See AGENT.md §9 — The Embeddings Pipeline.
    """
    all_texts = request.sentences + [request.user_input]
    raw_embeddings = embed_texts(all_texts)

    coords, pca = reduce_to_2d(raw_embeddings)

    axes = label_axes(
        pca.explained_variance_ratio_,
        pca.components_,
        texts=all_texts,
        embeddings=raw_embeddings,
    )

    points = [
        {"x": coords[i][0], "y": coords[i][1], "label": request.sentences[i], "agent": ""}
        for i in range(len(request.sentences))
    ]

    user_idx = len(request.sentences)
    user_point = {"x": coords[user_idx][0], "y": coords[user_idx][1]}

    return EmbeddingsResponse(points=points, user_point=user_point, axes=axes)


# ──────────────────────────────────────────────
# Health check
# ──────────────────────────────────────────────

@app.get("/health")
async def health():
    """Simple health check for Railway deployment."""
    return {"status": "ok", "project": "agentic-mirror"}


# ──────────────────────────────────────────────
# Entry point — See AGENT.md §13
# ──────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
