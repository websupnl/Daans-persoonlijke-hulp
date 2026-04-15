export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { execute } from '@/lib/db'
import { logActivity } from '@/lib/activity'

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await execute(`DELETE FROM work_logs WHERE id = $1`, [parseInt(params.id)])
  await logActivity({ entityType: 'worklog', entityId: parseInt(params.id), action: 'deleted', title: `Werklog ${params.id}`, summary: 'Werklog verwijderd' })
  return NextResponse.json({ success: true })
}
