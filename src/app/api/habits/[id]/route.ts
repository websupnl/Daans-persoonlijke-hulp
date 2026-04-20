export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { execute } from '@/lib/db'
import { jsonFail, jsonOk } from '@/lib/contracts/api-http'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    if (!id) return jsonFail('HABIT_ID_INVALID', 'Ongeldig id', 400, undefined, _req)
    await execute('DELETE FROM habits WHERE id = $1', [id])
    return jsonOk({ deleted: true }, undefined, _req)
  } catch (error: unknown) {
    return jsonFail('HABIT_DELETE_FAILED', 'Kon gewoonte niet verwijderen', 500, error, _req)
  }
}
