import { NextRequest } from 'next/server'
import { execute } from './db'

export const DEFAULT_WORKSPACE_ID = 'websup'

export const WORKSPACES = [
  { id: 'websup', label: 'WebsUp.nl' },
  { id: 'bouma', label: 'Bouma' },
] as const

export type WorkspaceId = (typeof WORKSPACES)[number]['id']

const workspaceIds = new Set(WORKSPACES.map((workspace) => workspace.id))

export function normalizeWorkspace(value?: string | null): WorkspaceId {
  if (value && workspaceIds.has(value as WorkspaceId)) return value as WorkspaceId
  return DEFAULT_WORKSPACE_ID
}

export function getWorkspaceFromRequest(req: NextRequest): WorkspaceId {
  return normalizeWorkspace(req.nextUrl.searchParams.get('workspace') || req.cookies.get('app_workspace')?.value || req.headers.get('x-workspace-id'))
}

export async function ensureWorkspaceColumns(tableNames: string[]) {
  for (const tableName of tableNames) {
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
