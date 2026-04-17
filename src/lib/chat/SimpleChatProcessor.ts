/**
 * NIEUWE SIMPLE CHAT PROCESSOR
 * 
 * Complete rebuild van de chat architectuur
 * Focus: Simpel, robuust, 100% verification
 * 
 * Flow: Input -> Intent -> Action -> Database -> Verification -> Response
 */

import { execute, queryOne } from '@/lib/db'

export interface ChatIntent {
  type: 'todo_add' | 'habit_log' | 'finance_expense' | 'finance_income' | 'unknown'
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
    VALUES ($1, false, 'medium', 'overig', CURRENT_TIMESTAMP)
    RETURNING id, title, created_at
  `, [params.title])
  
  // Verify it was actually created
  const verification = await queryOne(`
    SELECT id, title, completed 
    FROM todos 
    WHERE title = $1 AND completed = false 
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
