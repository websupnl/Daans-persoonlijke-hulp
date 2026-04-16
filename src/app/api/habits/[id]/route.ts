export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { execute } from '@/lib/db'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10)
  if (!id) return NextResponse.json({ error: 'Ongeldig id' }, { status: 400 })
  await execute('DELETE FROM habits WHERE id = $1', [id])
  return NextResponse.json({ ok: true })
}
