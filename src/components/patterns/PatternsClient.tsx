'use client'

import { useEffect, useMemo, useState } from 'react'
import { Brain, CheckCircle2, HelpCircle, Lightbulb, RefreshCcw, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import PageShell from '@/components/ui/PageShell'
import { ActionPill, EmptyPanel, MetricTile, Panel, PanelHeader } from '@/components/ui/Panel'

type Pattern = {
  id: number
  category: string
  theory: string
  confidence: number
  status: 'hypothesis' | 'confirmed' | 'dismissed'
  impact_score: number
  source_modules: string[]
  action_potential: string | null
  supporting_data: string | null
  updated_at: string
}

type Question = {
  id: number
  source_module: string
  question: string
  rationale: string | null
  status: 'pending' | 'sent' | 'answered' | 'dismissed'
  priority: number
  confidence: number
  impact_score: number
  created_at: string
}

type Observation = {
  obs_date: string
  module: string
  metric_key: string
  metric_value: number
  metric_text: string | null
}

const TABS = ['confirmed', 'hypothesis', 'questions', 'opportunities', 'viz'] as const

const CATEGORY_LABELS: Record<string, string> = {
  financieel_gedrag: 'Financieel',
  productiviteit: 'Productiviteit',
  emotioneel_patroon: 'Emotioneel',
  gewoonte: 'Gewoontes',
  werk_privé: 'Werk/prive',
  afwezigheid_signaal: 'Afwezigheid',
}

export default function PatternsClient() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('confirmed')
  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [observations, setObservations] = useState<Observation[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)

  const fetchData = async () => {
    try {
      const response = await fetch('/api/patterns')
      const payload = await response.json()
      setPatterns(payload.patterns || [])
      setQuestions(payload.questions || [])
      setObservations(payload.observations || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const runAnalysis = async () => {
    setAnalyzing(true)
    try {
      await fetch('/api/patterns', {
        method: 'POST',
        body: JSON.stringify({ action: 'analyze' }),
      })
      await fetchData()
    } finally {
      setAnalyzing(false)
    }
  }

  const updatePattern = async (id: number, action: 'confirm' | 'dismiss') => {
    await fetch('/api/patterns', {
      method: 'POST',
      body: JSON.stringify({ id, action }),
    })
    fetchData()
  }

  const confirmed = patterns.filter((pattern) => pattern.status === 'confirmed')
  const hypotheses = patterns.filter((pattern) => pattern.status === 'hypothesis')
  const openQuestions = questions.filter((question) => question.status === 'pending' || question.status === 'sent')
  const opportunities = patterns.filter((pattern) => pattern.action_potential)

  const moduleSpread = useMemo(() => {
    const counts = observations.reduce<Record<string, number>>((map, observation) => {
      map[observation.module] = (map[observation.module] || 0) + 1
      return map
    }, {})
    return Object.entries(counts).sort((left, right) => right[1] - left[1])
  }, [observations])

  return (
    <PageShell
      title="Patronen"
      subtitle="Dit scherm moet je een volwassen beeld geven van gedrag, ritme en frictie. Niet als losse AI-gokjes, maar als hypotheses en bevestigde signalen met impact."
      actions={
        <button
          onClick={runAnalysis}
          disabled={analyzing}
          className="inline-flex items-center gap-2 rounded-full bg-[#202625] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230] disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant"
        >
          <RefreshCcw size={15} className={analyzing ? 'animate-spin' : ''} />
          {analyzing ? 'Analyseren...' : 'Nu analyseren'}
        </button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Bevestigd" value={confirmed.length} meta="Patronen die overeind bleven" icon={<CheckCircle2 size={18} />} />
        <MetricTile label="Hypotheses" value={hypotheses.length} meta="Nog te toetsen aannames" icon={<Brain size={18} />} />
        <MetricTile label="Vragen" value={openQuestions.length} meta="Open kennisgaten" icon={<HelpCircle size={18} />} />
        <MetricTile label="Kansen" value={opportunities.length} meta="Acties met potentieel" icon={<Lightbulb size={18} />} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Panel tone="muted">
            <PanelHeader
              eyebrow="Filter"
              title="Kijkrichting"
              description="Niet alles tegelijk. Eerst bevestigde signalen, dan hypotheses, dan open vragen."
            />

            <div className="mt-5 flex flex-wrap gap-2">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                    activeTab === tab ? 'bg-[#202625] text-white' : 'bg-white text-on-surface-variant hover:bg-surface-container-low'
                  )}
                >
                  {tab === 'confirmed' && 'Bevestigd'}
                  {tab === 'hypothesis' && 'Hypotheses'}
                  {tab === 'questions' && 'Vragen'}
                  {tab === 'opportunities' && 'Kansen'}
                  {tab === 'viz' && 'Signalen'}
                </button>
              ))}
            </div>
          </Panel>

          {loading ? (
            <Panel className="min-h-[420px] animate-pulse" />
          ) : (
            <>
              {activeTab === 'confirmed' && (
                <Panel>
                  <PanelHeader
                    eyebrow="Bevestigd"
                    title="Patronen die je serieus kunt nemen"
                    description="Dit zijn geen losse AI-suggesties meer, maar patronen die voldoende vertrouwen hebben opgebouwd."
                  />

                  <div className="mt-5 space-y-3">
                    {confirmed.length === 0 ? (
                      <EmptyPanel
                        title="Nog geen bevestigde patronen"
                        description="Dat is niet erg. Eerst moet er genoeg data en tegenspraak zijn voordat iets echt betrouwbaar wordt."
                      />
                    ) : (
                      confirmed.map((pattern) => <PatternCard key={pattern.id} pattern={pattern} />)
                    )}
                  </div>
                </Panel>
              )}

              {activeTab === 'hypothesis' && (
                <Panel>
                  <PanelHeader
                    eyebrow="Hypotheses"
                    title="Nog te toetsen signalen"
                    description="Hier hoort nuance te zitten: bruikbaar, maar nog niet hard genoeg om blind op te varen."
                  />

                  <div className="mt-5 space-y-3">
                    {hypotheses.length === 0 ? (
                      <EmptyPanel
                        title="Geen actieve hypotheses"
                        description="Op dit moment heeft het systeem geen open aannames die om bevestiging of verwerping vragen."
                      />
                    ) : (
                      hypotheses.map((pattern) => (
                        <PatternCard
                          key={pattern.id}
                          pattern={pattern}
                          onConfirm={() => updatePattern(pattern.id, 'confirm')}
                          onDismiss={() => updatePattern(pattern.id, 'dismiss')}
                        />
                      ))
                    )}
                  </div>
                </Panel>
              )}

              {activeTab === 'questions' && (
                <Panel>
                  <PanelHeader
                    eyebrow="Open vragen"
                    title="Waar het systeem nog context mist"
                    description="Vragen zijn nuttig als ze je minder laten uitleggen in de toekomst. Anders zijn ze alleen maar extra frictie."
                  />

                  <div className="mt-5 space-y-3">
                    {openQuestions.length === 0 ? (
                      <EmptyPanel
                        title="Geen open vragen"
                        description="De engine heeft nu geen expliciete gaten die om verduidelijking vragen."
                      />
                    ) : (
                      openQuestions.map((question) => (
                        <div key={question.id} className="rounded-[24px] border border-black/5 bg-white/70 px-4 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <ActionPill>{question.source_module}</ActionPill>
                                <ActionPill>{`prioriteit ${question.priority}`}</ActionPill>
                              </div>
                              <p className="mt-3 text-sm font-semibold leading-7 text-on-surface">{question.question}</p>
                              {question.rationale && (
                                <p className="mt-2 text-xs leading-6 text-on-surface-variant">{question.rationale}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Panel>
              )}

              {activeTab === 'opportunities' && (
                <Panel>
                  <PanelHeader
                    eyebrow="Kansen"
                    title="Waar de AI handelingsruimte ziet"
                    description="Kansen horen concreet te zijn: iets wat je kunt veranderen, schrappen of verscherpen."
                  />

                  <div className="mt-5 space-y-3">
                    {opportunities.length === 0 ? (
                      <EmptyPanel
                        title="Nog geen concrete kansen"
                        description="Dat hoeft niet negatief te zijn. Een kans moet pas opduiken als de data er echt om vraagt."
                      />
                    ) : (
                      opportunities.map((pattern) => (
                        <div key={pattern.id} className="rounded-[24px] border border-black/5 bg-white/70 px-4 py-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-surface-container-low text-on-surface">
                              <Sparkles size={16} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-on-surface">{pattern.action_potential}</p>
                              <p className="mt-2 text-xs leading-6 text-on-surface-variant">{pattern.theory}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Panel>
              )}

              {activeTab === 'viz' && (
                <Panel>
                  <PanelHeader
                    eyebrow="Signalen"
                    title="Waar de observaties vandaan komen"
                    description="Geen speelgoedgrafieken. Gewoon snel zien welke modules nu het meeste patroonmateriaal leveren."
                  />

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <SignalBlock
                      title="Modules met meeste observaties"
                      items={moduleSpread.slice(0, 6).map(([module, count]) => ({
                        label: module,
                        value: `${count}`,
                      }))}
                    />
                    <SignalBlock
                      title="Recente waarnemingen"
                      items={observations.slice(0, 6).map((observation) => ({
                        label: observation.metric_key,
                        value: observation.module,
                      }))}
                    />
                  </div>
                </Panel>
              )}
            </>
          )}
        </div>

        <div className="space-y-5 xl:sticky xl:top-8 xl:self-start">
          <Panel tone="accent">
            <PanelHeader
              eyebrow="Doel"
              title="Wat patronen hier moeten doen"
              description="Niet voorspellen om het voorspellen, maar gedrag explicieter maken zodat je er iets mee kunt."
            />

            <div className="mt-5 space-y-3 text-sm leading-7 text-on-surface-variant">
              <p>Een goed patroon helpt prioriteren, bijsturen of eerder signaleren dat iets ontspoort.</p>
              <p>Een slecht patroon is alleen slimme taal zonder consequentie voor je gedrag of planning.</p>
            </div>
          </Panel>

          <Panel tone="muted">
            <PanelHeader
              eyebrow="Bronnen"
              title="Module-spreiding"
              description="Hoe breder de bronbasis, hoe interessanter en vaak ook betrouwbaarder het patroonbeeld wordt."
            />

            <div className="mt-5 space-y-3">
              {moduleSpread.length === 0 ? (
                <EmptyPanel
                  title="Nog geen observaties"
                  description="Zonder voldoende observaties blijft patroonherkenning dun. Dit groeit vanzelf mee met gebruik."
                />
              ) : (
                moduleSpread.slice(0, 6).map(([module, count]) => (
                  <div key={module} className="rounded-[22px] border border-black/5 bg-white/70 px-4 py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-on-surface">{module}</p>
                      <ActionPill>{count}</ActionPill>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  )
}

function PatternCard({
  pattern,
  onConfirm,
  onDismiss,
}: {
  pattern: Pattern
  onConfirm?: () => void
  onDismiss?: () => void
}) {
  return (
    <div className="rounded-[26px] border border-black/5 bg-white px-4 py-4 shadow-[0_18px_44px_-36px_rgba(31,37,35,0.28)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ActionPill>{CATEGORY_LABELS[pattern.category] || pattern.category}</ActionPill>
            <ActionPill>{`${Math.round(pattern.confidence * 100)}%`}</ActionPill>
            <ActionPill>{`impact ${Math.round(pattern.impact_score * 100)}%`}</ActionPill>
          </div>
          <p className="mt-3 text-sm font-semibold leading-7 text-on-surface">{pattern.theory}</p>
          {pattern.supporting_data && (
            <p className="mt-3 text-xs leading-6 text-on-surface-variant">{pattern.supporting_data}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {pattern.source_modules.map((module) => (
              <ActionPill key={module}>{module}</ActionPill>
            ))}
          </div>
        </div>
      </div>

      {onConfirm && onDismiss && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={onConfirm}
            className="rounded-full bg-[#202625] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230]"
          >
            Klopt
          </button>
          <button
            onClick={onDismiss}
            className="rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low"
          >
            Niet waar
          </button>
        </div>
      )}
    </div>
  )
}

function SignalBlock({
  title,
  items,
}: {
  title: string
  items: Array<{ label: string; value: string }>
}) {
  return (
    <div className="rounded-[24px] border border-black/5 bg-white/70 px-4 py-4">
      <p className="text-sm font-semibold text-on-surface">{title}</p>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Nog geen data</p>
        ) : (
          items.map((item, index) => (
            <div key={`${item.label}-${index}`} className="flex items-center justify-between gap-3 rounded-[18px] bg-surface-container-low px-3 py-2.5">
              <p className="truncate text-sm text-on-surface">{item.label}</p>
              <span className="text-xs font-medium text-on-surface-variant">{item.value}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
