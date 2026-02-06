import type { InsightCategory, InsightSeverity } from './types'

// ── Category styling ───────────────────────────────
export const categoryConfig: Record<InsightCategory, { label: string; bg: string; text: string }> = {
  pain_point: { label: 'Pain Point', bg: 'bg-red-50', text: 'text-red-700' },
  feature_request: { label: 'Feature Request', bg: 'bg-blue-50', text: 'text-blue-700' },
  workflow_issue: { label: 'Workflow Issue', bg: 'bg-amber-50', text: 'text-amber-700' },
  positive_feedback: { label: 'Positive Feedback', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  confusion: { label: 'Confusion', bg: 'bg-purple-50', text: 'text-purple-700' },
}

export const severityConfig: Record<InsightSeverity, { label: string; bg: string; text: string; dot: string }> = {
  critical: { label: 'Critical', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  high: { label: 'High', bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  medium: { label: 'Medium', bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  low: { label: 'Low', bg: 'bg-slate-50', text: 'text-slate-700', dot: 'bg-slate-500' },
}

export const severityEmoji: Record<InsightSeverity, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢',
}
