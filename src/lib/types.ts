// ─── Core entities ────────────────────────────────────────────────────────────

export interface Project {
  id: number
  title: string
  description?: string
  status: 'actief' | 'on-hold' | 'afgerond'
  color: string
  created_at: string
  updated_at: string
}

export interface Contact {
  id: number
  name: string
  type: 'persoon' | 'bedrijf'
  email?: string
  phone?: string
  company?: string
  website?: string
  address?: string
  notes?: string
  tags: string[]
  last_contact?: string
  created_at: string
  updated_at: string
}

export interface Todo {
  id: number
  title: string
  description?: string
  category: string
  priority: 'hoog' | 'medium' | 'laag'
  due_date?: string
  completed: boolean
  completed_at?: string
  project_id?: number
  contact_id?: number
  recurring?: string
  created_at: string
  updated_at: string
  // joined
  project?: Pick<Project, 'id' | 'title' | 'color'>
  contact?: Pick<Contact, 'id' | 'name'>
}

export interface Note {
  id: number
  title: string
  content: string
  content_text: string
  tags: string[]
  pinned: boolean
  project_id?: number
  contact_id?: number
  created_at: string
  updated_at: string
  project?: Pick<Project, 'id' | 'title' | 'color'>
  contact?: Pick<Contact, 'id' | 'name'>
}

export interface FinanceItem {
  id: number
  type: 'factuur' | 'inkomst' | 'uitgave'
  title: string
  description?: string
  amount: number
  contact_id?: number
  project_id?: number
  status: 'concept' | 'verstuurd' | 'betaald' | 'verlopen' | 'geannuleerd'
  invoice_number?: string
  due_date?: string
  paid_date?: string
  category: string
  created_at: string
  updated_at: string
  contact?: Pick<Contact, 'id' | 'name'>
  project?: Pick<Project, 'id' | 'title'>
}

export interface Habit {
  id: number
  name: string
  description?: string
  frequency: 'dagelijks' | 'wekelijks'
  target: number
  color: string
  icon: string
  active: boolean
  created_at: string
  // computed
  logs?: HabitLog[]
  streak?: number
  completedToday?: boolean
}

export interface HabitLog {
  id: number
  habit_id: number
  logged_date: string
  note?: string
  created_at: string
}

export interface JournalEntry {
  id: number
  date: string
  content: string
  mood?: number
  energy?: number
  gratitude: string[]
  highlights?: string
  created_at: string
  updated_at: string
}

export interface Memory {
  id: number
  key: string
  value: string
  category: string
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  actions: ChatAction[]
  created_at: string
}

// ─── Chat actions (wat de parser doet) ────────────────────────────────────────

export type ChatActionType =
  | 'todo_created'
  | 'todo_completed'
  | 'todo_deleted'
  | 'todo_listed'
  | 'note_created'
  | 'note_listed'
  | 'contact_created'
  | 'contact_listed'
  | 'finance_created'
  | 'finance_listed'
  | 'habit_logged'
  | 'habit_listed'
  | 'journal_opened'
  | 'memory_saved'
  | 'unknown'

export interface ChatAction {
  type: ChatActionType
  data?: unknown
}

export interface WorkLog {
  id: number
  date: string
  context: string
  project_id?: number
  project_title?: string
  title: string
  description?: string
  duration_minutes: number
  energy_level?: number
  created_at: string
  updated_at: string
}

export interface InboxItem {
  id: number
  source: string
  raw_text: string
  parsed_status: string
  suggested_type?: string
  suggested_context?: string
  created_at: string
  processed_at?: string
}

export interface MemoryLog {
  id: number
  key: string
  value: string
  category: string
  confidence: number
  source_message_id?: number
  last_reinforced_at: string
  created_at: string
  updated_at: string
}

export interface ConversationLog {
  id: number
  user_message: string
  assistant_message?: string
  raw_ai_result?: string
  parser_type: string
  confidence?: number
  actions?: string
  created_at: string
}

// ─── API response shapes ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

// ─── Dashboard stats ──────────────────────────────────────────────────────────

export interface DashboardStats {
  todos: {
    total: number
    open: number
    dueToday: number
    overdue: number
  }
  notes: { total: number }
  contacts: { total: number }
  finance: {
    openInvoices: number
    openAmount: number
    monthIncome: number
  }
  habits: {
    total: number
    completedToday: number
  }
}
