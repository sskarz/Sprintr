# Interview Sprint Planner

An AI-powered pipeline that turns user interview transcripts into actionable GitHub issues. Upload an audio recording or paste a transcript, and the system automatically extracts product insights, finds relevant documentation, generates implementation guides, and creates ready-to-work GitHub issues.

Built at the Continual Learning Hackathon 2026.

## How It Works

```
Audio / Pasted Text
        |
        v
  Transcription ─── OpenAI gpt-4o-transcribe-diarize (speaker diarization)
        |
        v
    Analysis ─────── Claude Sonnet 4.5 (structured outputs)
        |             Extracts categorized insights with severity & evidence
        v
   Enrichment ────── You.com search + Gemini Flash summarization
        |             Finds docs & generates implementation guides
        v
  GitHub Issues ──── Composio / GitHub REST API
                      Creates formatted issues with labels
```

Each stage has its own API endpoint, or use `POST /pipeline` to run everything end-to-end.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | FastAPI + Uvicorn |
| Transcription | OpenAI gpt-4o-transcribe-diarize |
| Analysis | Claude Sonnet 4.5 (structured outputs) |
| Doc Search | You.com Web Search API |
| Summarization | Google Gemini 3 Flash |
| GitHub Integration | Composio + GitHub REST API fallback |

## Prerequisites

- Python 3.14+
- API keys for: OpenAI, Anthropic, You.com, Google Gemini
- A GitHub repo to create issues in (with a PAT or Composio configured)

## Running the Backend

### 1. Install dependencies

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `backend/.env` and fill in your keys:

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for audio transcription |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for transcript analysis |
| `YDC_API_KEY` | Yes | You.com API key for doc search |
| `GEMINI_API_KEY` | Yes | Google Gemini API key for implementation guides |
| `GITHUB_OWNER` | Yes | GitHub org or username for issue creation |
| `GITHUB_REPO` | Yes | GitHub repo name for issue creation |
| `COMPOSIO_API_KEY` | No | Composio key (primary GitHub integration) |
| `GITHUB_PAT` | No | GitHub Personal Access Token (fallback if Composio unavailable) |

You need at least one of `COMPOSIO_API_KEY` or `GITHUB_PAT` for issue creation to work.

### 3. Set up Composio (optional)

If using Composio for GitHub integration:

```bash
composio login
composio add github
```

### 4. Prepare GitHub labels

Create these labels on your target repo before running the issue creation endpoint:

**Categories:** `pain_point`, `feature_request`, `workflow_issue`, `positive_feedback`, `confusion`

**Severities:** `critical`, `high`, `medium`, `low`

### 5. Start the server

```bash
cd backend
uvicorn main:app --reload --port 8000
```

The server will be available at `http://localhost:8000`.

### 6. Verify

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

Interactive API docs are at `http://localhost:8000/docs`.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/transcribe/audio` | Upload audio file (max 25 MB; mp3, mp4, m4a, wav, webm) |
| `POST` | `/transcribe/text` | Paste transcript text |
| `POST` | `/analyze` | Extract insights from transcript via Claude |
| `POST` | `/enrich` | Search docs + generate implementation guides |
| `POST` | `/create-issues` | Create GitHub issues from enriched insights |
| `POST` | `/pipeline` | Run the full pipeline end-to-end |

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
