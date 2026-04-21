export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import {
  createWorkspace,
  deleteWorkspace,
  getWorkspaceUsage,
  listWorkspaces,
  normalizeWorkspace,
  updateWorkspace,
  workspaceCookie,
} from '@/lib/workspace'
import { jsonFail, jsonOk } from '@/lib/contracts/api-http'

export async function GET(req: NextRequest) {
  try {
    const includeArchived = req.nextUrl.searchParams.get('archived') === '1'
    const workspaces = await listWorkspaces(includeArchived)
    const active = normalizeWorkspace(req.cookies.get('app_workspace')?.value)
    return jsonOk({ workspaces, active }, undefined, req)
  } catch (error: unknown) {
    return jsonFail('WORKSPACES_LIST_FAILED', 'Kon workspaces niet ophalen', 500, error, req)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const workspace = await createWorkspace({
      id: body.id,
      label: String(body.label || ''),
      description: body.description,
      color: body.color,
    })

    if (!workspace) return jsonFail('WORKSPACE_CREATE_FAILED', 'Workspace kon niet worden aangemaakt', 500, undefined, req)

    const response = NextResponse.json({ success: true, data: workspace })
    response.cookies.set(workspaceCookie(workspace.id))
    return response
  } catch (error: unknown) {
    return jsonFail('WORKSPACE_CREATE_FAILED', error instanceof Error ? error.message : 'Kon workspace niet aanmaken', 500, error, req)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const id = normalizeWorkspace(body.id)

    if (body.makeActive) {
      const response = NextResponse.json({ success: true, data: { active: id } })
      response.cookies.set(workspaceCookie(id))
      return response
    }

    const workspace = await updateWorkspace(id, {
      label: body.label,
      description: body.description,
      color: body.color,
      archived: body.archived,
    })

    return jsonOk(workspace, undefined, req)
  } catch (error: unknown) {
    return jsonFail('WORKSPACE_UPDATE_FAILED', error instanceof Error ? error.message : 'Kon workspace niet bijwerken', 500, error, req)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const id = normalizeWorkspace(body.id)
    const result = await deleteWorkspace(id)
    const response = NextResponse.json({ success: true, data: result })
    response.cookies.set(workspaceCookie('websup'))
    return response
  } catch (error: unknown) {
    const usage = (error as Error & { usage?: Record<string, number> }).usage
    if (usage) {
      return NextResponse.json(
        {
          success: false,
          error: 'Workspace bevat nog data en is daarom niet verwijderd.',
          data: { usage: Object.fromEntries(Object.entries(usage).filter(([, count]) => count > 0)) },
        },
        { status: 409 }
      )
    }
    return jsonFail('WORKSPACE_DELETE_FAILED', error instanceof Error ? error.message : 'Kon workspace niet verwijderen', 500, error, req)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const usage = await getWorkspaceUsage(String(body.id || ''))
    return jsonOk({ usage }, undefined, req)
  } catch (error: unknown) {
    return jsonFail('WORKSPACE_USAGE_FAILED', 'Kon workspace-gebruik niet controleren', 500, error, req)
  }
}
