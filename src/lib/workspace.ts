import { NextRequest } from 'next/server'
import { execute, query, queryOne } from './db'

export const DEFAULT_WORKSPACE_ID = 'websup'

export const WORKSPACES = [
  { id: 'websup', label: 'WebsUp.nl' },
  { id: 'bouma', label: 'Bouma' },
] as const

export type WorkspaceId = string

export type WorkspaceRecord = {
  id: string
  label: string
  description?: string | null
  color?: string | null
  is_default?: number | boolean
  archived?: number | boolean
  created_at?: string
  updated_at?: string
}

export function normalizeWorkspace(value?: string | null): WorkspaceId {
  const normalized = value?.trim().toLowerCase()
  if (normalized && /^[a-z0-9][a-z0-9_-]{1,48}$/.test(normalized)) return normalized
  return DEFAULT_WORKSPACE_ID
}

export function getWorkspaceFromRequest(req: NextRequest): WorkspaceId {
  return normalizeWorkspace(req.nextUrl.searchParams.get('workspace') || req.cookies.get('app_workspace')?.value || req.headers.get('x-workspace-id'))
}

export function workspaceCookie(workspace: string) {
  return {
    name: 'app_workspace',
    value: normalizeWorkspace(workspace),
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax' as const,
  }
}

export function slugifyWorkspaceId(value: string): WorkspaceId {
  return normalizeWorkspace(
    value
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48)
  )
}

export const WORKSPACE_SCOPED_TABLES = [
  'projects',
  'contacts',
  'todos',
  'notes',
  'finance_items',
  'finance_merchant_rules',
  'finance_review_queue',
  'finance_balances',
  'habits',
  'health_logs',
  'journal_entries',
  'memories',
  'chat_messages',
  'conversation_log',
  'work_logs',
  'inbox_items',
  'memory_log',
  'events',
  'ideas',
  'groceries',
  'activity_log',
  'entity_links',
  'ai_theories',
  'proactive_log',
  'nudge_state',
  'journal_conversation',
  'pending_actions',
  'pending_questions',
  'pattern_observations',
  'pattern_rules',
  'active_timers',
  'conversation_session',
  'telegram_flow_state',
  'import_runs',
] as const

const workspaceScopedTableSet = new Set<string>(WORKSPACE_SCOPED_TABLES)

export async function ensureWorkspaceColumns(tableNames: string[]) {
  for (const tableName of tableNames) {
    if (!workspaceScopedTableSet.has(tableName)) {
      throw new Error(`Workspace column requested for unknown table: ${tableName}`)
    }
    await execute(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS workspace TEXT NOT NULL DEFAULT '${DEFAULT_WORKSPACE_ID}'`)
    await execute(`ALTER TABLE ${tableName} ALTER COLUMN workspace SET DEFAULT '${DEFAULT_WORKSPACE_ID}'`)
    await execute(`CREATE INDEX IF NOT EXISTS idx_${tableName}_workspace ON ${tableName}(workspace)`)
  }
}

export async function migrateLegacyBoumaWorkspace(tableNames: string[]) {
  for (const tableName of tableNames) {
    await ensureWorkspaceColumns([tableName])
    await execute(`
      CREATE TABLE IF NOT EXISTS workspace_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    const migrationId = `legacy-bouma-to-websup:${tableName}`
    const result = await execute(
      `INSERT INTO workspace_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
      [migrationId]
    )
    if (!result) continue
    await execute(`UPDATE ${tableName} SET workspace = $1 WHERE workspace = 'bouma'`, [DEFAULT_WORKSPACE_ID])
  }
}

export async function ensureWorkspaceRegistry() {
  await execute(`
    CREATE TABLE IF NOT EXISTS app_workspaces (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#5f9fa1',
      is_default SMALLINT DEFAULT 0,
      archived SMALLINT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  for (const workspace of WORKSPACES) {
    await execute(
      `INSERT INTO app_workspaces (id, label, is_default)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, updated_at = NOW()`,
      [workspace.id, workspace.label, workspace.id === DEFAULT_WORKSPACE_ID ? 1 : 0]
    )
  }
}

export async function ensureWorkspaceDataStorage() {
  await ensureWorkspaceRegistry()
  await ensureWorkspaceColumns([...WORKSPACE_SCOPED_TABLES])
  await execute('ALTER TABLE health_logs DROP CONSTRAINT IF EXISTS health_logs_log_date_key')
  await execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_health_logs_workspace_date ON health_logs(workspace, log_date)')
  await execute('ALTER TABLE memory_log DROP CONSTRAINT IF EXISTS memory_log_key_key')
  await execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_log_workspace_key ON memory_log(workspace, key)')
  await execute('ALTER TABLE memories DROP CONSTRAINT IF EXISTS memories_key_key')
  await execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_memories_workspace_key ON memories(workspace, key)')
  await execute('ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_date_key')
  await execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_entries_workspace_date ON journal_entries(workspace, date)')
}

export async function listWorkspaces(includeArchived = false): Promise<WorkspaceRecord[]> {
  await ensureWorkspaceRegistry()
  return query<WorkspaceRecord>(
    `SELECT id, label, description, color, is_default, archived, created_at, updated_at
     FROM app_workspaces
     ${includeArchived ? '' : 'WHERE archived = 0'}
     ORDER BY is_default DESC, label ASC`
  )
}

export async function createWorkspace(input: { id?: string; label: string; description?: string | null; color?: string | null }) {
  await ensureWorkspaceRegistry()
  const id = slugifyWorkspaceId(input.id || input.label)
  const label = input.label.trim()
  if (!label) throw new Error('Naam is verplicht')

  return queryOne<WorkspaceRecord>(
    `INSERT INTO app_workspaces (id, label, description, color)
     VALUES ($1, $2, $3, $4)
     RETURNING id, label, description, color, is_default, archived, created_at, updated_at`,
    [id, label, input.description || null, input.color || '#5f9fa1']
  )
}

export async function updateWorkspace(id: string, input: { label?: string; description?: string | null; color?: string | null; archived?: boolean }) {
  await ensureWorkspaceRegistry()
  const workspace = normalizeWorkspace(id)
  const updates: string[] = []
  const values: unknown[] = []
  let index = 1

  if (input.label !== undefined) {
    updates.push(`label = $${index++}`)
    values.push(input.label.trim())
  }
  if (input.description !== undefined) {
    updates.push(`description = $${index++}`)
    values.push(input.description || null)
  }
  if (input.color !== undefined) {
    updates.push(`color = $${index++}`)
    values.push(input.color || '#5f9fa1')
  }
  if (input.archived !== undefined) {
    updates.push(`archived = $${index++}`)
    values.push(input.archived ? 1 : 0)
  }

  if (updates.length === 0) {
    return queryOne<WorkspaceRecord>('SELECT * FROM app_workspaces WHERE id = $1', [workspace])
  }

  values.push(workspace)
  return queryOne<WorkspaceRecord>(
    `UPDATE app_workspaces SET ${updates.join(', ')}, updated_at = NOW()
     WHERE id = $${index}
     RETURNING id, label, description, color, is_default, archived, created_at, updated_at`,
    values
  )
}

export async function getWorkspaceUsage(workspace: string) {
  await ensureWorkspaceRegistry()
  await ensureWorkspaceColumns([...WORKSPACE_SCOPED_TABLES])
  const normalized = normalizeWorkspace(workspace)
  const usage: Record<string, number> = {}

  for (const tableName of WORKSPACE_SCOPED_TABLES) {
    const row = await queryOne<{ count: string }>(`SELECT COUNT(*)::text as count FROM ${tableName} WHERE workspace = $1`, [normalized])
    usage[tableName] = Number(row?.count || 0)
  }

  return usage
}

export async function deleteWorkspace(id: string) {
  await ensureWorkspaceRegistry()
  const workspace = normalizeWorkspace(id)
  if (workspace === DEFAULT_WORKSPACE_ID) throw new Error('De standaard workspace kan niet worden verwijderd')

  const usage = await getWorkspaceUsage(workspace)
  const totalUsage = Object.values(usage).reduce((sum, count) => sum + count, 0)
  if (totalUsage > 0) {
    const error = new Error('Workspace bevat nog data')
    ;(error as Error & { usage?: Record<string, number> }).usage = usage
    throw error
  }

  await execute('DELETE FROM app_workspaces WHERE id = $1', [workspace])
  return { deleted: true }
}
