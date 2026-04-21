export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { queryOne, execute } from '@/lib/db'
import OpenAI from 'openai'

export async function POST(req: NextRequest) {
  const { note_id } = await req.json()
  if (!note_id) return NextResponse.json({ error: 'note_id verplicht' }, { status: 400 })

  const note = await queryOne<{ id: number; title: string; content_text: string }>(
    'SELECT id, title, content_text FROM notes WHERE id = $1',
    [note_id]
  )
  if (!note) return NextResponse.json({ error: 'Note niet gevonden' }, { status: 404 })

  const content = `${note.title}\n\n${note.content_text}`.slice(0, 2000)

  let tags: string[] = []
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY ontbreekt')

    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 80,
      messages: [
        {
          role: 'system',
          content: 'Genereer 3-5 relevante, specifieke tags voor deze notitie. Geef ALLEEN een JSON array terug, bijv: ["werk","planning","klant"]. Tags in het Nederlands, lowercase, max 2 woorden per tag.',
        },
        { role: 'user', content },
      ],
    })
    const raw = completion.choices[0]?.message?.content ?? '[]'
    const match = raw.match(/\[[\s\S]*?\]/)
    tags = JSON.parse(match?.[0] ?? '[]')
    if (!Array.isArray(tags)) tags = []
    tags = tags.filter(t => typeof t === 'string').slice(0, 5)
  } catch { tags = [] }

  await execute('UPDATE notes SET tags = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(tags), note_id])
  return NextResponse.json({ tags })
}
