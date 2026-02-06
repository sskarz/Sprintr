import { useState, useRef, useEffect } from 'react'
import type { InsightWithMeta, Insight, InsightCategory, InsightSeverity } from '../types'
import { categoryConfig, severityConfig } from '../utils'
import { ArrowLeft, Search, Lightbulb, Zap, ChevronDown, Loader2 } from 'lucide-react'

// ── Toggle Switch ────────────────────────────────────
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
        checked ? 'bg-green-500' : 'bg-gray-300'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

// ── Inline Editable Text ─────────────────────────────
function InlineEditable({
  value,
  onSave,
  className,
  as: Tag = 'span',
}: {
  value: string
  onSave: (value: string) => void
  className?: string
  as?: 'span' | 'p'
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const commit = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) {
      onSave(trimmed)
    } else {
      setDraft(value)
    }
  }

  if (editing) {
    if (Tag === 'p') {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              commit()
            }
            if (e.key === 'Escape') {
              setDraft(value)
              setEditing(false)
            }
          }}
          className={`${className} w-full resize-none rounded-lg border border-green-300 bg-white px-2 py-1 outline-none focus:ring-2 focus:ring-green-200`}
          rows={3}
        />
      )
    }
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setDraft(value)
            setEditing(false)
          }
        }}
        className={`${className} w-full rounded-lg border border-green-300 bg-white px-2 py-0.5 outline-none focus:ring-2 focus:ring-green-200`}
      />
    )
  }

  return (
    <Tag
      onClick={() => {
        setDraft(value)
        setEditing(true)
      }}
      className={`${className} cursor-pointer rounded px-1 -mx-1 hover:bg-sage-100 transition-colors duration-150`}
      title="Click to edit"
    >
      {value}
    </Tag>
  )
}

// ── Custom Select Dropdown ───────────────────────────
function SelectDropdown({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder: string
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-white border border-border rounded-xl pl-3 pr-8 py-2 text-sm text-text-primary cursor-pointer hover:border-green-300 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-colors"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
    </div>
  )
}

// ── Props ────────────────────────────────────────────
interface InsightsSectionProps {
  insights: InsightWithMeta[]
  themes: string[]
  productContext: string
  loading: boolean
  loadingMessage: string
  onToggleInclude: (insightId: string) => void
  onUpdateInsight: (insightId: string, updates: Partial<Insight>) => void
  onGenerateSprint: () => void
  onBack: () => void
}

// ── Main Component ───────────────────────────────────
export default function InsightsSection({
  insights,
  themes,
  productContext,
  loading,
  loadingMessage,
  onToggleInclude,
  onUpdateInsight,
  onGenerateSprint,
  onBack,
}: InsightsSectionProps) {
  const [categoryFilter, setCategoryFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [search, setSearch] = useState('')

  const includedCount = insights.filter((i) => i.included).length

  // Filter insights
  const filtered = insights.filter((item) => {
    if (categoryFilter && item.insight.category !== categoryFilter) return false
    if (severityFilter && item.insight.severity !== severityFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const matchesTitle = item.insight.title.toLowerCase().includes(q)
      const matchesDesc = item.insight.description.toLowerCase().includes(q)
      const matchesEvidence = item.insight.evidence_quote.toLowerCase().includes(q)
      const matchesSpeaker = item.insight.speaker.toLowerCase().includes(q)
      if (!matchesTitle && !matchesDesc && !matchesEvidence && !matchesSpeaker) return false
    }
    return true
  })

  const categoryOptions: { value: string; label: string }[] = (
    Object.keys(categoryConfig) as InsightCategory[]
  ).map((key) => ({ value: key, label: categoryConfig[key].label }))

  const severityOptions: { value: string; label: string }[] = (
    Object.keys(severityConfig) as InsightSeverity[]
  ).map((key) => ({ value: key, label: severityConfig[key].label }))

  return (
    <div className="pb-28">
      {/* ── Header ─────────────────────────────────── */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors mb-4 cursor-pointer bg-transparent border-0 p-0"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to input
        </button>
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-text-primary m-0">Insights Review</h1>
            {productContext && (
              <p className="text-text-secondary text-sm mt-1 mb-0">{productContext}</p>
            )}
          </div>
          <span className="text-sm text-text-muted font-medium">
            {includedCount} of {insights.length} insights selected
          </span>
        </div>
      </div>

      {/* ── Themes ─────────────────────────────────── */}
      {themes.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {themes.map((theme) => (
            <span
              key={theme}
              className="badge bg-sage-100 text-sage-500 border border-sage-200"
            >
              {theme}
            </span>
          ))}
        </div>
      )}

      {/* ── Filter Bar ─────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <SelectDropdown
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={categoryOptions}
          placeholder="All Categories"
        />
        <SelectDropdown
          value={severityFilter}
          onChange={setSeverityFilter}
          options={severityOptions}
          placeholder="All Severities"
        />
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search insights..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-border rounded-xl pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-colors"
          />
        </div>
      </div>

      {/* ── Insight Cards Grid ─────────────────────── */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((item) => {
            const cat = categoryConfig[item.insight.category]
            const sev = severityConfig[item.insight.severity]

            return (
              <div
                key={item.insight.id}
                className={`card flex flex-col gap-3 transition-opacity duration-200 ${
                  !item.included ? 'opacity-50' : ''
                }`}
              >
                {/* Card Header */}
                <div className="flex items-start justify-between gap-3">
                  <InlineEditable
                    value={item.insight.title}
                    onSave={(val) => onUpdateInsight(item.insight.id, { title: val })}
                    className="text-base font-semibold text-text-primary leading-snug"
                  />
                  <ToggleSwitch
                    checked={item.included}
                    onChange={() => onToggleInclude(item.insight.id)}
                  />
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`badge ${cat.bg} ${cat.text}`}>{cat.label}</span>
                  <span className={`badge ${sev.bg} ${sev.text} gap-1`}>
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                    {sev.label}
                  </span>
                </div>

                {/* Evidence Quote */}
                {item.insight.evidence_quote && (
                  <blockquote className="border-l-3 border-green-400 bg-sage-50 rounded-r-lg px-3 py-2 m-0">
                    <p className="text-sm italic text-text-secondary leading-relaxed m-0">
                      "{item.insight.evidence_quote}"
                    </p>
                    {item.insight.speaker && (
                      <p className="text-xs text-text-muted mt-1 mb-0">
                        -- {item.insight.speaker}
                      </p>
                    )}
                  </blockquote>
                )}

                {/* Description */}
                <InlineEditable
                  value={item.insight.description}
                  onSave={(val) => onUpdateInsight(item.insight.id, { description: val })}
                  className="text-sm text-text-secondary leading-relaxed"
                  as="p"
                />

                {/* Suggested Action */}
                {item.insight.suggested_action && (
                  <div className="flex items-start gap-2 bg-green-50 rounded-lg px-3 py-2">
                    <Lightbulb className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-green-700 m-0 leading-relaxed">
                      {item.insight.suggested_action}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* ── Empty State ────────────────────────────── */
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-sage-100 flex items-center justify-center mb-4">
            <Search className="w-7 h-7 text-sage-400" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-1">No insights found</h3>
          <p className="text-sm text-text-secondary max-w-sm">
            {insights.length === 0
              ? 'No insights have been generated yet. Go back and analyze an interview.'
              : 'Try adjusting your filters or search query to find what you are looking for.'}
          </p>
        </div>
      )}

      {/* ── Sticky Bottom Bar ──────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-border z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <p className="text-sm text-text-secondary m-0">
            <span className="font-semibold text-text-primary">{includedCount}</span> insight{includedCount !== 1 ? 's' : ''} selected for sprint
          </p>
          <button
            onClick={onGenerateSprint}
            disabled={loading || includedCount === 0}
            className="btn-primary inline-flex items-center gap-2 text-base px-8 py-3"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {loadingMessage || 'Generating...'}
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Generate Sprint
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
