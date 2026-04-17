import { query, execute } from '@/lib/db'
import { getOpenAIClient } from './openai-client'

/**
 * Automatically extracts habit completions from text (journal or chat)
 * and logs them in the habit_logs table.
 */
export async function extractAndLogHabits(content: string): Promise<{ logged: string[] }> {
  if (!process.env.OPENAI_API_KEY || !content.trim()) return { logged: [] }

  // Get active habits
  const habits = await query<{ id: number; name: string }>(
    `SELECT id, name FROM habits WHERE active = 1`
  )
  if (habits.length === 0) return { logged: [] }

  try {
    const openai = getOpenAIClient()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Je bent een habit-tracker assistent voor Daan. 
Analyseer de tekst en bepaal of Daan een van zijn gewoontes heeft uitgevoerd.

Beschikbare gewoontes:
${habits.map(h => `- ${h.name}`).join('\n')}

Regels:
- Geef een JSON-object terug: { "completed_habits": ["naam1", "naam2"] }
- Alleen gewoontes uit de lijst die EXPLICIET of STERK GEÏMPLICEERD zijn in de tekst.
- Als er geen gewoontes zijn, geef een lege lijst terug.
- Match exact op de namen uit de lijst.`
        },
        {
          role: 'user',
          content: `Tekst: "${content}"`
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })

    const raw = response.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw)
    const completedNames: string[] = parsed.completed_habits || []
    
    const logged: string[] = []
    const today = new Date().toISOString().split('T')[0]

    for (const name of completedNames) {
      const habit = habits.find(h => h.name.toLowerCase() === name.toLowerCase())
      if (habit) {
        const rowCount = await execute(
          `INSERT INTO habit_logs (habit_id, logged_date) 
           VALUES ($1, $2) 
           ON CONFLICT(habit_id, logged_date) DO NOTHING`,
          [habit.id, today]
        )
        if (rowCount > 0) {
          logged.push(habit.name)
        }
      }
    }

    return { logged }
  } catch (error) {
    console.error('[HabitExtractor] Error:', error)
    return { logged: [] }
  }
}
