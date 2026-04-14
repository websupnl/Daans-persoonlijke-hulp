import { NextRequest, NextResponse } from 'next/server'
import { execute } from '@/lib/db'

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await execute(`DELETE FROM work_logs WHERE id = $1`, [parseInt(params.id)])
  return NextResponse.json({ success: true })
}
