import { queryOne, execute, query } from '../db'
import { logActivity, syncEntityLinks } from '../activity'
import { AIAction } from './action-schema'

function normalizeProjectName(name: string): string {
  return name.toLowerCase().replace(/[\s\-_\.]+/g, '').replace(/[^a-z0-9]/g, '')
}

async function resolveOrCreateProject(projectName: string): Promise<number | null> {
  const normalized = normalizeProjectName(projectName)
  const projects = await query<{ id: number; title: string }>('SELECT id, title FROM projects WHERE status != $1', ['afgerond'])
  const match = projects.find(p => normalizeProjectName(p.title) === normalized)
  if (match) return match.id
  // Fuzzy: check if normalized name is a substring of a project or vice versa
  const fuzzy = projects.find(p => {
    const pn = normalizeProjectName(p.title)
    return pn.includes(normalized) || normalized.includes(pn)
  })
  if (fuzzy) return fuzzy.id
  // Auto-create
  const row = await queryOne<{ id: number }>('INSERT INTO projects (title) VALUES ($1) RETURNING id', [projectName])
  if (row?.id) {
    await logActivity({ entityType: 'project', entityId: row.id, action: 'created', title: projectName, summary: 'Project automatisch aangemaakt via chat' })
  }
  return row?.id ?? null
}

export interface ActionResult {
  type: string
  success: boolean
  data?: any
  error?: string
}

export async function executeActions(
  actions: AIAction[]
): Promise<ActionResult[]> {
  const results: ActionResult[] = []

  console.log(`[executeActions] Starting execution of ${actions.length} actions:`, actions.map(a => a.type))

  for (const action of actions) {
    try {
      console.log(`[executeActions] Executing action:`, action.type, action.payload)
      const result = await executeSingleAction(action)
      console.log(`[executeActions] Action result:`, result)
      results.push(result)
    } catch (err) {
      console.error(`[executeActions] Error executing ${action.type}:`, err)
      results.push({
        type: action.type,
        success: false,
        error: err instanceof Error ? err.message : 'Onbekende fout',
      })
    }
  }

  console.log(`[executeActions] Final results:`, results)
  return results
}

async function executeSingleAction(
  action: AIAction
): Promise<ActionResult> {
  console.log(`[executeSingleAction] Starting action execution for:`, action.type, action.payload)
  
  switch (action.type) {
    case 'todo_create': {
      const { title, description, priority, due_date, category, project_name } = action.payload
      let { project_id } = action.payload
      if (!project_id && project_name) {
        project_id = (await resolveOrCreateProject(project_name)) ?? undefined
      }
      
      console.log(`[executeSingleAction] About to insert todo:`, { title, description, priority, due_date, category, project_id })
      
      const row = await queryOne<{ id: number }>(`
        INSERT INTO todos (title, description, priority, due_date, category, project_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [title, description ?? null, priority ?? 'medium', due_date ?? null, category ?? 'overig', project_id ?? null])
      
      console.log(`[executeSingleAction] Todo insert result:`, row)
      
      if (row?.id) {
        console.log(`[executeSingleAction] Logging activity for todo ID:`, row.id)
        await logActivity({
          entityType: 'todo',
          entityId: row.id,
          action: 'created',
          title,
          summary: 'Todo aangemaakt via AI assistant',
        })
      }
      return { type: action.type, success: true, data: { id: row?.id, title } }
    }

    case 'todo_update': {
      const { id, ...updates } = action.payload
      const entries = Object.entries(updates).filter(([, v]) => v !== undefined)
      if (entries.length === 0) return { type: action.type, success: false, error: 'Geen updates' }
      const setClauses = entries.map(([k], idx) => `${k} = $${idx + 1}`)
      const values = entries.map(([, v]) => v)
      await execute(`UPDATE todos SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${entries.length + 1}`, [...values, id])
      return { type: action.type, success: true, data: { id } }
    }

    case 'todo_delete': {
      const { id } = action.payload as any
      await execute(`DELETE FROM todos WHERE id = $1`, [id])
      return { type: action.type, success: true, data: { id } }
    }

    case 'todo_delete_many': {
      const { ids } = action.payload as any
      if (!ids.length) return { type: action.type, success: true, data: { count: 0 } }
      await execute(`DELETE FROM todos WHERE id = ANY($1)`, [ids])
      return { type: action.type, success: true, data: { count: ids.length } }
    }

    case 'todo_complete': {
      const { title_search } = action.payload
      const todo = await queryOne<{ id: number; title: string }>(`
        SELECT id, title FROM todos 
        WHERE (title ILIKE $1 OR $1 ILIKE '%' || title || '%') AND completed = 0::smallint 
        LIMIT 1
      `, [`%${title_search}%`])
      if (!todo) return { type: action.type, success: false, error: `Geen open taak gevonden voor "${title_search}"` }
      await execute(`UPDATE todos SET completed = 1::smallint, completed_at = NOW(), updated_at = NOW() WHERE id = $1`, [todo.id])
      return { type: action.type, success: true, data: { id: todo.id, title: todo.title } }
    }

    case 'worklog_create': {
      const { title, duration_minutes, context, date, description, project_name } = action.payload
      let { project_id } = action.payload
      if (!project_id && project_name) {
        project_id = (await resolveOrCreateProject(project_name)) ?? undefined
      }
      const row = await queryOne<{ id: number }>(`
        INSERT INTO work_logs (title, duration_minutes, actual_duration_minutes, context, date, description, project_id, source)
        VALUES ($1, $2, $2, $3, $4, $5, $6, 'ai')
        RETURNING id
      `, [title, duration_minutes, context, date ?? new Date().toISOString().split('T')[0], description ?? null, project_id ?? null])

      // Smart side-effect: auto-complete related todo
      const relatedTodo = await queryOne<{ id: number; title: string }>(`
        SELECT id, title FROM todos 
        WHERE completed = 0::smallint AND (title ILIKE $1 OR $1 ILIKE '%' || title || '%')
        LIMIT 1
      `, [title])
      if (relatedTodo) {
        await execute('UPDATE todos SET completed = 1::smallint, completed_at = NOW(), updated_at = NOW() WHERE id = $1', [relatedTodo.id])
        await logActivity({
          entityType: 'todo',
          entityId: relatedTodo.id,
          action: 'completed',
          title: relatedTodo.title,
          summary: `Afgevinkt door worklog: "${title}"`,
        })
      }

      return { type: action.type, success: true, data: { id: row?.id, title, duration_minutes } }
    }

    case 'worklog_update_last': {
      const { duration_minutes } = action.payload
      const lastWorklog = await queryOne<{ id: number }>(`
        SELECT id FROM work_logs 
        WHERE source = 'ai' OR source = 'chat' OR source = 'telegram'
        ORDER BY created_at DESC LIMIT 1
      `)
      if (!lastWorklog) return { type: action.type, success: false, error: 'Geen recente werklog gevonden' }
      await execute(`UPDATE work_logs SET duration_minutes = $1, actual_duration_minutes = $1, updated_at = NOW() WHERE id = $2`, [duration_minutes, lastWorklog.id])
      return { type: action.type, success: true, data: { id: lastWorklog.id, duration_minutes } }
    }

    case 'event_create': {
      const { title, date, time, type, description, duration } = action.payload
      const row = await queryOne<{ id: number }>(`
        INSERT INTO events (title, date, time, type, description, duration)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [title, date, time ?? null, type ?? 'algemeen', description ?? null, duration ?? 60])
      return { type: action.type, success: true, data: { id: row?.id, title, date, time } }
    }

    case 'event_update': {
      const { id, ...updates } = action.payload
      const entries = Object.entries(updates).filter(([, v]) => v !== undefined)
      if (entries.length === 0) return { type: action.type, success: false, error: 'Geen updates' }
      const setClauses = entries.map(([k], idx) => `${k} = $${idx + 1}`)
      const values = entries.map(([, v]) => v)
      await execute(`UPDATE events SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${entries.length + 1}`, [...values, id])
      return { type: action.type, success: true, data: { id } }
    }

    case 'habit_log': {
      const { name_search, note } = action.payload
      const habit = await queryOne<{ id: number; name: string }>(`
        SELECT id, name FROM habits WHERE name ILIKE $1 AND active = 1 LIMIT 1
      `, [`%${name_search}%`])
      if (!habit) return { type: action.type, success: false, error: `Gewoonte "${name_search}" niet gevonden` }
      const date = new Date().toISOString().split('T')[0]
      await execute(
        `INSERT INTO habit_logs (habit_id, logged_date, note) VALUES ($1, $2, $3) ON CONFLICT(habit_id, logged_date) DO UPDATE SET note = EXCLUDED.note`,
        [habit.id, date, note ?? null]
      )
      return { type: action.type, success: true, data: { id: habit.id, name: habit.name } }
    }

    case 'finance_create_expense': {
      const { title, amount, category, description } = action.payload
      const row = await queryOne<{ id: number }>(`
        INSERT INTO finance_items (type, title, amount, category, description, status) 
        VALUES ('uitgave', $1, $2, $3, $4, 'betaald') RETURNING id
      `, [title, amount, category ?? 'overig', description ?? null])
      return { type: action.type, success: true, data: { id: row?.id, title, amount } }
    }

    case 'finance_create_income': {
      const { title, amount, category } = action.payload
      const row = await queryOne<{ id: number }>(`
        INSERT INTO finance_items (type, title, amount, category, status)
        VALUES ('inkomst', $1, $2, $3, 'betaald') RETURNING id
      `, [title, amount, category ?? 'overig'])
      return { type: action.type, success: true, data: { id: row?.id, title, amount } }
    }

    case 'note_create': {
      const { title, content, tags, project_id } = action.payload
      const tagsJson = JSON.stringify(tags ?? [])
      const contentText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      const row = await queryOne<{ id: number }>(`
        INSERT INTO notes (title, content, content_text, tags, project_id)
        VALUES ($1, $2, $3, $4, $5) RETURNING id
      `, [title, content, contentText, tagsJson, project_id ?? null])
      await logActivity({ entityType: 'note', entityId: row?.id, action: 'created', title, summary: 'Note aangemaakt via AI' })
      return { type: action.type, success: true, data: { id: row?.id, title } }
    }

    case 'note_update': {
      const { id, title, content } = action.payload
      const updates: string[] = ['updated_at = NOW()']
      const values: unknown[] = []
      let i = 1
      if (title !== undefined) { updates.push(`title = $${i++}`); values.push(title) }
      if (content !== undefined) {
        const contentText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        updates.push(`content = $${i++}`, `content_text = $${i++}`)
        values.push(content, contentText)
      }
      if (values.length === 0) return { type: action.type, success: false, error: 'Geen updates' }
      values.push(id)
      await execute(`UPDATE notes SET ${updates.join(', ')} WHERE id = $${i}`, values)
      return { type: action.type, success: true, data: { id, title } }
    }

    case 'journal_create': {
      const { content, mood, energy } = action.payload
      const date = new Date().toISOString().split('T')[0]
      await execute(`
        INSERT INTO journal_entries (date, content, mood, energy)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT(date) DO UPDATE SET
          content = EXCLUDED.content,
          mood = COALESCE(EXCLUDED.mood, journal_entries.mood),
          energy = COALESCE(EXCLUDED.energy, journal_entries.energy),
          updated_at = NOW()
      `, [date, content, mood ?? null, energy ?? null])
      
      // Auto-extract habits from journal
      const { extractAndLogHabits } = await import('./habit-extractor')
      extractAndLogHabits(content).then(res => {
        if (res.logged.length > 0) {
          console.log(`[JournalHabits] Auto-logged: ${res.logged.join(', ')}`)
        }
      })

      await logActivity({ entityType: 'journal', action: 'created', title: `Dagboek ${date}`, summary: 'Journal aangemaakt via AI' })
      return { type: action.type, success: true, data: { date, content: content.slice(0, 80) } }
    }

    case 'daily_plan_request':
    case 'weekly_plan_request': {
      const period = action.type === 'daily_plan_request' ? 'day' : 'week'
      return { type: action.type, success: true, data: { period, note: 'Plan wordt gegenereerd via /api/planning' } }
    }

    case 'memory_store': {
      const { key, value, category, confidence } = action.payload
      await execute(`
        INSERT INTO memory_log (key, value, category, confidence) VALUES ($1, $2, $3, $4)
        ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category, confidence = EXCLUDED.confidence, last_reinforced_at = NOW(), updated_at = NOW()
      `, [key, value, category, confidence])
      return { type: action.type, success: true, data: { key } }
    }

    case 'contact_create': {
      const { name, company, email, phone } = action.payload
      const row = await queryOne<{ id: number }>(`
        INSERT INTO contacts (name, company, email, phone) VALUES ($1, $2, $3, $4) RETURNING id
      `, [name, company ?? null, email ?? null, phone ?? null])
      return { type: action.type, success: true, data: { id: row?.id, name } }
    }

    case 'project_create': {
      const { title } = action.payload
      const row = await queryOne<{ id: number }>(`INSERT INTO projects (title) VALUES ($1) RETURNING id`, [title])
      return { type: action.type, success: true, data: { id: row?.id, title } }
    }

    case 'project_update': {
      const { id, ...updates } = action.payload
      const entries = Object.entries(updates).filter(([, v]) => v !== undefined)
      if (entries.length === 0) return { type: action.type, success: false, error: 'Geen updates' }
      const setClauses = entries.map(([k], idx) => `${k} = $${idx + 1}`)
      const values = entries.map(([, v]) => v)
      await execute(`UPDATE projects SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${entries.length + 1}`, [...values, id])
      return { type: action.type, success: true, data: { id } }
    }

    case 'inbox_capture': {
      const { raw_text, suggested_type } = action.payload
      const row = await queryOne<{ id: number }>(`
        INSERT INTO inbox_items (raw_text, suggested_type) VALUES ($1, $2) RETURNING id
      `, [raw_text, suggested_type ?? null])
      return { type: action.type, success: true, data: { id: row?.id, raw_text } }
    }

    case 'timer_start': {
      const { title, context, project_name } = action.payload
      let { project_id } = action.payload
      if (!project_id && project_name) {
        project_id = (await resolveOrCreateProject(project_name)) ?? undefined
      }
      // Stop any running timer first (silent)
      await execute('DELETE FROM active_timers', [])
      const row = await queryOne<{ id: number }>(`
        INSERT INTO active_timers (title, project_id, context, source)
        VALUES ($1, $2, $3, 'chat') RETURNING id
      `, [title, project_id ?? null, context])
      await logActivity({ entityType: 'timer', entityId: row?.id, action: 'started', title, summary: `Timer gestart: ${title}` })
      return { type: action.type, success: true, data: { id: row?.id, title, project_id } }
    }

    case 'timer_stop': {
      const timer = await queryOne<{ id: number; title: string; project_id: number | null; context: string; started_at: string }>(`
        SELECT id, title, project_id, context, started_at FROM active_timers ORDER BY started_at DESC LIMIT 1
      `)
      if (!timer) return { type: action.type, success: false, error: 'Geen actieve timer gevonden' }
      const elapsed = Math.round((Date.now() - new Date(timer.started_at).getTime()) / 60000)
      const duration = Math.max(1, elapsed)
      await execute('DELETE FROM active_timers', [])
      const row = await queryOne<{ id: number }>(`
        INSERT INTO work_logs (title, duration_minutes, actual_duration_minutes, context, project_id, source)
        VALUES ($1, $2, $2, $3, $4, 'timer') RETURNING id
      `, [timer.title, duration, timer.context, timer.project_id ?? null])
      await logActivity({ entityType: 'worklog', entityId: row?.id, action: 'created', title: timer.title, summary: `Timer gestopt na ${duration} minuten` })
      return { type: action.type, success: true, data: { id: row?.id, title: timer.title, duration_minutes: duration } }
    }

    case 'grocery_create': {
      const { title, quantity, category } = action.payload
      const row = await queryOne<{ id: number }>(`
        INSERT INTO groceries (title, quantity, category)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [title, quantity ?? null, category ?? 'overig'])
      if (row?.id) {
        await logActivity({ entityType: 'grocery', entityId: row.id, action: 'created', title, summary: 'Boodschap toegevoegd via AI' })
      }
      return { type: action.type, success: true, data: { id: row?.id, title } }
    }

    case 'grocery_list': {
      const items = await query('SELECT title, quantity FROM groceries WHERE completed = 0 ORDER BY category ASC')
      return { type: action.type, success: true, data: items }
    }

    default: {
      const a = action as any
      console.warn(`[executeSingleAction] Unhandled action type: ${a.type}`)
      return { type: a.type, success: false, error: 'Nog niet ondersteund in nieuwe engine' }
    }
  }
}
