import { query } from '../db'

export interface AIContext {
  currentDate: string
  currentDay: string
  recentTodos: Array<{ id: number; title: string; priority: string; due_date?: string; category?: string }>
  activeProjects: Array<{ id: number; title: string; status: string }>
  memories: Array<{ key: string; value: string; category: string }>
  recentMessages: Array<{ role: string; content: string }>
  recentInbox: Array<{ id: number; raw_text: string; suggested_type?: string }>
  todayWorklogs: Array<{ title: string; duration_minutes: number; context: string }>
  upcomingEvents: Array<{ title: string; date: string; time?: string; type: string }>
}

export async function buildContext(lastN: number = 5): Promise<AIContext> {
  const now = new Date()
  const days = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']

  const [recentTodos, activeProjects, memories, recentMessages, recentInbox, todayWorklogs, upcomingEvents] = await Promise.all([
    query<AIContext['recentTodos'][number]>(`
      SELECT id, title, priority, due_date, category
      FROM todos WHERE completed = 0
      ORDER BY CASE priority WHEN 'hoog' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, due_date ASC
      LIMIT 10
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
  ])

  return {
    currentDate: now.toISOString().split('T')[0],
    currentDay: days[now.getDay()],
    recentTodos,
    activeProjects,
    memories,
    recentMessages: recentMessages.reverse(),
    recentInbox,
    todayWorklogs,
    upcomingEvents,
  }
}

export function formatContextForPrompt(ctx: AIContext): string {
  const parts: string[] = [
    `Huidige datum: ${ctx.currentDate} (${ctx.currentDay})`,
  ]

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

  if (ctx.recentInbox.length > 0) {
    parts.push('\nInbox (onverwerkt):')
    ctx.recentInbox.forEach(i => parts.push(`- [${i.id}] ${i.raw_text}`))
  }

  return parts.join('\n')
}
