import { useEffect, useRef, useState } from 'react'
import { X, ExternalLink, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import type { BuildLogEntry } from '../types'

interface BuildProgressModalProps {
  buildId: string
  issueTitle: string
  onClose: () => void
}

const LOG_COLORS: Record<string, string> = {
  status: 'text-blue-400',
  agent_text: 'text-gray-300',
  tool_use: 'text-amber-400',
  error: 'text-red-400',
  result: 'text-green-400',
}

export default function BuildProgressModal({ buildId, issueTitle, onClose }: BuildProgressModalProps) {
  const [logs, setLogs] = useState<BuildLogEntry[]>([])
  const [done, setDone] = useState(false)
  const [finalStatus, setFinalStatus] = useState<string | null>(null)
  const [prUrl, setPrUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    const eventSource = new EventSource(`/api/build/${buildId}/stream`)

    eventSource.onmessage = (event) => {
      const data: BuildLogEntry = JSON.parse(event.data)

      if (data.type === 'done') {
        doneRef.current = true
        setDone(true)
        setFinalStatus(data.status ?? null)
        setPrUrl(data.pr_url ?? null)
        setError(data.error ?? null)
        eventSource.close()
        return
      }

      setLogs((prev) => [...prev, data])
    }

    eventSource.onerror = () => {
      if (!doneRef.current) {
        doneRef.current = true
        setDone(true)
        setFinalStatus('failed')
        setError('Connection to build stream lost')
      }
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [buildId])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col max-h-[80vh] border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3 min-w-0">
            {!done && <Loader2 className="w-5 h-5 text-blue-400 animate-spin flex-shrink-0" />}
            {done && finalStatus === 'completed' && (
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
            )}
            {done && finalStatus === 'failed' && (
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white truncate">
                Building: {issueTitle}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {done
                  ? finalStatus === 'completed'
                    ? 'Build completed'
                    : 'Build failed'
                  : 'Agent is working...'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer border-0 bg-transparent"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Log viewer */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-6 py-4 font-mono text-xs leading-relaxed space-y-1"
        >
          {logs.map((entry, i) => (
            <div key={i} className={`${LOG_COLORS[entry.type] || 'text-gray-300'}`}>
              <span className="text-gray-600 mr-2 select-none">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
              {entry.type === 'tool_use' && (
                <span className="text-amber-600 mr-1">[tool]</span>
              )}
              {entry.type === 'error' && (
                <span className="text-red-600 mr-1">[error]</span>
              )}
              <span className="whitespace-pre-wrap break-words">{entry.message}</span>
            </div>
          ))}

          {!done && logs.length === 0 && (
            <div className="text-gray-500 italic">Waiting for agent to start...</div>
          )}
        </div>

        {/* Footer */}
        {done && (
          <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between">
            {prUrl ? (
              <a
                href={prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors no-underline"
              >
                View Pull Request
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : error ? (
              <p className="text-sm text-red-400">{error}</p>
            ) : (
              <p className="text-sm text-gray-400">Build finished — check the repo for changes.</p>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition-colors cursor-pointer border-0"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
