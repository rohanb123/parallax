# Agentic Mirror

A cognitive debugger that visualizes hidden biases in human decision-making using multi-agent AI debate.

## How It Works

The user describes a dilemma they're facing. Four AI bias agents argue over the user's words, a neutral Rationalist scores who's winning, and the results are visualized in real time.

### Full Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│  FRONTEND (React + Vite, port 5173)                                │
│                                                                     │
│  1. User types a dilemma into InputScreen                          │
│     "I've spent 4 years in law school but I want to start a        │
│      startup. My savings would only last 6 months..."              │
│                                                                     │
│  2. App calls useDebateStream.startDebate(dilemma, biasOverrides)  │
│     → POST /debate as SSE stream                                   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BACKEND (FastAPI, port 8000)                                      │
│                                                                     │
│  3. /debate endpoint initializes DebateState and runs the          │
│     LangGraph debate graph (3 rounds, streamed via SSE)            │
│                                                                     │
│  ┌─── ROUND 1 ──────────────────────────────────────────────────┐  │
│  │                                                               │  │
│  │  4. Parallel Fan-Out — 4 bias agents call Claude Sonnet 4     │  │
│  │     simultaneously, each with their own system prompt:        │  │
│  │                                                               │  │
│  │     ┌──────────────┐  ┌──────────────┐                       │  │
│  │     │Loss Aversion │  │  Sunk Cost   │                       │  │
│  │     │ "Your 6-month│  │ "You've spent│                       │  │
│  │     │  runway is a │  │  4 years in  │                       │  │
│  │     │  death clock" │  │  law school" │                       │  │
│  │     └──────┬───────┘  └──────┬───────┘                       │  │
│  │            │                 │                                │  │
│  │     ┌──────┴───────┐  ┌─────┴────────┐                       │  │
│  │     │  Optimism    │  │  Status Quo  │                       │  │
│  │     │  Bias        │  │  Bias        │                       │  │
│  │     │ "Startups    │  │ "Your law    │                       │  │
│  │     │  have 10x    │  │  career is   │                       │  │
│  │     │  upside!"    │  │  stable"     │                       │  │
│  │     └──────┬───────┘  └──────┬───────┘                       │  │
│  │            │                 │                                │  │
│  │            └────────┬────────┘                                │  │
│  │                     ▼                                         │  │
│  │  5. Fan-In — The Rationalist receives all 4 arguments         │  │
│  │     and scores each agent's dominance over the user's         │  │
│  │     original text (scores must sum to 100):                   │  │
│  │                                                               │  │
│  │     {                                                         │  │
│  │       "scores": {                                             │  │
│  │         "loss_aversion": 35,                                  │  │
│  │         "sunk_cost": 30,                                      │  │
│  │         "optimism_bias": 15,                                  │  │
│  │         "status_quo": 20                                      │  │
│  │       },                                                      │  │
│  │       "dominant_agent": "loss_aversion",                      │  │
│  │       "key_phrases": ["savings", "only last", "6 months"],    │  │
│  │       "rationalist_summary": "Fear of financial ruin is       │  │
│  │         the strongest undercurrent in this decision."          │  │
│  │     }                                                         │  │
│  │                                                               │  │
│  │  6. Emit SSE event → DebateRoundEvent                         │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  7. Rounds 2 & 3 repeat the same loop. Each round, agents          │
│     receive the full history + last scores, so they counter        │
│     each other's arguments and fight for dominance.                │
│                                                                     │
│  8. After Round 3 → emit FinalEvent with dominant bias,            │
│     dominance %, and a bias-corrected recommendation.              │
│                                                                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  FRONTEND — Real-Time Visualization (during debate)                │
│                                                                     │
│  9. useDebateStream parses each SSE event and updates React state  │
│                                                                     │
│  ┌─────────────┐  ┌──────────────────┐  ┌───────────────────┐      │
│  │  Parliament  │  │   Force Graph    │  │   Bias Sliders    │      │
│  │  (Three.js)  │  │   (3D nodes)     │  │   (Radix UI)      │      │
│  │              │  │                  │  │                   │      │
│  │  3D spheres  │  │  User node gets  │  │  0-100% per agent │      │
│  │  grow/shrink │  │  pulled toward   │  │  Drag to override │      │
│  │  by score    │  │  dominant agent  │  │  and re-run       │      │
│  └─────────────┘  └──────────────────┘  └───────────────────┘      │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  Debate Stream — scrolling chat log of agent arguments   │      │
│  │  Color-coded by agent, animated with Framer Motion       │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                        After Round 3
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  EMBEDDINGS PIPELINE (post-debate)                                 │
│                                                                     │
│  10. Frontend collects all agent sentences + user input             │
│      → POST /embeddings                                            │
│                                                                     │
│  11. Backend pipeline:                                              │
│      a. embed_texts() — OpenAI text-embedding-3-small              │
│         Converts each sentence to a 1536-dim vector                │
│      b. reduce_to_2d() — PCA(n_components=2)                       │
│         Projects 1536-dim → 2D coordinates                         │
│      c. label_axes() — Claude names each axis                      │
│         e.g. "Risk vs Safety" / "Past vs Future"                   │
│                                                                     │
│  12. Returns EmbeddingsResponse:                                    │
│      { points: [{x, y, label, agent}, ...],                        │
│        user_point: {x, y},                                         │
│        axes: {x: "Risk vs Safety", y: "Past vs Future"} }         │
│                                                                     │
│  13. Heatmap component renders a D3 scatter plot:                   │
│      - Agent sentences plotted as colored dots                      │
│      - User's words plotted as a highlighted marker                 │
│      - Shows which bias cluster the user's language falls into     │
│                                                                     │
│  14. ResultBanner reveals the dominant bias, percentage,            │
│      and a bias-corrected recommendation.                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### The Five Agents

| Agent | Role | Perspective |
|-------|------|-------------|
| **Loss Aversion** | Bias agent | Fixates on downside risk, worst-case scenarios, fear of losing what you have |
| **Sunk Cost** | Bias agent | Argues past investment (time, money, identity) justifies staying the course |
| **Optimism Bias** | Bias agent | Cherry-picks positive data, assumes the user is uniquely capable |
| **Status Quo** | Bias agent | Argues the current state is safe and any change carries hidden costs |
| **Rationalist** | Moderator | Scores each agent's dominance (0-100, sum=100), extracts key phrases |

### Key Design Decisions

- **3 rounds exactly** — enough for agents to counter each other, not so many that costs spike
- **Scores always sum to 100** — forces relative comparison, not absolute
- **SSE over WebSockets** — simpler protocol, one-directional streaming is all we need
- **PCA over UMAP by default** — fast, deterministic, good enough for visualization
- **Bias sliders** — users can suppress/amplify specific agents and re-run the debate

## Tech Stack

### Backend
- **FastAPI** — async API with SSE streaming
- **LangGraph** — multi-agent orchestration (parallel fan-out, join, conditional loop)
- **Claude Sonnet 4** (`claude-sonnet-4-20250514`) — powers all 5 agents
- **OpenAI** (`text-embedding-3-small`) — sentence embeddings for the heatmap
- **scikit-learn** — PCA dimensionality reduction

### Frontend
- **React 18** + **Vite** — fast dev server with HMR
- **Three.js** (`@react-three/fiber`) — 3D Parliament sphere visualization
- **react-force-graph-3d** — force-directed agent influence graph
- **D3.js** — 2D embedding heatmap/scatter plot
- **Framer Motion** — animated debate stream
- **Radix UI** — accessible bias slider controls
- **Tailwind CSS** — dark-mode-only styling

## Project Structure

```
agentic-mirror/
├── backend/
│   ├── main.py              # FastAPI app — /debate (SSE) + /embeddings
│   ├── agents.py            # 5 agent system prompts + Claude API wrapper
│   ├── debate_graph.py      # LangGraph debate loop (fan-out → join → loop)
│   ├── embeddings.py        # OpenAI embeddings + PCA + axis labeling
│   ├── schemas.py           # Pydantic request/response models
│   ├── requirements.txt     # Python dependencies
│   └── .env                 # API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY)
│
└── frontend/
    ├── src/
    │   ├── App.jsx              # Root — phase management (input/debating/result)
    │   ├── main.jsx             # React entry point
    │   ├── index.css            # Tailwind + dark mode base styles
    │   ├── hooks/
    │   │   ├── useDebateStream.js   # SSE consumer — parses debate events
    │   │   └── useEmbeddings.js     # Fetches 2D embedding coordinates
    │   ├── components/
    │   │   ├── InputScreen.jsx      # Dilemma text input + keyword highlighting
    │   │   ├── WorkspaceLayout.jsx  # 3-panel debate visualization layout
    │   │   ├── Parliament.jsx       # Three.js canvas — 5 agent spheres
    │   │   ├── AgentSphere.jsx      # Individual sphere (size = score)
    │   │   ├── ForceGraph.jsx       # 3D force graph — user pulled by agents
    │   │   ├── DebateStream.jsx     # Scrolling color-coded debate log
    │   │   ├── BiasSliders.jsx      # 0-100% sliders to override bias weights
    │   │   ├── Heatmap.jsx          # D3 scatter — embeddings in PCA space
    │   │   └── ResultBanner.jsx     # Final dominant bias reveal
    │   └── utils/
    │       └── agentColors.js       # Agent colors, names, keys
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── tailwind.config.js
```

## Running Locally

You need **two terminals** running simultaneously.

### Terminal 1 — Backend (port 8000)
```bash
cd agentic-mirror/backend
pip install -r requirements.txt
# Add your ANTHROPIC_API_KEY and OPENAI_API_KEY to .env
uvicorn main:app --reload --port 8000
```

### Terminal 2 — Frontend (port 5173)
```bash
cd agentic-mirror/frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. The frontend proxies `/debate` and `/embeddings` to the backend automatically.

### Test Scripts (no frontend needed)
```bash
cd agentic-mirror/backend
python test_agents_demo.py      # Single round, 5 API calls, ~$0.01
python test_full_debate.py      # Full 3-round debate, 16 API calls, ~$0.04
```
