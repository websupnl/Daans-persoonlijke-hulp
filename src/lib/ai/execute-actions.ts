import { getDb } from '../db'
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
  const db = getDb()

  for (const action of actions) {
    try {
      const result = await executeSingleAction(action, db, skipConfirmation)
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
  db: ReturnType<typeof getDb>,
  _skipConfirmation: boolean
): Promise<ActionResult> {
  switch (action.type) {
    case 'todo_create': {
      const { title, description, priority, due_date, category, project_id } = action.payload
      const result = db.prepare(`
        INSERT INTO todos (title, description, priority, due_date, category, project_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(title, description ?? null, priority ?? 'medium', due_date ?? null, category ?? null, project_id ?? null)
      return { type: action.type, success: true, data: { id: result.lastInsertRowid, title } }
    }

    case 'todo_update': {
      const { id, ...updates } = action.payload
      const setClauses = Object.entries(updates)
        .filter(([, v]) => v !== undefined)
        .map(([k]) => `${k} = ?`)
      if (setClauses.length === 0) return { type: action.type, success: false, error: 'Geen updates opgegeven' }
      const values = Object.entries(updates).filter(([, v]) => v !== undefined).map(([, v]) => v)
      db.prepare(`UPDATE todos SET ${setClauses.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values, id)
      return { type: action.type, success: true, data: { id } }
    }

    case 'todo_complete': {
      const { title_search } = action.payload
      const todo = db.prepare(`SELECT id, title FROM todos WHERE title LIKE ? AND completed = 0 LIMIT 1`).get(`%${title_search}%`) as { id: number; title: string } | undefined
      if (!todo) return { type: action.type, success: false, error: `Geen open taak gevonden met "${title_search}"` }
      db.prepare(`UPDATE todos SET completed = 1, completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(todo.id)
      return { type: action.type, success: true, data: { id: todo.id, title: todo.title } }
    }

    case 'note_create': {
      const { title, content, tags, project_id } = action.payload
      const result = db.prepare(`
        INSERT INTO notes (title, content, content_text, tags, project_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(title, content, content, JSON.stringify(tags ?? []), project_id ?? null)
      return { type: action.type, success: true, data: { id: result.lastInsertRowid, title } }
    }

    case 'note_update': {
      const { id, title, content } = action.payload
      db.prepare(`UPDATE notes SET title = COALESCE(?, title), content = COALESCE(?, content), content_text = COALESCE(?, content_text), updated_at = datetime('now') WHERE id = ?`).run(title ?? null, content ?? null, content ?? null, id)
      return { type: action.type, success: true, data: { id } }
    }

    case 'project_create': {
      const { title, description, color } = action.payload
      const result = db.prepare(`INSERT INTO projects (title, description, color) VALUES (?, ?, ?)`).run(title, description ?? null, color ?? '#6366f1')
      return { type: action.type, success: true, data: { id: result.lastInsertRowid, title } }
    }

    case 'project_update': {
      const { id, title, status } = action.payload
      db.prepare(`UPDATE projects SET title = COALESCE(?, title), status = COALESCE(?, status), updated_at = datetime('now') WHERE id = ?`).run(title ?? null, status ?? null, id)
      return { type: action.type, success: true, data: { id } }
    }

    case 'contact_create': {
      const { name, type, email, phone, company, notes } = action.payload
      const result = db.prepare(`INSERT INTO contacts (name, type, email, phone, company, notes) VALUES (?, ?, ?, ?, ?, ?)`).run(name, type ?? 'persoon', email ?? null, phone ?? null, company ?? null, notes ?? null)
      return { type: action.type, success: true, data: { id: result.lastInsertRowid, name } }
    }

    case 'finance_create_expense': {
      const { title, amount, category, description } = action.payload
      const result = db.prepare(`INSERT INTO finance_items (type, title, amount, category, description, status) VALUES ('uitgave', ?, ?, ?, ?, 'betaald')`).run(title, amount, category ?? null, description ?? null)
      return { type: action.type, success: true, data: { id: result.lastInsertRowid } }
    }

    case 'finance_create_income': {
      const { title, amount, category } = action.payload
      const result = db.prepare(`INSERT INTO finance_items (type, title, amount, category, status) VALUES ('inkomst', ?, ?, ?, 'betaald')`).run(title, amount, category ?? null)
      return { type: action.type, success: true, data: { id: result.lastInsertRowid } }
    }

    case 'worklog_create': {
      const { title, duration_minutes, context, date, description, project_id, energy_level } = action.payload
      const result = db.prepare(`
        INSERT INTO work_logs (title, duration_minutes, context, date, description, project_id, energy_level)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(title, duration_minutes, context, date ?? new Date().toISOString().split('T')[0], description ?? null, project_id ?? null, energy_level ?? null)
      return { type: action.type, success: true, data: { id: result.lastInsertRowid, duration_minutes } }
    }

    case 'journal_create': {
      const { content, mood, energy } = action.payload
      const date = new Date().toISOString().split('T')[0]
      db.prepare(`INSERT INTO journal_entries (date, content, mood, energy) VALUES (?, ?, ?, ?) ON CONFLICT(date) DO UPDATE SET content = excluded.content, mood = COALESCE(excluded.mood, mood), energy = COALESCE(excluded.energy, energy), updated_at = datetime('now')`).run(date, content, mood ?? null, energy ?? null)
      return { type: action.type, success: true, data: { date } }
    }

    case 'habit_log': {
      const { name_search, note } = action.payload
      const habit = db.prepare(`SELECT id, name FROM habits WHERE name LIKE ? AND active = 1 LIMIT 1`).get(`%${name_search}%`) as { id: number; name: string } | undefined
      if (!habit) return { type: action.type, success: false, error: `Gewoonte "${name_search}" niet gevonden` }
      const date = new Date().toISOString().split('T')[0]
      db.prepare(`INSERT OR IGNORE INTO habit_logs (habit_id, logged_date, note) VALUES (?, ?, ?)`).run(habit.id, date, note ?? null)
      return { type: action.type, success: true, data: { habit_id: habit.id, name: habit.name } }
    }

    case 'memory_store': {
      const { key, value, category, confidence } = action.payload
      db.prepare(`
        INSERT INTO memory_log (key, value, category, confidence) VALUES (?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, category = excluded.category, confidence = excluded.confidence, last_reinforced_at = datetime('now'), updated_at = datetime('now')
      `).run(key, value, category, confidence)
      return { type: action.type, success: true, data: { key } }
    }

    case 'inbox_capture': {
      const { raw_text, suggested_type, suggested_context } = action.payload
      const result = db.prepare(`INSERT INTO inbox_items (raw_text, suggested_type, suggested_context) VALUES (?, ?, ?)`).run(raw_text, suggested_type ?? null, suggested_context ?? null)
      return { type: action.type, success: true, data: { id: result.lastInsertRowid } }
    }

    case 'daily_plan_request':
    case 'weekly_plan_request':
      return { type: action.type, success: true, data: { requested: true } }

    default:
      return { type: (action as AIAction).type, success: false, error: 'Onbekend action type' }
  }
}
