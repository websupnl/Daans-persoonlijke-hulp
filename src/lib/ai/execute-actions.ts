import { queryOne, execute } from '../db'
import { AIAction } from './action-schema'

export interface ActionResult {
  type: string
  success: boolean
  data?: unknown
  error?: string
  requires_confirmation?: boolean
}

export async function executeActions(
  actions: AIAction[],
  skipConfirmation: boolean = false
): Promise<ActionResult[]> {
  const results: ActionResult[] = []

  for (const action of actions) {
    try {
      const result = await executeSingleAction(action, skipConfirmation)
      results.push(result)
    } catch (err) {
      results.push({
        type: action.type,
        success: false,
        error: err instanceof Error ? err.message : 'Onbekende fout',
      })
    }
  }

  return results
}

async function executeSingleAction(
  action: AIAction,
  _skipConfirmation: boolean
): Promise<ActionResult> {
  switch (action.type) {
    case 'todo_create': {
      const { title, description, priority, due_date, category, project_id } = action.payload
      const row = await queryOne<{ id: number }>(`
        INSERT INTO todos (title, description, priority, due_date, category, project_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [title, description ?? null, priority ?? 'medium', due_date ?? null, category ?? null, project_id ?? null])
      return { type: action.type, success: true, data: { id: row?.id, title } }
    }

    case 'todo_update': {
      const { id, ...updates } = action.payload
      const entries = Object.entries(updates).filter(([, v]) => v !== undefined)
      if (entries.length === 0) return { type: action.type, success: false, error: 'Geen updates opgegeven' }
      const setClauses = entries.map(([k], idx) => `${k} = $${idx + 1}`)
      const values = entries.map(([, v]) => v)
      await execute(`UPDATE todos SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${entries.length + 1}`, [...values, id])
      return { type: action.type, success: true, data: { id } }
    }

    case 'todo_complete': {
      const { title_search } = action.payload
      const todo = await queryOne<{ id: number; title: string }>(`SELECT id, title FROM todos WHERE title LIKE $1 AND completed = 0 LIMIT 1`, [`%${title_search}%`])
      if (!todo) return { type: action.type, success: false, error: `Geen open taak gevonden met "${title_search}"` }
      await execute(`UPDATE todos SET completed = 1, completed_at = NOW(), updated_at = NOW() WHERE id = $1`, [todo.id])
      return { type: action.type, success: true, data: { id: todo.id, title: todo.title } }
    }

    case 'note_create': {
      const { title, content, tags, project_id } = action.payload
      const row = await queryOne<{ id: number }>(`
        INSERT INTO notes (title, content, content_text, tags, project_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [title, content, content, JSON.stringify(tags ?? []), project_id ?? null])
      return { type: action.type, success: true, data: { id: row?.id, title } }
    }

    case 'note_update': {
      const { id, title, content } = action.payload
      await execute(
        `UPDATE notes SET title = COALESCE($1, title), content = COALESCE($2, content), content_text = COALESCE($3, content_text), updated_at = NOW() WHERE id = $4`,
        [title ?? null, content ?? null, content ?? null, id]
      )
      return { type: action.type, success: true, data: { id } }
    }

    case 'project_create': {
      const { title, description, color } = action.payload
      const row = await queryOne<{ id: number }>(`INSERT INTO projects (title, description, color) VALUES ($1, $2, $3) RETURNING id`, [title, description ?? null, color ?? '#6366f1'])
      return { type: action.type, success: true, data: { id: row?.id, title } }
    }

    case 'project_update': {
      const { id, title, status } = action.payload
      await execute(`UPDATE projects SET title = COALESCE($1, title), status = COALESCE($2, status), updated_at = NOW() WHERE id = $3`, [title ?? null, status ?? null, id])
      return { type: action.type, success: true, data: { id } }
    }

    case 'contact_create': {
      const { name, type, email, phone, company, notes } = action.payload
      const row = await queryOne<{ id: number }>(`INSERT INTO contacts (name, type, email, phone, company, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, [name, type ?? 'persoon', email ?? null, phone ?? null, company ?? null, notes ?? null])
      return { type: action.type, success: true, data: { id: row?.id, name } }
    }

    case 'finance_create_expense': {
      const { title, amount, category, description } = action.payload
      const row = await queryOne<{ id: number }>(`INSERT INTO finance_items (type, title, amount, category, description, status) VALUES ('uitgave', $1, $2, $3, $4, 'betaald') RETURNING id`, [title, amount, category ?? null, description ?? null])
      return { type: action.type, success: true, data: { id: row?.id } }
    }

    case 'finance_create_income': {
      const { title, amount, category } = action.payload
      const row = await queryOne<{ id: number }>(`INSERT INTO finance_items (type, title, amount, category, status) VALUES ('inkomst', $1, $2, $3, 'betaald') RETURNING id`, [title, amount, category ?? null])
      return { type: action.type, success: true, data: { id: row?.id } }
    }

    case 'worklog_create': {
      const { title, duration_minutes, context, date, description, project_id, energy_level } = action.payload
      const row = await queryOne<{ id: number }>(`
        INSERT INTO work_logs (title, duration_minutes, context, date, description, project_id, energy_level)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [title, duration_minutes, context, date ?? new Date().toISOString().split('T')[0], description ?? null, project_id ?? null, energy_level ?? null])
      return { type: action.type, success: true, data: { id: row?.id, duration_minutes } }
    }

    case 'journal_create': {
      const { content, mood, energy } = action.payload
      const date = new Date().toISOString().split('T')[0]
      await execute(
        `INSERT INTO journal_entries (date, content, mood, energy) VALUES ($1, $2, $3, $4) ON CONFLICT(date) DO UPDATE SET content = EXCLUDED.content, mood = COALESCE(EXCLUDED.mood, journal_entries.mood), energy = COALESCE(EXCLUDED.energy, journal_entries.energy), updated_at = NOW()`,
        [date, content, mood ?? null, energy ?? null]
      )
      return { type: action.type, success: true, data: { date } }
    }

    case 'habit_log': {
      const { name_search, note } = action.payload
      const habit = await queryOne<{ id: number; name: string }>(`SELECT id, name FROM habits WHERE name LIKE $1 AND active = 1 LIMIT 1`, [`%${name_search}%`])
      if (!habit) return { type: action.type, success: false, error: `Gewoonte "${name_search}" niet gevonden` }
      const date = new Date().toISOString().split('T')[0]
      await execute(
        `INSERT INTO habit_logs (habit_id, logged_date, note) VALUES ($1, $2, $3) ON CONFLICT(habit_id, logged_date) DO NOTHING`,
        [habit.id, date, note ?? null]
      )
      return { type: action.type, success: true, data: { habit_id: habit.id, name: habit.name } }
    }

    case 'memory_store': {
      const { key, value, category, confidence } = action.payload
      await execute(`
        INSERT INTO memory_log (key, value, category, confidence) VALUES ($1, $2, $3, $4)
        ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category, confidence = EXCLUDED.confidence, last_reinforced_at = NOW(), updated_at = NOW()
      `, [key, value, category, confidence])
      return { type: action.type, success: true, data: { key } }
    }

    case 'inbox_capture': {
      const { raw_text, suggested_type, suggested_context } = action.payload
      const row = await queryOne<{ id: number }>(`INSERT INTO inbox_items (raw_text, suggested_type, suggested_context) VALUES ($1, $2, $3) RETURNING id`, [raw_text, suggested_type ?? null, suggested_context ?? null])
      return { type: action.type, success: true, data: { id: row?.id } }
    }

    case 'daily_plan_request':
    case 'weekly_plan_request':
      return { type: action.type, success: true, data: { requested: true } }

    default:
      return { type: (action as AIAction).type, success: false, error: 'Onbekend action type' }
  }
}
