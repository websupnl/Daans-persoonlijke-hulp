import { AICommandResult } from './action-schema'
import { ActionResult } from './execute-actions'

export function generateAIResponse(
  result: AICommandResult,
  actionResults: ActionResult[],
  requiresConfirmation: boolean
): string {
  if (requiresConfirmation) {
    const actionList = result.actions.map(a => `- **${getActionLabel(a.type)}**`).join('\n')
    return `${result.summary}\n\nWil je dat ik de volgende acties uitvoer?\n${actionList}\n\nZeg "ja, doe het" om te bevestigen.`
  }

  const parts: string[] = [result.summary]
  const errors = actionResults.filter(r => !r.success)
  if (errors.length > 0) {
    parts.push('\n\n⚠️ Sommige acties mislukten:')
    errors.forEach(e => parts.push(`- ${e.error}`))
  }

  return parts.join('')
}

function getActionLabel(type: string): string {
  const labels: Record<string, string> = {
    todo_create: 'Taak aanmaken',
    todo_update: 'Taak bijwerken',
    todo_complete: 'Taak afronden',
    note_create: 'Notitie aanmaken',
    note_update: 'Notitie bijwerken',
    project_create: 'Project aanmaken',
    project_update: 'Project bijwerken',
    contact_create: 'Contact aanmaken',
    finance_create_expense: 'Uitgave registreren',
    finance_create_income: 'Inkomst registreren',
    worklog_create: 'Werklog opslaan',
    journal_create: 'Dagboek bijwerken',
    habit_log: 'Gewoonte loggen',
    memory_store: 'Onthouden',
    inbox_capture: 'Opslaan in inbox',
    event_create: 'Event aanmaken',
    daily_plan_request: 'Dagplanning maken',
    weekly_plan_request: 'Weekplanning maken',
  }
  return labels[type] ?? type
}
