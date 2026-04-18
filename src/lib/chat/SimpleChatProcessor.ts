/**
 * NIEUWE SIMPLE CHAT PROCESSOR
 * 
 * Complete rebuild van de chat architectuur
 * Focus: Simpel, robuust, 100% verification
 * 
 * Flow: Input -> Intent -> Action -> Database -> Verification -> Response
 */

import { execute, queryOne, query } from '@/lib/db'

export interface ChatIntent {
  type: 'todo_add' | 'habit_log' | 'finance_expense' | 'finance_income' | 'event_create' | 'query_work' | 'query_agenda' | 'query_todos' | 'unknown'
  confidence: number
  params: Record<string, any>
  raw: string
}

export interface ActionResult {
  success: boolean
  data?: any
  error?: string
  verified: boolean
}

export interface ChatResponse {
  message: string
  success: boolean
  actions: ActionResult[]
  debug?: any
}

/**
 * Simple Intent Parser - geen complexe regex, duidelijke patterns
 */
export function parseIntent(message: string): ChatIntent {
  const normalized = message.toLowerCase().trim()
  
  // TODO patterns
  if (normalized.includes('todo') && normalized.includes('voeg')) {
    const titleMatch = message.match(/voeg\s+(?:todo\s+)?(?:toe\s+)?(.+)/i)
    return {
      type: 'todo_add',
      confidence: 0.9,
      params: { title: titleMatch?.[1]?.trim() || 'Nieuwe todo' },
      raw: message
    }
  }
  
  // HABIT patterns - EXCLUDE time logging
  if (normalized.includes('gewoonte') || normalized.includes('habit')) {
    // Exclude time logging
    if (normalized.includes('tijd') || normalized.includes('log de tijd')) {
      return {
        type: 'unknown',
        confidence: 0.8,
        params: {},
        raw: message
      }
    }
    
    const habitMatch = message.match(/(?:gewoonte|habit)\s+(.+)/i)
    return {
      type: 'habit_log',
      confidence: 0.8,
      params: { habit_name: habitMatch?.[1]?.trim() || 'Onbekende gewoonte' },
      raw: message
    }
  }
  
  // FINANCE patterns
  if (normalized.includes('uitgegeven') || normalized.includes('betaald')) {
    const amountMatch = message.match(/(\d+(?:[.,]\d+)?)\s*eur/i)
    const titleMatch = message.match(/(?:uitgegeven|betaald)\s+(?:aan\s+)?(.+)/i)
    return {
      type: 'finance_expense',
      confidence: 0.8,
      params: { 
        amount: parseFloat(amountMatch?.[1]?.replace(',', '.') || '0'),
        title: titleMatch?.[1]?.trim() || 'Onbekende uitgave'
      },
      raw: message
    }
  }
  
  // QUERY patterns
  if (normalized.includes('hoeveel') && normalized.includes('gewerkt')) {
    return {
      type: 'query_work',
      confidence: 0.8,
      params: { query: 'vandaag' },
      raw: message
    }
  }
  
  if (normalized.includes('agenda') || normalized.includes('planning')) {
    return {
      type: 'query_agenda',
      confidence: 0.8,
      params: { query: 'week' },
      raw: message
    }
  }
  
  if (normalized.includes('toon') && (normalized.includes('todos') || normalized.includes('open'))) {
    return {
      type: 'query_todos',
      confidence: 0.8,
      params: { query: 'open' },
      raw: message
    }
  }
  
  return {
    type: 'unknown',
    confidence: 0.5,
    params: {},
    raw: message
  }
}

/**
 * Simple Action Executor - met 100% verification
 */
export async function executeAction(intent: ChatIntent): Promise<ActionResult> {
  try {
    switch (intent.type) {
      case 'todo_add':
        return await executeTodoAdd(intent.params as { title: string })
      case 'habit_log':
        return await executeHabitLog(intent.params as { habit_name: string })
      case 'finance_expense':
        return await executeFinanceExpense(intent.params as { amount: number; title: string })
      case 'query_work':
        return await executeQueryWork(intent.params as { query: string })
      case 'query_agenda':
        return await executeQueryAgenda(intent.params as { query: string })
      case 'query_todos':
        return await executeQueryTodos(intent.params as { query: string })
      case 'event_create':
        return await executeEventCreate(intent.params as { title: string; time: string; date: string })
      default:
        return {
          success: false,
          error: 'Onbekende actie',
          verified: true
        }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Onbekende fout',
      verified: false
    }
  }
}

/**
 * Todo Add met verification
 */
async function executeTodoAdd(params: { title: string }): Promise<ActionResult> {
  console.log('[SimpleChat] Adding todo:', params.title)
  
  // Execute insert
  const result = await execute(`
    INSERT INTO todos (title, completed, priority, category, created_at)
    VALUES ($1, false::smallint, 'medium', 'overig', CURRENT_TIMESTAMP)
    RETURNING id, title, created_at
  `, [params.title])
  
  // Verify it was actually created
  const verification = await queryOne(`
    SELECT id, title, completed 
    FROM todos 
    WHERE title = $1 AND completed = false::smallint 
    ORDER BY created_at DESC 
    LIMIT 1
  `, [params.title])
  
  if (!verification) {
    return {
      success: false,
      error: 'Todo creation failed - verification failed',
      verified: false
    }
  }
  
  console.log('[SimpleChat] Todo verified:', verification)
  
  return {
    success: true,
    data: verification,
    verified: true
  }
}

/**
 * Habit Log met verification
 */
async function executeHabitLog(params: { habit_name: string }): Promise<ActionResult> {
  console.log('[SimpleChat] Logging habit:', params.habit_name)
  
  // Find or create habit
  let habit = await queryOne(`
    SELECT id, name FROM habits 
    WHERE name ILIKE $1 AND active = 1 
    LIMIT 1
  `, [`%${params.habit_name}%`])
  
  if (!habit) {
    // Create new habit
    habit = await queryOne(`
      INSERT INTO habits (name, frequency, target, active, created_at)
      VALUES ($1, 'dagelijks', 1, true, CURRENT_TIMESTAMP)
      RETURNING id, name
    `, [params.habit_name])
    
    if (!habit) {
      return {
        success: false,
        error: 'Habit creation failed',
        verified: false
      }
    }
  }
  
  // Log the habit event
  await execute(`
    INSERT INTO habit_logs (habit_id, logged_date, note)
    VALUES ($1, CURRENT_DATE, $2)
    ON CONFLICT(habit_id, logged_date) DO UPDATE SET note = COALESCE(EXCLUDED.note, habit_logs.note)
  `, [habit.id, null])
  
  // Verify the log was created
  const verification = await queryOne(`
    SELECT id, habit_id, logged_date 
    FROM habit_logs 
    WHERE habit_id = $1 AND logged_date = CURRENT_DATE
  `, [habit.id])
  
  if (!verification) {
    return {
      success: false,
      error: 'Habit log verification failed',
      verified: false
    }
  }
  
  console.log('[SimpleChat] Habit verified:', verification)
  
  return {
    success: true,
    data: { habit, log: verification },
    verified: true
  }
}

/**
 * Finance Expense met verification
 */
async function executeFinanceExpense(params: { amount: number; title: string }): Promise<ActionResult> {
  console.log('[SimpleChat] Adding expense:', params.amount, params.title)
  
  // Execute insert
  const result = await execute(`
    INSERT INTO finance (type, title, amount, category, account, status, created_at)
    VALUES ('uitgave', $1, $2, 'overig', 'privé', 'open', CURRENT_TIMESTAMP)
    RETURNING id, title, amount, created_at
  `, [params.title, params.amount])
  
  // Verify it was actually created
  const verification = await queryOne(`
    SELECT id, title, amount, type 
    FROM finance 
    WHERE title = $1 AND amount = $2 AND type = 'uitgave'
    ORDER BY created_at DESC 
    LIMIT 1
  `, [params.title, params.amount])
  
  if (!verification) {
    return {
      success: false,
      error: 'Finance transaction verification failed',
      verified: false
    }
  }
  
  console.log('[SimpleChat] Finance verified:', verification)
  
  return {
    success: true,
    data: verification,
    verified: true
  }
}

/**
 * Query Work - hoeveel gewerkt vandaag
 */
async function executeQueryWork(params: { query: string }): Promise<ActionResult> {
  console.log('[SimpleChat] Query work:', params.query)
  
  const workLogs = await query(`
    SELECT title, duration_minutes, date, created_at
    FROM work_logs 
    WHERE DATE(created_at) = CURRENT_DATE
    ORDER BY created_at DESC
  `)
  
  return {
    success: true,
    data: { 
      message: `Vandaag heb je ${workLogs.length} werklogs ingevoerd`,
      logs: workLogs 
    },
    verified: true
  }
}

/**
 * Query Agenda - toon agenda deze week
 */
async function executeQueryAgenda(params: { query: string }): Promise<ActionResult> {
  console.log('[SimpleChat] Query agenda:', params.query)
  
  const todos = await query(`
    SELECT id, title, due_date, priority
    FROM todos 
    WHERE completed = 0::smallint 
    AND due_date IS NOT NULL 
    AND due_date >= CURRENT_DATE 
    AND due_date <= CURRENT_DATE + INTERVAL '7 days'
    ORDER BY due_date ASC
    LIMIT 10
  `)
  
  return {
    success: true,
    data: { 
      message: `Je hebt ${todos.length} openstaande taken deze week`,
      todos: todos 
    },
    verified: true
  }
}

/**
 * Query Todos - toon open todos
 */
async function executeQueryTodos(params: { query: string }): Promise<ActionResult> {
  console.log('[SimpleChat] Query todos:', params.query)
  
  const todos = await query(`
    SELECT id, title, priority, created_at
    FROM todos 
    WHERE completed = 0::smallint 
    ORDER BY created_at DESC
    LIMIT 20
  `)
  
  return {
    success: true,
    data: { 
      message: `Je hebt ${todos.length} openstaande todos`,
      todos: todos 
    },
    verified: true
  }
}

/**
 * Event Create - agenda item toevoegen met verification
 */
async function executeEventCreate(params: { title: string; time: string; date: string }): Promise<ActionResult> {
  console.log('[SimpleChat] Creating event:', params.title, params.time, params.date)
  
  // Parse date to proper format
  let eventDate = new Date()
  const dateMap: Record<string, number> = {
    'maandag': 1, 'dinsdag': 2, 'woensdag': 3, 'donderdag': 4,
    'vrijdag': 5, 'zaterdag': 6, 'zondag': 0,
    'morgen': 1, 'vandaag': 0, 'gisteren': -1
  }
  
  const dayOffset = dateMap[params.date.toLowerCase()] || 0
  const currentDay = new Date().getDay()
  const targetDay = dayOffset === 0 ? currentDay : dayOffset
  
  if (targetDay >= currentDay) {
    eventDate.setDate(eventDate.getDate() + (targetDay - currentDay))
  } else {
    eventDate.setDate(eventDate.getDate() + (7 - currentDay + targetDay))
  }
  
  // Parse time
  const timeMatch = params.time.match(/(\d{1,2})[:.]?(\d{0,2})?/)
  const hours = parseInt(timeMatch?.[1] || '20')
  const minutes = parseInt(timeMatch?.[2] || '00')
  eventDate.setHours(hours, minutes, 0, 0)
  
  // Execute insert
  const result = await queryOne<{ id: number; title: string; date: string; time: string }>(`
    INSERT INTO events (title, date, time, type, created_at)
    VALUES ($1, $2, $3, 'algemeen', CURRENT_TIMESTAMP)
    RETURNING id, title, date, time
  `, [params.title, eventDate.toISOString().split('T')[0], `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`])

  if (!result?.id) {
    return {
      success: false,
      error: 'Event creation failed - no ID returned',
      verified: false
    }
  }

  // Verify it was actually created
  const verification = await queryOne(`
    SELECT id, title, date, time
    FROM events
    WHERE id = $1 AND title = $2
  `, [result.id, params.title])
  
  if (!verification) {
    return {
      success: false,
      error: 'Event creation verification failed',
      verified: false
    }
  }
  
  console.log('[SimpleChat] Event verified:', verification)
  
  return {
    success: true,
    data: verification,
    verified: true
  }
}

/**
 * Response Generator - gebaseerd op echte resultaten
 */
export function generateResponse(intent: ChatIntent, results: ActionResult[]): ChatResponse {
  const successfulResults = results.filter(r => r.success && r.verified)
  const failedResults = results.filter(r => !r.success || !r.verified)
  
  if (failedResults.length > 0) {
    return {
      message: `Sorry, er ging iets mis: ${failedResults[0].error}`,
      success: false,
      actions: results,
      debug: { intent, results }
    }
  }
  
  // Generate response based on actual results
  switch (intent.type) {
    case 'todo_add':
      return {
        message: `Todo "${intent.params.title}" is toegevoegd!`,
        success: true,
        actions: results
      }
      
    case 'habit_log':
      return {
        message: `Gewoonte "${intent.params.habit_name}" is gelogd!`,
        success: true,
        actions: results
      }
      
    case 'finance_expense':
      return {
        message: `Uitgave van ${intent.params.amount} voor "${intent.params.title}" is geregistreerd!`,
        success: true,
        actions: results
      }
      
    default:
      return {
        message: "Ik begrijp niet wat je bedoelt. Kun je het anders formuleren?",
        success: false,
        actions: results
      }
  }
}

/**
 * Main Chat Processor - de complete flow
 */
export async function processChatMessage(message: string): Promise<ChatResponse> {
  console.log('[SimpleChat] Processing:', message)
  
  // 1. Parse intent
  const intent = parseIntent(message)
  console.log('[SimpleChat] Intent:', intent)
  
  // 2. Execute action
  const result = await executeAction(intent)
  console.log('[SimpleChat] Result:', result)
  
  // 3. Generate response
  const response = generateResponse(intent, [result])
  console.log('[SimpleChat] Response:', response)
  
  return response
}
