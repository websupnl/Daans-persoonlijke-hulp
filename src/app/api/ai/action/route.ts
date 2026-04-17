export const dynamic = 'force-dynamic'

/**
 * POST /api/ai/action
 * 
 * Universele AI actie handler voor alle item types
 * Body: { itemId: number, itemType: string, action: string, context?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, execute } from '@/lib/db'
import { getOpenAIClient } from '@/lib/ai/openai-client'

export async function POST(req: NextRequest) {
  try {
    const { itemId, itemType, action, context } = await req.json() as {
      itemId: number
      itemType: 'transaction' | 'worklog' | 'todo' | 'note' | 'project' | 'pattern' | 'question'
      action: string
      context?: string
    }

    if (!itemId || !itemType || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Haal item data op voor context
    let itemData = null
    let tableName = ''
    
    switch (itemType) {
      case 'transaction':
        tableName = 'finance_items'
        itemData = await queryOne(`
          SELECT id, title, amount, category, description, created_at 
          FROM finance_items WHERE id = $1
        `, [itemId])
        break
      case 'worklog':
        tableName = 'work_logs'
        itemData = await queryOne(`
          SELECT id, title, duration_minutes, context, date 
          FROM work_logs WHERE id = $1
        `, [itemId])
        break
      case 'todo':
        tableName = 'todos'
        itemData = await queryOne(`
          SELECT id, title, description, priority, due_date 
          FROM todos WHERE id = $1
        `, [itemId])
        break
      case 'note':
        tableName = 'notes'
        itemData = await queryOne(`
          SELECT id, title, content_text, created_at 
          FROM notes WHERE id = $1
        `, [itemId])
        break
      case 'project':
        tableName = 'projects'
        itemData = await queryOne(`
          SELECT id, title, description, status 
          FROM projects WHERE id = $1
        `, [itemId])
        break
      default:
        return NextResponse.json({ error: 'Invalid item type' }, { status: 400 })
    }

    if (!itemData) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Bouw AI prompt voor specifieke actie
    const prompt = buildActionPrompt(itemType, action, itemData, context)

    // Roep AI aan voor actie
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'No AI key configured' }, { status: 500 })
    }

    const openai = getOpenAIClient()
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 600,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `Je bent de AI assistent van Daan's Persoonlijke Hulp. Geef concrete, bruikbare suggesties gebaseerd op de data. Wees specifiek en praktisch.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
    })

    const aiResponse = completion.choices[0]?.message?.content?.trim() ?? 'Geen suggestie beschikbaar'

    // Sla AI actie op voor logging
    await execute(`
      INSERT INTO ai_actions_log (item_type, item_id, action_type, context, ai_response, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [itemType, itemId, action, context || null, aiResponse])

    return NextResponse.json({ 
      success: true, 
      action: action,
      aiResponse,
      message: `AI actie "${action}" uitgevoerd voor ${itemType} #${itemId}` 
    })

  } catch (err) {
    console.error('[AI Action] Error:', err)
    return NextResponse.json(
      { error: 'Failed to execute AI action' }, 
      { status: 500 }
    )
  }
}

function buildActionPrompt(itemType: string, action: string, itemData: any, context?: string): string {
  const contextText = context ? `\n\nGebruiker context: ${context}` : ''
  
  switch (action) {
    case 'analyze':
      return `Analyseer dit ${itemType} in detail:\n\nData: ${JSON.stringify(itemData, null, 2)}${contextText}\n\nGeef inzichten, patronen en aanbevelingen.`
    
    case 'suggest':
      return `Geef suggesties voor dit ${itemType}:\n\nData: ${JSON.stringify(itemData, null, 2)}${contextText}\n\nWat kan beter? Welke acties worden aanbevolen?`
    
    case 'trend':
      return `Toon trends voor dit type item:\n\nItem: ${JSON.stringify(itemData, null, 2)}${contextText}\n\nWelke patronen zie je? Vergelijk met vergelijkbare items.`
    
    case 'categorize':
      return `Categoriseer deze transactie beter:\n\nData: ${JSON.stringify(itemData, null, 2)}${contextText}\n\nSuggest een betere categorie en eventuele subcategorie.`
    
    case 'similar':
      return `Toon vergelijkbare transacties:\n\nData: ${JSON.stringify(itemData, null, 2)}${contextText}\n\nWelke vergelijkbare uitgaven zie je? Wat zijn de patronen?`
    
    case 'optimize':
      return `Optimaliseer deze werklog planning:\n\nData: ${JSON.stringify(itemData, null, 2)}${contextText}\n\nHoe kan dit efficiënter? Welke patronen?`
    
    case 'productivity':
      return `Analyseer productiviteit voor deze werklog:\n\nData: ${JSON.stringify(itemData, null, 2)}${contextText}\n\nWelke inzichten over werkpatronen en efficiëntie?`
    
    case 'prioritize':
      return `Prioriteer deze taak:\n\nData: ${JSON.stringify(itemData, null, 2)}${contextText}\n\nWat is de beste aanpak? Welke subtaken?`
    
    case 'breakdown':
      return `Deel deze taak op in subtaken:\n\nData: ${JSON.stringify(itemData, null, 2)}${contextText}\n\nGeef concrete, uitvoerbare stappen.`
    
    case 'explore':
      return `Verdiep analyse voor patroon/vraag:\n\nData: ${JSON.stringify(itemData, null, 2)}${contextText}\n\nGeef diepgaande inzichten en verbanden.`
    
    case 'relate':
      return `Verbind dit patroon met andere patronen:\n\nData: ${JSON.stringify(itemData, null, 2)}${contextText}\n\nWelke verbanden zie je met andere patronen?`
    
    default:
      return `Voer AI actie "${action}" uit op:\n\nData: ${JSON.stringify(itemData, null, 2)}${contextText}\n\nGeef relevante inzichten.`
  }
}
