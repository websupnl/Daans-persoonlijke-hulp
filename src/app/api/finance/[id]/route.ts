export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { queryOne, execute } from '@/lib/db'
import { logActivity, syncEntityLinks } from '@/lib/activity'
import { jsonFail, jsonOk } from '@/lib/contracts/api-http'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id)
    if (Number.isNaN(id)) return jsonFail('FINANCE_ID_INVALID', 'Ongeldig finance id', 400, undefined, req)
    const body = await req.json()

    const fields = [
    'title', 'description', 'amount', 'contact_id', 'project_id', 'status', 'due_date', 'paid_date',
    'category', 'subcategory', 'merchant_raw', 'merchant_normalized', 'category_confidence',
    'recurrence_type', 'recurrence_confidence', 'subscription_status', 'fixed_cost_flag',
    'essential_flag', 'personal_business', 'user_verified', 'user_notes', 'needs_review', 'question_queue_status',
    'account', 'type'
  ]
    const updates: string[] = []
    const values: unknown[] = []
    let i = 1

    const smallIntFields = ['fixed_cost_flag', 'essential_flag', 'user_verified', 'needs_review']
    for (const field of fields) {
      if (field in body) {
        updates.push(`${field} = $${i++}`)
        let value = body[field] ?? null
        if (smallIntFields.includes(field) && typeof value === 'boolean') {
          value = value ? 1 : 0
        }
        values.push(value)
      }
    }

  // Als status betaald wordt, sla betaaldatum op
    if (body.status === 'betaald' && !body.paid_date) {
      updates.push(`paid_date = CURRENT_DATE`)
    }

    updates.push(`updated_at = NOW()`)
    values.push(id)

    await execute(`UPDATE finance_items SET ${updates.join(', ')} WHERE id = $${i}`, values)
    const updated = await queryOne(`
      SELECT f.*, c.name as contact_name FROM finance_items f
      LEFT JOIN contacts c ON f.contact_id = c.id
      WHERE f.id = $1
    `, [id])
    await syncEntityLinks({
      sourceType: 'finance',
      sourceId: id,
      projectId: Number((updated as Record<string, unknown> | undefined)?.project_id || 0) || null,
      contactId: Number((updated as Record<string, unknown> | undefined)?.contact_id || 0) || null,
      tags: [
        String((updated as Record<string, unknown> | undefined)?.category || 'overig'),
        String((updated as Record<string, unknown> | undefined)?.type || 'item'),
      ],
    })
    await logActivity({
      entityType: 'finance',
      entityId: id,
      action: 'updated',
      title: String((updated as Record<string, unknown> | undefined)?.title || `Finance ${id}`),
      summary: 'Financieel item bijgewerkt',
    })
    return jsonOk(updated, undefined, req)
  } catch (error: unknown) {
    return jsonFail('FINANCE_UPDATE_FAILED', 'Kon finance item niet bijwerken', 500, error, req)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id)
    if (Number.isNaN(id)) return jsonFail('FINANCE_ID_INVALID', 'Ongeldig finance id', 400, undefined, _req)
    await execute('DELETE FROM finance_items WHERE id = $1', [id])
    await logActivity({ entityType: 'finance', entityId: id, action: 'deleted', title: `Finance ${params.id}`, summary: 'Financieel item verwijderd' })
    return jsonOk({ message: 'Item verwijderd' }, undefined, _req)
  } catch (error: unknown) {
    return jsonFail('FINANCE_DELETE_FAILED', 'Kon finance item niet verwijderen', 500, error, _req)
  }
}
