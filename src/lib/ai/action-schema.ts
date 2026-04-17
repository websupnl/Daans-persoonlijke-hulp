import { z } from 'zod'

export const TodoCreateAction = z.object({
  type: z.literal('todo_create'),
  payload: z.object({
    title: z.string(),
    description: z.string().optional(),
    priority: z.enum(['hoog', 'medium', 'laag']).optional(),
    due_date: z.string().optional(),
    category: z.string().optional(),
    project_id: z.number().optional(),
  }),
})

export const TodoUpdateAction = z.object({
  type: z.literal('todo_update'),
  payload: z.object({
    id: z.number(),
    title: z.string().optional(),
    priority: z.enum(['hoog', 'medium', 'laag']).optional(),
    due_date: z.string().optional(),
    category: z.string().optional(),
  }),
})

export const TodoDeleteAction = z.object({
  type: z.literal('todo_delete'),
  payload: z.object({
    id: z.number(),
  }),
})

export const TodoDeleteManyAction = z.object({
  type: z.literal('todo_delete_many'),
  payload: z.object({
    ids: z.array(z.number()),
  }),
})

export const TodoCompleteAction = z.object({
  type: z.literal('todo_complete'),
  payload: z.object({
    title_search: z.string(),
  }),
})

export const NoteCreateAction = z.object({
  type: z.literal('note_create'),
  payload: z.object({
    title: z.string(),
    content: z.string(),
    tags: z.array(z.string()).optional(),
    project_id: z.number().optional(),
  }),
})

export const NoteUpdateAction = z.object({
  type: z.literal('note_update'),
  payload: z.object({
    id: z.number(),
    title: z.string().optional(),
    content: z.string().optional(),
  }),
})

export const ProjectCreateAction = z.object({
  type: z.literal('project_create'),
  payload: z.object({
    title: z.string(),
    description: z.string().optional(),
    color: z.string().optional(),
  }),
})

export const ProjectUpdateAction = z.object({
  type: z.literal('project_update'),
  payload: z.object({
    id: z.number(),
    title: z.string().optional(),
    status: z.enum(['actief', 'on-hold', 'afgerond']).optional(),
  }),
})

export const ContactCreateAction = z.object({
  type: z.literal('contact_create'),
  payload: z.object({
    name: z.string(),
    type: z.enum(['persoon', 'bedrijf']).optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    company: z.string().optional(),
    notes: z.string().optional(),
  }),
})

export const FinanceCreateExpenseAction = z.object({
  type: z.literal('finance_create_expense'),
  payload: z.object({
    title: z.string(),
    amount: z.number(),
    category: z.string().optional(),
    description: z.string().optional(),
  }),
})

export const FinanceCreateIncomeAction = z.object({
  type: z.literal('finance_create_income'),
  payload: z.object({
    title: z.string(),
    amount: z.number(),
    category: z.string().optional(),
  }),
})

export const WorklogCreateAction = z.object({
  type: z.literal('worklog_create'),
  payload: z.object({
    title: z.string(),
    duration_minutes: z.number(),
    context: z.enum(['Bouma', 'WebsUp', 'privé', 'studie', 'overig']),
    date: z.string().optional(),
    description: z.string().optional(),
    project_id: z.number().optional(),
    energy_level: z.number().min(1).max(5).optional(),
  }),
})

export const WorklogUpdateLastAction = z.object({
  type: z.literal('worklog_update_last'),
  payload: z.object({
    duration_minutes: z.number(),
    expected_previous_minutes: z.number().optional(),
  }),
})

export const JournalCreateAction = z.object({
  type: z.literal('journal_create'),
  payload: z.object({
    content: z.string(),
    mood: z.number().min(1).max(5).optional(),
    energy: z.number().min(1).max(5).optional(),
  }),
})

export const HabitLogAction = z.object({
  type: z.literal('habit_log'),
  payload: z.object({
    name_search: z.string(),
    note: z.string().optional(),
  }),
})

export const MemoryStoreAction = z.object({
  type: z.literal('memory_store'),
  payload: z.object({
    key: z.string(),
    value: z.string(),
    category: z.enum(['preference', 'routine', 'project_fact', 'business_fact', 'relationship', 'work_pattern', 'personal_context']),
    confidence: z.number().min(0).max(1),
  }),
})

export const InboxCaptureAction = z.object({
  type: z.literal('inbox_capture'),
  payload: z.object({
    raw_text: z.string(),
    suggested_type: z.string().optional(),
    suggested_context: z.string().optional(),
  }),
})

export const EventCreateAction = z.object({
  type: z.literal('event_create'),
  payload: z.object({
    title: z.string(),
    date: z.string(), // YYYY-MM-DD
    time: z.string().optional(),
    type: z.enum(['vergadering', 'deadline', 'afspraak', 'herinnering', 'algemeen']).optional(),
    description: z.string().optional(),
    duration: z.number().optional(),
  }),
})

export const EventUpdateAction = z.object({
  type: z.literal('event_update'),
  payload: z.object({
    id: z.number(),
    title: z.string().optional(),
    date: z.string().optional(),
    time: z.string().optional(),
    type: z.enum(['vergadering', 'deadline', 'afspraak', 'herinnering', 'algemeen']).optional(),
  }),
})

export const DailyPlanRequestAction = z.object({
  type: z.literal('daily_plan_request'),
  payload: z.object({}),
})

export const WeeklyPlanRequestAction = z.object({
  type: z.literal('weekly_plan_request'),
  payload: z.object({}),
})

export const AnyAction = z.discriminatedUnion('type', [
  TodoCreateAction,
  TodoUpdateAction,
  TodoDeleteAction,
  TodoDeleteManyAction,
  TodoCompleteAction,
  NoteCreateAction,
  NoteUpdateAction,
  ProjectCreateAction,
  ProjectUpdateAction,
  ContactCreateAction,
  FinanceCreateExpenseAction,
  FinanceCreateIncomeAction,
  WorklogCreateAction,
  WorklogUpdateLastAction,
  JournalCreateAction,
  HabitLogAction,
  MemoryStoreAction,
  InboxCaptureAction,
  EventCreateAction,
  EventUpdateAction,
  DailyPlanRequestAction,
  WeeklyPlanRequestAction,
])

export type AIAction = z.infer<typeof AnyAction>

export const MemoryCandidateSchema = z.object({
  key: z.string(),
  value: z.string(),
  category: z.enum(['preference', 'routine', 'project_fact', 'business_fact', 'relationship', 'work_pattern', 'personal_context']),
  confidence: z.number(),
})

export type MemoryCandidate = z.infer<typeof MemoryCandidateSchema>

export const AICommandResultSchema = z.object({
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  requires_confirmation: z.boolean(),
  actions: z.array(AnyAction),
  memory_candidates: z.array(MemoryCandidateSchema).optional(),
})

export type AICommandResult = z.infer<typeof AICommandResultSchema>
