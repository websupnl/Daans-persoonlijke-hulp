'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, FolderOpen, CheckSquare, FileText, Clock, Timer } from 'lucide-react'
import { cn, PROJECT_COLORS } from '@/lib/utils'
import AIContextButton from '@/components/ai/AIContextButton'

interface Project {
  id: number
  title: string
  description?: string
  status: 'actief' | 'on-hold' | 'afgerond'
  color: string
  open_todos: number
  total_todos: number
  note_count: number
  created_at: string
}

interface ActiveTimer { project_id: number | null; title: string; elapsed_minutes: number }

const STATUS_LABELS = { actief: 'Actief', 'on-hold': 'On Hold', afgerond: 'Afgerond' }
const STATUS_COLORS_MAP: Record<string, string> = {
  actief: 'text-emerald-600 bg-emerald-50',
  'on-hold': 'text-amber-600 bg-amber-50',
  afgerond: 'text-gray-400 bg-gray-100',
}
const GRAD = 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)'

function fmtMinutes(min: number) {
  const h = Math.floor(min / 60); const m = min % 60
  return h > 0 ? `${h}u ${m > 0 ? m + 'm' : ''}`.trim() : `${m}m`
}

export default function ProjectsView() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ title: '', description: '', color: '#ec4899', status: 'actief' })

  const fetchProjects = async () => {
    const [projRes, timerRes] = await Promise.all([
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/timers').then(r => r.json()),
    ])
    setProjects(projRes.data || [])
    setActiveTimer(timerRes.timer || null)
    setLoading(false)
  }

  useEffect(() => { fetchProjects() }, [])

  async function addProject() {
    if (!form.title.trim()) return
    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setForm({ title: '', description: '', color: '#ec4899', status: 'actief' })
    setShowAdd(false)
    fetchProjects()
  }

  async function updateStatus(e: React.MouseEvent, id: number, status: string) {
    e.stopPropagation()
    await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchProjects()
  }

  return (
    <div className="flex min-h-full flex-col bg-white">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-extrabold text-gradient">Projecten</h1>
          <p className="text-xs text-gray-400 mt-0.5 font-medium">{projects.filter(p => p.status === 'actief').length} actieve projecten</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold shadow-sm transition-opacity hover:opacity-90"
          style={{ background: GRAD }}
        >
          <Plus size={14} />
          Nieuw project
        </button>
      </div>

      {/* Active timer banner */}
      {activeTimer && (
        <div className="mx-6 mt-4 flex items-center justify-between bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <p className="text-xs font-bold text-green-700">Timer loopt: <span className="font-normal">{activeTimer.title}</span></p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-green-600">{fmtMinutes(activeTimer.elapsed_minutes)}</span>
            {activeTimer.project_id && (
              <button onClick={() => router.push(`/projects/${activeTimer.project_id}`)} className="text-[10px] font-semibold text-green-700 underline underline-offset-2">Bekijk project</button>
            )}
          </div>
        </div>
      )}

      {showAdd && (
        <div className="mx-6 mt-4 p-4 bg-gray-50 border border-gray-200 rounded-2xl animate-fade-in space-y-3">
          <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addProject()} placeholder="Projectnaam *" className="w-full bg-white text-sm text-gray-700 placeholder:text-gray-400 rounded-xl px-3 py-2 outline-none border border-gray-200" />
          <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Beschrijving" className="w-full bg-white text-sm text-gray-700 placeholder:text-gray-400 rounded-xl px-3 py-2 outline-none border border-gray-200" />
          <div>
            <p className="text-xs text-gray-400 mb-1.5 font-medium">Kleur</p>
            <div className="flex gap-2">
              {PROJECT_COLORS.map(c => (
                <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))} className={cn('w-7 h-7 rounded-full transition-transform shadow-sm', form.color === c ? 'ring-2 ring-gray-400 scale-110' : 'hover:scale-105')} style={{ background: c }} />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="text-xs text-gray-400 px-3 py-1.5 hover:text-gray-600 transition-colors">Annuleer</button>
            <button onClick={addProject} className="text-xs text-white px-4 py-1.5 rounded-xl font-semibold shadow-sm" style={{ background: GRAD }}>Opslaan</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#ec4899 transparent #ec4899 #ec4899' }} />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12">
            <FolderOpen size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm font-medium">Nog geen projecten. Maak je eerste aan!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => {
              const isTimerRunning = activeTimer?.project_id === project.id
              return (
                <div
                  key={project.id}
                  onClick={() => router.push(`/projects/${project.id}`)}
                  className={cn('bg-white border rounded-2xl p-5 shadow-sm card-hover group cursor-pointer transition-all', isTimerRunning ? 'border-green-200 ring-1 ring-green-200' : 'border-gray-100')}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-3 h-10 rounded-full flex-shrink-0 shadow-sm" style={{ background: project.color }} />
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-gray-700 truncate">{project.title}</h3>
                        {project.description && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{project.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <div className="opacity-0 group-hover:opacity-100 transition-all">
                        <AIContextButton
                          type="project"
                          title={project.title}
                          content={project.description}
                          id={project.id}
                        />
                      </div>
                      {isTimerRunning && (
                        <div className="flex items-center gap-1 text-green-500">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                          <span className="text-[10px] font-bold">{fmtMinutes(activeTimer.elapsed_minutes)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-1.5 text-gray-400">
                      <CheckSquare size={12} />
                      <span className="text-[11px] font-medium">{project.open_todos} open</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-400">
                      <FileText size={12} />
                      <span className="text-[11px] font-medium">{project.note_count} notes</span>
                    </div>
                  </div>

                  {project.total_todos > 0 && (
                    <div className="mb-4">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.round(((project.total_todos - project.open_todos) / project.total_todos) * 100)}%`,
                            background: GRAD,
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-gradient font-bold mt-1">
                        {Math.round(((project.total_todos - project.open_todos) / project.total_todos) * 100)}% klaar
                      </p>
                    </div>
                  )}

                  <select
                    value={project.status}
                    onClick={(e) => e.stopPropagation()}
                    onChange={e => updateStatus(e as unknown as React.MouseEvent, project.id, e.target.value)}
                    className={cn('text-[10px] px-2 py-1.5 rounded-xl border-0 outline-none cursor-pointer w-full font-semibold', STATUS_COLORS_MAP[project.status])}
                  >
                    {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
