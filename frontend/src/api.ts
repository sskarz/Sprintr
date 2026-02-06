import type {
  TranscribeResponse,
  AnalyzeResponse,
  EnrichResponse,
  CreateIssuesResponse,
  BuildStartResponse,
  BuildStatusResponse,
  Insight,
  EnrichedInsight,
} from './types'

const BASE = '/api'

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json()
}

async function postForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json()
}

export async function transcribeText(transcript_text: string): Promise<TranscribeResponse> {
  return post('/transcribe/text', { transcript_text })
}

export async function transcribeAudio(file: File): Promise<TranscribeResponse> {
  const form = new FormData()
  form.append('file', file)
  return postForm('/transcribe/audio', form)
}

export async function analyzeTranscript(transcript: string): Promise<AnalyzeResponse> {
  return post('/analyze', { transcript })
}

export async function enrichInsights(insights: Insight[]): Promise<EnrichResponse> {
  return post('/enrich', { insights })
}

export async function createIssues(
  enrichedInsights: EnrichedInsight[]
): Promise<CreateIssuesResponse> {
  const issues = enrichedInsights.map((ei) => ({
    insight: ei.insight,
    docs: ei.docs,
    implementation_guide: ei.implementation_guide,
  }))
  return post('/create-issues', { issues })
}

export async function startBuild(params: {
  issue_number: number
  issue_title: string
  issue_body: string
  implementation_guide?: string
  insight_description?: string
  suggested_action?: string
}): Promise<BuildStartResponse> {
  return post('/build', params)
}

export async function getBuildStatus(buildId: string): Promise<BuildStatusResponse> {
  const res = await fetch(`${BASE}/build/${buildId}/status`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json()
}
