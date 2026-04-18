'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check, X, RefreshCw, ChevronDown, ChevronUp,
  Folder, Brain, Lightbulb, CheckSquare, BookOpen,
  Clock, Users, Calendar, Loader2, AlertCircle, ArrowLeft,
  Play
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Candidate {
  id: number
  candidate_type: string
  target_module: string
  suggested_title: string | null
  normalized_text: string
  confidence: number
  temporal_context: string
  ai_reasoning: string
  suggested_action: string
  review_status: string
  matched_entity_type: string | null
  matched_entity_id: number | null
  match_confidence: number | null
  match_reasoning: string | null
  created_entity_id: number | null
  source_position: number
}

interface RunInfo {
  id: number
  source_label: string
  source_type: string
  status: string
  total_candidates: number | null
  accepted_count: number | null
  created_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const MODULE_TABS = [
  { key: 'all', label: 'Alles', icon: null },
  { key: 'project', label: 'Projecten', icon: Folder },
  { key: 'memory', label: 'Memory', icon: Brain },
  { key: 'idea', label: 'Ideeën', icon: Lightbulb },
  { key: 'todo', label: "Todo's", icon: CheckSquare },
  { key: 'journal', label: 'Dagboek', icon: BookOpen },
  { key: 'worklog', label: 'Werklog', icon: Clock },
  { key: 'contact', label: 'Contacten', icon: Users },
  { key: 'event', label: 'Agenda', icon: Calendar },
] as const

const TYPE_COLORS: Record<string, string> = {
  project: 'bg-blue-100 text-blue-700',
  memory: 'bg-purple-100 text-purple-700',
  idea: 'bg-yellow-100 text-yellow-700',
  todo: 'bg-orange-100 text-orange-700',
  journal: 'bg-pink-100 text-pink-700',
  worklog: 'bg-teal-100 text-teal-700',
  contact: 'bg-green-100 text-green-700',
  event: 'bg-indigo-100 text-indigo-700',
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Nieuw aanmaken',
  merge: 'Samenvoegen',
  update: 'Updaten',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
  error: 'bg-orange-100 text-orange-700',
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ImportReviewView({ runId }: { runId: number }) {
  const router = useRouter()
  const [run, setRun] = useState<RunInfo | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [activeTab, setActiveTab] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const [actionMap, setActionMap] = useState<Record<number, string>>({}) // candidateId → loading state
  const [followUps, setFollowUps] = useState<string[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [runRes, candRes] = await Promise.all([
        fetch(`/api/import/${runId}`),
        fetch(`/api/import/${runId}/candidates?status=${statusFilter}${activeTab !== 'all' ? `&type=${activeTab}` : ''}`),
      ])
      const runData = await runRes.json()
      const candData = await candRes.json()
      setRun(runData.run)
      setFollowUps(runData.followUpQuestions ?? [])
      setCounts(runData.candidateCounts ?? {})
      setCandidates(candData.candidates ?? [])
    } catch {
      setError('Laden mislukt')
    } finally {
      setLoading(false)
    }
  }, [runId, activeTab, statusFilter])

  useEffect(() => { load() }, [load])

  async function handleAction(candidateId: number, action: 'accept' | 'reject' | 'reset', suggestedAction?: string) {
    setActionMap(m => ({ ...m, [candidateId]: action }))
    try {
      const res = await fetch(`/api/import/${runId}/candidates/${candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, suggested_action: suggestedAction }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(`Fout: ${data.error ?? 'Onbekend'}`)
        setActionMap(m => { const n = { ...m }; delete n[candidateId]; return n })
        return
      }
      // Update local state
      setCandidates(prev => prev.map(c =>
        c.id === candidateId
          ? { ...c, review_status: action === 'reset' ? 'pending' : action === 'accept' ? 'accepted' : 'rejected', created_entity_id: data.entityId ?? c.created_entity_id }
          : c
      ))
    } finally {
      setActionMap(m => { const n = { ...m }; delete n[candidateId]; return n })
    }
  }

  async function handleExecuteAll() {
    if (!confirm('Alle pending kandidaten accepteren en uitvoeren?')) return
    setExecuting(true)
    try {
      const res = await fetch(`/api/import/${runId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acceptAll: true }),
      })
      const data = await res.json()
      alert(`Klaar: ${data.succeeded} geslaagd, ${data.failed} mislukt`)
      load()
    } catch {
      alert('Uitvoering mislukt')
    } finally {
      setExecuting(false)
    }
  }

  const pendingCount = counts['pending'] ?? 0
  const acceptedCount = counts['accepted'] ?? 0
  const rejectedCount = counts['rejected'] ?? 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button
            onClick={() => router.push('/import')}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Terug
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Review import</h1>
          {run && (
            <p className="text-sm text-gray-500 mt-1">
              {run.source_label} ·{' '}
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                run.status === 'completed' ? 'bg-green-100 text-green-700' :
                run.status === 'review' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-500'
              }`}>{run.status}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            title="Vernieuwen"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {pendingCount > 0 && (
            <button
              onClick={handleExecuteAll}
              disabled={executing}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Alles uitvoeren ({pendingCount})
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 mb-6 text-sm">
        <StatBadge label="Pending" count={pendingCount} color="text-gray-600" onClick={() => setStatusFilter('pending')} active={statusFilter === 'pending'} />
        <StatBadge label="Geaccepteerd" count={acceptedCount} color="text-green-600" onClick={() => setStatusFilter('accepted')} active={statusFilter === 'accepted'} />
        <StatBadge label="Afgewezen" count={rejectedCount} color="text-red-500" onClick={() => setStatusFilter('rejected')} active={statusFilter === 'rejected'} />
      </div>

      {/* Follow-up questions */}
      {followUps.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide mb-2">Follow-up vragen van AI</p>
          <ul className="space-y-1">
            {followUps.map((q, i) => (
              <li key={i} className="text-sm text-yellow-800">• {q}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Module tabs */}
      <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-100 pb-3">
        {MODULE_TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg p-3 mb-4 text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Candidates */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : candidates.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">Geen items</p>
          <p className="text-sm mt-1">Geen kandidaten met status &quot;{statusFilter}&quot; gevonden.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {candidates.map(c => (
            <CandidateCard
              key={c.id}
              candidate={c}
              loading={!!actionMap[c.id]}
              onAccept={(suggestedAction) => handleAction(c.id, 'accept', suggestedAction)}
              onReject={() => handleAction(c.id, 'reject')}
              onReset={() => handleAction(c.id, 'reset')}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Candidate Card
// ─────────────────────────────────────────────────────────────────────────────

function CandidateCard({
  candidate: c,
  loading,
  onAccept,
  onReject,
  onReset,
}: {
  candidate: Candidate
  loading: boolean
  onAccept: (suggestedAction?: string) => void
  onReject: () => void
  onReset: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [selectedAction, setSelectedAction] = useState(c.suggested_action)

  const isDone = c.review_status === 'accepted' || c.review_status === 'rejected'
  const typeColor = TYPE_COLORS[c.candidate_type] ?? 'bg-gray-100 text-gray-600'
  const confidence = Math.round((c.match_confidence ?? c.confidence) * 100)

  return (
    <div className={`rounded-xl border transition ${
      c.review_status === 'accepted' ? 'border-green-200 bg-green-50' :
      c.review_status === 'rejected' ? 'border-red-100 bg-red-50 opacity-60' :
      c.review_status === 'error' ? 'border-orange-200 bg-orange-50' :
      'border-gray-200 bg-white'
    }`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Type badge */}
          <span className={`text-xs px-2 py-1 rounded-md font-medium whitespace-nowrap mt-0.5 ${typeColor}`}>
            {c.candidate_type}
          </span>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 text-sm leading-snug">
              {c.suggested_title ?? c.normalized_text.split('\n')[0].slice(0, 80)}
            </p>
            {c.match_reasoning && (
              <p className="text-xs text-amber-600 mt-1">
                ⚡ {c.match_reasoning}
              </p>
            )}
            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
              <span>{confidence}% zekerheid</span>
              <span className={`px-1.5 py-0.5 rounded ${STATUS_COLORS[c.review_status] ?? 'bg-gray-100 text-gray-500'}`}>
                {c.review_status}
              </span>
              <span className="text-gray-300">{c.temporal_context}</span>
            </div>
          </div>

          {/* Expand */}
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-1 text-gray-400 hover:text-gray-600 shrink-0"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Genormaliseerde tekst</p>
              <p className="text-xs text-gray-700 bg-gray-50 rounded p-2 whitespace-pre-wrap">{c.normalized_text}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">AI redenering</p>
              <p className="text-xs text-gray-600">{c.ai_reasoning}</p>
            </div>
            {c.created_entity_id && (
              <p className="text-xs text-green-600">✓ Aangemaakt als #{c.created_entity_id} in {c.target_module}</p>
            )}
          </div>
        )}

        {/* Action row */}
        {!isDone && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            {/* Suggested action selector */}
            <select
              value={selectedAction}
              onChange={e => setSelectedAction(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              disabled={loading}
            >
              {Object.entries(ACTION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            <div className="flex-1" />

            <button
              onClick={onReject}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-red-600 hover:bg-red-50 border border-red-100 disabled:opacity-50 transition"
            >
              <X className="w-3.5 h-3.5" /> Afwijzen
            </button>
            <button
              onClick={() => onAccept(selectedAction)}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Accepteren
            </button>
          </div>
        )}

        {/* Reset for done items */}
        {isDone && (
          <div className="flex justify-end mt-2">
            <button
              onClick={onReset}
              disabled={loading}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Reset
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat Badge
// ─────────────────────────────────────────────────────────────────────────────

function StatBadge({ label, count, color, onClick, active }: {
  label: string
  count: number
  color: string
  onClick: () => void
  active: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition text-sm ${
        active ? 'border-blue-300 bg-blue-50' : 'border-gray-100 hover:border-gray-200 bg-white'
      }`}
    >
      <span className={`font-bold ${color}`}>{count}</span>
      <span className="text-gray-500">{label}</span>
    </button>
  )
}
