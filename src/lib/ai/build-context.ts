import { query } from '../db'

export interface AIContext {
  currentDate: string
  currentDay: string
  currentHour: number
  recentTodos: Array<{ id: number; title: string; priority: string; due_date?: string; category?: string }>
  overdueTodoCount: number
  activeProjects: Array<{ id: number; title: string; status: string }>
  memories: Array<{ key: string; value: string; category: string }>
  recentMessages: Array<{ role: string; content: string }>
  recentInbox: Array<{ id: number; raw_text: string; suggested_type?: string }>
  todayWorklogs: Array<{ title: string; duration_minutes: number; context: string }>
  upcomingEvents: Array<{ title: string; date: string; time?: string; type: string }>
  habits: Array<{ name: string; icon: string; completedToday: boolean; streak: number }>
  recentActivity: Array<{ entity_type: string; action: string; title: string; summary?: string }>
  historicalResonance: Array<{ type: string; date: string; excerpt: string }>
  irritationLevel: number
  todayMood?: number
}

export async function buildContext(lastN: number = 5): Promise<AIContext> {
  const now = new Date()
  const days = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']
  const currentHour = now.getHours()

  const [
    recentTodos,
    overdueTodosRaw,
    activeProjects,
    memories,
    recentMessages,
    recentInbox,
    todayWorklogs,
    upcomingEvents,
    habitsRaw,
    recentActivity,
    historicalJournal,
    nostalgiaProject,
    todayJournal,
  ] = await Promise.all([
    query<AIContext['recentTodos'][number]>(`
      SELECT id, title, priority, due_date, category
      FROM todos WHERE completed = 0
      ORDER BY CASE priority WHEN 'hoog' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, due_date ASC
      LIMIT 10
    `),
    query<{ count: string }>(`
      SELECT COUNT(*) as count FROM todos
      WHERE completed = 0 AND due_date IS NOT NULL AND due_date < CURRENT_DATE
    `),
    query<AIContext['activeProjects'][number]>(`
      SELECT id, title, status FROM projects WHERE status = 'actief' LIMIT 8
    `),
    query<AIContext['memories'][number]>(`
      SELECT key, value, category FROM memory_log ORDER BY last_reinforced_at DESC LIMIT 20
    `),
    query<AIContext['recentMessages'][number]>(`
      SELECT role, content FROM chat_messages ORDER BY created_at DESC LIMIT $1
    `, [lastN * 2]),
    query<AIContext['recentInbox'][number]>(`
      SELECT id, raw_text, suggested_type FROM inbox_items WHERE parsed_status = 'pending' ORDER BY created_at DESC LIMIT 5
    `),
    query<AIContext['todayWorklogs'][number]>(`
      SELECT title, COALESCE(actual_duration_minutes, duration_minutes) as duration_minutes, context
      FROM work_logs WHERE date = CURRENT_DATE ORDER BY created_at DESC LIMIT 5
    `).catch(() => [] as AIContext['todayWorklogs']),
    query<AIContext['upcomingEvents'][number]>(`
      SELECT title, TO_CHAR(date, 'YYYY-MM-DD') as date, time, type
      FROM events WHERE date >= CURRENT_DATE AND date <= CURRENT_DATE + INTERVAL '7 days'
      ORDER BY date ASC, time ASC NULLS LAST LIMIT 8
    `).catch(() => [] as AIContext['upcomingEvents']),
    query<{ id: number; name: string; icon: string; logs: string }>(`
      SELECT h.id, h.name, h.icon,
        (SELECT COUNT(*) FROM habit_logs hl WHERE hl.habit_id = h.id AND hl.logged_date = CURRENT_DATE) as completed_today,
        (SELECT COUNT(*) FROM habit_logs hl2 WHERE hl2.habit_id = h.id AND hl2.logged_date >= CURRENT_DATE - INTERVAL '30 days') as recent_count
      FROM habits h WHERE h.active = 1 ORDER BY h.name LIMIT 10
    `).catch(() => []),
    query<AIContext['recentActivity'][number]>(`
      SELECT entity_type, action, title, summary
      FROM activity_log
      ORDER BY created_at DESC
      LIMIT 12
    `).catch(() => []),
    query<{ date: string; content: string; mood: number }>(`
      SELECT TO_CHAR(date, 'YYYY-MM-DD') as date,
             LEFT(content, 200) as content,
             mood
      FROM journal_entries
      WHERE date BETWEEN (CURRENT_DATE - INTERVAL '1 year' - INTERVAL '3 days')
                     AND (CURRENT_DATE - INTERVAL '1 year' + INTERVAL '3 days')
      ORDER BY ABS(EXTRACT(DOY FROM date) - EXTRACT(DOY FROM CURRENT_DATE)) ASC
      LIMIT 2
    `).catch(() => []),
    query<{ id: number; title: string; updated_at: string }>(`
      SELECT id, title, TO_CHAR(updated_at, 'YYYY-MM-DD') as updated_at
      FROM projects WHERE status = 'afgerond'
      ORDER BY RANDOM() LIMIT 1
    `).catch(() => []),
    query<{ mood: number; energy: number }>(`
      SELECT mood, energy FROM journal_entries WHERE date = CURRENT_DATE LIMIT 1
    `).catch(() => []),
  ])

  const habits = (habitsRaw as Array<{ id: number; name: string; icon: string; completed_today: number; recent_count: number }>).map(h => ({
    name: h.name,
    icon: h.icon,
    completedToday: Number(h.completed_today) > 0,
    streak: Number(h.recent_count),
  }))

  const overdueTodoCount = parseInt(overdueTodosRaw[0]?.count ?? '0', 10)

  const totalWorkMinutesToday = (todayWorklogs as AIContext['todayWorklogs']).reduce(
    (s, w) => s + (w.duration_minutes || 0), 0
  )
  const workHoursToday = totalWorkMinutesToday / 60

  const todayMoodValue = (todayJournal as Array<{ mood: number; energy: number }>)[0]?.mood

  let irritationLevel = 0
  irritationLevel += Math.min(overdueTodoCount * 1.5, 4)
  irritationLevel += workHoursToday >= 8 ? 3 : workHoursToday >= 6 ? 1.5 : 0
  if (currentHour >= 22 || currentHour < 6) irritationLevel += 2
  else if (currentHour >= 20) irritationLevel += 1
  if (todayMoodValue !== undefined && todayMoodValue <= 2) irritationLevel += 1.5
  irritationLevel = Math.min(Math.round(irritationLevel), 10)

  const historicalResonance: AIContext['historicalResonance'] = []
  for (const j of historicalJournal as Array<{ date: string; content: string; mood: number }>) {
    if (j.content?.trim()) {
      historicalResonance.push({
        type: 'journal',
        date: j.date,
        excerpt: j.content.slice(0, 150),
      })
    }
  }
  for (const p of nostalgiaProject as Array<{ id: number; title: string; updated_at: string }>) {
    historicalResonance.push({
      type: 'project',
      date: p.updated_at,
      excerpt: `Afgerond project: ${p.title}`,
    })
  }

  return {
    currentDate: now.toISOString().split('T')[0],
    currentDay: days[now.getDay()],
    currentHour,
    recentTodos,
    overdueTodoCount,
    activeProjects,
    memories,
    recentMessages: recentMessages.reverse(),
    recentInbox,
    todayWorklogs,
    upcomingEvents,
    habits,
    recentActivity,
    historicalResonance,
    irritationLevel,
    todayMood: todayMoodValue,
  }
}

export function formatContextForPrompt(ctx: AIContext): string {
  const parts: string[] = [
    `Huidige datum: ${ctx.currentDate} (${ctx.currentDay}), ${ctx.currentHour}:00u`,
  ]

  const irritationLabel =
    ctx.irritationLevel >= 8 ? 'KRITIEK — Zeurbak modus actief' :
    ctx.irritationLevel >= 5 ? 'Verhoogd — licht chagrijnig' :
    ctx.irritationLevel >= 3 ? 'Matig — milde stress' :
    'Normaal — ontspannen'

  parts.push(`\nSysteem status:`)
  parts.push(`- Irritatieniveau: ${ctx.irritationLevel}/10 (${irritationLabel})`)
  parts.push(`- Achterstallige taken: ${ctx.overdueTodoCount}`)
  const workH = Math.round(ctx.todayWorklogs.reduce((s, w) => s + (w.duration_minutes || 0), 0) / 60 * 10) / 10
  parts.push(`- Gewerkt vandaag: ${workH}u`)
  if (ctx.todayMood !== undefined) {
    parts.push(`- Stemming vandaag: ${ctx.todayMood}/5`)
  }

  if (ctx.memories.length > 0) {
    parts.push('\nBekende context over Daan:')
    ctx.memories.forEach(m => parts.push(`- ${m.key}: ${m.value}`))
  }

  if (ctx.activeProjects.length > 0) {
    parts.push('\nActieve projecten:')
    ctx.activeProjects.forEach(p => parts.push(`- [${p.id}] ${p.title}`))
  }

  if (ctx.recentTodos.length > 0) {
    parts.push('\nOpen taken:')
    ctx.recentTodos.forEach(t => {
      const due = t.due_date ? ` (deadline: ${t.due_date})` : ''
      parts.push(`- [${t.id}] ${t.title} [${t.priority}]${due}`)
    })
  }

  if (ctx.upcomingEvents.length > 0) {
    parts.push('\nKomende events (7 dagen):')
    ctx.upcomingEvents.forEach(e => {
      const time = e.time ? ` om ${e.time}` : ''
      parts.push(`- ${e.date}${time}: ${e.title} (${e.type})`)
    })
  }

  if (ctx.todayWorklogs.length > 0) {
    const totalMin = ctx.todayWorklogs.reduce((s, w) => s + (w.duration_minutes || 0), 0)
    parts.push(`\nVandaag gewerkt: ${Math.round(totalMin / 60 * 10) / 10}u totaal`)
    ctx.todayWorklogs.forEach(w => {
      const h = Math.floor((w.duration_minutes || 0) / 60)
      const m = (w.duration_minutes || 0) % 60
      parts.push(`- ${w.title} (${h > 0 ? h + 'u ' : ''}${m > 0 ? m + 'm' : ''}, ${w.context})`)
    })
  }

  if (ctx.habits.length > 0) {
    parts.push('\nGewoontes vandaag:')
    ctx.habits.forEach(h => {
      const status = h.completedToday ? '✓' : '○'
      parts.push(`- ${status} ${h.icon} ${h.name}`)
    })
  }

  if (ctx.recentInbox.length > 0) {
    parts.push('\nInbox (onverwerkt):')
    ctx.recentInbox.forEach(i => parts.push(`- [${i.id}] ${i.raw_text}`))
  }

  if (ctx.recentActivity.length > 0) {
    parts.push('\nRecente activiteit:')
    ctx.recentActivity.forEach((item) => parts.push(`- ${item.entity_type}/${item.action}: ${item.title}${item.summary ? ` - ${item.summary}` : ''}`))
  }

  if (ctx.historicalResonance.length > 0) {
    parts.push('\nFlarden uit het verleden (een jaar geleden / nostalgie):')
    ctx.historicalResonance.forEach(h => parts.push(`- [${h.date}] ${h.excerpt}`))
  }

  return parts.join('\n')
}
