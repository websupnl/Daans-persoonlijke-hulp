'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { format, subDays } from 'date-fns'
import { nl } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Smile, Zap, Plus, X, Sparkles, Send, LineChart, Lightbulb, BarChart3, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import AIContextButton from '@/components/ai/AIContextButton'
import PageShell from '@/components/ui/PageShell'
import { ActionPill, Panel, PanelHeader } from '@/components/ui/Panel'

interface JournalEntry {
  id?: number
  date: string
  content: string
  mood?: number
  energy?: number
  gratitude: string[]
  highlights?: string
}

const MOOD_LABELS = ['', 'Slecht', 'Matig', 'Oké', 'Goed', 'Top']
const ENERGY_LABELS = ['', 'Leeg', 'Laag', 'Oké', 'Goed', 'Top']

export default function JournalView() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [entry, setEntry] = useState<JournalEntry | null>(null)
  const [saving, setSaving] = useState(false)
  const [newGratitude, setNewGratitude] = useState('')
  const [recentDates, setRecentDates] = useState<string[]>([])
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [aiQuestion, setAiQuestion] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiAnswer, setAiAnswer] = useState('')

  const [insights, setInsights] = useState<{
    summary: string
    themes: string[]
    energyGivers: string[]
    energyDrainers: string[]
    patterns: string[]
    development: string
  } | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightPeriod, setInsightPeriod] = useState('30')
  const [showInsights, setShowInsights] = useState(false)

  const fetchEntry = useCallback(async (currentDate: string) => {
    const res = await fetch(`/api/journal?date=${currentDate}`)
    const data = await res.json()
    setEntry(data.data || { date: currentDate, content: '', mood: undefined, energy: undefined, gratitude: [], highlights: '' })
  }, [])

  async function fetchInsights(period: string) {
    setInsightsLoading(true)
    setInsightPeriod(period)
    try {
      const res = await fetch('/api/journal/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period }),
      })
      const data = await res.json()
      setInsights(data)
      setShowInsights(true)
    } finally {
      setInsightsLoading(false)
    }
  }

  useEffect(() => { fetchEntry(date) }, [date, fetchEntry])

  useEffect(() => {
    const dates = Array.from({ length: 14 }, (_, i) => format(subDays(new Date(), i), 'yyyy-MM-dd'))
    setRecentDates(dates)
  }, [])

  const save = useCallback(async (updates: Partial<JournalEntry>) => {
    if (!entry) return
    setSaving(true)
    const updated = { ...entry, ...updates }
    setEntry(updated)
    await fetch('/api/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    setTimeout(() => setSaving(false), 500)
  }, [entry])

  const debouncedSave = useCallback((updates: Partial<JournalEntry>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => save(updates), 700)
  }, [save])

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
  }, [])

  const navigate = (delta: number) => {
    const value = new Date(`${date}T12:00:00`)
    value.setDate(value.getDate() + delta)
    if (value <= new Date()) setDate(format(value, 'yyyy-MM-dd'))
  }

  async function askAI() {
    if (!entry) return
    setAiLoading(true)
    setAiQuestion(null)
    setAiAnswer('')
    try {
      const res = await fetch('/api/journal/ai-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: entry.content, mood: entry.mood, energy: entry.energy, date }),
      })
      const data = await res.json()
      setAiQuestion(data.question ?? null)
    } finally {
      setAiLoading(false)
    }
  }

  function submitAiAnswer() {
    if (!aiAnswer.trim() || !entry) return
    const appended = entry.content
      ? `${entry.content}\n\n💬 ${aiQuestion}\n${aiAnswer.trim()}`
      : `💬 ${aiQuestion}\n${aiAnswer.trim()}`
    save({ content: appended })
    setAiQuestion(null)
    setAiAnswer('')
  }

  const addGratitude = () => {
    if (!newGratitude.trim() || !entry) return
    const gratitude = [...entry.gratitude, newGratitude.trim()]
    setNewGratitude('')
    save({ gratitude })
  }

  const removeGratitude = (index: number) => {
    if (!entry) return
    save({ gratitude: entry.gratitude.filter((_, i) => i !== index) })
  }

  const isToday = date === format(new Date(), 'yyyy-MM-dd')

  return (
    <PageShell title="Dagboek" subtitle="Snelle reflectie met vaste structuur. AI stelt vragen en analyseert patronen.">
      <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
        <div className="space-y-4 xl:sticky xl:top-8 xl:self-start">
          <Panel tone="accent">
            <PanelHeader eyebrow="AI" title="Dagboektools" />
            <div className="mt-4 space-y-2">
              <button
                onClick={askAI}
                disabled={aiLoading}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230] disabled:opacity-60"
              >
                <Sparkles size={14} />
                {aiLoading ? 'AI denkt na...' : 'Stel me een vraag'}
              </button>
              <button
                onClick={() => fetchInsights('30')}
                disabled={insightsLoading}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-outline-variant bg-white px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-60"
              >
                <LineChart size={14} className="text-on-surface-variant" />
                {insightsLoading ? 'Laden...' : 'Dagboekinzichten'}
              </button>
            </div>
          </Panel>

          <Panel tone="muted">
            <PanelHeader eyebrow="Recente dagen" title="Navigeer" />
            <div className="mt-4 space-y-1.5">
              {recentDates.map((currentDate) => (
                <button
                  key={currentDate}
                  onClick={() => setDate(currentDate)}
                  className={cn(
                    'w-full rounded-lg px-3 py-2.5 text-left text-xs font-medium transition-all',
                    currentDate === date ? 'bg-accent text-white' : 'text-on-surface hover:bg-surface-container'
                  )}
                >
                  <span className="capitalize">{format(new Date(`${currentDate}T12:00:00`), 'EEEE', { locale: nl })}</span>
                  <span className={cn('ml-2 text-[10px]', currentDate === date ? 'text-white/70' : 'text-on-surface-variant')}>
                    {format(new Date(`${currentDate}T12:00:00`), 'd MMM', { locale: nl })}
                  </span>
                </button>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant bg-white text-on-surface-variant hover:bg-surface-container-low">
                <ChevronLeft size={16} />
              </button>
              <div className="flex-1 text-center">
                <h2 className="text-base font-extrabold capitalize text-on-surface">
                  {format(new Date(`${date}T12:00:00`), 'EEEE d MMMM yyyy', { locale: nl })}
                </h2>
                {isToday && <span className="text-[10px] font-semibold text-on-surface-variant">Vandaag</span>}
              </div>
              {entry?.id && (
                <AIContextButton type="journal" title={`Dagboek ${date}`} content={entry.content?.slice(0, 300)} id={entry.id} />
              )}
              <button onClick={() => navigate(1)} disabled={isToday} className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant bg-white text-on-surface-variant hover:bg-surface-container-low disabled:opacity-30">
                <ChevronRight size={16} />
              </button>
            </div>
          </Panel>

          {insightsLoading && (
            <Panel>
              <div className="flex flex-col items-center py-10">
                <Sparkles className="animate-pulse text-on-surface-variant" size={24} />
                <p className="mt-3 text-sm text-on-surface-variant">AI analyseert je dagboekentries...</p>
              </div>
            </Panel>
          )}

          {showInsights && insights && !insightsLoading && (
            <Panel>
              <div className="flex items-center justify-between">
                <PanelHeader eyebrow="Dagboekinzichten" title="Analyse" />
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {['7', '30', '90', 'all'].map((p) => (
                      <button
                        key={p}
                        onClick={() => fetchInsights(p)}
                        className={cn(
                          'rounded-full px-2.5 py-1 text-[10px] font-bold transition-all',
                          insightPeriod === p ? 'bg-accent text-white' : 'text-on-surface-variant hover:text-on-surface'
                        )}
                      >
                        {p === 'all' ? 'Alles' : `${p}d`}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowInsights(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-outline-variant bg-surface-container-low p-4">
                <p className="text-sm italic leading-7 text-on-surface-variant">&quot;{insights.summary}&quot;</p>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Lightbulb size={13} className="text-amber-500" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/75">Thema&apos;s</p>
                  </div>
                  <ul className="space-y-1.5">
                    {insights.themes.map((t, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-on-surface-variant/50" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <TrendingUp size={13} className="text-blue-500" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/75">Ontwikkeling</p>
                  </div>
                  <p className="text-sm leading-7 text-on-surface-variant">{insights.development}</p>
                </div>
                <div className="rounded-2xl border border-outline-variant bg-white/70 p-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <Zap size={12} className="text-emerald-500" />
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Geeft energie</p>
                  </div>
                  <ul className="space-y-1">
                    {insights.energyGivers.map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-on-surface-variant">
                        <Plus size={9} className="text-emerald-400" /> {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-outline-variant bg-white/70 p-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <Zap size={12} className="text-orange-500" />
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-600">Kost energie</p>
                  </div>
                  <ul className="space-y-1">
                    {insights.energyDrainers.map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-on-surface-variant">
                        <span className="text-orange-400">−</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {insights.patterns && insights.patterns.length > 0 && (
                <div className="mt-4 border-t border-outline-variant pt-4">
                  <div className="mb-2 flex items-center gap-2">
                    <BarChart3 size={13} className="text-violet-500" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/75">Patronen</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {insights.patterns.map((p, i) => (
                      <div key={i} className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
                        {p}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          )}

          {entry && (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-5">
                <Panel>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/75">Hoe was je dag?</p>
                  <textarea
                    value={entry.content}
                    onChange={(e) => {
                      setEntry((prev) => prev ? { ...prev, content: e.target.value } : prev)
                      debouncedSave({ content: e.target.value })
                    }}
                    placeholder="Schrijf rauw op wat er gebeurde, wat je dacht en wat opviel."
                    className="min-h-[220px] w-full resize-none bg-transparent text-sm leading-7 text-on-surface outline-none placeholder:text-on-surface-variant"
                  />
                  {saving && <p className="text-right text-[10px] text-on-surface-variant">Opslaan...</p>}
                </Panel>

                {aiQuestion && (
                  <Panel tone="accent">
                    <div className="mb-3 flex items-center gap-2">
                      <Sparkles size={14} className="text-on-surface-variant" />
                      <p className="text-sm font-semibold text-on-surface">AI-vraag</p>
                    </div>
                    <p className="mb-3 text-sm leading-7 text-on-surface-variant">{aiQuestion}</p>
                    <div className="flex gap-2">
                      <textarea
                        value={aiAnswer}
                        onChange={(e) => setAiAnswer(e.target.value)}
                        placeholder="Jouw antwoord..."
                        rows={3}
                        className="flex-1 resize-none rounded-2xl border border-outline-variant bg-white px-4 py-3 text-sm leading-7 text-on-surface outline-none placeholder:text-on-surface-variant"
                      />
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={submitAiAnswer}
                          disabled={!aiAnswer.trim()}
                          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-white transition-colors hover:bg-[#2a3230] disabled:opacity-40"
                        >
                          <Send size={14} />
                        </button>
                        <button
                          onClick={() => setAiQuestion(null)}
                          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-outline-variant bg-white text-on-surface-variant hover:bg-surface-container-low"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </Panel>
                )}

                <Panel>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/75">Hoogtepunten en lessen</p>
                  <textarea
                    value={entry.highlights || ''}
                    onChange={(e) => {
                      setEntry((prev) => prev ? { ...prev, highlights: e.target.value } : prev)
                      debouncedSave({ highlights: e.target.value })
                    }}
                    placeholder="Wat was het beste stuk van vandaag? Wat neem je mee naar morgen?"
                    className="min-h-[120px] w-full resize-none bg-transparent text-sm leading-7 text-on-surface outline-none placeholder:text-on-surface-variant"
                  />
                </Panel>
              </div>

              <div className="space-y-5">
                <Panel>
                  <div className="mb-3 flex items-center gap-2">
                    <Smile size={14} className="text-on-surface-variant" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/75">Stemming</p>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        onClick={() => save({ mood: value })}
                        className={cn(
                          'rounded-2xl py-2 text-lg transition-all',
                          entry.mood === value ? 'bg-accent shadow-sm' : 'bg-surface-container-low hover:bg-surface-container'
                        )}
                      >
                        {['😔', '😕', '😐', '🙂', '😄'][value - 1]}
                      </button>
                    ))}
                  </div>
                  {entry.mood && <p className="mt-2 text-center text-xs text-on-surface-variant">{MOOD_LABELS[entry.mood]}</p>}
                </Panel>

                <Panel>
                  <div className="mb-3 flex items-center gap-2">
                    <Zap size={14} className="text-on-surface-variant" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/75">Energie</p>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        onClick={() => save({ energy: value })}
                        className={cn(
                          'rounded-2xl py-2 text-sm font-bold transition-all',
                          entry.energy === value ? 'bg-accent text-white shadow-sm' : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                        )}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                  {entry.energy && <p className="mt-2 text-center text-xs text-on-surface-variant">{ENERGY_LABELS[entry.energy]}</p>}
                </Panel>

                <Panel>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/75">Dankbaarheid</p>
                  <div className="space-y-2">
                    {entry.gratitude.map((item, index) => (
                      <div key={`${item}-${index}`} className="flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface-container-low px-3 py-2">
                        <span className="text-on-surface-variant">✦</span>
                        <span className="flex-1 text-sm text-on-surface">{item}</span>
                        <button onClick={() => removeGratitude(index)} className="text-on-surface-variant hover:text-[#a55a2c]">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={newGratitude}
                      onChange={(e) => setNewGratitude(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addGratitude()}
                      placeholder="Waar ben je dankbaar voor?"
                      className="flex-1 rounded-2xl border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
                    />
                    <button
                      onClick={addGratitude}
                      className="flex h-9 w-9 items-center justify-center rounded-2xl bg-accent text-white transition-colors hover:bg-[#2a3230]"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </Panel>

                <div className="flex flex-wrap gap-2">
                  {entry.mood && <ActionPill>Stemming: {MOOD_LABELS[entry.mood]}</ActionPill>}
                  {entry.energy && <ActionPill>Energie: {ENERGY_LABELS[entry.energy]}</ActionPill>}
                  {saving && <ActionPill>Opslaan...</ActionPill>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}
