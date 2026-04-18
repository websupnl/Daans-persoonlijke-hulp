/**
 * Telegram Flow Manager
 *
 * State machine voor multi-step guided flows per module.
 * Elke flow bestaat uit stappen met prompts, validatie en een finale actie.
 *
 * Pipeline: flow_start → step 1 (prompt) → answer → step 2 → ... → execute → verify → reply
 */

import { queryOne, execute } from '@/lib/db'
import { executeActions } from '@/lib/ai/execute-actions'
import type { InlineKeyboardMarkup } from '@/lib/telegram/send-message'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type FlowType =
  | 'transactie'
  | 'todo'
  | 'boodschappen'
  | 'dagboek'
  | 'werklog'
  | 'notitie'
  | 'idee'
  | 'gewoonte'
  | 'contact'

export interface FlowState {
  id: number
  session_id: string
  flow_type: FlowType
  step: number
  data: Record<string, any>
  expires_at: Date
}

export interface FlowStepResult {
  prompt: string
  keyboard?: InlineKeyboardMarkup
  done: boolean
  reply?: string        // final reply after execution
  error?: string
}

interface StepDef {
  key: string           // data key to store the answer in
  prompt: string
  keyboard?: InlineKeyboardMarkup
  optional?: boolean
  validate?: (input: string) => string | null  // returns error message or null
  transform?: (input: string) => any           // transform input before storing
}

// ─────────────────────────────────────────────────────────────────────────────
// Flow definitions
// ─────────────────────────────────────────────────────────────────────────────

const FLOW_DEFS: Record<FlowType, StepDef[]> = {
  transactie: [
    {
      key: 'amount',
      prompt: '💸 *Nieuwe transactie*\n\nHoeveel? (bijv. `17.50`)',
      validate: (v) => {
        const n = parseFloat(v.replace(',', '.').replace('€', '').trim())
        return isNaN(n) || n <= 0 ? 'Dat lijkt geen geldig bedrag. Typ bijv. `17.50`' : null
      },
      transform: (v) => parseFloat(v.replace(',', '.').replace('€', '').trim()),
    },
    {
      key: 'type',
      prompt: '📊 Inkomst of uitgave?',
      keyboard: {
        inline_keyboard: [[
          { text: '💸 Uitgave', callback_data: 'flow_answer:uitgave' },
          { text: '💰 Inkomst', callback_data: 'flow_answer:inkomst' },
        ]],
      },
      validate: (v) =>
        !['uitgave', 'inkomst', 'expense', 'income'].includes(v.toLowerCase())
          ? 'Kies "uitgave" of "inkomst"'
          : null,
      transform: (v) =>
        v.toLowerCase().startsWith('in') || v.toLowerCase() === 'income' ? 'inkomst' : 'uitgave',
    },
    {
      key: 'title',
      prompt: '📝 Omschrijving? (bijv. `Jumbo boodschappen`)',
    },
    {
      key: 'category',
      prompt: '🗂️ Categorie?',
      keyboard: {
        inline_keyboard: [
          [
            { text: '🛒 Boodschappen', callback_data: 'flow_answer:boodschappen' },
            { text: '🏠 Wonen', callback_data: 'flow_answer:wonen' },
            { text: '🚗 Auto', callback_data: 'flow_answer:auto' },
          ],
          [
            { text: '🍔 Eten & drinken', callback_data: 'flow_answer:eten' },
            { text: '💼 Werk', callback_data: 'flow_answer:werk' },
            { text: '📦 Overig', callback_data: 'flow_answer:overig' },
          ],
        ],
      },
      optional: true,
      transform: (v) => v.toLowerCase().trim(),
    },
  ],

  todo: [
    {
      key: 'title',
      prompt: '✅ *Nieuwe todo*\n\nWat moet er gedaan worden?',
    },
    {
      key: 'priority',
      prompt: '🎯 Prioriteit?',
      keyboard: {
        inline_keyboard: [[
          { text: '🔴 Hoog', callback_data: 'flow_answer:hoog' },
          { text: '🟡 Medium', callback_data: 'flow_answer:medium' },
          { text: '⚪ Laag', callback_data: 'flow_answer:laag' },
        ]],
      },
      transform: (v) => v.toLowerCase().trim(),
    },
    {
      key: 'project',
      prompt: '📁 Voor welk project? (typ naam of `overslaan`)',
      optional: true,
      transform: (v) => v.toLowerCase() === 'overslaan' ? null : v.trim(),
    },
    {
      key: 'due_date',
      prompt: '📅 Deadline? (bijv. `morgen`, `vrijdag`, `2026-05-01` of `overslaan`)',
      optional: true,
      transform: (v) => v.toLowerCase() === 'overslaan' ? null : v.trim(),
    },
  ],

  boodschappen: [
    {
      key: 'items',
      prompt: '🛒 *Boodschappenlijst*\n\nWat wil je toevoegen?\n_(Meerdere items? Scheidt ze met komma\'s)_\n\nBijv: `melk, brood, kaas`',
    },
  ],

  dagboek: [
    {
      key: 'content',
      prompt: '📔 *Dagboek*\n\nWat wil je kwijt? Schrijf vrij.',
    },
    {
      key: 'mood',
      prompt: '😊 Hoe was je stemming vandaag?',
      keyboard: {
        inline_keyboard: [[
          { text: '😞 1', callback_data: 'flow_answer:1' },
          { text: '😕 2', callback_data: 'flow_answer:2' },
          { text: '😐 3', callback_data: 'flow_answer:3' },
          { text: '🙂 4', callback_data: 'flow_answer:4' },
          { text: '😄 5', callback_data: 'flow_answer:5' },
        ]],
      },
      transform: (v) => parseInt(v, 10),
    },
    {
      key: 'energy',
      prompt: '⚡ Energieniveau?',
      keyboard: {
        inline_keyboard: [[
          { text: '😴 1', callback_data: 'flow_answer:1' },
          { text: '🥱 2', callback_data: 'flow_answer:2' },
          { text: '😐 3', callback_data: 'flow_answer:3' },
          { text: '💪 4', callback_data: 'flow_answer:4' },
          { text: '🚀 5', callback_data: 'flow_answer:5' },
        ]],
      },
      transform: (v) => parseInt(v, 10),
    },
  ],

  werklog: [
    {
      key: 'context',
      prompt: '⏱️ *Werklog*\n\nVoor welk context?',
      keyboard: {
        inline_keyboard: [[
          { text: '🏗️ Bouma', callback_data: 'flow_answer:Bouma' },
          { text: '💻 WebsUp', callback_data: 'flow_answer:WebsUp' },
          { text: '🏠 Privé', callback_data: 'flow_answer:privé' },
        ]],
      },
    },
    {
      key: 'title',
      prompt: '📝 Wat heb je gedaan?',
    },
    {
      key: 'duration',
      prompt: '⏰ Hoe lang? (bijv. `1u30`, `45min`, `2 uur`)',
      validate: (v) => {
        const parsed = parseDuration(v)
        return parsed <= 0 ? 'Kan de duur niet begrijpen. Probeer `1u30` of `45min`' : null
      },
      transform: (v) => parseDuration(v),
    },
  ],

  notitie: [
    {
      key: 'title',
      prompt: '📌 *Nieuwe notitie*\n\nTitel? (of typ meteen de inhoud)',
    },
    {
      key: 'content',
      prompt: '📄 Inhoud van de notitie?',
      optional: true,
    },
  ],

  idee: [
    {
      key: 'title',
      prompt: '💡 *Nieuw idee*\n\nWat is het idee?',
    },
    {
      key: 'description',
      prompt: '📝 Toelichting? (of `overslaan`)',
      optional: true,
      transform: (v) => v.toLowerCase() === 'overslaan' ? null : v.trim(),
    },
  ],

  gewoonte: [
    {
      key: 'habit_name',
      prompt: '🔄 *Gewoonte loggen*\n\nWelke gewoonte heb je gedaan? (bijv. `lopen`, `mediteren`, `lezen`)',
    },
  ],

  contact: [
    {
      key: 'name',
      prompt: '👤 *Nieuw contact*\n\nNaam?',
    },
    {
      key: 'type',
      prompt: '🏷️ Persoon of bedrijf?',
      keyboard: {
        inline_keyboard: [[
          { text: '👤 Persoon', callback_data: 'flow_answer:persoon' },
          { text: '🏢 Bedrijf', callback_data: 'flow_answer:bedrijf' },
        ]],
      },
      transform: (v) => v.toLowerCase().trim(),
    },
    {
      key: 'phone',
      prompt: '📞 Telefoonnummer? (of `overslaan`)',
      optional: true,
      transform: (v) => v.toLowerCase() === 'overslaan' ? null : v.trim(),
    },
    {
      key: 'email',
      prompt: '📧 E-mailadres? (of `overslaan`)',
      optional: true,
      transform: (v) => v.toLowerCase() === 'overslaan' ? null : v.trim(),
    },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// Duration parser
// ─────────────────────────────────────────────────────────────────────────────

function parseDuration(input: string): number {
  const s = input.toLowerCase().trim()
  let minutes = 0

  const hourMin = s.match(/(\d+)\s*u(?:ur|r)?\s*(\d+)?/)
  if (hourMin) {
    minutes = parseInt(hourMin[1]) * 60 + parseInt(hourMin[2] ?? '0')
    return minutes
  }
  const minOnly = s.match(/(\d+)\s*min/)
  if (minOnly) return parseInt(minOnly[1])
  const hourOnly = s.match(/(\d+\.?\d*)\s*uur/)
  if (hourOnly) return Math.round(parseFloat(hourOnly[1]) * 60)
  const decimal = s.match(/^(\d+\.?\d*)$/)
  if (decimal) return Math.round(parseFloat(decimal[1]) * 60)

  return 0
}

// ─────────────────────────────────────────────────────────────────────────────
// DB helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getFlow(sessionId: string): Promise<FlowState | null> {
  const result = await queryOne<FlowState>(
    `SELECT * FROM telegram_flow_state
     WHERE session_id = $1 AND expires_at > NOW()`,
    [sessionId]
  )
  return result ?? null
}

async function saveFlow(
  sessionId: string,
  flowType: FlowType,
  step: number,
  data: Record<string, any>
): Promise<void> {
  await execute(
    `INSERT INTO telegram_flow_state (session_id, flow_type, step, data, expires_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 minutes', NOW())
     ON CONFLICT (session_id) DO UPDATE SET
       flow_type = EXCLUDED.flow_type,
       step = EXCLUDED.step,
       data = EXCLUDED.data,
       expires_at = EXCLUDED.expires_at,
       updated_at = NOW()`,
    [sessionId, flowType, step, JSON.stringify(data)]
  )
}

async function clearFlow(sessionId: string): Promise<void> {
  await execute('DELETE FROM telegram_flow_state WHERE session_id = $1', [sessionId])
}

// ─────────────────────────────────────────────────────────────────────────────
// Flow execution (final step)
// ─────────────────────────────────────────────────────────────────────────────

async function executeFlow(
  flowType: FlowType,
  data: Record<string, any>
): Promise<{ reply: string; keyboard?: InlineKeyboardMarkup }> {
  switch (flowType) {
    case 'transactie': {
      const type = data.type === 'inkomst' ? 'finance_create_income' : 'finance_create_expense'
      const results = await executeActions([{
        type,
        payload: {
          amount: data.amount,
          title: data.title || 'Onbekend',
          category: data.category || 'overig',
        },
      } as any])
      const ok = results[0]?.success
      const id = (results[0]?.data as any)?.id
      const sign = data.type === 'inkomst' ? '+' : '-'
      const reply = ok
        ? `✅ *${data.type === 'inkomst' ? 'Inkomst' : 'Uitgave'} opgeslagen*\n€${Number(data.amount).toFixed(2)} — ${data.title} _(${data.category || 'overig'})_${id ? ` \`[ID: ${id}]\`` : ''}`
        : '❌ Kon de transactie niet opslaan. Probeer het opnieuw.'
      return {
        reply,
        keyboard: ok ? { inline_keyboard: [[{ text: '💰 Financiën', callback_data: 'finance_overview' }]] } : undefined,
      }
    }

    case 'todo': {
      const results = await executeActions([{
        type: 'todo_create',
        payload: {
          title: data.title,
          priority: data.priority || 'medium',
          due_date: data.due_date || null,
          project_name: data.project || null,
        },
      }])
      const ok = results[0]?.success
      const id = (results[0]?.data as any)?.id
      const reply = ok
        ? `✅ *Todo aangemaakt*\n${data.title}\nPrioriteit: ${data.priority || 'medium'}${data.due_date ? `\nDeadline: ${data.due_date}` : ''}${id ? ` \`[ID: ${id}]\`` : ''}`
        : '❌ Kon de todo niet aanmaken.'
      return {
        reply,
        keyboard: ok && id ? {
          inline_keyboard: [[
            { text: '✓ Direct afronden', callback_data: `todo_complete:${id}` },
            { text: '📋 Alle taken', callback_data: 'todos_overview' },
          ]],
        } : undefined,
      }
    }

    case 'boodschappen': {
      const raw = String(data.items || '')
      const items = raw.split(/,|;|\n/).map(s => s.trim()).filter(s => s.length > 1)
      if (items.length === 0) return { reply: '❌ Geen items gevonden.' }

      const results = await executeActions(
        items.map(title => ({ type: 'grocery_create' as const, payload: { title, category: 'overig' } }))
      )
      const added = results.filter(r => r.success).map(r => (r.data as any)?.title ?? '?')
      const reply = added.length === 0
        ? '❌ Kon niets toevoegen.'
        : added.length === 1
        ? `✅ Toegevoegd: *${added[0]}*`
        : `✅ Toegevoegd:\n${added.map(i => `• ${i}`).join('\n')}`
      return { reply, keyboard: { inline_keyboard: [[{ text: '🛒 Boodschappenlijst', callback_data: 'groceries_overview' }]] } }
    }

    case 'dagboek': {
      const date = new Date().toISOString().split('T')[0]
      await execute(
        `INSERT INTO journal_entries (date, content, mood, energy)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (date) DO UPDATE SET
           content = EXCLUDED.content,
           mood = EXCLUDED.mood,
           energy = EXCLUDED.energy,
           updated_at = NOW()`,
        [date, data.content, data.mood || null, data.energy || null]
      )
      const moodLabel = data.mood ? ['', '😞', '😕', '😐', '🙂', '😄'][data.mood] || '' : ''
      return {
        reply: `📔 *Dagboek opgeslagen* ${moodLabel}\n\n_${data.content.slice(0, 100)}${data.content.length > 100 ? '…' : ''}_`,
        keyboard: {
          inline_keyboard: [[
            { text: '💬 Reflectievraag', callback_data: 'generate_question' },
          ]],
        },
      }
    }

    case 'werklog': {
      const results = await executeActions([{
        type: 'worklog_create',
        payload: {
          title: data.title,
          context: data.context || 'overig',
          duration_minutes: data.duration || 60,
          date: new Date().toISOString().split('T')[0],
        },
      }])
      const ok = results[0]?.success
      const mins = data.duration || 0
      const h = Math.floor(mins / 60)
      const m = mins % 60
      const dur = `${h > 0 ? h + 'u ' : ''}${m > 0 ? m + 'm' : ''}`.trim()
      const reply = ok
        ? `⏱️ *Werklog opgeslagen*\n${data.title}\nContext: ${data.context} | Duur: ${dur || '?'}`
        : '❌ Kon de werklog niet opslaan.'
      return { reply }
    }

    case 'notitie': {
      const results = await executeActions([{
        type: 'note_create',
        payload: {
          title: data.title,
          content: data.content || '',
        },
      }])
      const ok = results[0]?.success
      const id = (results[0]?.data as any)?.id
      return {
        reply: ok
          ? `📌 *Notitie opgeslagen*: ${data.title}${id ? ` \`[ID: ${id}]\`` : ''}`
          : '❌ Kon de notitie niet opslaan.',
      }
    }

    case 'idee': {
      // Save idea via DB directly (no dedicated action type)
      await execute(
        `INSERT INTO ideas (title, raw_input, verdict, status) VALUES ($1, $2, 'nog beoordelen', 'actief')`,
        [data.title, data.description || data.title]
      )
      return {
        reply: `💡 *Idee opgeslagen*: ${data.title}\n_Ik analyseer het idee later op de achtergrond._`,
      }
    }

    case 'gewoonte': {
      const results = await executeActions([{
        type: 'habit_log' as const,
        payload: { name_search: data.habit_name },
      }])
      const ok = results[0]?.success
      return {
        reply: ok
          ? `🔄 *Gewoonte gelogd*: ${data.habit_name} ✅`
          : `❌ Kon gewoonte "${data.habit_name}" niet vinden. Controleer de naam of maak hem eerst aan.`,
      }
    }

    case 'contact': {
      const results = await executeActions([{
        type: 'contact_create',
        payload: {
          name: data.name,
          type: data.type || 'persoon',
          phone: data.phone || null,
          email: data.email || null,
        },
      }])
      const ok = results[0]?.success
      const id = (results[0]?.data as any)?.id
      return {
        reply: ok
          ? `👤 *Contact opgeslagen*: ${data.name}${id ? ` \`[ID: ${id}]\`` : ''}`
          : '❌ Kon het contact niet opslaan.',
      }
    }

    default:
      return { reply: '❌ Onbekende flow.' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/** Check if there's an active flow for this session */
export async function hasActiveFlow(sessionId: string): Promise<boolean> {
  const flow = await getFlow(sessionId)
  return flow !== null
}

/** Start a new flow for a module */
export async function startFlow(
  sessionId: string,
  flowType: FlowType
): Promise<FlowStepResult> {
  const steps = FLOW_DEFS[flowType]
  if (!steps?.length) {
    return { prompt: '❌ Onbekende flow.', done: false }
  }

  await saveFlow(sessionId, flowType, 1, {})

  const firstStep = steps[0]
  return {
    prompt: firstStep.prompt,
    keyboard: firstStep.keyboard,
    done: false,
  }
}

/** Process the next answer in the active flow */
export async function processFlowAnswer(
  sessionId: string,
  answer: string
): Promise<FlowStepResult> {
  const flow = await getFlow(sessionId)
  if (!flow) {
    return { prompt: 'Er is geen actieve flow. Typ /menu om te beginnen.', done: false }
  }

  const steps = FLOW_DEFS[flow.flow_type]
  if (!steps) {
    await clearFlow(sessionId)
    return { prompt: '❌ Ongeldige flow, gestopt.', done: true }
  }

  const currentStepDef = steps[flow.step - 1]
  if (!currentStepDef) {
    await clearFlow(sessionId)
    return { prompt: '❌ Flow stap niet gevonden.', done: true }
  }

  // Validate input
  if (currentStepDef.validate) {
    const err = currentStepDef.validate(answer)
    if (err) {
      return {
        prompt: `⚠️ ${err}\n\n${currentStepDef.prompt}`,
        keyboard: currentStepDef.keyboard,
        done: false,
      }
    }
  }

  // Transform + store
  const value = currentStepDef.transform ? currentStepDef.transform(answer) : answer.trim()
  const updatedData = { ...flow.data, [currentStepDef.key]: value }

  const nextStepIndex = flow.step  // 0-based index of NEXT step
  const hasNextStep = nextStepIndex < steps.length

  if (hasNextStep) {
    // Move to next step
    await saveFlow(sessionId, flow.flow_type, flow.step + 1, updatedData)
    const nextStep = steps[nextStepIndex]
    return {
      prompt: nextStep.prompt,
      keyboard: nextStep.keyboard,
      done: false,
    }
  } else {
    // All steps done — execute
    await clearFlow(sessionId)
    const { reply, keyboard } = await executeFlow(flow.flow_type, updatedData)
    return {
      prompt: reply,
      keyboard,
      done: true,
      reply,
    }
  }
}

/** Cancel the active flow */
export async function cancelFlow(sessionId: string): Promise<string> {
  await clearFlow(sessionId)
  return '❌ Flow geannuleerd. Typ /menu voor opties.'
}
