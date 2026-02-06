import { useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Github,
  Hash,
  Bot,
} from 'lucide-react'
import type { CreatedIssue, InsightWithMeta } from '../types'
import { categoryConfig, severityConfig } from '../utils'
import { startBuild } from '../api'
import BuildProgressModal from './BuildProgressModal'

interface OutputSectionProps {
  issues: CreatedIssue[]
  stats: { total: number; successful: number; failed: number } | null
  insights: InsightWithMeta[]
  onNewAnalysis: () => void
}

export default function OutputSection({ issues, stats, insights, onNewAnalysis }: OutputSectionProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [buildingIssues, setBuildingIssues] = useState<Set<number>>(new Set())
  const [activeBuild, setActiveBuild] = useState<{ buildId: string; issueTitle: string } | null>(null)

  function toggleExpand(insightId: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(insightId)) {
        next.delete(insightId)
      } else {
        next.add(insightId)
      }
      return next
    })
  }

  function findInsight(insightId: string) {
    return insights.find((i) => i.insight.id === insightId)
  }

  async function handleBuildWithAI(issue: CreatedIssue) {
    if (buildingIssues.has(issue.issue_number)) return
    const meta = findInsight(issue.insight_id)

    setBuildingIssues((prev) => new Set(prev).add(issue.issue_number))

    try {
      const result = await startBuild({
        issue_number: issue.issue_number,
        issue_title: issue.title,
        issue_body: meta?.insight.description ?? '',
        implementation_guide: meta?.implementation_guide ?? '',
        insight_description: meta?.insight.description ?? '',
        suggested_action: meta?.insight.suggested_action ?? '',
      })
      setActiveBuild({ buildId: result.build_id, issueTitle: issue.title })
    } catch {
      setBuildingIssues((prev) => {
        const next = new Set(prev)
        next.delete(issue.issue_number)
        return next
      })
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ── Page Header ──────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-green-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">
            Sprint Created
          </h1>
          <p className="text-text-secondary mt-0.5 text-base">
            Your GitHub issues are ready
          </p>
        </div>
      </div>

      {/* ── Summary Stats Bar ────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          {/* Total Issues */}
          <div className="card relative overflow-hidden">
            <div className="absolute top-3 right-3 flex gap-1 opacity-20">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-green-500" />
              ))}
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
              Total Issues
            </p>
            <p className="text-4xl font-bold text-text-primary">
              {stats.total}
            </p>
            <div className="mt-3 h-1 w-16 rounded-full bg-green-200" />
          </div>

          {/* Successful */}
          <div className="card relative overflow-hidden">
            <div className="absolute top-3 right-3 opacity-20">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
              Successful
            </p>
            <p className="text-4xl font-bold text-green-600">
              {stats.successful}
            </p>
            <div className="mt-3 flex gap-1">
              {[...Array(Math.min(stats.successful, 12))].map((_, i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-green-400" />
              ))}
            </div>
          </div>

          {/* Failed — only show if > 0 */}
          {stats.failed > 0 && (
            <div className="card relative overflow-hidden">
              <div className="absolute top-3 right-3 opacity-20">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                Failed
              </p>
              <p className="text-4xl font-bold text-red-600">
                {stats.failed}
              </p>
              <div className="mt-3 flex gap-1">
                {[...Array(Math.min(stats.failed, 12))].map((_, i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-red-400" />
                ))}
              </div>
            </div>
          )}

          {/* Placeholder when no failures — keep grid alignment */}
          {stats.failed === 0 && (
            <div className="card relative overflow-hidden bg-green-50/50 border-green-200">
              <p className="text-xs font-semibold uppercase tracking-wider text-green-600 mb-2">
                All Clear
              </p>
              <p className="text-4xl font-bold text-green-600">
                0
              </p>
              <p className="text-xs text-green-500 mt-2">No failures</p>
            </div>
          )}
        </div>
      )}

      {/* ── Issues List ──────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {issues.map((issue, idx) => {
          const meta = findInsight(issue.insight_id)
          const isExpanded = expanded.has(issue.insight_id)
          const isCreated = issue.status === 'created'

          const catConf = meta ? categoryConfig[meta.insight.category] : null
          const sevConf = meta ? severityConfig[meta.insight.severity] : null

          return (
            <div
              key={issue.insight_id}
              className="card p-0 overflow-hidden"
              style={{
                animation: `fadeSlideIn 0.4s ease-out ${idx * 80}ms both`,
              }}
            >
              {/* Main row */}
              <div className="flex items-center gap-4 px-5 py-4">
                {/* Status icon */}
                <div className="flex-shrink-0">
                  {isCreated ? (
                    <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>
                  ) : (
                    <div className="w-9 h-9 bg-red-100 rounded-full flex items-center justify-center">
                      <XCircle className="w-5 h-5 text-red-600" />
                    </div>
                  )}
                </div>

                {/* Title + badges */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-text-primary text-sm truncate">
                    {issue.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {catConf && (
                      <span className={`badge ${catConf.bg} ${catConf.text}`}>
                        {catConf.label}
                      </span>
                    )}
                    {sevConf && (
                      <span className={`badge ${sevConf.bg} ${sevConf.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sevConf.dot} mr-1.5`} />
                        {sevConf.label}
                      </span>
                    )}
                    {isCreated && issue.issue_number > 0 && (
                      <span className="badge bg-gray-100 text-text-secondary">
                        <Hash className="w-3 h-3 mr-0.5" />
                        {issue.issue_number}
                      </span>
                    )}
                  </div>
                  {/* Error message for failed issues */}
                  {!isCreated && issue.error && (
                    <p className="text-xs text-red-600 mt-1.5">{issue.error}</p>
                  )}
                </div>

                {/* Right side actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isCreated && issue.github_url && (
                    <a
                      href={issue.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600 hover:text-green-700 transition-colors duration-150"
                    >
                      <Github className="w-3.5 h-3.5" />
                      View on GitHub
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {isCreated && (
                    <button
                      type="button"
                      onClick={() => handleBuildWithAI(issue)}
                      disabled={buildingIssues.has(issue.issue_number)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      {buildingIssues.has(issue.issue_number) ? 'Building...' : 'Build with AI'}
                    </button>
                  )}
                  {meta && (
                    <button
                      type="button"
                      onClick={() => toggleExpand(issue.insight_id)}
                      className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-150 cursor-pointer border-0 bg-transparent"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-text-secondary" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-text-secondary" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && meta && (
                <div className="px-5 pb-5 pt-0 border-t border-border">
                  <div className="mt-4 flex flex-col gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                        Description
                      </p>
                      <p className="text-sm text-text-secondary leading-relaxed">
                        {meta.insight.description}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                        Evidence Quote
                      </p>
                      <blockquote className="text-sm text-text-secondary italic border-l-2 border-green-300 pl-3 leading-relaxed">
                        "{meta.insight.evidence_quote}"
                      </blockquote>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                        Suggested Action
                      </p>
                      <p className="text-sm text-text-secondary leading-relaxed">
                        {meta.insight.suggested_action}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── New Analysis Button ───────────────────────── */}
      <div className="flex justify-center pt-2 pb-4">
        <button
          type="button"
          onClick={onNewAnalysis}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-green-600 border-2 border-green-500 bg-white hover:bg-green-50 transition-all duration-200 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          Start New Analysis
        </button>
      </div>

      {/* ── Build Progress Modal ────────────────────── */}
      {activeBuild && (
        <BuildProgressModal
          buildId={activeBuild.buildId}
          issueTitle={activeBuild.issueTitle}
          onClose={() => setActiveBuild(null)}
        />
      )}

      {/* ── Keyframe animation ───────────────────────── */}
      <style>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
