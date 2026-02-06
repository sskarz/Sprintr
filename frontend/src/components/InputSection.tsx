import { useState, useRef, type DragEvent, type ChangeEvent } from 'react'
import {
  Upload,
  FileAudio,
  Sparkles,
  Loader2,
  X,
  FileText,
  Mic,
} from 'lucide-react'

interface InputSectionProps {
  loading: boolean
  loadingMessage: string
  onAnalyze: (input: string | File) => void
}

type Tab = 'paste' | 'upload'

const PLACEHOLDER = `Speaker 1: I think the navigation is really confusing...
Speaker 2: Can you tell me more about what was confusing?
Speaker 1: When I tried to find the settings page...`

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB
const ACCEPTED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/mp4', 'audio/webm']
const ACCEPTED_EXTENSIONS = '.mp3,.wav,.m4a,.webm'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function InputSection({ loading, loadingMessage, onAnalyze }: InputSectionProps) {
  const [tab, setTab] = useState<Tab>('paste')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const canSubmit = tab === 'paste' ? text.trim().length > 0 : file !== null

  function handleSubmit() {
    if (!canSubmit) return
    if (tab === 'paste') {
      onAnalyze(text)
    } else if (file) {
      onAnalyze(file)
    }
  }

  function validateAndSetFile(f: File) {
    if (f.size > MAX_FILE_SIZE) {
      alert('File exceeds 25 MB limit.')
      return
    }
    if (!ACCEPTED_TYPES.includes(f.type) && !f.name.match(/\.(mp3|wav|m4a|webm)$/i)) {
      alert('Unsupported file format. Please use MP3, WAV, M4A, or WebM.')
      return
    }
    setFile(f)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) validateAndSetFile(dropped)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (selected) validateAndSetFile(selected)
  }

  // ── Loading state ───────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-8">
        <div className="flex gap-4 w-full max-w-2xl">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex-1 bg-card rounded-2xl border border-border p-6 animate-pulse"
            >
              <div className="h-3 bg-gray-200 rounded-full w-3/4 mb-4" />
              <div className="h-2 bg-gray-200 rounded-full w-full mb-3" />
              <div className="h-2 bg-gray-200 rounded-full w-5/6 mb-3" />
              <div className="h-2 bg-gray-200 rounded-full w-2/3" />
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-text-secondary text-sm font-medium">{loadingMessage}</p>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Main input view ─────────────────────────────────
  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">
          Interview Sprint Planner
        </h1>
        <p className="text-text-secondary mt-2 text-base">
          Analyze user interviews and turn insights into actionable GitHub issues
        </p>
      </div>

      {/* Card */}
      <div className="card">
        {/* Tab switcher */}
        <div className="inline-flex bg-gray-100 rounded-xl p-1 mb-6">
          <button
            type="button"
            onClick={() => setTab('paste')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer border-0 ${
              tab === 'paste'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-text-secondary hover:text-blue-700 hover:bg-blue-50 hover:shadow-sm'
            }`}
          >
            <FileText className="w-4 h-4" />
            Paste Transcript
          </button>
          <button
            type="button"
            onClick={() => setTab('upload')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer border-0 ${
              tab === 'upload'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-text-secondary hover:text-blue-700 hover:bg-blue-50 hover:shadow-sm'
            }`}
          >
            <Mic className="w-4 h-4" />
            Upload Audio
          </button>
        </div>

        {/* Paste tab */}
        {tab === 'paste' && (
          <div className="flex flex-col gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={PLACEHOLDER}
              className="w-full min-h-[300px] bg-white border border-border rounded-xl p-4 text-sm text-text-primary placeholder:text-text-muted resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 transition-all duration-200 font-sans leading-relaxed"
            />
            <div className="text-right">
              <span className="text-xs text-text-muted">
                {text.length.toLocaleString()} characters
              </span>
            </div>
          </div>
        )}

        {/* Upload tab */}
        {tab === 'upload' && (
          <div>
            {file ? (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <FileAudio className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">{file.name}</p>
                    <p className="text-xs text-text-muted">{formatBytes(file.size)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="p-1.5 rounded-lg hover:bg-red-100 hover:text-red-600 hover:shadow-sm transition-all cursor-pointer border-0 bg-transparent"
                >
                  <X className="w-4 h-4 text-text-secondary hover:text-red-600" />
                </button>
              </div>
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-12 cursor-pointer transition-all duration-200 ${
                  dragOver
                    ? 'border-blue-600 bg-blue-100 shadow-md'
                    : 'border-border hover:border-blue-500 hover:bg-blue-100 hover:shadow-md'
                }`}
              >
                <Upload className="w-8 h-8 text-text-muted" />
                <p className="text-sm text-text-secondary font-medium">
                  Drop your audio file here or click to browse
                </p>
                <p className="text-xs text-text-muted">
                  MP3, WAV, M4A, WebM — Max 25MB
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        )}

        {/* Submit button */}
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="btn-primary w-full mt-6 flex items-center justify-center gap-2 text-base py-3.5"
        >
          <Sparkles className="w-5 h-5" />
          Analyze Interview
        </button>
      </div>
    </div>
  )
}
