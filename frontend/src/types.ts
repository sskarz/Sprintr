// ── Enums ──────────────────────────────────────────
export type InsightCategory =
  | 'pain_point'
  | 'feature_request'
  | 'workflow_issue'
  | 'positive_feedback'
  | 'confusion'

export type InsightSeverity = 'critical' | 'high' | 'medium' | 'low'

// ── Transcript ─────────────────────────────────────
export interface TranscriptSegment {
  speaker: string
  text: string
  start: number
  end: number
}

export interface TranscribeResponse {
  segments: TranscriptSegment[]
  raw_text: string
}

// ── Insights / Analysis ────────────────────────────
export interface Insight {
  id: string
  category: InsightCategory
  title: string
  description: string
  severity: InsightSeverity
  evidence_quote: string
  speaker: string
  suggested_action: string
  doc_search_query: string
}

export interface AnalyzeResponse {
  product_context: string
  insights: Insight[]
  themes: string[]
  recommended_priorities: string[]
}

// ── Enrichment ─────────────────────────────────────
export interface DocResult {
  url: string
  title: string
  snippet: string
}

export interface EnrichedInsight {
  insight: Insight
  docs: DocResult[]
  implementation_guide: string
}

export interface EnrichResponse {
  enriched_insights: EnrichedInsight[]
}

// ── GitHub Issues ──────────────────────────────────
export interface CreatedIssue {
  insight_id: string
  title: string
  github_url: string
  issue_number: number
  status: 'created' | 'failed' | 'pending'
  error?: string
}

export interface CreateIssuesResponse {
  created: CreatedIssue[]
  total: number
  successful: number
  failed: number
}

// ── App state ──────────────────────────────────────
export interface InsightWithMeta extends EnrichedInsight {
  included: boolean
}

export type AppStep = 'input' | 'insights' | 'output'

export interface AppState {
  step: AppStep
  loading: boolean
  loadingMessage: string
  transcript: string
  analysisResult: AnalyzeResponse | null
  enrichedInsights: InsightWithMeta[]
  createdIssues: CreatedIssue[]
  issueStats: { total: number; successful: number; failed: number } | null
}
