'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, AlertCircle, Loader2, ArrowRight } from 'lucide-react'
import { Textarea } from '@/components/ui/interfaces-textarea'

type Step = 'input' | 'analyzing' | 'done'

export default function ImportInputView() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('input')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string>('Verwerken...')
  const [result, setResult] = useState<{
    runId: number
    sourceLabel: string
    detectedFormat: string
    candidateCount?: number
  } | null>(null)

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) { setFile(f); setText('') }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) { setFile(f); setText('') }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!text.trim() && !file) {
      setError('Plak tekst of upload een bestand.')
      return
    }
    setStep('analyzing')

    try {
      // Step 1: create run + normalize
      setProgress('Formaat detecteren en normaliseren...')
      let createRes: Response
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        createRes = await fetch('/api/import', { method: 'POST', body: fd })
      } else {
        createRes = await fetch('/api/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawInput: text }),
        })
      }

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}))
        throw new Error(err.error ?? `HTTP ${createRes.status}`)
      }

      const created = await createRes.json()
      const runId: number = created.runId

      // Step 2: segmentatie + matching (kan even duren)
      setProgress('AI analyseert en categoriseert de inhoud...')
      const segRes = await fetch(`/api/import/${runId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'segment' }),
      })

      if (!segRes.ok) {
        const err = await segRes.json().catch(() => ({}))
        throw new Error(err.error ?? `Segmentatie mislukt (HTTP ${segRes.status})`)
      }

      const segData = await segRes.json()

      setResult({
        runId,
        sourceLabel: created.sourceLabel,
        detectedFormat: created.detectedFormat,
        candidateCount: segData.candidateCount,
      })
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStep('input')
    }
  }

  if (step === 'analyzing') {
    return (
      <div className="max-w-xl mx-auto py-24 flex flex-col items-center gap-6 text-center">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
        <p className="text-lg font-medium text-gray-800">{progress}</p>
        <p className="text-sm text-gray-500">Dit kan 10–30 seconden duren voor grote exports.</p>
      </div>
    )
  }

  if (step === 'done' && result) {
    return (
      <div className="max-w-xl mx-auto py-16 flex flex-col items-center gap-6 text-center">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
          <FileText className="w-7 h-7 text-green-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Import klaar voor review</h2>
          <p className="text-sm text-gray-500 mt-1">{result.sourceLabel} · {result.detectedFormat}</p>
        </div>
        <div className="bg-blue-50 rounded-xl px-6 py-4 text-center">
          <span className="text-3xl font-bold text-blue-700">{result.candidateCount ?? 0}</span>
          <p className="text-sm text-blue-600 mt-1">items gevonden</p>
        </div>
        <button
          onClick={() => router.push(`/import/${result.runId}/review`)}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition"
        >
          Naar review <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => { setStep('input'); setResult(null); setText(''); setFile(null) }}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          Nieuwe import
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Importeren</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Plak een ChatGPT/Claude export, een tekstdump of upload een bestand.
          AI splitst alles op in losse items die je kunt reviewen.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-5 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* File drop zone */}
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleFileDrop}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition group"
        >
          <Upload className="w-6 h-6 text-gray-400 group-hover:text-blue-500 mx-auto mb-2 transition" />
          {file ? (
            <p className="text-sm font-medium text-blue-700">{file.name}</p>
          ) : (
            <>
              <p className="text-sm text-gray-600">Sleep een bestand hierheen of klik om te uploaden</p>
              <p className="text-xs text-gray-400 mt-1">.txt · .md · .json (ChatGPT/Claude export)</p>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.json,.jsonl"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-400">
          <div className="flex-1 h-px bg-gray-200" />
          of plak tekst
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <Textarea
          value={text}
          onChange={e => { setText(e.target.value); setFile(null) }}
          placeholder="Plak hier een stuk tekst, dagboeknotitie, gesprekslog of dump..."
          rows={10}
          className="resize-none rounded-xl border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-blue-500"
        />

        <button
          type="submit"
          disabled={!text.trim() && !file}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Analyseren en importeren
        </button>
      </form>

      <RecentRuns />
    </div>
  )
}

function RecentRuns() {
  const [runs, setRuns] = useState<Array<{
    id: number
    source_label: string
    status: string
    total_candidates: number | null
    accepted_count: number | null
    created_at: string
  }>>([])
  const [loaded, setLoaded] = useState(false)

  // Lazy load on mount
  useState(() => {
    fetch('/api/import')
      .then(r => r.json())
      .then(d => { setRuns(d.runs ?? []); setLoaded(true) })
      .catch(() => setLoaded(true))
  })

  if (!loaded || runs.length === 0) return null

  return (
    <div className="mt-10">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Recente imports</h3>
      <div className="space-y-2">
        {runs.slice(0, 8).map(r => (
          <a
            key={r.id}
            href={`/import/${r.id}/review`}
            className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition text-sm"
          >
            <div>
              <span className="font-medium text-gray-800">{r.source_label}</span>
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${statusColor(r.status)}`}>{r.status}</span>
            </div>
            <span className="text-gray-400 text-xs">
              {r.total_candidates ?? 0} items · {new Date(r.created_at).toLocaleDateString('nl-NL')}
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}

function statusColor(status: string): string {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-700'
    case 'review': return 'bg-blue-100 text-blue-700'
    case 'executing': return 'bg-yellow-100 text-yellow-700'
    case 'completed_with_errors': return 'bg-orange-100 text-orange-700'
    default: return 'bg-gray-100 text-gray-500'
  }
}
