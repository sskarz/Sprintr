from pydantic import BaseModel
from typing import Optional
from enum import Enum
from datetime import datetime


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
    implementation_guide: str = ""


class EnrichRequest(BaseModel):
    insights: list[Insight]


class EnrichResponse(BaseModel):
    enriched_insights: list[EnrichedInsight]


class IssueToCreate(BaseModel):
    insight: Insight
    docs: list[DocResult]
    implementation_guide: str = ""


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


# ── Build with AI ──────────────────────────────────

class BuildRequest(BaseModel):
    issue_number: int
    issue_title: str
    issue_body: str
    implementation_guide: str = ""
    insight_description: str = ""
    suggested_action: str = ""


class BuildStartResponse(BaseModel):
    build_id: str
    status: str


class BuildLogEntry(BaseModel):
    timestamp: str
    type: str  # "status" | "agent_text" | "tool_use" | "error" | "result"
    message: str


class BuildStatusResponse(BaseModel):
    build_id: str
    issue_number: int
    status: str  # "queued" | "cloning" | "running" | "completed" | "failed"
    pr_url: Optional[str] = None
    error: Optional[str] = None
    logs: list[BuildLogEntry] = []
    created_at: str
