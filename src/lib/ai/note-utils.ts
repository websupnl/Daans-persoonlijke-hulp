import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function generateTags(content: string): Promise<string[]> {
  if (!content || content.length < 10) return []

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Je bent een assistent die tags genereert voor notities. Geef maximaal 5 relevante tags terug als een door komma\'s gescheiden lijst. Gebruik alleen lowercase letters en streepjes voor spaties. Antwoord alleen met de lijst.'
        },
        {
          role: 'user',
          content: `Genereer tags voor deze notitie:\n${content}`
        }
      ],
      max_tokens: 50,
    })

    const tagsString = completion.choices[0]?.message?.content || ''
    return tagsString.split(',').map(t => t.trim().toLowerCase().replace(/\s+/g, '-')).filter(t => t.length > 0)
  } catch (error) {
    console.error('Error generating tags:', error)
    return []
  }
}

export async function rankNotesByQuery(notes: any[], query: string): Promise<any[]> {
  if (!query || notes.length === 0) return notes

  try {
    const noteSummaries = notes.map((n, i) => ({
      index: i,
      title: n.title,
      content: n.content?.substring(0, 200),
      tags: n.tags,
    }))

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Je bent een zoekassistent. Gegeven een zoekopdracht en een lijst met notities, bepaal welke notities het meest relevant zijn. Geef de indices van de top 10 meest relevante notities terug in volgorde van relevantie, als een door komma\'s gescheiden lijst met nummers. Antwoord alleen met de nummers.'
        },
        {
          role: 'user',
          content: `Zoekopdracht: "${query}"\n\nNotities:\n${JSON.stringify(noteSummaries, null, 2)}`
        }
      ],
      max_tokens: 100,
    })

    const indicesString = completion.choices[0]?.message?.content || ''
    const indices = indicesString.split(',').map(i => parseInt(i.trim())).filter(i => !isNaN(i))

    if (indices.length === 0) return notes

    const rankedNotes = indices.map(i => notes[i]).filter(Boolean)
    const otherNotes = notes.filter((_, i) => !indices.includes(i))

    return [...rankedNotes, ...otherNotes]
  } catch (error) {
    console.error('Error ranking notes:', error)
    return notes
  }
}
