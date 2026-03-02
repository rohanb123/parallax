# Parallax

**IrvineHacks 2026** — Multi-agent cognitive bias debugger.

**[Live Demo](put_link)**

---

## What is this?

You describe a dilemma you're stuck on. Four AI agents — each locked into a specific cognitive bias — argue over your words for 3 rounds. A neutral Rationalist scores who's winning. Everything streams live into a 3D visualization so you can actually *see* which bias is pulling hardest on your thinking.

You can then drag sliders to suppress specific biases and re-run the whole thing.

---

## Agents

| Agent | Role | What it does |
|-------|------|--------------|
| **Loss Aversion** | Bias | Fixates on downside risk and worst-case scenarios |
| **Sunk Cost** | Bias | Argues past investment justifies staying the course |
| **Optimism Bias** | Bias | Cherry-picks positive data, underweights risk |
| **Status Quo** | Bias | Argues the current state is safe, change is dangerous |
| **Rationalist** | Moderator | Scores each agent 0–100 (must sum to 100), extracts key phrases |

---

## Tech Stack

**Backend:** FastAPI, LangGraph, Claude Sonnet 4, OpenAI embeddings (`text-embedding-3-small`), scikit-learn (PCA), Python 3.12

**Frontend:** React 18 + Vite, Three.js (`@react-three/fiber`), react-force-graph-3d, D3.js, Framer Motion, Radix UI, Tailwind CSS

**Deployed on:** Netlify (frontend) + Railway (backend)

---

## Project Structure

```
agentic-mirror/
├── backend/
│   ├── main.py              # FastAPI app, /debate + /embeddings
│   ├── agents.py            # Agent prompts + Claude calls
│   ├── debate_graph.py      # LangGraph debate loop
│   ├── embeddings.py        # OpenAI embed + PCA
│   ├── schemas.py           # Pydantic models
│   ├── requirements.txt
│   ├── runtime.txt          # Python 3.12
│   ├── .env.example
│   ├── test_agents_demo.py  # Quick single-round test
│   └── test_full_debate.py  # Full 3-round test
│
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── main.jsx
    │   ├── index.css
    │   ├── hooks/
    │   │   ├── useDebateStream.js
    │   │   └── useEmbeddings.js
    │   ├── components/
    │   │   ├── HomeInputScreen.jsx
    │   │   ├── InputScreen.jsx
    │   │   ├── WorkspaceLayout.jsx
    │   │   ├── Parliament.jsx       # 3D agent spheres
    │   │   ├── AgentSphere.jsx
    │   │   ├── ForceGraph.jsx       # 3D force graph
    │   │   ├── DebateStream.jsx     # Scrolling debate log
    │   │   ├── BiasSliders.jsx      # Override sliders
    │   │   ├── Heatmap.jsx          # D3 embedding scatter
    │   │   ├── ResultBanner.jsx
    │   │   ├── ChatOverlay.jsx
    │   │   ├── HelpPanel.jsx
    │   │   └── StarfieldBackground.jsx
    │   └── utils/
    │       └── agentColors.js
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── tailwind.config.js
```

---

## Setup

### Prerequisites

- Python 3.12+
- Node.js 18+
- Anthropic API key
- OpenAI API key

### Backend

```bash
cd agentic-mirror/backend
python -m venv venv
source venv/bin/activate   # Windows: .\venv\Scripts\Activate
pip install -r requirements.txt

cp .env.example .env
# Fill in ANTHROPIC_API_KEY and OPENAI_API_KEY

uvicorn main:app --reload --port 8000
```

### Frontend (separate terminal)

```bash
cd agentic-mirror/frontend
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies API requests to the backend automatically.

---

## Testing

From `agentic-mirror/backend` with the venv active:

```bash
python test_agents_demo.py      # Single round, ~$0.01
python test_full_debate.py      # Full 3-round debate, ~$0.04
```

---

## How It Works

1. User submits a dilemma via `POST /debate` (SSE stream)
2. 4 bias agents call Claude in parallel, each arguing from their lens
3. Rationalist scores all 4 arguments (scores sum to 100)
4. SSE event fires — frontend updates all visualizations live
5. Repeat for 3 rounds — agents counter each other using full history
6. Final event reveals dominant bias + bias-corrected recommendation
7. Post-debate: sentences get embedded (OpenAI), reduced to 2D (PCA), and plotted on a D3 heatmap

Users can drag bias sliders to suppress/amplify agents and re-run. The graph shifts and a new recommendation comes back.

---

## Background

Grounded in a few ideas from cognitive science:

- **Dual Process Theory** (Kahneman) — bias agents act as System 1, the Rationalist as System 2
- **Internal Family Systems** — each agent is a sub-personality with a narrow lens
- **Externalization** — seeing a bias on screen reduces its emotional grip
- **Digital Phenotyping** — the embeddings pipeline creates a linguistic fingerprint of the user's decision-making patterns

---

## API

### `POST /debate`

Streams SSE events (one per round + a final event).

```json
// request
{
  "dilemma": "Should I quit my job to start a VR meditation company?",
  "bias_overrides": { "loss_aversion": 100, "sunk_cost": 100, "optimism_bias": 100, "status_quo": 100 }
}

// round event
{
  "round": 2,
  "dialogue": [
    { "agent": "loss_aversion", "text": "Your $50k disappears in 14 months..." },
    { "agent": "optimism_bias", "text": "VR meditation CAGR is 34% through 2028..." }
  ],
  "scores": { "loss_aversion": 78, "sunk_cost": 12, "optimism_bias": 8, "status_quo": 2 },
  "dominant_agent": "loss_aversion",
  "key_phrases": ["$50k", "14 months", "wasting my life"],
  "rationalist_summary": "Fear of financial loss is overwhelming forward-looking analysis."
}
```

### `POST /embeddings`

Returns 2D PCA coordinates for the heatmap.

```json
// request
{ "sentences": ["sentence1", "sentence2"], "user_input": "original dilemma text" }

// response
{
  "points": [{ "x": 0.3, "y": -0.7, "label": "fear of savings loss", "agent": "loss_aversion" }],
  "user_point": { "x": 0.25, "y": -0.65 },
  "axes": { "x": "Risk vs Safety", "y": "Past vs Future" }
}
```

---

## Team

Built at **IrvineHacks 2026**
 