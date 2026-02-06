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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
