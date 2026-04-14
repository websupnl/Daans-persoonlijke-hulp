'use client'

import { useState, useEffect } from 'react'
import { Plus, FolderOpen, CheckSquare, FileText, Trash2 } from 'lucide-react'
import { cn, PROJECT_COLORS } from '@/lib/utils'

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

const STATUS_LABELS = { actief: 'Actief', 'on-hold': 'On Hold', afgerond: 'Afgerond' }
const STATUS_COLORS_MAP: Record<string, string> = {
  actief: 'text-emerald-400 bg-emerald-950/60',
  'on-hold': 'text-amber-400 bg-amber-950/60',
  afgerond: 'text-slate-500 bg-slate-800',
}

export default function ProjectsView() {
  const [projects, setProjects] = useState<Project[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ title: '', description: '', color: '#6172f3', status: 'actief' })

  const fetchProjects = async () => {
    const res = await fetch('/api/projects')
    const data = await res.json()
    setProjects(data.data || [])
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
    setForm({ title: '', description: '', color: '#6172f3', status: 'actief' })
    setShowAdd(false)
    fetchProjects()
  }

  async function deleteProject(id: number) {
    if (!confirm('Project verwijderen?')) return
    await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  async function updateStatus(id: number, status: string) {
    await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchProjects()
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-white">Projecten</h1>
          <p className="text-xs text-slate-500 mt-0.5">{projects.filter(p => p.status === 'actief').length} actieve projecten</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-500 transition-colors">
          <Plus size={14} />
          Nieuw project
        </button>
      </div>

      {showAdd && (
        <div className="mx-6 mt-4 p-4 bg-[#13151c] border border-white/10 rounded-xl animate-fade-in space-y-3">
          <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Projectnaam *" className="w-full bg-white/5 text-sm text-slate-300 placeholder:text-slate-600 rounded-lg px-3 py-2 outline-none" />
          <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Beschrijving" className="w-full bg-white/5 text-sm text-slate-300 placeholder:text-slate-600 rounded-lg px-3 py-2 outline-none" />
          <div>
            <p className="text-xs text-slate-600 mb-1.5">Kleur</p>
            <div className="flex gap-2">
              {PROJECT_COLORS.map(c => (
                <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))} className={cn('w-6 h-6 rounded-full transition-transform', form.color === c ? 'ring-2 ring-white/50 scale-110' : 'hover:scale-105')} style={{ background: c }} />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="text-xs text-slate-500 px-3 py-1.5">Annuleer</button>
            <button onClick={addProject} className="text-xs bg-brand-600 text-white px-4 py-1.5 rounded-lg">Opslaan</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12">
            <FolderOpen size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-600 text-sm">Nog geen projecten. Maak je eerste aan!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.map(project => (
              <div key={project.id} className="bg-[#13151c] border border-white/5 rounded-xl p-4 hover:border-white/10 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-3 h-8 rounded-full flex-shrink-0" style={{ background: project.color }} />
                    <div>
                      <h3 className="text-sm font-semibold text-white">{project.title}</h3>
                      {project.description && <p className="text-[10px] text-slate-600 mt-0.5">{project.description}</p>}
                    </div>
                  </div>
                  <button onClick={() => deleteProject(project.id)} className="opacity-0 group-hover:opacity-100 text-slate-700 hover:text-red-400 transition-all">
                    <Trash2 size={12} />
                  </button>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-1 text-slate-600">
                    <CheckSquare size={11} />
                    <span className="text-[10px]">{project.open_todos} open</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-600">
                    <FileText size={11} />
                    <span className="text-[10px]">{project.note_count} notes</span>
                  </div>
                </div>

                {project.total_todos > 0 && (
                  <div className="mb-3">
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.round(((project.total_todos - project.open_todos) / project.total_todos) * 100)}%`, background: project.color }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-700 mt-1">{Math.round(((project.total_todos - project.open_todos) / project.total_todos) * 100)}% klaar</p>
                  </div>
                )}

                <select
                  value={project.status}
                  onChange={e => updateStatus(project.id, e.target.value)}
                  className={cn('text-[10px] px-2 py-1 rounded-lg border-0 outline-none cursor-pointer w-full', STATUS_COLORS_MAP[project.status])}
                >
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
