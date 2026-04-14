import { NextRequest, NextResponse } from 'next/server'
import { queryOne, execute } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)
  const body = await req.json()

  const fields = ['title', 'description', 'status', 'color']
  const updates: string[] = []
  const values: unknown[] = []
  let i = 1

  for (const field of fields) {
    if (field in body) {
      updates.push(`${field} = $${i++}`)
      values.push(body[field] ?? null)
    }
  }

  updates.push(`updated_at = NOW()`)
  values.push(id)

  await execute(`UPDATE projects SET ${updates.join(', ')} WHERE id = $${i}`, values)
  const updated = await queryOne('SELECT * FROM projects WHERE id = $1', [id])
  return NextResponse.json({ data: updated })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await execute('DELETE FROM projects WHERE id = $1', [parseInt(params.id)])
  return NextResponse.json({ message: 'Project verwijderd' })
}
