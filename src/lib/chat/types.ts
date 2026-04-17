export type ChatChannel = 'chat' | 'telegram' | string

export type Priority = 'hoog' | 'medium' | 'laag'
export type WorkContext = 'Bouma' | 'WebsUp' | 'privé' | 'studie' | 'overig'
export type EventType = 'vergadering' | 'deadline' | 'afspraak' | 'herinnering' | 'algemeen'
export type ProjectStatus = 'actief' | 'on-hold' | 'afgerond'
export type MessageKind =
  | 'question'
  | 'command'
  | 'informative_update'
  | 'log_entry'
  | 'status_update'
  | 'confirmation'
  | 'correction'
  | 'small_talk'
  | 'mixed_intent'
  | 'unknown'

export interface ChatRequest {
  message: string
  source: ChatChannel
  sessionKey?: string
  senderName?: string
  senderPhone?: string
}

export interface ParsedChatMessage {
  original: string
  normalized: string
}

export interface ResolvedProject {
  id: number
  title: string
  status?: string
}

export interface ResolvedContact {
  id: number
  name: string
  company?: string | null
}

export interface ResolvedHabit {
  id: number
  name: string
}

export interface ContextMessage {
  role: 'user' | 'assistant'
  content: string
  actions: StoredAction[]
  created_at: string
}

export interface PendingActionRecord {
  session_key: string
  source: string
  preview: string
  payload: string
  created_at: string
  updated_at: string
  expires_at: string
}

export interface ChatRuntimeContext {
  source: ChatChannel
  sessionKey: string
  now: Date
  recentMessages: ContextMessage[]
  memories: Array<{ id: number; key: string; value: string; category: string; confidence: number }>
  activeProjects: Array<{ id: number; title: string; status: string }>
  contacts: Array<{ id: number; name: string; company?: string | null }>
  openTodos: Array<{ id: number; title: string; priority: string; due_date?: string | null; category?: string | null }>
  upcomingEvents: Array<{ id: number; title: string; date: string; time?: string | null; type: string }>
  recentWorklogs: Array<{ id: number; title: string; duration_minutes: number; context: string; created_at: string; date: string }>
  habits: Array<{ id: number; name: string }>
  pendingAction?: PendingActionRecord
}

export type StoredAction =
  | { type: 'grocery_added'; data: { id?: number; title: string } }
  | { type: 'grocery_listed'; data: { items: Array<{ title: string; quantity?: string }> } }
  | { type: 'todo_created'; data: { id?: number; title: string; due_date?: string | null; priority?: Priority } }
  | { type: 'todo_updated'; data: { id: number; title?: string; priority?: Priority; due_date?: string | null } }
  | { type: 'todo_completed'; data: { id: number; title: string } }
  | { type: 'todo_deleted'; data: { id: number; title: string } }
  | { type: 'todo_listed'; data: Array<{ id: number; title: string; priority?: string; due_date?: string | null }> }
  | { type: 'todos_deleted'; data: { count: number; titles?: string[] } }
  | { type: 'event_created'; data: { id?: number; title: string; date: string; time?: string | null; type?: EventType } }
  | { type: 'event_updated'; data: { id: number; title: string; date: string; time?: string | null } }
  | { type: 'events_listed'; data: Array<{ id: number; title: string; date: string; time?: string | null; type?: string }> }
  | { type: 'worklog_created'; data: { id?: number; title: string; duration_minutes: number; context: WorkContext } }
  | { type: 'worklog_updated'; data: { id: number; title: string; duration_minutes: number } }
  | { type: 'worklog_listed'; data: { total_minutes: number; entries: Array<{ id: number; title: string; duration_minutes: number; context: string }> } }
  | { type: 'habit_logged'; data: { habit_id?: number; habit_name: string } }
  | { type: 'finance_created'; data: { id?: number; title: string; amount: number; kind: 'uitgave' | 'inkomst' | 'factuur' } }
  | { type: 'finance_summary'; data: { total: number; period: string; count?: number } }
  | { type: 'memory_saved'; data: { key: string; value: string; category: string } }
  | { type: 'memory_answered'; data: { topic?: string } }
  | { type: 'project_created'; data: { id?: number; title: string } }
  | { type: 'project_updated'; data: { id: number; title: string; status?: ProjectStatus } }
  | { type: 'projects_listed'; data: Array<{ id: number; title: string; status: string }> }
  | { type: 'contact_created'; data: { id?: number; name: string; company?: string | null } }
  | { type: 'contact_answered'; data: { query: string } }
  | { type: 'timeline_logged'; data: { title: string; summary?: string; category?: string } }
  | { type: 'inbox_captured'; data: { id?: number; text: string } }
  | { type: 'clarification_requested'; data: { module?: string; reason: string } }
  | { type: 'confirmation_requested'; data: { preview: string } }
  | { type: 'confirmation_cancelled'; data: { preview: string } }
  | { type: 'confirmation_executed'; data: { preview: string } }
  | { type: 'fallback_answer'; data: { mode: 'ai' | 'rule' } }
  | { type: 'timer_started'; data: { id?: number; title: string; project_id?: number | null } }
  | { type: 'timer_stopped'; data: { id?: number; title: string; duration_minutes: number } }
  | { type: 'note_created'; data: { id?: number; title: string } }
  | { type: 'note_updated'; data: { id: number; title?: string } }
  | { type: 'journal_created'; data: { date: string; content: string } }
  | { type: 'plan_requested'; data: { period: 'day' | 'week' } }

export type ChatAction =
  | {
      type: 'todo_create'
      payload: {
        title: string
        description?: string
        priority?: Priority
        due_date?: string
        category?: string
        project_id?: number | null
      }
    }
  | {
      type: 'todo_update'
      payload: {
        id: number
        title?: string
        priority?: Priority
        due_date?: string | null
      }
    }
  | { type: 'todo_complete'; payload: { id: number } }
  | { type: 'todo_delete'; payload: { id: number } }
  | { type: 'todo_delete_many'; payload: { ids: number[] } }
  | {
      type: 'event_create'
      payload: {
        title: string
        date: string
        time?: string | null
        type?: EventType
        description?: string
        duration?: number
        project_id?: number | null
        contact_id?: number | null
        moment_label?: string
      }
    }
  | {
      type: 'event_update'
      payload: {
        id: number
        title?: string
        date?: string
        time?: string | null
        type?: EventType
        description?: string | null
      }
    }
  | {
      type: 'worklog_create'
      payload: {
        title: string
        duration_minutes: number
        context: WorkContext
        date?: string
        description?: string
        project_id?: number | null
        contact_id?: number | null
        work_type?: string
      }
    }
  | {
      type: 'worklog_update_last'
      payload: {
        duration_minutes: number
        expected_previous_minutes?: number | null
      }
    }
  | {
      type: 'habit_log'
      payload: {
        habit_name: string
        note?: string
        auto_create?: boolean
      }
    }
  | {
      type: 'finance_create_expense'
      payload: {
        title: string
        amount: number
        category?: string
        description?: string
      }
    }
  | {
      type: 'finance_create_invoice'
      payload: {
        title: string
        amount?: number
        client?: string
        due_date?: string
        status?: 'concept' | 'verstuurd'
      }
    }
  | {
      type: 'project_create'
      payload: {
        title: string
        description?: string
      }
    }
  | {
      type: 'project_update'
      payload: {
        id: number
        title?: string
        status?: ProjectStatus
      }
    }
  | {
      type: 'contact_create'
      payload: {
        name: string
        company?: string
        email?: string
        phone?: string
      }
    }
  | {
      type: 'timeline_log'
      payload: {
        title: string
        summary?: string
        category?: string
      }
    }
  | {
      type: 'memory_store'
      payload: {
        key: string
        value: string
        category: string
        confidence: number
      }
    }
  | {
      type: 'inbox_capture'
      payload: {
        raw_text: string
        suggested_type?: string
        suggested_context?: string
      }
    }

export type ChatQuery =
  | { type: 'todo_list'; filter?: 'open' | 'today' | 'week' | 'overdue' | 'completed' }
  | { type: 'agenda_list'; filter?: 'today' | 'tomorrow' | 'week' | 'specific_day'; dayName?: string }
  | { type: 'worklog_summary'; period?: 'today' | 'week' }
  | { type: 'finance_summary'; period?: 'today' | 'week' | 'month' }
  | { type: 'memory_profile'; topic?: string }
  | { type: 'project_list'; filter?: 'active' | 'waiting' | 'all' }
  | { type: 'contact_lookup'; query: string }

export interface ChatPlan {
  kind: MessageKind
  confidence: number
  primaryIntent: string
  actions: ChatAction[]
  query?: ChatQuery
  requiresConfirmation?: boolean
  confirmationPreview?: string
  clarification?: string
  suggestion?: string
}

export interface ChatResult {
  reply: string
  actions: StoredAction[]
  parserType: string
  confidence: number
  intent: string
}
