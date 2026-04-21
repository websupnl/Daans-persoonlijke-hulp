import { NextRequest } from 'next/server'
import { execute } from './db'

export const WORKSPACES = [
  { id: 'bouma', label: 'Bouma' },
  { id: 'websup', label: 'WebsUp.nl' },
  { id: 'prive', label: 'Prive' },
] as const

export type WorkspaceId = (typeof WORKSPACES)[number]['id']

const workspaceIds = new Set(WORKSPACES.map((workspace) => workspace.id))

export function normalizeWorkspace(value?: string | null): WorkspaceId {
  if (value && workspaceIds.has(value as WorkspaceId)) return value as WorkspaceId
  return 'bouma'
}

export function getWorkspaceFromRequest(req: NextRequest): WorkspaceId {
  return normalizeWorkspace(req.nextUrl.searchParams.get('workspace') || req.cookies.get('app_workspace')?.value || req.headers.get('x-workspace-id'))
}

export async function ensureWorkspaceColumns(tableNames: string[]) {
  for (const tableName of tableNames) {
    await execute(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS workspace TEXT NOT NULL DEFAULT 'bouma'`)
    await execute(`CREATE INDEX IF NOT EXISTS idx_${tableName}_workspace ON ${tableName}(workspace)`)
  }
}
