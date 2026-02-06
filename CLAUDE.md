# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Interview Sprint Planner** — a FastAPI backend that converts user interview transcripts into actionable GitHub issues via a multi-LLM pipeline. No database, no auth, in-memory only. Hackathon project.

## Commands

```bash
# Setup
cd backend && pip install -r requirements.txt
cp .env.example .env  # then fill in API keys

# Composio setup (one-time, interactive)
composio login && composio add github

# Run server
cd backend && uvicorn main:app --reload --port 8000
# OR: cd backend && python main.py

# Health check
curl http://localhost:8000/health

# API docs
open http://localhost:8000/docs
```

No test suite, linter, or CI configured yet.

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

The pipeline flows through 4 stages, each with a dedicated endpoint and service:

```
Audio/Text → Transcription → Analysis → Enrichment → GitHub Issues
```

1. **Transcription** (`/transcribe/audio`, `/transcribe/text`) — OpenAI `gpt-4o-transcribe-diarize` for audio with speaker diarization; simple text parser for pasted transcripts.
2. **Analysis** (`/analyze`) — Claude `claude-sonnet-4-5-20250929` with structured outputs extracts categorized insights (pain points, feature requests, etc.) with severity and evidence quotes.
3. **Enrichment** (`/enrich`) — Parallel You.com web searches per insight, then parallel Gemini `gemini-3-flash-preview` summarization to produce implementation guides.
4. **Issue Creation** (`/create-issues`) — Creates GitHub issues via Composio (primary) with raw GitHub API fallback. Sequential to avoid rate limits.

`POST /pipeline` runs all 4 stages end-to-end in a single call.

### Code Layout

All backend code is in `backend/`. The `frontend/` directory is a placeholder.

- `main.py` — FastAPI app, all route definitions, CORS middleware
- `config.py` — loads env vars via `python-dotenv`
- `models.py` — all Pydantic request/response models and enums
- `prompts.py` — Claude system prompt and JSON schema for structured outputs
- `templates.py` — GitHub issue title/body formatting
- `services/` — one module per pipeline stage:
  - `transcription.py` — OpenAI transcribe + text parser
  - `analysis.py` — Claude structured output analysis
  - `enrichment.py` — You.com search + orchestrates Gemini summarization
  - `gemini_summarizer.py` — Gemini implementation guide generation
  - `github_issues.py` — Composio + GitHub API issue creation

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
- Labels used in issues (`pain_point`, `feature_request`, `workflow_issue`, etc. + severity levels) must already exist on the target repo
- Issues created sequentially to preserve order and avoid rate limits

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | FastAPI 0.115.6 + Uvicorn |
| Language | Python 3.14, Pydantic 2.11 |
| Transcription | OpenAI gpt-4o-transcribe-diarize |
| Analysis | Claude Sonnet 4.5 (structured outputs) |
| Doc Search | You.com Web Search API |
| Summarization | Google Gemini 3 Flash |
| GitHub | Composio + raw GitHub REST API fallback |
| HTTP Client | httpx (async) |
