/**
 * DataService — Centrale data laag
 *
 * Eén plek voor alle data-ophaal logica.
 * Alle AI-routes en modules halen data op via deze service.
 * Data readiness checks per module zodat AI niet op lege data vurt.
 */

import { query, queryOne, execute } from './db'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DataReadiness {
  overall: 'ready' | 'minimal' | 'empty'
  score: number // 0-100
  modules: Record<string, ModuleReadiness>
  isNewUser: boolean
}

export interface ModuleReadiness {
  ready: boolean
  count: number
  minRequired: number
  label: string
}

export interface UserProfile {
  [label: string]: {
    value: string
    type: string
    category: string
    confidence: number
    source: string
  }
}

export interface UserSettings {
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

// ── User Profile ──────────────────────────────────────────────────────────────

export async function getUserProfile(): Promise<UserProfile> {
  try {
    const rows = await query<{
      label: string; value: string; data_type: string
      category: string; confidence: number; source: string
    }>(`SELECT label, value, data_type, category, confidence, source FROM user_profile ORDER BY category, label`)

    return Object.fromEntries(rows.map(r => [r.label, {
      value: r.value, type: r.data_type, category: r.category,
      confidence: r.confidence, source: r.source,
    }]))
  } catch { return {} }
}

export async function setUserFact(
  label: string, value: string, options: {
    type?: string; category?: string; confidence?: number; source?: string
  } = {}
) {
  await execute(`
    INSERT INTO user_profile (label, value, data_type, category, confidence, source, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (label) DO UPDATE SET
      value = EXCLUDED.value,
      data_type = EXCLUDED.data_type,
      category = EXCLUDED.category,
      confidence = EXCLUDED.confidence,
      source = EXCLUDED.source,
      updated_at = NOW()
  `, [label, value, options.type ?? 'text', options.category ?? 'algemeen',
      options.confidence ?? 1.0, options.source ?? 'manual'])
}

export async function deleteUserFact(label: string) {
  await execute(`DELETE FROM user_profile WHERE label = $1`, [label])
}

// ── User Settings ─────────────────────────────────────────────────────────────

export async function getUserSettings(): Promise<UserSettings> {
  try {
    const rows = await query<{ key: string; value: string }>(`SELECT key, value FROM user_settings`)
    const raw = Object.fromEntries(rows.map(r => [r.key, r.value]))

    return {
      debug_mode: raw.debug_mode === 'true',
      module_gezondheid: raw.module_gezondheid !== 'false',
      module_groceries: raw.module_groceries !== 'false',
      module_agenda: raw.module_agenda !== 'false',
      module_financien: raw.module_financien !== 'false',
      notification_morning_hour: parseInt(raw.notification_morning_hour ?? '8'),
      notification_enabled: raw.notification_enabled !== 'false',
      life_coach_enabled: raw.life_coach_enabled !== 'false',
      onboarding_completed: raw.onboarding_completed === 'true',
      theme: (raw.theme as 'light' | 'dark') ?? 'light',
      ...raw,
    }
  } catch {
    return {
      debug_mode: false, module_gezondheid: true, module_groceries: true,
      module_agenda: true, module_financien: true, notification_morning_hour: 8,
      notification_enabled: true, life_coach_enabled: true,
      onboarding_completed: false, theme: 'light',
    }
  }
}

export async function setSetting(key: string, value: string) {
  await execute(`
    INSERT INTO user_settings (key, value, updated_at) VALUES ($1, $2, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `, [key, value])
}

export async function getSettingValue(key: string, defaultValue = ''): Promise<string> {
  const row = await queryOne<{ value: string }>(`SELECT value FROM user_settings WHERE key = $1`, [key])
  return row?.value ?? defaultValue
}

// ── Data Readiness ────────────────────────────────────────────────────────────

export async function getDataReadiness(): Promise<DataReadiness> {
  try {
    const [todos, finance, journal, habits, memories, worklogs, profile] = await Promise.all([
      queryOne<{ c: string }>(`SELECT COUNT(*) as c FROM todos`),
      queryOne<{ c: string }>(`SELECT COUNT(*) as c FROM finance_items`),
      queryOne<{ c: string }>(`SELECT COUNT(*) as c FROM journal_entries`),
      queryOne<{ c: string }>(`SELECT COUNT(*) as c FROM habits`),
      queryOne<{ c: string }>(`SELECT COUNT(*) as c FROM memory_log`),
      queryOne<{ c: string }>(`SELECT COUNT(*) as c FROM work_logs`),
      queryOne<{ c: string }>(`SELECT COUNT(*) as c FROM user_profile`),
    ])

    const modules: Record<string, ModuleReadiness> = {
      todos:    { ready: +todos!.c >= 3,    count: +todos!.c,    minRequired: 3,  label: 'Taken' },
      finance:  { ready: +finance!.c >= 5,  count: +finance!.c,  minRequired: 5,  label: 'Financiën' },
      journal:  { ready: +journal!.c >= 3,  count: +journal!.c,  minRequired: 3,  label: 'Dagboek' },
      habits:   { ready: +habits!.c >= 1,   count: +habits!.c,   minRequired: 1,  label: 'Gewoontes' },
      memories: { ready: +memories!.c >= 5, count: +memories!.c, minRequired: 5,  label: 'Geheugen' },
      worklogs: { ready: +worklogs!.c >= 3, count: +worklogs!.c, minRequired: 3,  label: 'Werklogs' },
      profile:  { ready: +profile!.c >= 3,  count: +profile!.c,  minRequired: 3,  label: 'Profiel' },
    }

    const readyCount = Object.values(modules).filter(m => m.ready).length
    const score = Math.round((readyCount / Object.keys(modules).length) * 100)
    const isNewUser = score < 20
    const overall = score >= 60 ? 'ready' : score >= 20 ? 'minimal' : 'empty'

    return { overall, score, modules, isNewUser }
  } catch {
    return {
      overall: 'empty', score: 0, isNewUser: true,
      modules: {},
    }
  }
}

// ── Module Data Fetchers ──────────────────────────────────────────────────────

export async function getTodos(options: { limit?: number; filter?: string } = {}) {
  const { limit = 20, filter } = options
  const where = filter === 'today'
    ? `AND t.due_date::date = CURRENT_DATE`
    : filter === 'overdue'
    ? `AND t.due_date::date < CURRENT_DATE`
    : ''

  return query(`
    SELECT t.*, p.title as project_title
    FROM todos t LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.completed = 0 ${where}
    ORDER BY CASE t.priority WHEN 'hoog' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END
    LIMIT $1
  `, [limit])
}

export async function getFinanceSummary(days = 30) {
  const [items, balance] = await Promise.all([
    query(`
      SELECT type, category, SUM(amount) as total, COUNT(*) as count
      FROM finance_items
      WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY type, category ORDER BY total DESC
    `),
    query(`SELECT account_name, balance, currency FROM finance_balances ORDER BY balance DESC`),
  ])
  return { items, balance }
}

export async function getMemories(limit = 30) {
  return query<{ key: string; value: string; category: string; confidence: number }>(
    `SELECT key, value, category, confidence FROM memory_log ORDER BY last_reinforced_at DESC LIMIT $1`,
    [limit]
  )
}

export async function getHealthToday() {
  return queryOne(`SELECT * FROM health_logs WHERE log_date = CURRENT_DATE`)
}

export async function upsertHealthLog(data: {
  log_date?: string
  sleep_start?: string; sleep_end?: string; sleep_hours?: number; sleep_quality?: number
  energy_level?: number; stress_level?: number; pain_score?: number; pain_location?: string
  water_glasses?: number; symptoms?: string[]; medications?: string[]; notes?: string
}) {
  const { log_date, ...rest } = data
  const fields = Object.entries(rest).filter(([, v]) => v !== undefined)
  if (fields.length === 0) return

  const sets = fields.map(([k], i) => `${k} = $${i + 1}`).join(', ')
  const values = fields.map(([, v]) => v)
  const dateParam = log_date || new Date().toISOString().split('T')[0]

  await execute(`
    INSERT INTO health_logs (log_date, ${fields.map(([k]) => k).join(', ')}, updated_at)
    VALUES ($${values.length + 1}, ${values.map((_, i) => `$${i + 1}`).join(', ')}, NOW())
    ON CONFLICT (log_date) DO UPDATE SET ${sets}, updated_at = NOW()
  `, [...values, dateParam])
}

// ── Context string voor AI prompts ────────────────────────────────────────────

export async function buildUserProfileContext(): Promise<string> {
  const [profile, settings, readiness] = await Promise.all([
    getUserProfile(),
    getUserSettings(),
    getDataReadiness(),
  ])

  const facts = Object.entries(profile)
    .map(([label, fact]) => `${label}: ${fact.value}`)
    .join('\n')

  const lines: string[] = []
  if (facts) lines.push(`=== GEBRUIKERSPROFIEL ===\n${facts}`)
  if (readiness.isNewUser) {
    lines.push(`=== NIEUW GEBRUIKER ===\nDit is een nieuwe gebruiker met weinig data. Wees verwelkomend, help op weg, stel geen vragen over historische data.`)
  }
  if (!settings.notification_enabled) {
    lines.push('Notificaties zijn uitgeschakeld door gebruiker.')
  }

  return lines.join('\n\n')
}

// ── Notification helpers ──────────────────────────────────────────────────────

export async function getNotificationRules() {
  return query(`SELECT * FROM notification_rules WHERE enabled = true ORDER BY schedule_hour`)
}

export async function canSendNotification(ruleId: number, cooldownHours = 1): Promise<boolean> {
  const rule = await queryOne<{ last_sent_at: string; cooldown_hours: number }>(
    `SELECT last_sent_at, cooldown_hours FROM notification_rules WHERE id = $1`,
    [ruleId]
  )
  if (!rule?.last_sent_at) return true
  const hoursSince = (Date.now() - new Date(rule.last_sent_at).getTime()) / 3_600_000
  return hoursSince >= (rule.cooldown_hours ?? cooldownHours)
}

export async function markNotificationSent(ruleId: number, messageHash: string) {
  await execute(
    `UPDATE notification_rules SET last_sent_at = NOW(), last_message_hash = $2 WHERE id = $1`,
    [ruleId, messageHash]
  )
}
