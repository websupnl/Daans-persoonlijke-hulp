import test from 'node:test'
import assert from 'node:assert/strict'
import { planMessage } from '@/lib/chat/engine'
import type { ChatRuntimeContext } from '@/lib/chat/types'

function createContext(now = new Date('2026-04-17T10:00:00+02:00')): ChatRuntimeContext {
  return {
    source: 'chat',
    sessionKey: 'chat',
    now,
    recentMessages: [
      {
        role: 'assistant',
        content: 'Open taken',
        created_at: now.toISOString(),
        actions: [{ type: 'todo_listed', data: [{ id: 11, title: 'MCE factureren', priority: 'medium' }] }],
      },
      {
        role: 'assistant',
        content: 'Agenda',
        created_at: now.toISOString(),
        actions: [{ type: 'events_listed', data: [{ id: 21, title: 'Meeting met Jeremy', date: '2026-04-17', time: '19:00' }] }],
      },
    ],
    memories: [],
    activeProjects: [
      { id: 1, title: 'Prime Animalz', status: 'actief' },
      { id: 2, title: 'Camperhulp', status: 'actief' },
    ],
    contacts: [
      { id: 1, name: 'Jeremy', company: 'Prime Animalz' },
    ],
    openTodos: [
      { id: 11, title: 'MCE factureren', priority: 'medium', due_date: null, category: 'werk' },
    ],
    upcomingEvents: [
      { id: 21, title: 'Meeting met Jeremy', date: '2026-04-17', time: '19:00', type: 'vergadering' },
    ],
    recentWorklogs: [
      { id: 31, title: 'Werk aan Prime Animalz', duration_minutes: 60, context: 'WebsUp', created_at: now.toISOString(), date: '2026-04-17' },
    ],
    habits: [{ id: 1, name: 'Sporten' }],
  }
}

test('agenda-input gebruikt expliciete datum en tijd', () => {
  const plan = planMessage('Zet in de agenda voor 20 april om 8:00 uur meeting met Camperhulp', createContext())
  assert.equal(plan.primaryIntent, 'event_create')
  assert.equal(plan.actions[0]?.type, 'event_create')
  if (plan.actions[0]?.type === 'event_create') {
    assert.equal(plan.actions[0].payload.date, '2026-04-20')
    assert.equal(plan.actions[0].payload.time, '08:00')
  }
})

test('werkuren worden niet als finance gezien', () => {
  const plan = planMessage('Voeg toe aan werk uren 2 uren aan prime animalz', createContext())
  assert.equal(plan.primaryIntent, 'worklog_create')
  assert.equal(plan.actions[0]?.type, 'worklog_create')
})

test('uren bezig geweest aan app wordt als werklog herkend', () => {
  const plan = planMessage('2 uren bezig geweest aan Daans persoonlijke hulp app', createContext())
  assert.equal(plan.primaryIntent, 'worklog_create')
  assert.equal(plan.actions[0]?.type, 'worklog_create')
  if (plan.actions[0]?.type === 'worklog_create') {
    assert.equal(plan.actions[0].payload.duration_minutes, 120)
    assert.equal(plan.actions[0].payload.context, 'WebsUp')
    assert.match(plan.actions[0].payload.title, /Daans persoonlijke hulp app/i)
  }
})

test('werkmoment zonder duur vraagt verduidelijking in plaats van gokken', () => {
  const plan = planMessage('gister avond met Jeremy gebeld over de website want we gaan vandaag opleveren', createContext())
  assert.equal(plan.primaryIntent, 'worklog_missing_duration')
  assert.match(plan.clarification ?? '', /ik mis nog de duur/i)
})

test('natuurlijke gewoontevariaties worden herkend', () => {
  const plan = planMessage('Zonet aan het sporten geweest', createContext())
  assert.equal(plan.primaryIntent, 'habit_log')
  assert.equal(plan.actions[0]?.type, 'habit_log')
})

test('bevestiging wordt herkend', () => {
  const plan = planMessage('ja doe maar', createContext())
  assert.equal(plan.primaryIntent, 'confirmation_yes')
})

test('narratief bericht levert meerdere assistentacties op', () => {
  const plan = planMessage(
    'Zonet nadat ik wakker werd op vrijdag (mijn dag vrij van Bouma) ben ik om half 10 uit bed gegaan, daarna een potje Fortnite gedaan en daarna verder gegaan met deze app',
    createContext()
  )
  assert.equal(plan.primaryIntent, 'rich_narrative')
  assert.equal(plan.requiresConfirmation, true)
  assert.ok((plan.actions?.length ?? 0) >= 3)
})

test('pronoun update maakt laatste todo belangrijk', () => {
  const plan = planMessage('Maak dit belangrijk', createContext())
  assert.equal(plan.primaryIntent, 'todo_update_priority')
  assert.equal(plan.actions[0]?.type, 'todo_update')
})
