export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { query, execute } from '@/lib/db'
import { logActivity, syncEntityLinks } from '@/lib/activity'
import { jsonFail, jsonOk } from '@/lib/contracts/api-http'

export async function GET() {
  try {
    const memories = await query(`SELECT * FROM memory_log ORDER BY last_reinforced_at DESC`)
    return jsonOk({ memories })
  } catch (error: unknown) {
    return jsonFail('MEMORY_LIST_FAILED', 'Kon memory-items niet ophalen', 500, error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { key, value, category, confidence } = await request.json()
    if (!key || !value) return jsonFail('MEMORY_VALIDATION', 'key en value zijn verplicht', 400, undefined, request)
    await execute(`
    INSERT INTO memory_log (key, value, category, confidence) VALUES ($1, $2, $3, $4)
    ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category, confidence = EXCLUDED.confidence, last_reinforced_at = NOW(), updated_at = NOW()
  `, [key, value, category ?? 'general', confidence ?? 0.8])
    const saved = await query<{ id: number }>(`SELECT id FROM memory_log WHERE key = $1 LIMIT 1`, [key])
    const memoryId = saved[0]?.id
    if (memoryId) {
      await syncEntityLinks({
        sourceType: 'memory',
        sourceId: Number(memoryId),
        tags: [category ?? 'general'],
      })
      await logActivity({
        entityType: 'memory',
        entityId: Number(memoryId),
        action: 'saved',
        title: String(key),
        summary: 'Memory opgeslagen of versterkt',
        metadata: { category: category ?? 'general', confidence: confidence ?? 0.8 },
      })
    }
    return jsonOk({ success: true }, undefined, request)
  } catch (error: unknown) {
    return jsonFail('MEMORY_SAVE_FAILED', 'Kon memory niet opslaan', 500, error, request)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    await execute(`DELETE FROM memory_log WHERE id = $1`, [id])
    return jsonOk({ success: true }, undefined, request)
  } catch (error: unknown) {
    return jsonFail('MEMORY_DELETE_FAILED', 'Kon memory niet verwijderen', 500, error, request)
  }
}
