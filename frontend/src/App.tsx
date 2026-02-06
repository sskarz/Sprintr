import { useState, useCallback } from 'react'
import type { AppState, InsightWithMeta, EnrichedInsight } from './types'
import {
  transcribeText,
  transcribeAudio,
  analyzeTranscript,
  enrichInsights,
  createIssues,
} from './api'
import Sidebar from './components/Sidebar'
import InputSection from './components/InputSection'
import InsightsSection from './components/InsightsSection'
import OutputSection from './components/OutputSection'

const initialState: AppState = {
  step: 'input',
  loading: false,
  loadingMessage: '',
  transcript: '',
  analysisResult: null,
  enrichedInsights: [],
  createdIssues: [],
  issueStats: null,
}

export default function App() {
  const [state, setState] = useState<AppState>(initialState)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const setLoading = (loading: boolean, loadingMessage = '') =>
    setState((s) => ({ ...s, loading, loadingMessage }))

  // ── Analyze handler ──────────────────────────────
  const handleAnalyze = useCallback(async (input: string | File) => {
    try {
      setLoading(true, 'Transcribing interview...')

      let rawText: string
      if (typeof input === 'string') {
        const res = await transcribeText(input)
        rawText = res.raw_text
      } else {
        const res = await transcribeAudio(input)
        rawText = res.raw_text
      }

      setState((s) => ({ ...s, transcript: rawText }))
      setLoading(true, 'Analyzing transcript with AI...')

      const analysis = await analyzeTranscript(rawText)
      setState((s) => ({ ...s, analysisResult: analysis }))

      setLoading(true, 'Enriching insights with documentation...')
      const enriched = await enrichInsights(analysis.insights)

      const insightsWithMeta: InsightWithMeta[] = enriched.enriched_insights.map((ei) => ({
        ...ei,
        included: true,
      }))

      setState((s) => ({
        ...s,
        enrichedInsights: insightsWithMeta,
        step: 'insights',
        loading: false,
        loadingMessage: '',
      }))
    } catch (err) {
      console.error(err)
      setLoading(false)
      alert(err instanceof Error ? err.message : 'Analysis failed')
    }
  }, [])

  // ── Toggle include ───────────────────────────────
  const handleToggleInclude = useCallback((insightId: string) => {
    setState((s) => ({
      ...s,
      enrichedInsights: s.enrichedInsights.map((ei) =>
        ei.insight.id === insightId ? { ...ei, included: !ei.included } : ei
      ),
    }))
  }, [])

  // ── Update insight ───────────────────────────────
  const handleUpdateInsight = useCallback(
    (insightId: string, updates: Partial<InsightWithMeta['insight']>) => {
      setState((s) => ({
        ...s,
        enrichedInsights: s.enrichedInsights.map((ei) =>
          ei.insight.id === insightId
            ? { ...ei, insight: { ...ei.insight, ...updates } }
            : ei
        ),
      }))
    },
    []
  )

  // ── Generate sprint ──────────────────────────────
  const handleGenerateSprint = useCallback(async () => {
    const included = state.enrichedInsights.filter((ei) => ei.included)
    if (included.length === 0) {
      alert('Select at least one insight to include in the sprint.')
      return
    }

    try {
      setLoading(true, 'Creating GitHub issues...')
      const stripped: EnrichedInsight[] = included.map(({ included: _, ...rest }) => rest)
      const result = await createIssues(stripped)

      setState((s) => ({
        ...s,
        createdIssues: result.created,
        issueStats: { total: result.total, successful: result.successful, failed: result.failed },
        step: 'output',
        loading: false,
        loadingMessage: '',
      }))
    } catch (err) {
      console.error(err)
      setLoading(false)
      alert(err instanceof Error ? err.message : 'Issue creation failed')
    }
  }, [state.enrichedInsights])

  // ── Reset ────────────────────────────────────────
  const handleReset = useCallback(() => {
    setState(initialState)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
        activeStep={state.step}
      />

      <main
        className="flex-1 overflow-y-auto transition-all duration-300"
        style={{ marginLeft: sidebarCollapsed ? 72 : 260 }}
      >
        <div className="max-w-5xl mx-auto px-6 py-8">
          {state.step === 'input' && (
            <InputSection loading={state.loading} loadingMessage={state.loadingMessage} onAnalyze={handleAnalyze} />
          )}

          {state.step === 'insights' && (
            <InsightsSection
              insights={state.enrichedInsights}
              themes={state.analysisResult?.themes ?? []}
              productContext={state.analysisResult?.product_context ?? ''}
              loading={state.loading}
              loadingMessage={state.loadingMessage}
              onToggleInclude={handleToggleInclude}
              onUpdateInsight={handleUpdateInsight}
              onGenerateSprint={handleGenerateSprint}
              onBack={handleReset}
            />
          )}

          {state.step === 'output' && (
            <OutputSection
              issues={state.createdIssues}
              stats={state.issueStats}
              insights={state.enrichedInsights}
              onNewAnalysis={handleReset}
            />
          )}
        </div>
      </main>
    </div>
  )
}
