import { execute, query, queryOne } from '@/lib/db'
import { logActivity, syncEntityLinks } from '@/lib/activity'
import { format } from 'date-fns'
import type {
  ChatAction,
  ChatRuntimeContext,
  ProjectStatus,
  StoredAction,
  WorkContext,
} from '../types'

export async function executeChatActions(
  actions: ChatAction[],
  _context: ChatRuntimeContext
): Promise<{ actions: StoredAction[] }> {
  const stored: StoredAction[] = []

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'todo_create': {
          const row = await queryOne<{ id: number }>(`
            INSERT INTO todos (title, description, priority, due_date, category, project_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
          `, [
            action.payload.title,
            action.payload.description ?? null,
            action.payload.priority ?? 'medium',
            action.payload.due_date ?? null,
            action.payload.category ?? 'overig',
            action.payload.project_id ?? null,
          ])

          if (row?.id) {
            await syncEntityLinks({
              sourceType: 'todo',
              sourceId: row.id,
              projectId: action.payload.project_id ?? null,
              tags: action.payload.category ? [action.payload.category] : [],
            })
            await logActivity({
              entityType: 'todo',
              entityId: row.id,
              action: 'created',
              title: action.payload.title,
              summary: 'Todo aangemaakt via chat',
              metadata: {
                priority: action.payload.priority ?? 'medium',
                due_date: action.payload.due_date ?? null,
              },
            })
          }

          stored.push({
            type: 'todo_created',
            data: {
              id: row?.id,
              title: action.payload.title,
              due_date: action.payload.due_date ?? null,
              priority: action.payload.priority,
            },
          })
          break
        }

        case 'todo_update': {
          await execute(
            `
              UPDATE todos
              SET title = COALESCE($1, title),
                  priority = COALESCE($2, priority),
                  due_date = COALESCE($3, due_date),
                  updated_at = NOW()
              WHERE id = $4
            `,
            [action.payload.title ?? null, action.payload.priority ?? null, action.payload.due_date ?? null, action.payload.id]
          )
          const todo = await queryOne<{ title: string }>('SELECT title FROM todos WHERE id = $1 LIMIT 1', [action.payload.id])
          stored.push({
            type: 'todo_updated',
            data: {
              id: action.payload.id,
              title: todo?.title ?? action.payload.title,
              priority: action.payload.priority,
              due_date: action.payload.due_date ?? null,
            },
          })
          break
        }

        case 'todo_complete': {
          const todo = await queryOne<{ id: number; title: string }>('SELECT id, title FROM todos WHERE id = $1 LIMIT 1', [action.payload.id])
          if (!todo) break
          await execute('UPDATE todos SET completed = 1::smallint, completed_at = NOW(), updated_at = NOW() WHERE id = $1', [todo.id])
          stored.push({ type: 'todo_completed', data: { id: todo.id, title: todo.title } })
          break
        }

        case 'todo_delete': {
          const todo = await queryOne<{ id: number; title: string }>('SELECT id, title FROM todos WHERE id = $1 LIMIT 1', [action.payload.id])
          if (!todo) break
          await execute('DELETE FROM todos WHERE id = $1', [todo.id])
          stored.push({ type: 'todo_deleted', data: { id: todo.id, title: todo.title } })
          break
        }

        case 'todo_delete_many': {
          const rows = await query<{ title: string }>('SELECT title FROM todos WHERE id = ANY($1::int[])', [action.payload.ids])
          await execute('DELETE FROM todos WHERE id = ANY($1::int[])', [action.payload.ids])
          stored.push({ type: 'todos_deleted', data: { count: action.payload.ids.length, titles: rows.map((row) => row.title) } })
          break
        }

        case 'event_create': {
          const row = await queryOne<{ id: number }>(`
            INSERT INTO events (title, description, date, time, duration, type, project_id, contact_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
          `, [
            action.payload.title,
            action.payload.description ?? null,
            action.payload.date,
            action.payload.time ?? null,
            action.payload.duration ?? 60,
            action.payload.type ?? 'algemeen',
            action.payload.project_id ?? null,
            action.payload.contact_id ?? null,
          ])
          if (row?.id) {
            await syncEntityLinks({
              sourceType: 'event',
              sourceId: row.id,
              projectId: action.payload.project_id ?? null,
              contactId: action.payload.contact_id ?? null,
              tags: [action.payload.type ?? 'algemeen'],
            })
            await logActivity({
              entityType: 'event',
              entityId: row.id,
              action: 'created',
              title: action.payload.title,
              summary: 'Event aangemaakt via chat',
              metadata: { date: action.payload.date, time: action.payload.time ?? null, type: action.payload.type ?? 'algemeen' },
            })
          }
          stored.push({
            type: 'event_created',
            data: {
              id: row?.id,
              title: action.payload.title,
              date: action.payload.date,
              time: action.payload.time ?? null,
              type: action.payload.type,
            },
          })
          break
        }

        case 'event_update': {
          await execute(
            `
              UPDATE events
              SET title = COALESCE($1, title),
                  date = COALESCE($2, date),
                  time = COALESCE($3, time),
                  type = COALESCE($4, type),
                  description = COALESCE($5, description),
                  updated_at = NOW()
              WHERE id = $6
            `,
            [
              action.payload.title ?? null,
              action.payload.date ?? null,
              action.payload.time ?? null,
              action.payload.type ?? null,
              action.payload.description ?? null,
              action.payload.id,
            ]
          )
          const row = await queryOne<{ title: string; date: string; time?: string | null }>(`
            SELECT title, TO_CHAR(date, 'YYYY-MM-DD') as date, time
            FROM events
            WHERE id = $1
            LIMIT 1
          `, [action.payload.id])
          if (!row) break
          stored.push({
            type: 'event_updated',
            data: { id: action.payload.id, title: row.title, date: row.date, time: row.time ?? null },
          })
          break
        }

        case 'worklog_create': {
          const row = await queryOne<{ id: number }>(`
            INSERT INTO work_logs (title, duration_minutes, actual_duration_minutes, context, date, description, project_id, source, type)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'chat', $8)
            RETURNING id
          `, [
            action.payload.title,
            action.payload.duration_minutes,
            action.payload.duration_minutes,
            action.payload.context,
            action.payload.date ?? format(new Date(), 'yyyy-MM-dd'),
            action.payload.description ?? null,
            action.payload.project_id ?? null,
            action.payload.work_type ?? 'deep_work',
          ])

          // AUTO-COMPLETE TASK (Close the loop)
          // Look for an open todo that matches this worklog title
          const relatedTodo = await queryOne<{ id: number; title: string }>(`
            SELECT id, title FROM todos 
            WHERE completed = 0::smallint 
            AND (
              title ILIKE $1 
              OR $2 ILIKE '%' || title || '%'
            )
            LIMIT 1
          `, [action.payload.title, action.payload.title])

          if (relatedTodo) {
            await execute('UPDATE todos SET completed = 1::smallint, completed_at = NOW(), updated_at = NOW() WHERE id = $1', [relatedTodo.id])
            stored.push({ type: 'todo_completed', data: { id: relatedTodo.id, title: relatedTodo.title } })
            
            await logActivity({
              entityType: 'todo',
              entityId: relatedTodo.id,
              action: 'completed',
              title: relatedTodo.title,
              summary: `Automatisch afgevinkt door worklog: "${action.payload.title}"`,
            })
          }

          stored.push({
            type: 'worklog_created',
            data: {
              id: row?.id,
              title: action.payload.title,
              duration_minutes: action.payload.duration_minutes,
              context: action.payload.context,
            },
          })
          break
        }

        case 'worklog_update_last': {
          const latest = await queryOne<{ id: number; title: string }>(`
            SELECT id, title
            FROM work_logs
            ORDER BY created_at DESC
            LIMIT 1
          `)
          if (!latest) break
          await execute(
            `
              UPDATE work_logs
              SET actual_duration_minutes = $1,
                  duration_minutes = $1,
                  updated_at = NOW()
              WHERE id = $2
            `,
            [action.payload.duration_minutes, latest.id]
          )
          stored.push({
            type: 'worklog_updated',
            data: {
              id: latest.id,
              title: latest.title,
              duration_minutes: action.payload.duration_minutes,
            },
          })
          break
        }

        case 'habit_log': {
          try {
            console.log('[Habit Debug] Starting habit logging for:', action.payload.habit_name)
            
            const habit = await findOrCreateHabit(action.payload.habit_name, action.payload.auto_create === true)
            console.log('[Habit Debug] Found/created habit:', habit)
            
            if (!habit) {
              console.log('[Habit Debug] Habit creation failed - no habit returned')
              break
            }

            // Execute habit log insertion
            await execute(
              `
                INSERT INTO habit_logs (habit_id, logged_date, note)
                VALUES ($1, CURRENT_DATE, $2)
                ON CONFLICT(habit_id, logged_date) DO UPDATE SET note = COALESCE(EXCLUDED.note, habit_logs.note)
              `,
              [habit.id, action.payload.note ?? null]
            )
            
            // Verify the log was actually created
            const verifyLog = await queryOne(`
              SELECT id, habit_id, logged_date 
              FROM habit_logs 
              WHERE habit_id = $1 AND logged_date = CURRENT_DATE
            `, [habit.id])
            
            console.log('[Habit Debug] Verification result:', verifyLog)
            
            if (verifyLog) {
              stored.push({ type: 'habit_logged', data: { habit_id: habit.id, habit_name: habit.name } })
              console.log('[Habit Debug] Successfully logged habit:', habit.name)
            } else {
              console.log('[Habit Debug] Verification failed - log not found')
            }
          } catch (err) {
            console.error('[Habit Debug] Error logging habit:', err)
          }
          break
        }

        case 'finance_create_expense': {
          const row = await queryOne<{ id: number }>(`
            INSERT INTO finance_items (type, title, amount, category, description, status)
            VALUES ('uitgave', $1, $2, $3, $4, 'betaald')
            RETURNING id
          `, [action.payload.title, action.payload.amount, action.payload.category ?? 'overig', action.payload.description ?? null])
          stored.push({ type: 'finance_created', data: { id: row?.id, title: action.payload.title, amount: action.payload.amount, kind: 'uitgave' } })
          break
        }

        case 'finance_create_invoice': {
          const row = await queryOne<{ id: number }>(`
            INSERT INTO finance_items (type, title, amount, status, due_date, category)
            VALUES ('factuur', $1, $2, $3, $4, 'overig')
            RETURNING id
          `, [
            action.payload.title,
            action.payload.amount ?? 0,
            action.payload.status ?? 'concept',
            action.payload.due_date ?? null,
          ])
          stored.push({ type: 'finance_created', data: { id: row?.id, title: action.payload.title, amount: action.payload.amount ?? 0, kind: 'factuur' } })
          break
        }

        case 'project_create': {
          const row = await queryOne<{ id: number }>('INSERT INTO projects (title, description) VALUES ($1, $2) RETURNING id', [
            action.payload.title,
            action.payload.description ?? null,
          ])
          stored.push({ type: 'project_created', data: { id: row?.id, title: action.payload.title } })
          break
        }

        case 'project_update': {
          await execute(
            `
              UPDATE projects
              SET title = COALESCE($1, title),
                  status = COALESCE($2, status),
                  updated_at = NOW()
              WHERE id = $3
            `,
            [action.payload.title ?? null, action.payload.status ?? null, action.payload.id]
          )
          const row = await queryOne<{ title: string; status: ProjectStatus }>('SELECT title, status FROM projects WHERE id = $1 LIMIT 1', [action.payload.id])
          if (!row) break
          stored.push({ type: 'project_updated', data: { id: action.payload.id, title: row.title, status: row.status } })
          break
        }

        case 'contact_create': {
          const row = await queryOne<{ id: number }>(`
            INSERT INTO contacts (name, company, email, phone)
            VALUES ($1, $2, $3, $4)
            RETURNING id
          `, [action.payload.name, action.payload.company ?? null, action.payload.email ?? null, action.payload.phone ?? null])
          stored.push({ type: 'contact_created', data: { id: row?.id, name: action.payload.name, company: action.payload.company ?? null } })
          break
        }

        case 'timeline_log': {
          await logActivity({
            entityType: 'timeline',
            action: action.payload.category ?? 'noted',
            title: action.payload.title,
            summary: action.payload.summary,
          })
          stored.push({ type: 'timeline_logged', data: { title: action.payload.title, summary: action.payload.summary, category: action.payload.category } })
          break
        }

        case 'memory_store': {
          await execute(
            `
              INSERT INTO memory_log (key, value, category, confidence)
              VALUES ($1, $2, $3, $4)
              ON CONFLICT(key) DO UPDATE SET
                value = EXCLUDED.value,
                category = EXCLUDED.category,
                confidence = EXCLUDED.confidence,
                last_reinforced_at = NOW(),
                updated_at = NOW()
            `,
            [action.payload.key, action.payload.value, action.payload.category, action.payload.confidence]
          )

          await logActivity({
            entityType: 'memory',
            action: 'stored',
            title: action.payload.key,
            summary: `Memory expliciet opgeslagen: "${action.payload.value}"`,
            metadata: { category: action.payload.category, confidence: action.payload.confidence },
          })

          stored.push({ type: 'memory_saved', data: { key: action.payload.key, value: action.payload.value, category: action.payload.category } })
          break
        }

        case 'inbox_capture': {
          const row = await queryOne<{ id: number }>(`
            INSERT INTO inbox_items (raw_text, suggested_type, suggested_context)
            VALUES ($1, $2, $3)
            RETURNING id
          `, [action.payload.raw_text, action.payload.suggested_type ?? null, action.payload.suggested_context ?? null])

          if (row?.id) {
            await logActivity({
              entityType: 'inbox',
              entityId: row.id,
              action: 'captured',
              title: action.payload.raw_text.slice(0, 80),
              summary: 'Gevangen in de inbox voor latere verwerking',
              metadata: { type: action.payload.suggested_type, context: action.payload.suggested_context },
            })
          }

          stored.push({ type: 'inbox_captured', data: { id: row?.id, text: action.payload.raw_text } })
          break
        }
      }
    } catch (err) {
      console.error('[executeChatActions] Error executing action:', action.type, err)
    }
  }

  return { actions: stored }
}

async function findOrCreateHabit(name: string, autoCreate: boolean): Promise<{ id: number; name: string } | undefined> {
  const existing = await queryOne<{ id: number; name: string }>(`
    SELECT id, name
    FROM habits
    WHERE active = 1 AND name ILIKE $1
    LIMIT 1
  `, [`%${name}%`])

  if (existing) return existing
  if (!autoCreate) return undefined

  const inserted = await queryOne<{ id: number; name: string }>(`
    INSERT INTO habits (name, frequency, target, active)
    VALUES ($1, 'dagelijks', 1, 1)
    RETURNING id, name
  `, [name])

  return inserted
}
