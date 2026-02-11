<p align="center">
  <img src="frontend/public/sprintr-logo.png" alt="Sprintr" width="280" />
</p>

<p align="center">
  <strong>Turn user interviews into sprint-ready GitHub issues in minutes, not days.</strong>
</p>

<p align="center">
  Upload a recording or paste a transcript. Sprintr transcribes, extracts product insights, finds relevant documentation, generates implementation guides, creates GitHub issues — and can even start building them with an AI agent.
</p>

<p align="center">
  <a href="https://youtu.be/4jvxkSsN8Zs?si=5jpKAeiVnMeofOyT">Watch the demo</a> · Built at the Continual Learning Hackathon 2026
</p>

---

## How It Works

Sprintr runs a 4-stage AI pipeline that takes raw user interview data and produces actionable, enriched GitHub issues:

```
  Audio / Pasted Transcript
            │
            ▼
   ┌─────────────────┐
   │  Transcription   │  OpenAI gpt-4o-transcribe-diarize
   │                  │  Speaker diarization + timestamped segments
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │    Analysis      │  Claude Sonnet 4.5 (structured outputs)
   │                  │  Categorized insights with severity & evidence quotes
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │   Enrichment     │  You.com search + Gemini Flash (parallel)
   │                  │  Implementation guides backed by real documentation
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │  Issue Creation  │  Composio / GitHub REST API
   │                  │  Formatted issues with labels & severity
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │  Build with AI   │  Claude Agent SDK (optional)
   │                  │  Implements the issue → opens a PR
   └─────────────────┘
```

Each stage has its own API endpoint, or use `POST /pipeline` to run everything end-to-end.

## Features

- **Audio & text input** — Upload MP3/WAV/M4A/WebM files (up to 25 MB) with drag-and-drop, or paste a transcript directly
- **Speaker diarization** — Automatically identifies and labels different speakers in audio recordings
- **Structured insight extraction** — Claude identifies pain points, feature requests, workflow issues, positive feedback, and points of confusion, each with severity levels and supporting evidence
- **Inline editing** — Review and refine every insight before creating issues. Toggle individual insights on/off, edit titles, descriptions, and suggested actions
- **Filter & sort** — Filter insights by category and severity to focus on what matters
- **Doc-backed implementation guides** — Each insight is enriched with relevant documentation found via You.com search and summarized by Gemini into actionable implementation steps
- **One-click GitHub issues** — Creates formatted, labeled issues on your repo with severity indicators, evidence quotes, implementation guides, and search references
- **Build with AI** — After issues are created, trigger a Claude agent to implement the issue, commit code, and open a pull request — with real-time streaming logs
- **3-step wizard UI** — Clean, guided flow: Input → Insights Review → Sprint Output

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | FastAPI 0.115.6, Python 3.14, Pydantic 2.11 |
| **Frontend** | React 19, TypeScript, Vite 7, Tailwind CSS 4 |
| **Transcription** | OpenAI gpt-4o-transcribe-diarize |
| **Analysis** | Claude Sonnet 4.5 (structured outputs) |
| **Doc Search** | You.com Web Search API |
| **Summarization** | Google Gemini 3 Flash |
| **Implementation Agent** | Claude Agent SDK |
| **GitHub Integration** | Composio (primary) + GitHub REST API (fallback) |
| **Icons** | Lucide React |

## Getting Started

### Prerequisites

- Python 3.14+
- Node.js 18+
- API keys for OpenAI, Anthropic, You.com, and Google Gemini
- A GitHub repository to create issues in (with Composio configured or a PAT)

### 1. Clone the repo

```bash
git clone https://github.com/sskarz/Continual-Learning-Hackathon-2026.git
cd Continual-Learning-Hackathon-2026
```

### 2. Set up the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Copy the environment template and fill in your keys:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | Audio transcription |
| `ANTHROPIC_API_KEY` | Yes | Insight analysis + Build with AI |
| `YDC_API_KEY` | Yes | Documentation search |
| `GEMINI_API_KEY` | Yes | Implementation guide generation |
| `GITHUB_OWNER` | Yes | GitHub org or username |
| `GITHUB_REPO` | Yes | Target repository name |
| `COMPOSIO_API_KEY` | No | Composio GitHub integration (primary) |
| `GITHUB_PAT` | No | GitHub Personal Access Token (fallback) |

> You need at least one of `COMPOSIO_API_KEY` or `GITHUB_PAT` for issue creation.

### 3. Set up Composio (optional)

If using Composio as your GitHub integration:

```bash
composio login
composio add github
```

### 4. Prepare GitHub labels

Create these labels on your target repository:

**Categories:** `pain_point` `feature_request` `workflow_issue` `positive_feedback` `confusion`

**Severities:** `critical` `high` `medium` `low`

### 5. Set up the frontend

```bash
cd frontend
npm install
```

### 6. Run both servers

In one terminal:

```bash
cd backend
uvicorn main:app --reload --port 8000
```

In another terminal:

```bash
cd frontend
npm run dev
```

The app will be available at **http://localhost:5173**. The frontend proxies `/api/*` requests to the backend at `http://localhost:8000`.

### 7. Verify

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

Interactive API docs are at **http://localhost:8000/docs**.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/transcribe/audio` | Upload audio file (max 25 MB) |
| `POST` | `/transcribe/text` | Submit pasted transcript |
| `POST` | `/analyze` | Extract insights via Claude structured outputs |
| `POST` | `/enrich` | Search docs + generate implementation guides |
| `POST` | `/create-issues` | Create GitHub issues from enriched insights |
| `POST` | `/pipeline` | Run all 4 stages end-to-end |
| `POST` | `/build` | Start AI agent to implement an issue |
| `GET` | `/build/{id}/stream` | SSE stream of build progress |

### Quick test

```bash
# Paste a transcript
curl -X POST http://localhost:8000/transcribe/text \
  -H "Content-Type: application/json" \
  -d '{"transcript_text": "Speaker A: What frustrates you most?\nSpeaker B: I can never find the export button, it is hidden behind three menus."}'

# Run the full pipeline
curl -X POST http://localhost:8000/pipeline \
  -H "Content-Type: application/json" \
  -d '{"transcript": "Speaker A: What frustrates you most?\nSpeaker B: I can never find the export button, it is hidden behind three menus."}'
```

## Project Structure

```
├── backend/
│   ├── main.py                  # FastAPI app & route definitions
│   ├── config.py                # Environment variable loader
│   ├── models.py                # Pydantic request/response models
│   ├── prompts.py               # Claude system prompt & JSON schema
│   ├── templates.py             # GitHub issue formatting (markdown, emojis)
│   ├── requirements.txt
│   ├── .env.example
│   └── services/
│       ├── transcription.py     # OpenAI audio transcription
│       ├── analysis.py          # Claude structured output analysis
│       ├── enrichment.py        # You.com search + Gemini orchestration
│       ├── gemini_summarizer.py # Gemini implementation guides
│       ├── github_issues.py     # Issue creation (Composio + API fallback)
│       └── agent_builder.py     # Claude Agent SDK for Build with AI
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Root component & state management
│   │   ├── api.ts               # API client (fetch-based)
│   │   ├── types.ts             # TypeScript interfaces
│   │   ├── utils.ts             # Styling constants & helpers
│   │   └── components/
│   │       ├── Sidebar.tsx          # Navigation & progress tracker
│   │       ├── InputSection.tsx     # Audio upload & text input
│   │       ├── InsightsSection.tsx  # Insight review & editing
│   │       ├── OutputSection.tsx    # Created issues & Build with AI
│   │       └── BuildProgressModal.tsx # Real-time build log streaming
│   ├── vite.config.ts           # Vite + React + Tailwind + API proxy
│   └── package.json
│
├── CLAUDE.md                    # Project context for Claude Code
└── README.md
```

## Architecture Notes

- **No database** — all state is in-memory. This is a hackathon project, not production infrastructure.
- **No auth** — the app trusts all requests. Intended for local / demo use.
- **Async everywhere** — the backend uses `asyncio.gather()` for parallel enrichment (search + summarization across all insights simultaneously).
- **Two-tier GitHub integration** — Composio is the primary integration; if unavailable, falls back to raw GitHub REST API via `GITHUB_PAT`.
- **SSE streaming** — Build with AI progress is streamed to the frontend via Server-Sent Events with color-coded log types (status, agent output, tool use, errors, results).

## Team

Built by the Continual Learning team at the 2026 hackathon.

## License

This project was built at a hackathon. No license has been specified yet.
