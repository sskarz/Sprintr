# BUILD: FastAPI Backend — Interview Sprint Planner

Build a FastAPI backend with 5 endpoints. No database, no auth, no frontend. In-memory only.

## File Structure — Create Exactly This

```
backend/
├── main.py
├── config.py
├── models.py
├── prompts.py
├── templates.py
├── services/
│   ├── __init__.py
│   ├── transcription.py
│   ├── analysis.py
│   ├── enrichment.py
│   └── github_issues.py
├── requirements.txt
└── .env.example
```

---

## `requirements.txt`

```
fastapi==0.115.6
uvicorn==0.34.0
python-multipart==0.0.20
python-dotenv==1.0.1
openai>=1.82.0
anthropic>=0.52.0
httpx>=0.28.0
composio>=0.7.0
pydantic>=2.11.0
```

---

## `.env.example`

```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
YDC_API_KEY=...
COMPOSIO_API_KEY=...
GITHUB_OWNER=your-org
GITHUB_REPO=your-repo
GITHUB_PAT=ghp_...
```

Note: `GITHUB_PAT` is the fallback if Composio auth isn't set up. Include it.

---

## `config.py`

```python
import os
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
YDC_API_KEY = os.environ["YDC_API_KEY"]
GITHUB_OWNER = os.environ["GITHUB_OWNER"]
GITHUB_REPO = os.environ["GITHUB_REPO"]

# Optional — Composio may not be configured
COMPOSIO_API_KEY = os.environ.get("COMPOSIO_API_KEY", "")
GITHUB_PAT = os.environ.get("GITHUB_PAT", "")
```

---

## `models.py`

```python
from pydantic import BaseModel
from typing import Optional
from enum import Enum


class TranscriptSegment(BaseModel):
    speaker: str
    text: str
    start: float
    end: float


class TranscribeRequest(BaseModel):
    transcript_text: str


class TranscribeResponse(BaseModel):
    segments: list[TranscriptSegment]
    raw_text: str


class InsightCategory(str, Enum):
    pain_point = "pain_point"
    feature_request = "feature_request"
    workflow_issue = "workflow_issue"
    positive_feedback = "positive_feedback"
    confusion = "confusion"


class InsightSeverity(str, Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


class Insight(BaseModel):
    id: str
    category: InsightCategory
    title: str
    description: str
    severity: InsightSeverity
    evidence_quote: str
    speaker: str
    suggested_action: str
    doc_search_query: str


class AnalyzeRequest(BaseModel):
    transcript: str


class AnalyzeResponse(BaseModel):
    product_context: str
    insights: list[Insight]
    themes: list[str]
    recommended_priorities: list[str]


class DocResult(BaseModel):
    url: str
    title: str
    snippet: str


class EnrichedInsight(BaseModel):
    insight: Insight
    docs: list[DocResult]


class EnrichRequest(BaseModel):
    insights: list[Insight]


class EnrichResponse(BaseModel):
    enriched_insights: list[EnrichedInsight]


class IssueToCreate(BaseModel):
    insight: Insight
    docs: list[DocResult]


class CreatedIssue(BaseModel):
    insight_id: str
    title: str
    github_url: str
    issue_number: int
    status: str  # "created" or "failed"
    error: Optional[str] = None


class CreateIssuesRequest(BaseModel):
    issues: list[IssueToCreate]


class CreateIssuesResponse(BaseModel):
    created: list[CreatedIssue]
    total: int
    successful: int
    failed: int
```

---

## `prompts.py`

```python
ANALYSIS_SYSTEM_PROMPT = """You are a senior product manager analyzing a user interview transcript.

Your job:
1. Extract actionable insights from what the INTERVIEWEE said (not the interviewer's questions).
2. Each insight must be grounded in a direct quote from the user.
3. Categorize each insight and assign severity based on user impact.
4. For each insight, generate a targeted search query to find relevant API docs, libraries, or technical resources for implementation. Be specific — use library/framework names, not generic terms.

Rules:
- Do NOT infer problems the user didn't mention.
- Do NOT create insights from the interviewer's leading questions.
- Assign unique IDs: "insight-001", "insight-002", etc.
- The doc_search_query must be specific enough to find implementation docs (e.g. "Stripe subscription billing API webhooks" not "payment processing").
- Extract 3-10 insights depending on conversation richness.
"""

ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "product_context": {
            "type": "string",
            "description": "Brief summary of what product/feature is being discussed"
        },
        "insights": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "category": {
                        "type": "string",
                        "enum": ["pain_point", "feature_request", "workflow_issue", "positive_feedback", "confusion"]
                    },
                    "title": {"type": "string", "description": "Short actionable title, max 80 chars"},
                    "description": {"type": "string"},
                    "severity": {
                        "type": "string",
                        "enum": ["critical", "high", "medium", "low"]
                    },
                    "evidence_quote": {"type": "string", "description": "Direct quote from interviewee"},
                    "speaker": {"type": "string", "description": "Speaker label from transcript"},
                    "suggested_action": {"type": "string"},
                    "doc_search_query": {
                        "type": "string",
                        "description": "Specific search query for relevant technical docs/libraries"
                    }
                },
                "required": ["id", "category", "title", "description", "severity", "evidence_quote", "speaker", "suggested_action", "doc_search_query"],
                "additionalProperties": False
            }
        },
        "themes": {
            "type": "array",
            "items": {"type": "string"}
        },
        "recommended_priorities": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Ordered list of insight IDs by priority"
        }
    },
    "required": ["product_context", "insights", "themes", "recommended_priorities"],
    "additionalProperties": False
}
```

---

## `templates.py`

```python
def build_issue_title(insight: dict) -> str:
    severity_emoji = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}
    emoji = severity_emoji.get(insight["severity"], "⚪")
    category_label = insight["category"].replace("_", " ").title()
    return f"{emoji} [{category_label}] {insight['title']}"


def build_issue_body(insight: dict, docs: list[dict]) -> str:
    if docs:
        doc_lines = "\n".join(
            f"- [{d['title']}]({d['url']}) — \"{d['snippet'][:150]}...\""
            for d in docs[:3]
        )
        docs_section = f"## 📚 Relevant Documentation\n{doc_lines}"
    else:
        docs_section = "## 📚 Relevant Documentation\n_No relevant documentation found._"

    return f"""## User Story
As a user, I want to {insight['suggested_action'].lower()} so that {insight['description'].lower()}.

## Evidence from Interview
> "{insight['evidence_quote']}"
— Speaker {insight['speaker']}

## Acceptance Criteria
- [ ] {insight['suggested_action']}
- [ ] Verify fix addresses the reported issue
- [ ] Add tests for the new behavior

{docs_section}

## Metadata
| Field | Value |
|-------|-------|
| Category | `{insight['category']}` |
| Severity | `{insight['severity']}` |
| Insight ID | `{insight['id']}` |

---
_Auto-generated from user interview analysis_
"""
```

---

## `services/__init__.py`

Empty file.

---

## `services/transcription.py`

**CRITICAL API constraints for OpenAI gpt-4o-transcribe-diarize:**
- `chunking_strategy: "auto"` is MANDATORY for audio > 30 seconds
- `response_format` must be `"diarized_json"` to get speaker labels
- Max file size: 25 MB
- No prompting support on this model
- Supported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm

```python
import openai
from config import OPENAI_API_KEY

client = openai.OpenAI(api_key=OPENAI_API_KEY)


async def transcribe_audio(audio_bytes: bytes, filename: str) -> dict:
    transcript = client.audio.transcriptions.create(
        model="gpt-4o-transcribe-diarize",
        file=(filename, audio_bytes),
        response_format="diarized_json",
        chunking_strategy="auto",
        language="en",
    )

    segments = []
    for seg in transcript.segments:
        segments.append({
            "speaker": seg.speaker,
            "text": seg.text,
            "start": seg.start,
            "end": seg.end,
        })

    raw_text = "\n".join(f"Speaker {s['speaker']}: {s['text']}" for s in segments)
    return {"segments": segments, "raw_text": raw_text}


def parse_pasted_transcript(text: str) -> dict:
    return {
        "segments": [{"speaker": "unknown", "text": text, "start": 0.0, "end": 0.0}],
        "raw_text": text,
    }
```

---

## `services/analysis.py`

**CRITICAL API constraints for Claude Structured Outputs:**
- Model: `claude-sonnet-4-5-20250929`
- Requires beta header `anthropic-beta: structured-outputs-2025-11-13`
- Use `output_format` (not `output_config`) with this beta header
- Response JSON is in `response.content[0].text` — guaranteed valid per schema
- First request with a new schema has extra compile latency (~5-15s), then cached 24 hrs
- `additionalProperties: false` is required in schema for strict mode
- Incompatible with message prefilling

```python
import json
import anthropic
from config import ANTHROPIC_API_KEY
from prompts import ANALYSIS_SYSTEM_PROMPT, ANALYSIS_SCHEMA

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


async def analyze_transcript(transcript_text: str) -> dict:
    response = client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=4096,
        system=ANALYSIS_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"Analyze this user interview transcript and extract actionable product insights:\n\n{transcript_text}",
            }
        ],
        extra_headers={
            "anthropic-beta": "structured-outputs-2025-11-13",
        },
        extra_body={
            "output_format": {
                "type": "json_schema",
                "schema": ANALYSIS_SCHEMA,
            }
        },
    )

    return json.loads(response.content[0].text)
```

---

## `services/enrichment.py`

**API: You.com Web Search — `GET https://api.ydc-index.io/v1/search`**
- Auth: `X-API-Key` header
- Params: `query` (str), `count` (int — max results per section)
- Returns: `results.web[]` each with `url`, `title`, `description`, `snippets[]`
- Free tier: 1,000 calls
- This is best-effort — failures must not break the pipeline

```python
import httpx
import asyncio
from config import YDC_API_KEY

YDC_SEARCH_URL = "https://api.ydc-index.io/v1/search"


async def search_docs_for_insight(query: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(
                YDC_SEARCH_URL,
                params={"query": query, "count": 3},
                headers={"X-API-Key": YDC_API_KEY},
            )
            resp.raise_for_status()
            data = resp.json()

            results = []
            for item in data.get("results", {}).get("web", [])[:3]:
                snippets = item.get("snippets", [])
                snippet_text = snippets[0] if snippets else item.get("description", "")
                results.append({
                    "url": item.get("url", ""),
                    "title": item.get("title", ""),
                    "snippet": snippet_text[:300],
                })
            return results
        except Exception as e:
            print(f"You.com search failed for '{query}': {e}")
            return []


async def enrich_insights(insights: list[dict]) -> list[dict]:
    tasks = [search_docs_for_insight(i["doc_search_query"]) for i in insights]
    doc_results = await asyncio.gather(*tasks)
    return [
        {"insight": insight, "docs": docs}
        for insight, docs in zip(insights, doc_results)
    ]
```

---

## `services/github_issues.py`

**Two implementations: Composio (primary) and raw GitHub API (fallback).**

Composio: uses `GITHUB_CREATE_AN_ISSUE` action via `composio.tools.execute()`. Requires prior CLI setup: `composio login && composio add github`. The response wraps the GitHub API response — the exact shape may vary, so log it on first test.

Fallback: raw `httpx` POST to `https://api.github.com/repos/{owner}/{repo}/issues` using a personal access token. This always works if PAT has repo scope.

**Important: Labels referenced in issue creation must already exist on the repo. Create these labels manually before running: `pain_point`, `feature_request`, `workflow_issue`, `positive_feedback`, `confusion`, `critical`, `high`, `medium`, `low`.**

```python
import httpx
from config import COMPOSIO_API_KEY, GITHUB_PAT, GITHUB_OWNER, GITHUB_REPO
from templates import build_issue_body, build_issue_title

# Try Composio, fall back to raw API
USE_COMPOSIO = bool(COMPOSIO_API_KEY)

if USE_COMPOSIO:
    try:
        from composio import Composio
        composio_client = Composio(api_key=COMPOSIO_API_KEY)
    except Exception:
        USE_COMPOSIO = False
        composio_client = None


async def _create_via_composio(title: str, body: str, labels: list[str]) -> dict:
    result = composio_client.tools.execute(
        action="GITHUB_CREATE_AN_ISSUE",
        params={
            "owner": GITHUB_OWNER,
            "repo": GITHUB_REPO,
            "title": title,
            "body": body,
            "labels": labels,
        },
        user_id="default",
    )
    # Composio wraps response — try common paths for the data
    data = result.get("data", result)
    if isinstance(data, dict):
        return {
            "html_url": data.get("html_url", f"https://github.com/{GITHUB_OWNER}/{GITHUB_REPO}/issues"),
            "number": data.get("number", 0),
        }
    return {"html_url": f"https://github.com/{GITHUB_OWNER}/{GITHUB_REPO}/issues", "number": 0}


async def _create_via_github_api(title: str, body: str, labels: list[str]) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/issues",
            json={"title": title, "body": body, "labels": labels},
            headers={
                "Authorization": f"token {GITHUB_PAT}",
                "Accept": "application/vnd.github.v3+json",
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return {"html_url": data["html_url"], "number": data["number"]}


async def create_github_issue(insight: dict, docs: list[dict]) -> dict:
    title = build_issue_title(insight)
    body = build_issue_body(insight, docs)
    labels = [insight["category"], insight["severity"]]

    try:
        if USE_COMPOSIO:
            result = await _create_via_composio(title, body, labels)
        else:
            result = await _create_via_github_api(title, body, labels)

        return {
            "insight_id": insight["id"],
            "title": title,
            "github_url": result["html_url"],
            "issue_number": result["number"],
            "status": "created",
            "error": None,
        }
    except Exception as e:
        # If Composio fails, try fallback once
        if USE_COMPOSIO and GITHUB_PAT:
            try:
                result = await _create_via_github_api(title, body, labels)
                return {
                    "insight_id": insight["id"],
                    "title": title,
                    "github_url": result["html_url"],
                    "issue_number": result["number"],
                    "status": "created",
                    "error": None,
                }
            except Exception as fallback_err:
                e = fallback_err

        return {
            "insight_id": insight["id"],
            "title": title,
            "github_url": "",
            "issue_number": 0,
            "status": "failed",
            "error": str(e),
        }


async def create_all_issues(issues: list[dict]) -> list[dict]:
    """Create issues sequentially to preserve order and avoid rate limits."""
    results = []
    for item in issues:
        result = await create_github_issue(item["insight"], item["docs"])
        results.append(result)
    return results
```

---

## `main.py`

5 POST endpoints + 1 GET health check. CORS is fully open (hackathon).

```python
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import (
    TranscribeRequest, TranscribeResponse,
    AnalyzeRequest, AnalyzeResponse,
    EnrichRequest, EnrichResponse,
    CreateIssuesRequest, CreateIssuesResponse,
)
from services.transcription import transcribe_audio, parse_pasted_transcript
from services.analysis import analyze_transcript
from services.enrichment import enrich_insights
from services.github_issues import create_all_issues

app = FastAPI(title="Interview Sprint Planner", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/transcribe/audio", response_model=TranscribeResponse)
async def transcribe_audio_endpoint(file: UploadFile = File(...)):
    """Upload audio → diarized transcript. Max 25 MB. Formats: mp3, mp4, m4a, wav, webm."""
    contents = await file.read()
    if len(contents) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File must be under 25 MB")
    result = await transcribe_audio(contents, file.filename)
    return TranscribeResponse(segments=result["segments"], raw_text=result["raw_text"])


@app.post("/transcribe/text", response_model=TranscribeResponse)
async def transcribe_text_endpoint(request: TranscribeRequest):
    """Accept pasted transcript text. Fallback when audio unavailable."""
    if not request.transcript_text.strip():
        raise HTTPException(status_code=400, detail="transcript_text is required")
    result = parse_pasted_transcript(request.transcript_text)
    return TranscribeResponse(segments=result["segments"], raw_text=result["raw_text"])


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_endpoint(request: AnalyzeRequest):
    """Transcript → Claude structured outputs → insights with categories, severity, quotes."""
    if not request.transcript.strip():
        raise HTTPException(status_code=400, detail="transcript is required")
    result = await analyze_transcript(request.transcript)
    return AnalyzeResponse(**result)


@app.post("/enrich", response_model=EnrichResponse)
async def enrich_endpoint(request: EnrichRequest):
    """Parallel You.com searches for each insight's doc_search_query. Best-effort, non-blocking."""
    insights_dicts = [i.model_dump() for i in request.insights]
    enriched = await enrich_insights(insights_dicts)
    return EnrichResponse(enriched_insights=enriched)


@app.post("/create-issues", response_model=CreateIssuesResponse)
async def create_issues_endpoint(request: CreateIssuesRequest):
    """Create GitHub issues via Composio (or fallback to raw API). Sequential to preserve order."""
    items = [
        {"insight": item.insight.model_dump(), "docs": [d.model_dump() for d in item.docs]}
        for item in request.issues
    ]
    results = await create_all_issues(items)
    successful = sum(1 for r in results if r["status"] == "created")
    return CreateIssuesResponse(
        created=results,
        total=len(results),
        successful=successful,
        failed=len(results) - successful,
    )


@app.post("/pipeline")
async def full_pipeline(request: AnalyzeRequest):
    """Full pipeline in one call: analyze → enrich → create issues. Skips human review."""
    analysis = await analyze_transcript(request.transcript)
    enriched = await enrich_insights(analysis["insights"])
    results = await create_all_issues(enriched)
    successful = sum(1 for r in results if r["status"] == "created")
    return {
        "analysis": analysis,
        "enriched_insights": enriched,
        "created_issues": results,
        "summary": {
            "insights_found": len(analysis["insights"]),
            "issues_created": successful,
            "issues_failed": len(results) - successful,
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

---

## After Building — Verify

```bash
# Install
cd backend && pip install -r requirements.txt

# Composio setup (one-time, interactive)
composio login
composio add github

# Copy env
cp .env.example .env
# Fill in all keys

# Run
uvicorn main:app --reload --port 8000

# Health check
curl http://localhost:8000/health
# → {"status":"ok"}

# Swagger docs
open http://localhost:8000/docs
```

Test each endpoint in order:
1. `POST /transcribe/text` with `{"transcript_text": "Speaker A: What's your biggest frustration?\nSpeaker B: I can never find the export button, it's hidden behind three menus."}`
2. `POST /analyze` with `{"transcript": "<raw_text from step 1>"}`
3. `POST /enrich` with `{"insights": [<insights array from step 2>]}`
4. `POST /create-issues` with `{"issues": [<enriched_insights from step 3>]}`

Or test full pipeline: `POST /pipeline` with `{"transcript": "<text>"}`.
