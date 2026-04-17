export const dynamic = 'force-dynamic'

/**
 * POST /api/ai/context
 * 
 * Gebruikers kunnen context geven aan AI voor elk item
 * Body: { itemId: number, itemType: string, context: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { query, execute } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { itemId, itemType, context } = await req.json() as {
      itemId: number
      itemType: 'transaction' | 'worklog' | 'todo' | 'note' | 'project'
      context: string
    }

    if (!itemId || !itemType || !context.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Sla context op in juiste tabel
    let tableName = ''
    switch (itemType) {
      case 'transaction':
        tableName = 'finance_items'
        break
      case 'worklog':
        tableName = 'work_logs'
        break
      case 'todo':
        tableName = 'todos'
        break
      case 'note':
        tableName = 'notes'
        break
      case 'project':
        tableName = 'projects'
        break
      default:
        return NextResponse.json({ error: 'Invalid item type' }, { status: 400 })
    }

    // Voeg AI context toe als user_notes veld
    await execute(`
      UPDATE ${tableName} 
      SET user_notes = $1, updated_at = NOW() 
      WHERE id = $2
    `, [context, itemId])

    return NextResponse.json({ 
      success: true, 
      message: `Context opgeslagen voor ${itemType} #${itemId}` 
    })

  } catch (err) {
    console.error('[AI Context] Error:', err)
    return NextResponse.json(
      { error: 'Failed to save context' }, 
      { status: 500 }
    )
  }
}
