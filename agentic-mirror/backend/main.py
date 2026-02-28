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
            async for event in run_debate(request.dilemma, request.bias_overrides):
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
    # TODO: Combine request.sentences + [request.user_input]
    # TODO: Call embed_texts() on the combined list
    # TODO: Call reduce_to_2d() to get 2D coordinates
    # TODO: Label axes via label_axes()
    # TODO: Build and return EmbeddingsResponse with points, user_point, axes
    pass


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
