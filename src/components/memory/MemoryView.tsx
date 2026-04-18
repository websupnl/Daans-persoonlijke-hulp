'use client'

import { useEffect, useMemo, useState } from 'react'
import { Brain, Info, Plus, Sparkles, Trash2 } from 'lucide-react'
import { formatRelative } from '@/lib/utils'
import PageShell from '@/components/ui/PageShell'
import { ActionPill, EmptyPanel, MetricTile, Panel, PanelHeader } from '@/components/ui/Panel'

interface MemoryItem {
  id: number
  key: string
  value: string
  category: string
  confidence: number
  last_reinforced_at: string
}

const CATEGORY_LABELS: Record<string, string> = {
  personal_context: 'Persoonlijk',
  business_fact: 'Zakelijk',
  project_fact: 'Project',
  preference: 'Voorkeur',
  routine: 'Routine',
  relationship: 'Relatie',
  work_pattern: 'Werkpatroon',
  general: 'Algemeen',
}

const CATEGORY_ACCENTS: Record<string, string> = {
  personal_context: 'bg-[#f3dce4] text-[#8a4f66]',
  business_fact: 'bg-[#dde8f2] text-[#4e667e]',
  project_fact: 'bg-[#e7def0] text-[#6f5b88]',
  preference: 'bg-[#f3ead6] text-[#8b6d2f]',
  routine: 'bg-[#dfeadf] text-[#4e7053]',
  relationship: 'bg-[#f5e2d6] text-[#9b6941]',
  work_pattern: 'bg-[#d9e9e8] text-[#446f6a]',
  general: 'bg-surface-container text-on-surface-variant',
}

export default function MemoryView() {
  const [memories, setMemories] = useState<MemoryItem[]>([])
  const [keyValue, setKeyValue] = useState('')
  const [value, setValue] = useState('')
  const [category, setCategory] = useState('personal_context')
  const [showAdd, setShowAdd] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult] = useState<string | null>(null)

  async function load() {
    const response = await fetch('/api/memory')
    const payload = await response.json()
    setMemories(payload.memories || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function save() {
    if (!keyValue.trim() || !value.trim()) return
    await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: keyValue, value, category, confidence: 0.9 }),
    })
    setKeyValue('')
    setValue('')
    setShowAdd(false)
    load()
  }

  async function remove(id: number) {
    await fetch('/api/memory', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  async function generate() {
    setGenerating(true)
    setGenResult(null)
    try {
      const response = await fetch('/api/memory/generate', { method: 'POST' })
      const payload = await response.json()
      if (payload.error) {
        setGenResult(`Fout: ${payload.error}`)
        return
      }
      setGenResult(`${payload.saved} nieuwe memories opgeslagen uit je data`)
      load()
    } catch {
      setGenResult('Verbindingsfout')
    } finally {
      setGenerating(false)
    }
  }

  const groupedMemories = useMemo(() => {
    return Object.entries(
      memories.reduce<Record<string, MemoryItem[]>>((groups, memory) => {
        if (!groups[memory.category]) groups[memory.category] = []
        groups[memory.category].push(memory)
        return groups
      }, {})
    ).sort((left, right) => right[1].length - left[1].length)
  }, [memories])

  const highConfidence = memories.filter((memory) => memory.confidence >= 0.8).length

  return (
    <PageShell
      title="Memory"
      subtitle={`${memories.length} opgeslagen feiten. Dit scherm moet laten voelen dat de app echt duurzame context van je opbouwt in plaats van alleen losse chatgeschiedenis te bewaren.`}
      actions={
        <>
          <button
            onClick={generate}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-full bg-[#202625] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230] disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant"
          >
            <Sparkles size={15} />
            {generating ? 'Analyseren...' : 'Analyseer mijn data'}
          </button>
          <button
            onClick={() => setShowAdd((value) => !value)}
            className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low"
          >
            <Plus size={15} />
            Handmatig
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Totaal" value={memories.length} meta="Opslagen feiten en voorkeuren" icon={<Brain size={18} />} />
        <MetricTile label="Sterk bevestigd" value={highConfidence} meta="80% zekerheid of hoger" icon={<Sparkles size={18} />} />
        <MetricTile label="Categorieen" value={groupedMemories.length} meta="Soorten context in gebruik" icon={<Info size={18} />} />
        <MetricTile label="Handmatig" value={showAdd ? 'Open' : 'Dicht'} meta="Direct iets toevoegen" icon={<Plus size={18} />} />
      </div>

      {genResult && (
        <Panel tone="accent">
          <p className="text-sm font-medium leading-7 text-on-surface">{genResult}</p>
        </Panel>
      )}

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-5 xl:sticky xl:top-8 xl:self-start">
          <Panel tone="muted">
            <PanelHeader
              eyebrow="Wat dit is"
              title="Duurzaam geheugen"
              description="Memory moet de feiten bevatten die je assistent structureel nodig heeft: voorkeuren, routines, relaties, zakelijke feiten en terugkerende patronen."
            />

            <div className="mt-5 space-y-3 text-sm leading-7 text-on-surface-variant">
              <p>Chatgeschiedenis is vluchtig. Memory is het deel dat bewust blijft hangen en later gedrag van de app stuurt.</p>
              <p>Als dit goed voelt, vertrouw je sneller op de app omdat je niet steeds dezelfde context hoeft te herhalen.</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <ActionPill>Voorkeuren</ActionPill>
              <ActionPill>Routines</ActionPill>
              <ActionPill>Zakelijke feiten</ActionPill>
            </div>
          </Panel>

          {showAdd && (
            <Panel tone="accent">
              <PanelHeader
                eyebrow="Handmatig toevoegen"
                title="Nieuwe memory"
                description="Gebruik dit alleen voor dingen die echt duurzaam relevant zijn."
              />

              <div className="mt-5 space-y-3">
                <input
                  value={keyValue}
                  onChange={(event) => setKeyValue(event.target.value)}
                  placeholder="Sleutel, bijvoorbeeld uurtarief of ochtendroutine"
                  className="w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
                />
                <textarea
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder="Wat moet het systeem hierover onthouden?"
                  className="min-h-[120px] w-full resize-none rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm leading-7 text-on-surface outline-none placeholder:text-on-surface-variant"
                />
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-on-surface outline-none"
                >
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={save}
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
              eyebrow="Kwaliteit"
              title="Waar je op wilt letten"
              description="Te veel rommel hier maakt het systeem onbetrouwbaar. Te weinig maakt het dom."
            />

            <div className="mt-5 space-y-3 text-sm leading-7 text-on-surface-variant">
              <p>Geen losse trivia. Alleen context die latere acties, antwoorden of prioriteiten echt beter maakt.</p>
              <p>Verwijder dingen die verouderd zijn of geen duurzaam nut meer hebben.</p>
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          {memories.length === 0 ? (
            <Panel>
              <EmptyPanel
                title="Nog geen memories opgeslagen"
                description="Laat de app je data analyseren of voeg handmatig de eerste structurele feiten toe. Pas daarna gaat dit echt als tweede brein voelen."
                action={
                  <button
                    onClick={generate}
                    disabled={generating}
                    className="rounded-full bg-[#202625] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230] disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant"
                  >
                    {generating ? 'Bezig...' : 'Analyseer mijn data'}
                  </button>
                }
              />
            </Panel>
          ) : (
            groupedMemories.map(([memoryCategory, items]) => (
              <Panel key={memoryCategory}>
                <PanelHeader
                  eyebrow={CATEGORY_LABELS[memoryCategory] ?? memoryCategory}
                  title={`${items.length} geheugenitems`}
                  description="Dit zijn de feiten die in deze categorie blijven hangen."
                />

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {items.map((memory) => (
                    <div key={memory.id} className="rounded-[24px] border border-black/5 bg-white/70 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-on-surface">
                            {memory.key.replace(/_/g, ' ')}
                          </p>
                          <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${CATEGORY_ACCENTS[memory.category] ?? CATEGORY_ACCENTS.general}`}>
                            {CATEGORY_LABELS[memory.category] ?? memory.category}
                          </span>
                        </div>
                        <button
                          onClick={() => remove(memory.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-[#a55a2c]"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <p className="mt-4 text-sm leading-7 text-on-surface">{memory.value}</p>

                      <div className="mt-4 flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-container">
                          <div
                            className="h-full rounded-full bg-[#202625]"
                            style={{ width: `${Math.round(memory.confidence * 100)}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-medium text-on-surface-variant">
                          {Math.round(memory.confidence * 100)}%
                        </span>
                      </div>

                      <p className="mt-3 text-xs text-on-surface-variant">
                        Laatst bevestigd {memory.last_reinforced_at ? formatRelative(memory.last_reinforced_at) : 'onbekend'}
                      </p>
                    </div>
                  ))}
                </div>
              </Panel>
            ))
          )}
        </div>
      </div>
    </PageShell>
  )
}
