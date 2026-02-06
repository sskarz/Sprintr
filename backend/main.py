import asyncio
import json

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from models import (
    TranscribeRequest, TranscribeResponse,
    AnalyzeRequest, AnalyzeResponse,
    EnrichRequest, EnrichResponse,
    CreateIssuesRequest, CreateIssuesResponse,
    BuildRequest, BuildStartResponse, BuildStatusResponse, BuildLogEntry,
)
from services.transcription import transcribe_audio, parse_pasted_transcript
from services.analysis import analyze_transcript
from services.enrichment import enrich_insights
from services.github_issues import create_all_issues
from services.agent_builder import start_build, get_job

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
    """Upload audio -> diarized transcript. Max 25 MB. Formats: mp3, mp4, m4a, wav, webm."""
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
    """Transcript -> Claude structured outputs -> insights with categories, severity, quotes."""
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
        {
            "insight": item.insight.model_dump(),
            "docs": [d.model_dump() for d in item.docs],
            "implementation_guide": item.implementation_guide,
        }
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
    """Full pipeline in one call: analyze -> enrich -> create issues. Skips human review."""
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


# ── Build with AI endpoints ────────────────────────


@app.post("/build", response_model=BuildStartResponse)
async def build_endpoint(request: BuildRequest):
    """Start an AI agent to implement a GitHub issue and create a PR."""
    job = start_build(
        issue_number=request.issue_number,
        issue_title=request.issue_title,
        issue_body=request.issue_body,
        implementation_guide=request.implementation_guide,
        insight_description=request.insight_description,
        suggested_action=request.suggested_action,
    )
    return BuildStartResponse(build_id=job.build_id, status=job.status)


@app.get("/build/{build_id}/status", response_model=BuildStatusResponse)
async def build_status_endpoint(build_id: str):
    """Poll the current status of a build job."""
    job = get_job(build_id)
    if not job:
        raise HTTPException(status_code=404, detail="Build not found")
    return BuildStatusResponse(
        build_id=job.build_id,
        issue_number=job.issue_number,
        status=job.status,
        pr_url=job.pr_url,
        error=job.error,
        logs=[BuildLogEntry(**entry) for entry in job.logs],
        created_at=job.created_at,
    )


@app.get("/build/{build_id}/stream")
async def build_stream_endpoint(build_id: str):
    """Stream build logs via Server-Sent Events."""
    job = get_job(build_id)
    if not job:
        raise HTTPException(status_code=404, detail="Build not found")

    async def event_generator():
        sent = 0
        while True:
            # Send any new log entries
            while sent < len(job.logs):
                entry = job.logs[sent]
                data = json.dumps(entry)
                yield f"data: {data}\n\n"
                sent += 1

            # Check if job is done
            if job.status in ("completed", "failed"):
                done_data = json.dumps({
                    "type": "done",
                    "status": job.status,
                    "pr_url": job.pr_url,
                    "error": job.error,
                })
                yield f"data: {done_data}\n\n"
                return

            await asyncio.sleep(0.5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
