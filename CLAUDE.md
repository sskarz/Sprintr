# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Interview Sprint Planner** — converts user interview transcripts into actionable GitHub issues via a multi-LLM pipeline. FastAPI backend + React/Vite frontend. No database, no auth, in-memory only. Hackathon project.

## Commands

```bash
# Backend setup
cd backend && pip install -r requirements.txt
cp .env.example .env  # then fill in API keys

# Composio setup (one-time, interactive)
composio login && composio add github

# Run backend
cd backend && uvicorn main:app --reload --port 8000
# OR: cd backend && python main.py

# Frontend setup & dev
cd frontend && npm install
cd frontend && npm run dev        # starts on http://localhost:5173
cd frontend && npm run build      # production build (runs tsc then vite build)
cd frontend && npm run lint       # eslint

# Health check
curl http://localhost:8000/health

# API docs (Swagger UI)
open http://localhost:8000/docs
```

No test suite or CI configured yet.

## Required Environment Variables

All in `backend/.env` (see `.env.example`):
- `OPENAI_API_KEY` — GPT-4o audio transcription
- `ANTHROPIC_API_KEY` — Claude Sonnet 4.5 analysis
- `YDC_API_KEY` — You.com web search
- `GEMINI_API_KEY` — Gemini Flash implementation guides
- `GITHUB_OWNER`, `GITHUB_REPO` — target repo for issues
- `COMPOSIO_API_KEY` (optional) — Composio GitHub integration
- `GITHUB_PAT` (optional) — fallback for GitHub API if Composio unavailable

## Architecture

### Pipeline (4 stages)

```
Audio/Text → Transcription → Analysis → Enrichment → GitHub Issues
```

1. **Transcription** (`/transcribe/audio`, `/transcribe/text`) — OpenAI `gpt-4o-transcribe-diarize` for audio with speaker diarization; simple text parser for pasted transcripts.
2. **Analysis** (`/analyze`) — Claude `claude-sonnet-4-5-20250929` with structured outputs extracts categorized insights (pain points, feature requests, etc.) with severity and evidence quotes.
3. **Enrichment** (`/enrich`) — Parallel `asyncio.gather()` for You.com web searches per insight, then parallel Gemini `gemini-3-flash-preview` summarization to produce implementation guides.
4. **Issue Creation** (`/create-issues`) — Creates GitHub issues via Composio (primary) with raw GitHub API fallback. Sequential to avoid rate limits.

`POST /pipeline` runs all 4 stages end-to-end in a single call.

### Frontend ↔ Backend Integration

The frontend calls `/api/*` which Vite's dev proxy (`vite.config.ts`) rewrites to `http://localhost:8000/*`. Both servers must be running during development. The frontend drives a 3-step wizard: input → insights review/edit → output (created issues).

API client lives in `frontend/src/api.ts` — all calls use `fetch` with the `/api` prefix.

### Backend Code Layout (`backend/`)

- `main.py` — FastAPI app, all route definitions, CORS middleware (allows all origins)
- `config.py` — loads env vars via `python-dotenv` at import time; fails loudly if required keys missing
- `models.py` — all Pydantic request/response models and enums
- `prompts.py` — Claude system prompt and JSON schema for structured outputs
- `templates.py` — GitHub issue title/body formatting (severity emojis, markdown sections)
- `services/` — one module per pipeline stage:
  - `transcription.py` — OpenAI transcribe + text parser
  - `analysis.py` — Claude structured output analysis
  - `enrichment.py` — You.com search + orchestrates Gemini summarization (parallel via `asyncio.gather`)
  - `gemini_summarizer.py` — Gemini implementation guide generation
  - `github_issues.py` — Composio + GitHub API issue creation (two-tier fallback)

### Frontend Code Layout (`frontend/src/`)

- `App.tsx` — root component, manages single `AppState` via `useState`, orchestrates pipeline calls
- `api.ts` — API client functions (all endpoints)
- `types.ts` — TypeScript types mirroring backend Pydantic models
- `utils.ts` — styling constants
- `components/` — `Sidebar.tsx` (nav/progress), `InputSection.tsx` (audio/text input), `InsightsSection.tsx` (insight review with inline editing, filtering), `OutputSection.tsx` (created issues display)

## Critical API Constraints

**Claude Structured Outputs** (`services/analysis.py`):
- Requires beta header: `anthropic-beta: structured-outputs-2025-11-13`
- Must use `output_format` (NOT `output_config`) with this beta
- `additionalProperties: false` required in schema
- Incompatible with message prefilling
- First request with a new schema has ~5-15s compile latency, then cached 24h

**OpenAI Transcription** (`services/transcription.py`):
- `chunking_strategy: "auto"` is mandatory for audio > 30 seconds
- `response_format` must be `"diarized_json"` for speaker labels
- Max file size: 25 MB

**GitHub Issues** (`services/github_issues.py`):
- Labels (`pain_point`, `feature_request`, `workflow_issue`, `positive_feedback`, `confusion` + `critical`, `high`, `medium`, `low`) must already exist on the target repo
- Issues created sequentially to preserve order and avoid rate limits

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | FastAPI 0.115.6 + Uvicorn, Python 3.14, Pydantic 2.11 |
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS 4 |
| Transcription | OpenAI gpt-4o-transcribe-diarize |
| Analysis | Claude Sonnet 4.5 (structured outputs) |
| Doc Search | You.com Web Search API |
| Summarization | Google Gemini 3 Flash |
| GitHub | Composio + raw GitHub REST API fallback |
| HTTP Client | httpx (async, backend), fetch (frontend) |
