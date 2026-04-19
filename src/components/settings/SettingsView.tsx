'use client'

import { useState, useEffect, useCallback } from 'react'
import PageShell, { PageSection } from '@/components/ui/PageShell'
import {
  User, Brain, LayoutGrid, Bell, Trash2, Plus, Check,
  ChevronDown, ChevronUp, Save, RefreshCw, Tag
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Settings {
  debug_mode: boolean
  module_gezondheid: boolean
  module_groceries: boolean
  module_agenda: boolean
  module_financien: boolean
  notification_morning_hour: number
  notification_enabled: boolean
  life_coach_enabled: boolean
  onboarding_completed: boolean
  theme: 'light' | 'dark'
  [key: string]: unknown
}

interface ProfileFact {
  value: string
  type: string
  category: string
  confidence: number
  source: string
}

interface Profile {
  [label: string]: ProfileFact
}

const DEFAULT_SETTINGS: Settings = {
  debug_mode: false,
  module_gezondheid: true,
  module_groceries: true,
  module_agenda: true,
  module_financien: true,
  notification_morning_hour: 8,
  notification_enabled: true,
  life_coach_enabled: true,
  onboarding_completed: false,
  theme: 'light',
}

const MODULE_META: { key: keyof Settings; label: string; desc: string }[] = [
  { key: 'module_gezondheid', label: 'Gezondheid', desc: 'Slaap, energie, symptomen en life coach' },
  { key: 'module_groceries',  label: 'Boodschappen', desc: 'Boodschappenlijst via chat of handmatig' },
  { key: 'module_agenda',     label: 'Agenda',       desc: 'Afspraken, herinneringen en deadlines' },
  { key: 'module_financien',  label: 'Financiën',    desc: 'Uitgaven, inkomsten en saldo-overzicht' },
]

const PROFILE_CATEGORIES = ['persoonlijk', 'werk', 'gezondheid', 'financiën', 'overig']

// ── Toggle ─────────────────────────────────────────────────────────────────────

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200',
        value ? 'bg-accent' : 'bg-outline-variant',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200',
          value ? 'translate-x-4' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  )
}

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({ icon: Icon, title, children }: {
  icon: React.ElementType; title: string; children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low">
      <div className="flex items-center gap-3 border-b border-outline-variant px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Icon size={16} />
        </div>
        <h2 className="text-sm font-semibold text-on-surface">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ── Fact row ──────────────────────────────────────────────────────────────────

function FactRow({
  label, fact, onDelete,
}: { label: string; fact: ProfileFact; onDelete: () => void }) {
  const confidence = Math.round(fact.confidence * 100)
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-outline-variant last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wide">{label}</span>
          <span className="rounded-full border border-outline-variant px-1.5 py-0.5 text-[10px] text-on-surface-variant">{fact.category}</span>
          {confidence < 100 && (
            <span className="text-[10px] text-on-surface-variant/60">{confidence}%</span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-on-surface">{fact.value}</p>
        <p className="mt-0.5 text-[11px] text-on-surface-variant/60">via {fact.source}</p>
      </div>
      <button
        onClick={onDelete}
        className="shrink-0 rounded-md p-1.5 text-on-surface-variant hover:bg-error/10 hover:text-error transition-colors"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SettingsView() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [profile, setProfile] = useState<Profile>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [profileOpen, setProfileOpen] = useState(true)

  // New fact form
  const [newLabel, setNewLabel] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newCategory, setNewCategory] = useState('persoonlijk')
  const [addingFact, setAddingFact] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, pRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/profile'),
      ])
      const sData = await sRes.json()
      const pData = await pRes.json()
      if (sData.data) setSettings(sData.data)
      if (pData.data) setProfile(pData.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function patchSetting(key: string, value: unknown) {
    setSaving(key)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      })
      const data = await res.json()
      if (data.data) setSettings(data.data)
    } finally {
      setSaving(null)
    }
  }

  async function addFact() {
    if (!newLabel.trim() || !newValue.trim()) return
    setAddingFact(true)
    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newLabel.trim(), value: newValue.trim(), category: newCategory, source: 'handmatig' }),
      })
      setNewLabel('')
      setNewValue('')
      await load()
    } finally {
      setAddingFact(false)
    }
  }

  async function deleteFact(label: string) {
    await fetch(`/api/profile?label=${encodeURIComponent(label)}`, { method: 'DELETE' })
    setProfile(p => { const n = { ...p }; delete n[label]; return n })
  }

  const grouped = Object.entries(profile).reduce<Record<string, [string, ProfileFact][]>>((acc, entry) => {
    const cat = entry[1].category || 'overig'
    ;(acc[cat] ??= []).push(entry)
    return acc
  }, {})

  if (loading) {
    return (
      <PageShell title="Instellingen">
        <div className="flex items-center justify-center py-20 text-on-surface-variant">
          <RefreshCw size={18} className="animate-spin mr-2" /> Laden...
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell title="Instellingen" subtitle="Beheer je profiel, modules en AI-gedrag">

      {/* Profiel */}
      <SectionCard icon={User} title="Gebruikersprofiel">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs text-on-surface-variant">
            {Object.keys(profile).length} feiten opgeslagen — de AI gebruikt deze kennis bij elke vraag.
          </p>
          <button
            onClick={() => setProfileOpen(v => !v)}
            className="flex items-center gap-1 text-xs text-on-surface-variant hover:text-on-surface"
          >
            {profileOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {profileOpen ? 'Inklappen' : 'Uitklappen'}
          </button>
        </div>

        {profileOpen && (
          <>
            {Object.keys(profile).length === 0 ? (
              <p className="py-4 text-center text-sm text-on-surface-variant">Nog geen feiten opgeslagen. Voeg hieronder je eerste feit toe.</p>
            ) : (
              <div className="mb-4 space-y-4">
                {PROFILE_CATEGORIES.filter(c => grouped[c]?.length).map(cat => (
                  <div key={cat}>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant/50">{cat}</p>
                    {grouped[cat].map(([label, fact]) => (
                      <FactRow key={label} label={label} fact={fact} onDelete={() => deleteFact(label)} />
                    ))}
                  </div>
                ))}
                {Object.keys(grouped).filter(c => !PROFILE_CATEGORIES.includes(c)).map(cat => (
                  <div key={cat}>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant/50">{cat}</p>
                    {grouped[cat].map(([label, fact]) => (
                      <FactRow key={label} label={label} fact={fact} onDelete={() => deleteFact(label)} />
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Add fact form */}
            <div className="mt-4 rounded-lg border border-dashed border-outline-variant bg-surface-container p-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant/60">
                <Tag size={11} className="inline mr-1" /> Nieuw feit toevoegen
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  placeholder="Label (bijv. 'naam', 'leeftijd')"
                  className="flex-1 rounded-md border border-outline-variant bg-background px-3 py-1.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-accent focus:outline-none"
                />
                <input
                  value={newValue}
                  onChange={e => setNewValue(e.target.value)}
                  placeholder="Waarde"
                  className="flex-1 rounded-md border border-outline-variant bg-background px-3 py-1.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-accent focus:outline-none"
                  onKeyDown={e => e.key === 'Enter' && addFact()}
                />
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  className="rounded-md border border-outline-variant bg-background px-3 py-1.5 text-sm text-on-surface focus:border-accent focus:outline-none"
                >
                  {PROFILE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button
                  onClick={addFact}
                  disabled={addingFact || !newLabel.trim() || !newValue.trim()}
                  className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-40 transition-colors"
                >
                  {addingFact ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
                  Toevoegen
                </button>
              </div>
            </div>
          </>
        )}
      </SectionCard>

      {/* AI & Debug */}
      <SectionCard icon={Brain} title="AI & Debug">
        <div className="space-y-4">
          <SettingRow
            label="Debug modus"
            desc="Toon AI-acties en payload per bericht in de chat"
            saving={saving === 'debug_mode'}
          >
            <Toggle
              value={settings.debug_mode}
              onChange={v => patchSetting('debug_mode', v)}
            />
          </SettingRow>
          <SettingRow
            label="Life coach"
            desc="Proactieve vragen en reflecties in het dagboek"
            saving={saving === 'life_coach_enabled'}
          >
            <Toggle
              value={settings.life_coach_enabled}
              onChange={v => patchSetting('life_coach_enabled', v)}
            />
          </SettingRow>
        </div>
      </SectionCard>

      {/* Modules */}
      <SectionCard icon={LayoutGrid} title="Modules">
        <div className="space-y-4">
          {MODULE_META.map(({ key, label, desc }) => (
            <SettingRow key={key} label={label} desc={desc} saving={saving === key}>
              <Toggle
                value={settings[key] as boolean}
                onChange={v => patchSetting(key, v)}
              />
            </SettingRow>
          ))}
        </div>
      </SectionCard>

      {/* Notificaties */}
      <SectionCard icon={Bell} title="Notificaties">
        <div className="space-y-4">
          <SettingRow
            label="Notificaties actief"
            desc="Telegram-berichten voor ochtendplanning en herinneringen"
            saving={saving === 'notification_enabled'}
          >
            <Toggle
              value={settings.notification_enabled}
              onChange={v => patchSetting('notification_enabled', v)}
            />
          </SettingRow>
          <SettingRow
            label="Ochtendmelding"
            desc="Tijdstip voor de dagelijkse ochtendplanning"
            saving={saving === 'notification_morning_hour'}
          >
            <select
              value={settings.notification_morning_hour}
              onChange={e => patchSetting('notification_morning_hour', parseInt(e.target.value))}
              disabled={!settings.notification_enabled}
              className="rounded-md border border-outline-variant bg-background px-3 py-1.5 text-sm text-on-surface focus:border-accent focus:outline-none disabled:opacity-40"
            >
              {Array.from({ length: 13 }, (_, i) => i + 5).map(h => (
                <option key={h} value={h}>{h}:00</option>
              ))}
            </select>
          </SettingRow>
        </div>
      </SectionCard>

    </PageShell>
  )
}

function SettingRow({
  label, desc, saving, children,
}: { label: string; desc: string; saving?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-on-surface">{label}</p>
          {saving && <RefreshCw size={12} className="animate-spin text-accent" />}
        </div>
        <p className="text-xs text-on-surface-variant">{desc}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
