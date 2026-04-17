<<<<<<< HEAD
import { queryOne, execute } from '../db'
=======
import { queryOne, execute, query } from '../db'
import { logActivity, syncEntityLinks } from '../activity'
>>>>>>> origin/main
import { AIAction } from './action-schema'

export interface ActionResult {
  type: string
  success: boolean
<<<<<<< HEAD
  data?: unknown
  error?: string
  requires_confirmation?: boolean
}

export async function executeActions(
  actions: AIAction[],
  skipConfirmation: boolean = false
=======
  data?: any
  error?: string
}

export async function executeActions(
  actions: AIAction[]
>>>>>>> origin/main
): Promise<ActionResult[]> {
  const results: ActionResult[] = []

  for (const action of actions) {
    try {
<<<<<<< HEAD
      const result = await executeSingleAction(action, skipConfirmation)
      results.push(result)
    } catch (err) {
=======
      const result = await executeSingleAction(action)
      results.push(result)
    } catch (err) {
      console.error(`[executeActions] Error executing ${action.type}:`, err)
>>>>>>> origin/main
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
<<<<<<< HEAD
  action: AIAction,
  _skipConfirmation: boolean
=======
  action: AIAction
>>>>>>> origin/main
): Promise<ActionResult> {
  switch (action.type) {
    case 'todo_create': {
      const { title, description, priority, due_date, category, project_id } = action.payload
      const row = await queryOne<{ id: number }>(`
        INSERT INTO todos (title, description, priority, due_date, category, project_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
<<<<<<< HEAD
      `, [title, description ?? null, priority ?? 'medium', due_date ?? null, category ?? null, project_id ?? null])
=======
      `, [title, description ?? null, priority ?? 'medium', due_date ?? null, category ?? 'overig', project_id ?? null])
      
      if (row?.id) {
        await logActivity({
          entityType: 'todo',
          entityId: row.id,
          action: 'created',
          title,
          summary: 'Todo aangemaakt via AI assistant',
        })
      }
>>>>>>> origin/main
      return { type: action.type, success: true, data: { id: row?.id, title } }
    }

    case 'todo_update': {
      const { id, ...updates } = action.payload
      const entries = Object.entries(updates).filter(([, v]) => v !== undefined)
<<<<<<< HEAD
      if (entries.length === 0) return { type: action.type, success: false, error: 'Geen updates opgegeven' }
=======
      if (entries.length === 0) return { type: action.type, success: false, error: 'Geen updates' }
>>>>>>> origin/main
      const setClauses = entries.map(([k], idx) => `${k} = $${idx + 1}`)
      const values = entries.map(([, v]) => v)
      await execute(`UPDATE todos SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${entries.length + 1}`, [...values, id])
      return { type: action.type, success: true, data: { id } }
    }

    case 'todo_complete': {
      const { title_search } = action.payload
<<<<<<< HEAD
      const todo = await queryOne<{ id: number; title: string }>(`SELECT id, title FROM todos WHERE title LIKE $1 AND completed = 0 LIMIT 1`, [`%${title_search}%`])
      if (!todo) return { type: action.type, success: false, error: `Geen open taak gevonden met "${title_search}"` }
=======
      const todo = await queryOne<{ id: number; title: string }>(`
        SELECT id, title FROM todos 
        WHERE (title ILIKE $1 OR $1 ILIKE '%' || title || '%') AND completed = 0 
        LIMIT 1
      `, [`%${title_search}%`])
      if (!todo) return { type: action.type, success: false, error: `Geen open taak gevonden voor "${title_search}"` }
>>>>>>> origin/main
      await execute(`UPDATE todos SET completed = 1, completed_at = NOW(), updated_at = NOW() WHERE id = $1`, [todo.id])
      return { type: action.type, success: true, data: { id: todo.id, title: todo.title } }
    }

<<<<<<< HEAD
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
=======
    case 'worklog_create': {
      const { title, duration_minutes, context, date, description, project_id } = action.payload
      const row = await queryOne<{ id: number }>(`
        INSERT INTO work_logs (title, duration_minutes, actual_duration_minutes, context, date, description, project_id, source)
        VALUES ($1, $2, $2, $3, $4, $5, $6, 'ai')
        RETURNING id
      `, [title, duration_minutes, context, date ?? new Date().toISOString().split('T')[0], description ?? null, project_id ?? null])

      // Smart side-effect: auto-complete related todo
      const relatedTodo = await queryOne<{ id: number; title: string }>(`
        SELECT id, title FROM todos 
        WHERE completed = 0 AND (title ILIKE $1 OR $1 ILIKE '%' || title || '%')
        LIMIT 1
      `, [title])
      if (relatedTodo) {
        await execute('UPDATE todos SET completed = 1, completed_at = NOW(), updated_at = NOW() WHERE id = $1', [relatedTodo.id])
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

    case 'event_create': {
      const { title, date, time, type, description, duration } = action.payload
      const row = await queryOne<{ id: number }>(`
        INSERT INTO events (title, date, time, type, description, duration)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [title, date, time ?? null, type ?? 'algemeen', description ?? null, duration ?? 60])
      return { type: action.type, success: true, data: { id: row?.id, title, date, time } }
>>>>>>> origin/main
    }

    case 'habit_log': {
      const { name_search, note } = action.payload
<<<<<<< HEAD
      const habit = await queryOne<{ id: number; name: string }>(`SELECT id, name FROM habits WHERE name LIKE $1 AND active = 1 LIMIT 1`, [`%${name_search}%`])
      if (!habit) return { type: action.type, success: false, error: `Gewoonte "${name_search}" niet gevonden` }
      const date = new Date().toISOString().split('T')[0]
      await execute(
        `INSERT INTO habit_logs (habit_id, logged_date, note) VALUES ($1, $2, $3) ON CONFLICT(habit_id, logged_date) DO NOTHING`,
        [habit.id, date, note ?? null]
      )
      return { type: action.type, success: true, data: { habit_id: habit.id, name: habit.name } }
=======
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
>>>>>>> origin/main
    }

    case 'memory_store': {
      const { key, value, category, confidence } = action.payload
      await execute(`
        INSERT INTO memory_log (key, value, category, confidence) VALUES ($1, $2, $3, $4)
        ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category, confidence = EXCLUDED.confidence, last_reinforced_at = NOW(), updated_at = NOW()
      `, [key, value, category, confidence])
      return { type: action.type, success: true, data: { key } }
    }

<<<<<<< HEAD
    case 'inbox_capture': {
      const { raw_text, suggested_type, suggested_context } = action.payload
      const row = await queryOne<{ id: number }>(`INSERT INTO inbox_items (raw_text, suggested_type, suggested_context) VALUES ($1, $2, $3) RETURNING id`, [raw_text, suggested_type ?? null, suggested_context ?? null])
      return { type: action.type, success: true, data: { id: row?.id } }
    }

    case 'event_create': {
      const { title, date, time, type, description, duration } = action.payload
      const row = await queryOne<{ id: number }>(`
        INSERT INTO events (title, date, time, type, description, duration)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [title, date, time ?? null, type ?? 'algemeen', description ?? null, duration ?? 60])
      return { type: action.type, success: true, data: { id: row?.id, title, date } }
    }

    case 'daily_plan_request':
    case 'weekly_plan_request':
      return { type: action.type, success: true, data: { requested: true } }

    default:
      return { type: (action as AIAction).type, success: false, error: 'Onbekend action type' }
=======
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

    case 'inbox_capture': {
      const { raw_text, suggested_type } = action.payload
      const row = await queryOne<{ id: number }>(`
        INSERT INTO inbox_items (raw_text, suggested_type) VALUES ($1, $2) RETURNING id
      `, [raw_text, suggested_type ?? null])
      return { type: action.type, success: true, data: { id: row?.id, raw_text } }
    }

    default:
      // Fallback for actions not explicitly handled yet or handled by original logic
      console.warn(`[executeSingleAction] Unhandled action type: ${action.type}`)
      return { type: action.type, success: false, error: 'Nog niet ondersteund in nieuwe engine' }
>>>>>>> origin/main
  }
}
