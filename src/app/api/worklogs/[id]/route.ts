import { NextRequest, NextResponse } from 'next/server'
import getDb from '@/lib/db'

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  db.prepare(`DELETE FROM work_logs WHERE id = ?`).run(parseInt(params.id))
  return NextResponse.json({ success: true })
}
