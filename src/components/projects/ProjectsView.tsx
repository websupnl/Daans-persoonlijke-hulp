'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckSquare, Clock3, FileText, FolderOpen, Plus, Timer } from 'lucide-react'
import { cn, PROJECT_COLORS } from '@/lib/utils'
import PageShell from '@/components/ui/PageShell'
import { ActionPill, EmptyPanel, MetricTile, Panel, PanelHeader } from '@/components/ui/Panel'
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

interface ActiveTimer {
  project_id: number | null
  title: string
  elapsed_minutes: number
}

const STATUS_LABELS = {
  actief: 'Actief',
  'on-hold': 'On hold',
  afgerond: 'Afgerond',
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours > 0 ? `${hours}u ${rest > 0 ? `${rest}m` : ''}`.trim() : `${rest}m`
}

export default function ProjectsView() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ title: '', description: '', color: '#5a677b', status: 'actief' })

  async function fetchProjects() {
    const [projectResponse, timerResponse] = await Promise.all([
      fetch('/api/projects').then((response) => response.json()),
      fetch('/api/timers').then((response) => response.json()),
    ])
    setProjects(projectResponse.data || [])
    setActiveTimer(timerResponse.timer || null)
    setLoading(false)
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  async function addProject() {
    if (!form.title.trim()) return
    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setForm({ title: '', description: '', color: '#5a677b', status: 'actief' })
    setShowAdd(false)
    fetchProjects()
  }

  async function updateStatus(event: React.ChangeEvent<HTMLSelectElement>, id: number) {
    event.stopPropagation()
    await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: event.target.value }),
    })
    fetchProjects()
  }

  const activeProjects = projects.filter((project) => project.status === 'actief')
  const completedProjects = projects.filter((project) => project.status === 'afgerond')
  const pausedProjects = projects.filter((project) => project.status === 'on-hold')

  return (
    <PageShell
      title="Projecten"
      subtitle={`${activeProjects.length} actieve projecten. Dit scherm moet je projecten laten voelen als echte werkruimtes in plaats van losse kaarten zonder richting.`}
      actions={
        <button
          onClick={() => setShowAdd((value) => !value)}
          className="inline-flex items-center gap-2 rounded-full bg-[#202625] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230]"
        >
          <Plus size={15} />
          Nieuw project
        </button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Actief" value={activeProjects.length} meta="Projecten in beweging" icon={<FolderOpen size={18} />} />
        <MetricTile label="On hold" value={pausedProjects.length} meta="Geparkeerde trajecten" icon={<Clock3 size={18} />} />
        <MetricTile label="Afgerond" value={completedProjects.length} meta="Afgesloten trajecten" icon={<CheckSquare size={18} />} />
        <MetricTile label="Timer" value={activeTimer ? formatMinutes(activeTimer.elapsed_minutes) : 'Uit'} meta={activeTimer?.title || 'Geen actieve timer'} icon={<Timer size={18} />} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          {activeTimer && (
            <Panel tone="accent">
              <PanelHeader
                eyebrow="Actieve timer"
                title={activeTimer.title}
                description="Lopende tijd hoort direct zichtbaar te zijn zodat projecten als echte werkplekken aanvoelen."
                action={
                  activeTimer.project_id ? (
                    <button
                      onClick={() => router.push(`/projects/${activeTimer.project_id}`)}
                      className="rounded-full bg-[#202625] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230]"
                    >
                      Open project
                    </button>
                  ) : undefined
                }
              />
              <div className="mt-4 flex items-center gap-2">
                <ActionPill>{formatMinutes(activeTimer.elapsed_minutes)}</ActionPill>
                <ActionPill>Timer loopt</ActionPill>
              </div>
            </Panel>
          )}

          {showAdd && (
            <Panel tone="accent">
              <PanelHeader
                eyebrow="Nieuw project"
                title="Maak een nieuwe werkruimte"
                description="Een project moet een container zijn voor taken, notities en tijd. Niet alleen een mooie naam."
              />

              <div className="mt-5 space-y-3">
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  onKeyDown={(event) => event.key === 'Enter' && addProject()}
                  placeholder="Projectnaam"
                  className="w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
                />
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Korte beschrijving"
                  className="min-h-[120px] w-full resize-none rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm leading-7 text-on-surface outline-none placeholder:text-on-surface-variant"
                />
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/75">Kleur</p>
                  <div className="flex flex-wrap gap-2">
                    {PROJECT_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setForm((current) => ({ ...current, color }))}
                        className={cn('h-8 w-8 rounded-full transition-transform', form.color === color ? 'scale-110 ring-2 ring-[#202625]' : 'hover:scale-105')}
                        style={{ background: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={addProject}
                  className="rounded-full bg-[#202625] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230]"
                >
                  Opslaan
                </button>
                <button
                  onClick={() => setShowAdd(false)}
                  className="rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low"
                >
                  Annuleer
                </button>
              </div>
            </Panel>
          )}

          <Panel>
            <PanelHeader
              eyebrow="Werkruimtes"
              title="Projectoverzicht"
              description="Projecten moeten scanbaar zijn op voortgang, context en open werk. Minder decoratie, meer sturing."
            />

            {loading ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="min-h-[220px] rounded-[24px] border border-black/5 bg-surface-container-low animate-pulse" />
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className="mt-5">
                <EmptyPanel
                  title="Nog geen projecten"
                  description="Maak van projecten een centrale plek voor werk, context en voortgang. Niet alleen een lijstje met namen."
                />
              </div>
            ) : (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {projects.map((project) => {
                  const progress = project.total_todos > 0 ? Math.round(((project.total_todos - project.open_todos) / project.total_todos) * 100) : 0
                  const timerRunning = activeTimer?.project_id === project.id
                  return (
                    <button
                      key={project.id}
                      onClick={() => router.push(`/projects/${project.id}`)}
                      className={cn(
                        'group rounded-[26px] border border-black/5 bg-white p-5 text-left shadow-[0_18px_44px_-36px_rgba(31,37,35,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-container-low',
                        timerRunning && 'ring-1 ring-[#202625]'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="mt-1 h-12 w-3 rounded-full" style={{ background: project.color }} />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold text-on-surface">{project.title}</p>
                              {timerRunning && <ActionPill>{formatMinutes(activeTimer?.elapsed_minutes || 0)}</ActionPill>}
                            </div>
                            {project.description && (
                              <p className="mt-2 line-clamp-3 text-sm leading-6 text-on-surface-variant">{project.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <AIContextButton type="project" title={project.title} content={project.description} id={project.id} />
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-3 gap-2">
                        <div className="rounded-[20px] border border-black/5 bg-surface-container-low px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/75">Open</p>
                          <p className="mt-2 text-lg font-headline font-extrabold text-on-surface">{project.open_todos}</p>
                        </div>
                        <div className="rounded-[20px] border border-black/5 bg-surface-container-low px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/75">Notities</p>
                          <p className="mt-2 text-lg font-headline font-extrabold text-on-surface">{project.note_count}</p>
                        </div>
                        <div className="rounded-[20px] border border-black/5 bg-surface-container-low px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/75">Klaar</p>
                          <p className="mt-2 text-lg font-headline font-extrabold text-on-surface">{progress}%</p>
                        </div>
                      </div>

                      <div className="mt-5">
                        <div className="mb-2 flex items-center justify-between text-[11px] text-on-surface-variant">
                          <span>Voortgang</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-surface-container">
                          <div className="h-full rounded-full" style={{ width: `${progress}%`, background: project.color }} />
                        </div>
                      </div>

                      <div className="mt-5 flex items-center justify-between gap-3">
                        <select
                          value={project.status}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => updateStatus(event, project.id)}
                          className="rounded-full border border-black/5 bg-white px-3 py-1.5 text-xs font-medium text-on-surface outline-none"
                        >
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <span className="text-xs text-on-surface-variant">Open werkruimte</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-5 xl:sticky xl:top-8 xl:self-start">
          <Panel tone="muted">
            <PanelHeader
              eyebrow="Sturing"
              title="Waar je projecten nu staan"
              description="De rechterrail moet je helpen kiezen wat aandacht krijgt en wat geparkeerd mag blijven."
            />

            <div className="mt-5 flex flex-wrap gap-2">
              <ActionPill>{activeProjects.length} actief</ActionPill>
              <ActionPill>{pausedProjects.length} on hold</ActionPill>
              <ActionPill>{completedProjects.length} afgerond</ActionPill>
            </div>

            <div className="mt-5 space-y-3">
              {activeProjects.slice(0, 5).map((project) => (
                <div key={project.id} className="rounded-[22px] border border-black/5 bg-white/70 px-4 py-3.5">
                  <p className="truncate text-sm font-semibold text-on-surface">{project.title}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                    <span>{project.open_todos} open taken</span>
                    <span>{project.note_count} notities</span>
                  </div>
                </div>
              ))}
              {activeProjects.length === 0 && (
                <EmptyPanel
                  title="Geen actieve projecten"
                  description="Dat kan goed zijn, maar meestal betekent het dat je werk nog niet helder als projecten is georganiseerd."
                />
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow="Projectgedachte"
              title="Wat een project hier moet zijn"
              description="Niet zomaar een container, maar een plek waar voortgang, context en focus samenkomen."
            />

            <div className="mt-5 space-y-3 text-sm leading-7 text-on-surface-variant">
              <p>Een goed project maakt open taken zichtbaar zonder dat je eerst hoeft te zoeken.</p>
              <p>Een goed project bewaart notities, tijd en context op dezelfde plek zodat je sneller terug in flow komt.</p>
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  )
}
