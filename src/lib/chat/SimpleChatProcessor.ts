/**
 * SIMPLE CHAT PROCESSOR
 * 
 * Complete rebuild van de chat architectuur
 * Focus: Simpel, robuust, multi-tenant aware
 */

import { DatabaseRouter } from '@/lib/tenant/DatabaseRouter';
import { ChatResult, StoredAction } from './types';

export interface ChatProcessorContext {
  tenant_id: string;
  user_id?: string;
  database: DatabaseRouter;
  sessionKey?: string;
}

export interface ChatIntent {
  type: 'todo_add' | 'habit_log' | 'habit_time_log' | 'finance_expense' | 'finance_income' | 'event_create' | 'query_work' | 'query_agenda' | 'query_todos' | 'unknown';
  confidence: number;
  params: Record<string, any>;
  raw: string;
}

export interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
  verified: boolean;
  type?: string;
}

export class SimpleChatProcessor {
  /**
   * Main Chat Processor - de complete flow
   */
  async processChatMessage(message: string, context: ChatProcessorContext): Promise<ChatResult> {
    console.log(`[SimpleChat] [Tenant: ${context.tenant_id}] Processing:`, message);
    
    // Create a local db helper for this tenant
    const db = {
      query: <T = any>(sql: string, params?: any[]) => context.database.query<T>(context.tenant_id, sql, params),
      queryOne: <T = any>(sql: string, params?: any[]) => context.database.queryOne<T>(context.tenant_id, sql, params),
      execute: (sql: string, params?: any[]) => context.database.execute(context.tenant_id, sql, params),
    };

    // 1. Parse intent
    const intent = this.parseIntent(message);
    console.log('[SimpleChat] Intent:', intent);

    // 2. Execute action
    const actionResult = await this.executeAction(intent, db);
    console.log('[SimpleChat] Action Result:', actionResult);

    // 3. Generate response
    const reply = this.generateReply(intent, actionResult);
    
    // 4. Map to stored actions
    const storedActions = this.mapToStoredActions(actionResult, intent);

    // 5. Final Result
    const result: ChatResult & { message: string } = {
      reply,
      message: reply, // Add this for compatibility with TelegramBotManager
      actions: storedActions,
      parserType: 'rule',
      confidence: intent.confidence,
      intent: intent.type,
    };

    // 6. Log and store
    await this.logAndStoreResponse(message, result, db);

    return result;
  }

  /**
   * Simple Intent Parser - geen complexe regex, duidelijke patterns
   */
  private parseIntent(message: string): ChatIntent {
    const normalized = message.toLowerCase().trim();
    
    // TODO patterns
    if (normalized.includes('todo') && normalized.includes('voeg')) {
      const titleMatch = message.match(/voeg\s+(?:todo\s+)?(?:toe\s+)?(.+)/i);
      return {
        type: 'todo_add',
        confidence: 0.9,
        params: { title: titleMatch?.[1]?.trim() || 'Nieuwe todo' },
        raw: message
      };
    }
    
    // HABIT patterns
    if (normalized.includes('gewoont') || normalized.includes('habit')) {
      // TIME LOGGING patterns
      if (normalized.includes('slaap') || normalized.includes('slapen') || normalized.includes('uur') || 
          normalized.includes('tijd') || normalized.includes('om') || 
          (normalized.includes('ging') && normalized.includes('slaap'))) {
        
        // Extract time from sleep logs
        const timeMatch = message.match(/(\d{1,2})\s*(?:uur|pm|am|ochtend|middag|avond|nacht)/i);
        const habitName = 'slaap';
        const loggedTime = timeMatch?.[1] || '3';
        
        return {
          type: 'habit_time_log',
          confidence: 0.9,
          params: { 
            habit_name: habitName,
            logged_time: `${loggedTime}:00`,
            note: message.includes('vannacht') ? 'Vannacht' : 'Tijd gelogd'
          },
          raw: message
        };
      }
      
      // HABIT CREATION patterns
      if (normalized.includes('zet') || normalized.includes('voeg') || normalized.includes('toe')) {
        const habitMatch = message.match(/(?:zet|voeg|toe)\s+(?:dit\s+)?(?:in\s+)?(?:de\s+)?(?:gewoontes?|habits?)\s*:?\s*(.+)/i);
        return {
          type: 'habit_log',
          confidence: 0.9,
          params: { habit_name: habitMatch?.[1]?.trim() || 'Nieuwe gewoonte' },
          raw: message
        };
      }
      
      // DEFAULT HABIT LOG
      const habitMatch = message.match(/(?:gewoonte|habit)\s+(.+)/i);
      return {
        type: 'habit_log',
        confidence: 0.8,
        params: { habit_name: habitMatch?.[1]?.trim() || 'Onbekende gewoonte' },
        raw: message
      };
    }
    
    // FINANCE patterns
    if (normalized.includes('uitgegeven') || normalized.includes('betaald')) {
      const amountMatch = message.match(/(\d+(?:[.,]\d+)?)\s*eur/i);
      const titleMatch = message.match(/(?:uitgegeven|betaald)\s+(?:aan\s+)?(.+)/i);
      return {
        type: 'finance_expense',
        confidence: 0.8,
        params: { 
          amount: parseFloat(amountMatch?.[1]?.replace(',', '.') || '0'),
          title: titleMatch?.[1]?.trim() || 'Onbekende uitgave'
        },
        raw: message
      };
    }

    if (normalized.includes('ontvangen') || normalized.includes('verdiend') || normalized.includes('inkomst')) {
      const amountMatch = message.match(/(\d+(?:[.,]\d+)?)\s*eur/i);
      const titleMatch = message.match(/(?:ontvangen|verdiend|inkomst)\s+(?:van\s+)?(.+)/i);
      return {
        type: 'finance_income',
        confidence: 0.8,
        params: { 
          amount: parseFloat(amountMatch?.[1]?.replace(',', '.') || '0'),
          title: titleMatch?.[1]?.trim() || 'Onbekende inkomst'
        },
        raw: message
      };
    }
    
    // QUERY patterns
    if (normalized.includes('hoeveel') && normalized.includes('gewerkt')) {
      return {
        type: 'query_work',
        confidence: 0.8,
        params: { query: 'vandaag' },
        raw: message
      };
    }
    
    if (normalized.includes('agenda') || normalized.includes('planning')) {
      return {
        type: 'query_agenda',
        confidence: 0.8,
        params: { query: 'week' },
        raw: message
      };
    }
    
    if (normalized.includes('toon') && (normalized.includes('todos') || normalized.includes('open'))) {
      return {
        type: 'query_todos',
        confidence: 0.8,
        params: { query: 'open' },
        raw: message
      };
    }

    // EVENT patterns
    if (normalized.includes('agenda') || normalized.includes('afspraak') || normalized.includes('event')) {
      if (normalized.includes('voeg') || normalized.includes('zet') || normalized.includes('nieuw')) {
        const titleMatch = message.match(/(?:voeg|zet|nieuw(?:e)?)\s+(?:agenda\s+|afspraak\s+|event\s+)?(?:toe\s+)?(.+?)(?:\s+om|\s+om|\s+op|\s+vandaag|\s+morgen|$)/i);
        const timeMatch = message.match(/(\d{1,2}[:.]\d{2})/);
        const dateMatch = message.match(/(vandaag|morgen|maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)/i);
        
        return {
          type: 'event_create',
          confidence: 0.9,
          params: { 
            title: titleMatch?.[1]?.trim() || 'Nieuwe afspraak',
            time: timeMatch?.[1] || '12:00',
            date: dateMatch?.[1] || 'vandaag'
          },
          raw: message
        };
      }
    }
    
    return {
      type: 'unknown',
      confidence: 0.5,
      params: {},
      raw: message
    };
  }

  /**
   * Simple Action Executor
   */
  private async executeAction(intent: ChatIntent, db: any): Promise<ActionResult> {
    try {
      switch (intent.type) {
        case 'todo_add':
          return await this.executeTodoAdd(intent.params as { title: string }, db);
        case 'habit_log':
          return await this.executeHabitLog(intent.params as { habit_name: string }, db);
        case 'habit_time_log':
          return await this.executeHabitTimeLog(intent.params as { habit_name: string; logged_time: string; note?: string }, db);
        case 'finance_expense':
          return await this.executeFinanceExpense(intent.params as { amount: number; title: string }, db);
        case 'finance_income':
          return await this.executeFinanceIncome(intent.params as { amount: number; title: string }, db);
        case 'query_work':
          return await this.executeQueryWork(intent.params as { query: string }, db);
        case 'query_agenda':
          return await this.executeQueryAgenda(intent.params as { query: string }, db);
        case 'query_todos':
          return await this.executeQueryTodos(intent.params as { query: string }, db);
        case 'event_create':
          return await this.executeEventCreate(intent.params as { title: string; time: string; date: string }, db);
        default:
          return {
            success: false,
            error: 'Onbekende actie',
            verified: true
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Onbekende fout',
        verified: false
      };
    }
  }

  private async executeTodoAdd(params: { title: string }, db: any): Promise<ActionResult> {
    const result = await db.query(`
      INSERT INTO todos (title, completed, priority, category, created_at)
      VALUES ($1, 0, 'medium', 'overig', CURRENT_TIMESTAMP)
      RETURNING id, title, created_at
    `, [params.title]);
    
    const verification = await db.queryOne(`
      SELECT id, title, completed 
      FROM todos 
      WHERE title = $1 AND completed = 0
      ORDER BY created_at DESC 
      LIMIT 1
    `, [params.title]);
    
    if (!verification) {
      return { success: false, error: 'Todo creation failed', verified: false };
    }
    
    return { success: true, data: verification, verified: true, type: 'todo_create' };
  }

  private async executeHabitLog(params: { habit_name: string }, db: any): Promise<ActionResult> {
    let habit = await db.queryOne(`
      SELECT id, name FROM habits 
      WHERE name ILIKE $1 AND active = 1 
      LIMIT 1
    `, [`%${params.habit_name}%`]);
    
    if (!habit) {
      habit = await db.queryOne(`
        INSERT INTO habits (name, frequency, target, active, created_at)
        VALUES ($1, 'dagelijks', 1, 1, CURRENT_TIMESTAMP)
        RETURNING id, name
      `, [params.habit_name]);
    }
    
    if (!habit) return { success: false, error: 'Habit creation failed', verified: false };

    await db.execute(`
      INSERT INTO habit_logs (habit_id, logged_date, note)
      VALUES ($1, CURRENT_DATE, $2)
      ON CONFLICT(habit_id, logged_date) DO UPDATE SET note = COALESCE(EXCLUDED.note, habit_logs.note)
    `, [habit.id, null]);
    
    const verification = await db.queryOne(`
      SELECT id, habit_id, logged_date 
      FROM habit_logs 
      WHERE habit_id = $1 AND logged_date = CURRENT_DATE
    `, [habit.id]);
    
    if (!verification) return { success: false, error: 'Habit log failed', verified: false };
    
    return { success: true, data: { habit, log: verification }, verified: true, type: 'habit_log' };
  }

  private async executeHabitTimeLog(params: { habit_name: string; logged_time: string; note?: string }, db: any): Promise<ActionResult> {
    let habit = await db.queryOne(`
      SELECT id, name FROM habits 
      WHERE name ILIKE $1 AND active = 1 
      LIMIT 1
    `, [`%${params.habit_name}%`]);
    
    if (!habit) {
      habit = await db.queryOne(`
        INSERT INTO habits (name, frequency, target, active, created_at)
        VALUES ($1, 'dagelijks', 1, 1, CURRENT_TIMESTAMP)
        RETURNING id, name
      `, [params.habit_name]);
    }
    
    if (!habit) return { success: false, error: 'Habit creation failed', verified: false };

    await db.execute(`
      INSERT INTO habit_logs (habit_id, logged_date, note)
      VALUES ($1, CURRENT_DATE, $2)
      ON CONFLICT(habit_id, logged_date) DO UPDATE SET note = COALESCE(EXCLUDED.note, habit_logs.note)
    `, [habit.id, `${params.note || 'Tijd gelogd'}: ${params.logged_time}`]);
    
    const verification = await db.queryOne(`
      SELECT id, habit_id, logged_date, note 
      FROM habit_logs 
      WHERE habit_id = $1 AND logged_date = CURRENT_DATE AND note ILIKE $2
    `, [habit.id, `%${params.logged_time}%`]);
    
    if (!verification) return { success: false, error: 'Habit time log failed', verified: false };
    
    return { success: true, data: { habit, log: verification }, verified: true, type: 'habit_log' };
  }

  private async executeFinanceExpense(params: { amount: number; title: string }, db: any): Promise<ActionResult> {
    await db.execute(`
      INSERT INTO finance_items (type, title, amount, category, account, status, created_at)
      VALUES ('uitgave', $1, $2, 'overig', 'privé', 'betaald', CURRENT_TIMESTAMP)
    `, [params.title, params.amount]);
    
    const verification = await db.queryOne(`
      SELECT id, title, amount, type 
      FROM finance_items 
      WHERE title = $1 AND amount = $2 AND type = 'uitgave'
      ORDER BY created_at DESC 
      LIMIT 1
    `, [params.title, params.amount]);
    
    if (!verification) return { success: false, error: 'Finance expense failed', verified: false };
    
    return { success: true, data: verification, verified: true, type: 'finance_create_expense' };
  }

  private async executeFinanceIncome(params: { amount: number; title: string }, db: any): Promise<ActionResult> {
    await db.execute(`
      INSERT INTO finance_items (type, title, amount, category, account, status, created_at)
      VALUES ('inkomst', $1, $2, 'overig', 'privé', 'betaald', CURRENT_TIMESTAMP)
    `, [params.title, params.amount]);
    
    const verification = await db.queryOne(`
      SELECT id, title, amount, type 
      FROM finance_items 
      WHERE title = $1 AND amount = $2 AND type = 'inkomst'
      ORDER BY created_at DESC 
      LIMIT 1
    `, [params.title, params.amount]);
    
    if (!verification) return { success: false, error: 'Finance income failed', verified: false };
    
    return { success: true, data: verification, verified: true, type: 'finance_create_income' };
  }

  private async executeQueryWork(params: { query: string }, db: any): Promise<ActionResult> {
    const workLogs = await db.query(`
      SELECT title, duration_minutes, date, created_at
      FROM work_logs 
      WHERE date = CURRENT_DATE
      ORDER BY created_at DESC
    `);
    return { success: true, data: { count: workLogs.length, logs: workLogs }, verified: true };
  }

  private async executeQueryAgenda(params: { query: string }, db: any): Promise<ActionResult> {
    const events = await db.query(`
      SELECT id, title, date, time
      FROM events 
      WHERE date >= CURRENT_DATE 
      AND date <= CURRENT_DATE + INTERVAL '7 days'
      ORDER BY date ASC, time ASC
      LIMIT 10
    `);
    return { success: true, data: { count: events.length, events }, verified: true };
  }

  private async executeQueryTodos(params: { query: string }, db: any): Promise<ActionResult> {
    const todos = await db.query(`
      SELECT id, title, priority, created_at
      FROM todos 
      WHERE completed = 0 
      ORDER BY created_at DESC
      LIMIT 20
    `);
    return { success: true, data: { count: todos.length, todos }, verified: true };
  }

  private async executeEventCreate(params: { title: string; time: string; date: string }, db: any): Promise<ActionResult> {
    console.log('[SimpleChat] Creating event:', params.title, params.time, params.date);
    
    // Parse date to proper format
    let eventDate = new Date();
    const dateMap: Record<string, number> = {
      'maandag': 1, 'dinsdag': 2, 'woensdag': 3, 'donderdag': 4,
      'vrijdag': 5, 'zaterdag': 6, 'zondag': 0,
      'morgen': 1, 'vandaag': 0, 'gisteren': -1
    };
    
    const dayOffset = dateMap[params.date.toLowerCase()] || 0;
    const currentDay = new Date().getDay();
    const targetDay = dayOffset === 0 ? currentDay : dayOffset;
    
    if (targetDay >= currentDay) {
      eventDate.setDate(eventDate.getDate() + (targetDay - currentDay));
    } else {
      eventDate.setDate(eventDate.getDate() + (7 - currentDay + targetDay));
    }
    
    // Parse time
    const timeMatch = params.time.match(/(\d{1,2})[:.]?(\d{0,2})?/);
    const hours = parseInt(timeMatch?.[1] || '20');
    const minutes = parseInt(timeMatch?.[2] || '00');
    eventDate.setHours(hours, minutes, 0, 0);
    
    // Execute insert
    const result = await db.queryOne(`
      INSERT INTO events (title, date, time, type, created_at)
      VALUES ($1, $2, $3, 'algemeen', CURRENT_TIMESTAMP)
      RETURNING id, title, date, time
    `, [params.title, eventDate.toISOString().split('T')[0], `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`]);

    if (!result) {
      return {
        success: false,
        error: 'Event creation failed',
        verified: false
      };
    }

    // Verify it was actually created
    const verification = await db.queryOne(`
      SELECT id, title, date, time
      FROM events
      WHERE id = $1 AND title = $2
    `, [result.id, params.title]);
    
    if (!verification) {
      return {
        success: false,
        error: 'Event creation verification failed',
        verified: false
      };
    }
    
    return {
      success: true,
      data: verification,
      verified: true,
      type: 'event_create'
    };
  }

  private generateReply(intent: ChatIntent, result: ActionResult): string {
    if (!result.success) return `Sorry, er ging iets mis: ${result.error}`;
    
    switch (intent.type) {
      case 'todo_add':
        return `Todo "${intent.params.title}" is toegevoegd!`;
      case 'habit_log':
        return `Gewoonte "${intent.params.habit_name}" is gelogd!`;
      case 'habit_time_log':
        return `Slaapgewoonte gelogd om ${intent.params.logged_time}!`;
      case 'finance_expense':
        return `Uitgave van €${intent.params.amount} voor "${intent.params.title}" is geregistreerd!`;
      case 'finance_income':
        return `Inkomst van €${intent.params.amount} van "${intent.params.title}" is geregistreerd!`;
      case 'query_work':
        return `Je hebt vandaag ${result.data.count} werklogs ingevoerd.`;
      case 'query_agenda':
        return `Je hebt ${result.data.count} items in je agenda voor de komende 7 dagen.`;
      case 'query_todos':
        return `Je hebt ${result.data.count} openstaande taken.`;
      default:
        return "Ik heb het voor je verwerkt!";
    }
  }

  private mapToStoredActions(result: ActionResult, intent: ChatIntent): StoredAction[] {
    if (!result.success || !result.type) return [];
    
    const data = result.data;
    switch (result.type) {
      case 'todo_create':
        return [{ type: 'todo_created', data: { id: data.id, title: data.title } }];
      case 'habit_log':
        return [{ type: 'habit_logged', data: { habit_id: data.habit.id, habit_name: data.habit.name } }];
      case 'finance_create_expense':
        return [{ type: 'finance_created', data: { id: data.id, title: data.title, amount: data.amount, kind: 'uitgave' } }];
      case 'finance_create_income':
        return [{ type: 'finance_created', data: { id: data.id, title: data.title, amount: data.amount, kind: 'inkomst' } }];
      case 'event_create':
        return [{ type: 'event_created', data: { id: data.id, title: data.title, date: data.date, time: data.time } }];
      default:
        return [];
    }
  }

  private async logAndStoreResponse(userMessage: string, result: ChatResult, db: any) {
    try {
      await db.execute('INSERT INTO chat_messages (role, content, actions) VALUES ($1, $2, $3)', [
        'user',
        userMessage,
        '[]',
      ]);

      await db.execute('INSERT INTO chat_messages (role, content, actions) VALUES ($1, $2, $3)', [
        'assistant',
        result.reply,
        JSON.stringify(result.actions),
      ]);

      await db.execute(`
        INSERT INTO conversation_log (user_message, assistant_message, parser_type, confidence, actions)
        VALUES ($1, $2, $3, $4, $5)
      `, [userMessage, result.reply, result.parserType, result.confidence, JSON.stringify(result.actions)]);
    } catch (error) {
      console.error('[SimpleChat] Logging error:', error);
    }
  }
}
