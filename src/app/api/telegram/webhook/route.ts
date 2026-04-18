export const dynamic = 'force-dynamic'

/**
 * Telegram Bot Webhook — Daan 2.0
 *
 * Pipeline per bericht:
 * 1. Auth check
 * 2. Flow state check (actieve multi-step flow?)
 * 3. Slash command routing
 * 4. Pending conversation state (dagboek follow-up, pattern antwoord)
 * 5. Ingest pipeline (legacy engine: intent → actie → verify → reply)
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendTelegramMessage, sendChatAction, getTelegramFileUrl, answerCallbackQuery } from '@/lib/telegram/send-message'
import { ingestMessage } from '@/lib/telegram/ingest'
import { queryOne, execute, query } from '@/lib/db'
import { generateDeepQuestion, runDeepSync } from '@/lib/ai/proactive-engine'
import { analyzeDiaryEntry, formatDiaryAnalysisForTelegram } from '@/lib/ai/diary-personas'
import { buildLifeSnapshot, formatSnapshotForPrompt } from '@/lib/ai/life-snapshot'
import { getOpenAIClient } from '@/lib/ai/openai-client'
import { promoteTheoryToMemory } from '@/lib/ai/proactive-engine'
import { hasActiveFlow, startFlow, processFlowAnswer, cancelFlow } from '@/lib/telegram/flow-manager'
import { mainMenuKeyboard } from '@/lib/telegram/keyboards'
import type { TelegramUpdate } from '@/lib/telegram/send-message'
import type { FlowType } from '@/lib/telegram/flow-manager'

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  const webhookSecret = request.headers.get('x-telegram-bot-api-secret-token')

  if (!configuredSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Telegram webhook] TELEGRAM_WEBHOOK_SECRET is not configured')
      return NextResponse.json({ error: 'Webhook configuration missing' }, { status: 503 })
    }
  }

  if (configuredSecret && webhookSecret !== configuredSecret) {
    console.error('[Telegram webhook] Unauthorized: secret mismatch')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let update: TelegramUpdate
  try {
    update = await request.json() as TelegramUpdate
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    if (update.callback_query) {
      await handleCallbackQuery(update).catch(err => console.error('[Telegram webhook] Callback error:', err))
    } else {
      await handleUpdate(update).catch(err => console.error('[Telegram webhook] Update error:', err))
    }
  } catch (err) {
    console.error('[Telegram webhook] Processing error:', err)
  }

  return NextResponse.json({ ok: true })
}

// ─────────────────────────────────────────────────────────────────────────────
// Voice transcription
// ─────────────────────────────────────────────────────────────────────────────

async function transcribeVoice(fileId: string, mimeType?: string): Promise<string | null> {
  try {
    const fileUrl = await getTelegramFileUrl(fileId)
    const audioRes = await fetch(fileUrl)
    if (!audioRes.ok) return null
    const audioBuffer = await audioRes.arrayBuffer()
    const ext = mimeType?.includes('mpeg') ? 'mp3' : mimeType?.includes('mp4') ? 'mp4' : 'ogg'
    const audioFile = new File([audioBuffer], `voice.${ext}`, { type: mimeType ?? 'audio/ogg' })
    const client = getOpenAIClient()
    const transcription = await client.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'nl',
    })
    return transcription.text.trim() || null
  } catch (err) {
    console.error('[Telegram] Voice transcription error:', err)
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main message handler
// ─────────────────────────────────────────────────────────────────────────────

async function handleUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message
  if (!message) return

  const chatId = message.chat.id
  const senderName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ')
  const sessionId = String(chatId)

  const allowedChatId = process.env.TELEGRAM_CHAT_ID
  if (allowedChatId && String(chatId) !== allowedChatId) {
    await sendTelegramMessage(chatId, '⛔ Je bent niet geautoriseerd om deze bot te gebruiken.')
    return
  }

  // ── Voice messages via Whisper ─────────────────────────────────────────────
  if (!message.text && (message.voice ?? message.audio)) {
    const fileId = (message.voice ?? message.audio)!.file_id
    const mimeType = (message.voice ?? message.audio)!.mime_type
    await sendChatAction(chatId, 'typing')
    const transcribed = await transcribeVoice(fileId, mimeType)
    if (!transcribed) {
      await sendTelegramMessage(chatId, '❌ Kon je spraakbericht niet begrijpen. Probeer het opnieuw.')
      return
    }
    await sendTelegramMessage(chatId, `_🎙️ Ik hoorde: "${transcribed}"_`)
    await routeMessage(chatId, sessionId, transcribed, senderName)
    return
  }

  if (!message.text) return
  const text = message.text.trim()

  // ── Slash commands ─────────────────────────────────────────────────────────
  if (text.startsWith('/')) {
    await handleSlashCommand(chatId, sessionId, text, senderName)
    return
  }

  await routeMessage(chatId, sessionId, text, senderName)
}

// ─────────────────────────────────────────────────────────────────────────────
// Message routing (flow check → pending state → ingest)
// ─────────────────────────────────────────────────────────────────────────────

async function routeMessage(
  chatId: number,
  sessionId: string,
  text: string,
  senderName: string
): Promise<void> {
  await sendChatAction(chatId, 'typing')

  // ── 1. Actieve multi-step flow? ──────────────────────────────────────────
  const activeFlow = await hasActiveFlow(sessionId)
  if (activeFlow) {
    const normalized = text.toLowerCase().trim()
    if (['stop', 'annuleer', 'cancel', 'nee', 'exit', 'quit'].includes(normalized)) {
      const msg = await cancelFlow(sessionId)
      await sendTelegramMessage(chatId, msg, { reply_markup: mainMenuKeyboard() })
      return
    }
    const result = await processFlowAnswer(sessionId, text)
    await sendTelegramMessage(chatId, result.prompt, {
      reply_markup: result.done
        ? result.keyboard ?? { inline_keyboard: [[{ text: '📋 Menu', callback_data: 'show_menu' }]] }
        : result.keyboard ?? { inline_keyboard: [[{ text: '❌ Annuleer', callback_data: 'flow_cancel' }]] },
    })
    return
  }

  // ── 2. Pending dagboek follow-up of pattern antwoord ────────────────────
  const pendingConvo = await queryOne<{
    session_id: string
    pending_question: string | null
    state: string
  }>(
    `SELECT session_id, pending_question, state
     FROM journal_conversation
     WHERE session_id = $1 AND state IN ('waiting_followup', 'waiting_entry', 'waiting_pattern_answer')`,
    [sessionId]
  )

  if (pendingConvo?.state === 'waiting_entry') {
    // Dit is een dagboekentry via journal_start flow
    await execute(
      `UPDATE journal_conversation SET state = 'complete', updated_at = NOW() WHERE session_id = $1`,
      [sessionId]
    )
    const date = new Date().toISOString().split('T')[0]
    await execute(
      `INSERT INTO journal_entries (date, content)
       VALUES ($1, $2)
       ON CONFLICT (date) DO UPDATE SET
         content = EXCLUDED.content, updated_at = NOW()`,
      [date, text]
    )
    await sendTelegramMessage(chatId, `📔 _Entry opgeslagen._\n\n_Ik analyseer en stuur je zo een follow-up vraag._`)
    scheduleJournalAnalysis(chatId, sessionId, text)
    return
  }

  if (pendingConvo?.state === 'waiting_followup') {
    await execute(
      `UPDATE journal_conversation SET state = 'complete', updated_at = NOW() WHERE session_id = $1`,
      [sessionId]
    )
    const analysis = await analyzeDiaryEntry(text, null, null)
    const telegramResponse = formatDiaryAnalysisForTelegram(analysis)
    const inboxRow = await queryOne<{ id: number }>(`
      INSERT INTO inbox_items (raw_text, source, suggested_type, parsed_status)
      VALUES ($1, 'telegram_journal', 'journal', 'pending') RETURNING id
    `, [text])
    await sendTelegramMessage(chatId, `✍️ _Ik heb je antwoord gelezen._\n\n${telegramResponse}`, {
      reply_markup: {
        inline_keyboard: [[
          { text: '📔 In dagboek opslaan', callback_data: `save_journal_note:${inboxRow?.id ?? 0}` },
          { text: '💬 Vraag meer', callback_data: 'generate_question' },
        ]],
      },
    })
    return
  }

  if (pendingConvo?.state === 'waiting_pattern_answer') {
    const qId = parseInt(pendingConvo.pending_question || '0', 10)
    await execute(`
      UPDATE pending_questions
      SET answer = $1, status = 'answered', answered_at = NOW()
      WHERE id = $2
    `, [text, qId])
    await execute(
      `UPDATE journal_conversation SET state = 'complete', updated_at = NOW() WHERE session_id = $1`,
      [sessionId]
    )
    await sendTelegramMessage(chatId, '✅ Bedankt voor je antwoord! Ik heb dit meegenomen in mijn patroonherkenning.')
    return
  }

  // ── 3. Normale ingest pipeline ─────────────────────────────────────────
  try {
    const result = await ingestMessage({
      message: text,
      source: 'telegram',
      senderName: senderName || undefined,
      senderPhone: sessionId,
    })

    if (result.reply) {
      const isJournalAction = (result.actions as Array<{ type?: string }>)?.some(
        (a) => a?.type === 'journal_created' || a?.type === 'journal_create'
      )

      await sendTelegramMessage(chatId, result.reply, { reply_markup: result.replyMarkup })

      if (isJournalAction) {
        scheduleJournalAnalysis(chatId, sessionId, text)
      }
    }
  } catch (err) {
    console.error('[Telegram webhook] Ingest error:', err instanceof Error ? err.message : err)
    await sendTelegramMessage(chatId, '❌ Er ging iets mis. Probeer het opnieuw.', {
      reply_markup: mainMenuKeyboard(),
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Async diary analysis (fires after sending initial reply)
// ─────────────────────────────────────────────────────────────────────────────

function scheduleJournalAnalysis(chatId: number, sessionId: string, entryText: string) {
  setTimeout(async () => {
    try {
      const todayJournal = await queryOne<{ content: string; mood: number; energy: number }>(
        'SELECT content, mood, energy FROM journal_entries WHERE date = CURRENT_DATE LIMIT 1'
      )
      const content = todayJournal?.content ?? entryText
      const analysis = await analyzeDiaryEntry(content, todayJournal?.mood ?? null, todayJournal?.energy ?? null)
      const followUp = formatDiaryAnalysisForTelegram(analysis)

      await execute(`
        INSERT INTO journal_conversation (session_id, state, pending_question, context_snapshot)
        VALUES ($1, 'waiting_followup', $2, '{}')
        ON CONFLICT (session_id) DO UPDATE
          SET state = 'waiting_followup', pending_question = EXCLUDED.pending_question, updated_at = NOW()
      `, [sessionId, analysis.followUpQuestion])

      await sendTelegramMessage(chatId, `📔 _Entry verwerkt._\n\n${followUp}`)
    } catch (err) {
      console.error('[Webhook] Diary follow-up error:', err instanceof Error ? err.message : err)
    }
  }, 2000)
}

// ─────────────────────────────────────────────────────────────────────────────
// Slash command handler
// ─────────────────────────────────────────────────────────────────────────────

async function handleSlashCommand(
  chatId: number,
  sessionId: string,
  text: string,
  senderName: string
): Promise<void> {
  const cmd = text.split(' ')[0].toLowerCase()

  // /start en /help → menu + uitleg
  if (cmd === '/start' || cmd === '/help') {
    await sendTelegramMessage(chatId,
      `🧠 *Daan's Personal Brain*\n\n` +
      `Kies een module hieronder of typ gewoon wat je wilt doen.\n\n` +
      `*Commando's:*\n` +
      `• /menu — Module knoppen\n` +
      `• /boodschappen — Boodschappenlijst\n` +
      `• /taken — Open taken\n` +
      `• /financien — Financiën deze maand\n` +
      `• /status — Life snapshot\n` +
      `• /vraag — Reflectievraag\n` +
      `• /sync — Volledig rapport\n\n` +
      `_🎙️ Spraakberichten worden automatisch omgezet._`,
      { reply_markup: mainMenuKeyboard() }
    )
    return
  }

  if (cmd === '/menu') {
    await sendTelegramMessage(chatId, '📋 *Kies een module:*', { reply_markup: mainMenuKeyboard() })
    return
  }

  if (cmd === '/vraag' || cmd === '/stelmeenvraag') {
    await sendTelegramMessage(chatId, '🧠 _Bezig met een diepgravende vraag voor je..._')
    try {
      const question = await generateDeepQuestion()
      await sendTelegramMessage(chatId, `💬 *Reflectievraag*\n\n${question}`, {
        reply_markup: {
          inline_keyboard: [[
            { text: '📔 Beantwoord in dagboek', callback_data: 'journal_start' },
            { text: '💬 Stuur antwoord hier', callback_data: 'reply_here' },
          ]],
        },
      })
    } catch {
      await sendTelegramMessage(chatId, '❌ Kon geen vraag genereren. Probeer het opnieuw.')
    }
    return
  }

  if (cmd === '/sync' || cmd === '/deepsync' || cmd === '/rapport') {
    await sendTelegramMessage(chatId, '🧠 _Volledige systeemscan wordt uitgevoerd..._')
    try {
      const report = await runDeepSync()
      await sendTelegramMessage(chatId, report, {
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Ontvangen', callback_data: 'deep_sync_ack' },
            { text: '❓ Stel me een vraag', callback_data: 'generate_question' },
          ]],
        },
      })
    } catch {
      await sendTelegramMessage(chatId, '❌ Deep sync mislukt.')
    }
    return
  }

  if (cmd === '/status' || cmd === '/snap') {
    try {
      const snap = await buildLifeSnapshot()
      const formatted = formatSnapshotForPrompt(snap)
      await sendTelegramMessage(chatId, `📊 *Life Snapshot*\n\n\`\`\`\n${formatted}\n\`\`\``)
    } catch {
      await sendTelegramMessage(chatId, '❌ Snapshot ophalen mislukt.')
    }
    return
  }

  if (cmd === '/boodschappen' || cmd === '/groceries') {
    const items = await query<{ id: number; title: string; quantity?: string; category?: string }>(`
      SELECT id, title, quantity, category FROM groceries WHERE completed = 0 ORDER BY category, title
    `).catch(() => [] as Array<{ id: number; title: string; quantity?: string; category?: string }>)
    if (items.length === 0) {
      await sendTelegramMessage(chatId, '🛒 Je boodschappenlijst is leeg.', {
        reply_markup: { inline_keyboard: [[{ text: '➕ Toevoegen', callback_data: 'flow_start:boodschappen' }]] },
      })
    } else {
      const lines = items.map(i => `• ${i.title}${i.quantity ? ` (${i.quantity})` : ''} \`[${i.id}]\``)
      const buttons = items.slice(0, 8).map(i => ({ text: `✓ ${i.title.slice(0, 20)}`, callback_data: `grocery_complete:${i.id}` }))
      const rows: typeof buttons[] = []
      for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2))
      rows.push([{ text: '➕ Item toevoegen', callback_data: 'flow_start:boodschappen' }])
      await sendTelegramMessage(chatId, `🛒 *Boodschappenlijst* (${items.length})\n\n${lines.join('\n')}`, {
        reply_markup: { inline_keyboard: rows },
      })
    }
    return
  }

  if (cmd === '/taken' || cmd === '/todos') {
    const todos = await query<{ id: number; title: string; priority: string; due_date: string | null }>(`
      SELECT id, title, priority, TO_CHAR(due_date, 'YYYY-MM-DD') as due_date
      FROM todos WHERE completed = 0
      ORDER BY CASE priority WHEN 'hoog' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END LIMIT 15
    `).catch(() => [] as Array<{ id: number; title: string; priority: string; due_date: string | null }>)
    if (todos.length === 0) {
      await sendTelegramMessage(chatId, '📋 Geen open taken.', {
        reply_markup: { inline_keyboard: [[{ text: '➕ Todo toevoegen', callback_data: 'flow_start:todo' }]] },
      })
    } else {
      const lines = todos.map(t => {
        const due = t.due_date ? ` _(${t.due_date})_` : ''
        const icon = t.priority === 'hoog' ? '🔴' : t.priority === 'medium' ? '🟡' : '⚪'
        return `${icon} ${t.title}${due} \`[${t.id}]\``
      })
      const highTodos = todos.filter(t => t.priority === 'hoog').slice(0, 4)
      const buttons = highTodos.map(t => ({ text: `✓ ${t.title.slice(0, 20)}`, callback_data: `todo_complete:${t.id}` }))
      const rows: typeof buttons[] = []
      for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2))
      rows.push([{ text: '➕ Todo toevoegen', callback_data: 'flow_start:todo' }])
      await sendTelegramMessage(chatId, `📋 *Open taken* (${todos.length})\n\n${lines.join('\n')}`, {
        reply_markup: { inline_keyboard: rows },
      })
    }
    return
  }

  if (cmd === '/financien' || cmd === '/finance' || cmd === '/geld') {
    const items = await query<{ type: string; title: string; amount: number; category: string; date: string }>(`
      SELECT type, title, amount::float, category, TO_CHAR(date, 'YYYY-MM-DD') as date
      FROM finance_items
      WHERE date >= DATE_TRUNC('month', CURRENT_DATE)
      ORDER BY date DESC LIMIT 15
    `).catch(() => [] as Array<{ type: string; title: string; amount: number; category: string; date: string }>)
    const totaalUit = items.filter(i => i.type === 'expense' || i.type === 'uitgave').reduce((s, i) => s + Number(i.amount), 0)
    const totaalIn = items.filter(i => i.type === 'inkomst' || i.type === 'income').reduce((s, i) => s + Number(i.amount), 0)
    const lines = items.map(i => {
      const sign = (i.type === 'expense' || i.type === 'uitgave') ? '-' : '+'
      return `${sign}€${Number(i.amount).toFixed(2)} — ${i.title} _(${i.date})_`
    })
    await sendTelegramMessage(chatId,
      `💰 *Financiën deze maand*\n` +
      `Inkomsten: +€${totaalIn.toFixed(2)} | Uitgaven: -€${totaalUit.toFixed(2)}\n\n` +
      `${lines.join('\n') || '_Geen transacties_'}`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '➕ Transactie toevoegen', callback_data: 'flow_start:transactie' },
          ]],
        },
      }
    )
    return
  }

  // Onbekend slash command → via ingest
  await routeMessage(chatId, sessionId, text, senderName)
}

// ─────────────────────────────────────────────────────────────────────────────
// Callback query handler
// ─────────────────────────────────────────────────────────────────────────────

async function handleCallbackQuery(update: TelegramUpdate): Promise<void> {
  const cb = update.callback_query
  if (!cb) return

  const chatId = cb.message?.chat.id
  const callbackData = cb.data ?? ''
  const sessionId = chatId ? String(chatId) : ''

  const allowedChatId = process.env.TELEGRAM_CHAT_ID
  if (allowedChatId && chatId && String(chatId) !== allowedChatId) {
    await answerCallbackQuery(cb.id, '⛔ Niet geautoriseerd')
    return
  }

  try {
    const colonIdx = callbackData.indexOf(':')
    const action = colonIdx >= 0 ? callbackData.slice(0, colonIdx) : callbackData
    const rest = colonIdx >= 0 ? callbackData.slice(colonIdx + 1) : ''

    // ── Flow: start ────────────────────────────────────────────────────────
    if (action === 'flow_start') {
      const flowType = rest as FlowType
      await answerCallbackQuery(cb.id, `${flowType} starten...`)
      if (chatId) {
        const result = await startFlow(sessionId, flowType)
        await sendTelegramMessage(chatId, result.prompt, {
          reply_markup: result.keyboard ?? {
            inline_keyboard: [[{ text: '❌ Annuleer', callback_data: 'flow_cancel' }]],
          },
        })
      }
      return
    }

    // ── Flow: answer via button ────────────────────────────────────────────
    if (action === 'flow_answer') {
      await answerCallbackQuery(cb.id, rest)
      if (chatId) {
        const activeFlow = await hasActiveFlow(sessionId)
        if (activeFlow) {
          const result = await processFlowAnswer(sessionId, rest)
          await sendTelegramMessage(chatId, result.prompt, {
            reply_markup: result.done
              ? result.keyboard ?? { inline_keyboard: [[{ text: '📋 Menu', callback_data: 'show_menu' }]] }
              : result.keyboard ?? { inline_keyboard: [[{ text: '❌ Annuleer', callback_data: 'flow_cancel' }]] },
          })
        }
      }
      return
    }

    // ── Flow: cancel ───────────────────────────────────────────────────────
    if (action === 'flow_cancel') {
      await answerCallbackQuery(cb.id, 'Geannuleerd')
      if (chatId) {
        const msg = await cancelFlow(sessionId)
        await sendTelegramMessage(chatId, msg, { reply_markup: mainMenuKeyboard() })
      }
      return
    }

    // ── Menu tonen ────────────────────────────────────────────────────────
    if (action === 'show_menu') {
      await answerCallbackQuery(cb.id, '')
      if (chatId) await sendTelegramMessage(chatId, '📋 *Kies een module:*', { reply_markup: mainMenuKeyboard() })
      return
    }

    // ── Status overview ────────────────────────────────────────────────────
    if (action === 'status_overview') {
      await answerCallbackQuery(cb.id, 'Status laden...')
      if (chatId) {
        try {
          const snap = await buildLifeSnapshot()
          const formatted = formatSnapshotForPrompt(snap)
          await sendTelegramMessage(chatId, `📊 *Life Snapshot*\n\n\`\`\`\n${formatted}\n\`\`\``)
        } catch {
          await sendTelegramMessage(chatId, '❌ Snapshot niet beschikbaar.')
        }
      }
      return
    }

    // ── Deep sync trigger ──────────────────────────────────────────────────
    if (action === 'deep_sync_trigger') {
      await answerCallbackQuery(cb.id, 'Sync starten...')
      if (chatId) {
        await sendTelegramMessage(chatId, '🧠 _Volledige systeemscan wordt uitgevoerd..._')
        try {
          const report = await runDeepSync()
          await sendTelegramMessage(chatId, report, {
            reply_markup: { inline_keyboard: [[{ text: '✅ Ontvangen', callback_data: 'deep_sync_ack' }]] },
          })
        } catch {
          await sendTelegramMessage(chatId, '❌ Deep sync mislukt.')
        }
      }
      return
    }

    // ── Groceries overview ────────────────────────────────────────────────
    if (action === 'groceries_overview') {
      await answerCallbackQuery(cb.id, '')
      if (chatId) {
        const items = await query<{ id: number; title: string }>(`
          SELECT id, title FROM groceries WHERE completed = 0 ORDER BY title LIMIT 20
        `).catch(() => [] as Array<{ id: number; title: string }>)
        if (items.length === 0) {
          await sendTelegramMessage(chatId, '🛒 Boodschappenlijst is leeg.')
        } else {
          const lines = items.map(i => `• ${i.title} \`[${i.id}]\``)
          const buttons = items.slice(0, 6).map(i => ({ text: `✓ ${i.title.slice(0, 20)}`, callback_data: `grocery_complete:${i.id}` }))
          const rows: typeof buttons[] = []
          for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2))
          await sendTelegramMessage(chatId, `🛒 *Boodschappenlijst* (${items.length})\n\n${lines.join('\n')}`, {
            reply_markup: { inline_keyboard: rows },
          })
        }
      }
      return
    }

    // ── Pending action: Confirm ────────────────────────────────────────────
    if (action === 'confirm_pending') {
      await answerCallbackQuery(cb.id, '⏳ Wordt uitgevoerd...')
      if (chatId) {
        await sendChatAction(chatId, 'typing')
        const result = await ingestMessage({ message: 'ja', source: 'telegram', senderPhone: sessionId })
        if (result.reply) await sendTelegramMessage(chatId, result.reply, { reply_markup: result.replyMarkup })
      }
      return
    }

    // ── Pending action: Cancel ─────────────────────────────────────────────
    if (action === 'cancel_pending') {
      await answerCallbackQuery(cb.id, '❌ Geannuleerd')
      if (chatId) {
        const result = await ingestMessage({ message: 'nee', source: 'telegram', senderPhone: sessionId })
        if (result.reply) await sendTelegramMessage(chatId, result.reply, { reply_markup: result.replyMarkup })
      }
      return
    }

    // ── Todo complete ──────────────────────────────────────────────────────
    if (action === 'todo_complete') {
      const id = parseInt(rest, 10)
      if (isNaN(id)) { await answerCallbackQuery(cb.id, 'Ongeldig ID'); return }
      const todo = await queryOne<{ id: number; title: string }>(
        'SELECT id, title FROM todos WHERE id = $1 AND completed = 0 LIMIT 1', [id]
      )
      if (!todo) { await answerCallbackQuery(cb.id, '✅ Al afgerond of niet gevonden'); return }
      await execute('UPDATE todos SET completed = 1, completed_at = NOW(), updated_at = NOW() WHERE id = $1', [id])
      await answerCallbackQuery(cb.id, `✅ Klaar: ${todo.title}`)
      if (chatId) await sendTelegramMessage(chatId, `✅ Taak afgerond: *${todo.title}* \`[ID: ${id}]\``)
      return
    }

    // ── Grocery complete ───────────────────────────────────────────────────
    if (action === 'grocery_complete') {
      const id = parseInt(rest, 10)
      if (isNaN(id)) { await answerCallbackQuery(cb.id, 'Ongeldig ID'); return }
      const item = await queryOne<{ id: number; title: string }>(
        'SELECT id, title FROM groceries WHERE id = $1 AND completed = 0 LIMIT 1', [id]
      )
      if (!item) { await answerCallbackQuery(cb.id, '✅ Al afgevinkt'); return }
      await execute('UPDATE groceries SET completed = 1, updated_at = NOW() WHERE id = $1', [id])
      await answerCallbackQuery(cb.id, `✅ Afgevinkt: ${item.title}`)
      if (chatId) await sendTelegramMessage(chatId, `✅ Boodschap afgevinkt: *${item.title}* \`[ID: ${id}]\``)
      return
    }

    // ── Note pin ───────────────────────────────────────────────────────────
    if (action === 'note_pin') {
      const id = parseInt(rest, 10)
      const note = await queryOne<{ id: number; title: string }>('SELECT id, title FROM notes WHERE id = $1 LIMIT 1', [id])
      if (!note) { await answerCallbackQuery(cb.id, '📌 Niet gevonden'); return }
      await execute('UPDATE notes SET pinned = 1, updated_at = NOW() WHERE id = $1', [id])
      await answerCallbackQuery(cb.id, `📌 Vastgepind: ${note.title}`)
      if (chatId) await sendTelegramMessage(chatId, `📌 Notitie vastgepind: *${note.title}*`)
      return
    }

    // ── Worklog status ─────────────────────────────────────────────────────
    if (action === 'worklog_status') {
      const id = parseInt(rest, 10)
      const log = await queryOne<{ id: number; title: string; duration_minutes: number; context: string; date: string }>(
        `SELECT id, title, COALESCE(actual_duration_minutes, duration_minutes) as duration_minutes,
                context, TO_CHAR(date, 'YYYY-MM-DD') as date
         FROM work_logs WHERE id = $1 LIMIT 1`, [id]
      )
      if (!log) { await answerCallbackQuery(cb.id, '📊 Niet gevonden'); return }
      const h = Math.floor(log.duration_minutes / 60)
      const m = log.duration_minutes % 60
      const dur = `${h > 0 ? h + 'u ' : ''}${m > 0 ? m + 'm' : ''}`.trim()
      await answerCallbackQuery(cb.id, `${log.title} — ${dur}`)
      if (chatId) {
        await sendTelegramMessage(chatId,
          `📊 *Werklog* \`[ID: ${id}]\`\n- Titel: ${log.title}\n- Duur: ${dur}\n- Context: ${log.context}\n- Datum: ${log.date}`
        )
      }
      return
    }

    // ── Nudge resolve ──────────────────────────────────────────────────────
    if (action === 'nudge_resolve') {
      await execute(`UPDATE nudge_state SET resolved_at = NOW() WHERE topic = $1`, [rest])
      await answerCallbackQuery(cb.id, '✅ Topic losgelaten')
      return
    }

    // ── Nudge snooze ───────────────────────────────────────────────────────
    if (action === 'nudge_snooze') {
      const [topic, hoursStr] = rest.split(':')
      const hours = parseInt(hoursStr ?? '4', 10)
      await execute(
        `UPDATE nudge_state SET last_nudged_at = NOW() - INTERVAL '1 hour' * ($1 - $2) WHERE topic = $3`,
        [NUDGE_COOLDOWN_MAP[topic] ?? 24, hours, topic]
      )
      await answerCallbackQuery(cb.id, `⏰ Herinner ik je over ${hours}u`)
      return
    }

    // ── Journal start ──────────────────────────────────────────────────────
    if (action === 'journal_start') {
      await answerCallbackQuery(cb.id, '')
      if (chatId) {
        await sendTelegramMessage(chatId,
          `📔 *Dagboek sessie*\n\nTyp je reflectie hier. Schrijf over hoe je dag was, wat je bezighoudt, of alles wat in je opkomt.\n\n_Ik luister en reageer daarna._`
        )
        await execute(`
          INSERT INTO journal_conversation (session_id, state, pending_question, context_snapshot)
          VALUES ($1, 'waiting_entry', NULL, '{}')
          ON CONFLICT (session_id) DO UPDATE
            SET state = 'waiting_entry', pending_question = NULL, updated_at = NOW()
        `, [sessionId])
      }
      return
    }

    // ── Generate question ──────────────────────────────────────────────────
    if (action === 'generate_question') {
      await answerCallbackQuery(cb.id, '🧠 Vraag genereren...')
      if (chatId) {
        const question = await generateDeepQuestion()
        await sendTelegramMessage(chatId, `💬 *Reflectievraag*\n\n${question}`, {
          reply_markup: {
            inline_keyboard: [[{ text: '📔 Beantwoord in dagboek', callback_data: 'journal_start' }]],
          },
        })
      }
      return
    }

    // ── Deep sync ack ──────────────────────────────────────────────────────
    if (action === 'deep_sync_ack') {
      await answerCallbackQuery(cb.id, '✅ Rapport ontvangen')
      return
    }

    // ── Finance overview ───────────────────────────────────────────────────
    if (action === 'finance_overview') {
      await answerCallbackQuery(cb.id, '')
      if (chatId) {
        const items = await query<{ type: string; title: string; amount: number; date: string }>(`
          SELECT type, title, amount::float, TO_CHAR(date, 'DD-MM') as date
          FROM finance_items
          WHERE date >= DATE_TRUNC('month', CURRENT_DATE)
          ORDER BY date DESC LIMIT 10
        `).catch(() => [] as any[])
        const lines = items.map(i => {
          const sign = (i.type === 'expense' || i.type === 'uitgave') ? '-' : '+'
          return `${sign}€${Number(i.amount).toFixed(2)} — ${i.title} _(${i.date})_`
        })
        await sendTelegramMessage(chatId,
          `💰 *Financiën deze maand*\n\n${lines.join('\n') || '_Geen items_'}`,
          { reply_markup: { inline_keyboard: [[{ text: '➕ Transactie toevoegen', callback_data: 'flow_start:transactie' }]] } }
        )
      }
      return
    }

    // ── Todos overview ─────────────────────────────────────────────────────
    if (action === 'todos_overview') {
      await answerCallbackQuery(cb.id, '')
      if (chatId) {
        const todos = await query<{ id: number; title: string; priority: string }>(`
          SELECT id, title, priority FROM todos WHERE completed = 0
          ORDER BY CASE priority WHEN 'hoog' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END LIMIT 10
        `).catch(() => [] as any[])
        const lines = todos.map(t => {
          const icon = t.priority === 'hoog' ? '🔴' : t.priority === 'medium' ? '🟡' : '⚪'
          return `${icon} ${t.title} \`[${t.id}]\``
        })
        await sendTelegramMessage(chatId,
          `📋 *Open taken*\n\n${lines.join('\n') || '_Geen open taken_'}`,
          { reply_markup: { inline_keyboard: [[{ text: '➕ Todo toevoegen', callback_data: 'flow_start:todo' }]] } }
        )
      }
      return
    }

    // ── Reply here ─────────────────────────────────────────────────────────
    if (action === 'reply_here') {
      await answerCallbackQuery(cb.id, '')
      if (chatId) {
        await sendTelegramMessage(chatId, '_Typ je antwoord gewoon hieronder. Ik bewaar het voor je._')
        await execute(`
          INSERT INTO journal_conversation (session_id, state, pending_question, context_snapshot)
          VALUES ($1, 'waiting_followup', 'open_question', '{}')
          ON CONFLICT (session_id) DO UPDATE
            SET state = 'waiting_followup', updated_at = NOW()
        `, [sessionId])
      }
      return
    }

    // ── Pattern Brain: reply ───────────────────────────────────────────────
    if (action === 'pattern_q_reply') {
      const qId = parseInt(rest, 10)
      await answerCallbackQuery(cb.id, 'Antwoord vastleggen...')
      if (chatId) {
        await sendTelegramMessage(chatId, '_Ik luister naar je antwoord._')
        await execute(`
          INSERT INTO journal_conversation (session_id, state, pending_question, context_snapshot)
          VALUES ($1, 'waiting_pattern_answer', $2, '{}')
          ON CONFLICT (session_id) DO UPDATE
            SET state = 'waiting_pattern_answer', pending_question = EXCLUDED.pending_question, updated_at = NOW()
        `, [sessionId, String(qId)])
      }
      return
    }

    // ── Pattern Brain: dismiss ─────────────────────────────────────────────
    if (action === 'pattern_q_dismiss') {
      const qId = parseInt(rest, 10)
      await execute(`UPDATE pending_questions SET status = 'dismissed' WHERE id = $1`, [qId])
      await answerCallbackQuery(cb.id, 'Vraag overgeslagen')
      if (chatId) await sendTelegramMessage(chatId, '👍 Prima, we slaan deze even over.')
      return
    }

    // ── Theory confirm/reject ──────────────────────────────────────────────
    if (action === 'theory_confirm') {
      const id = parseInt(rest, 10)
      if (!isNaN(id)) await promoteTheoryToMemory(id, true)
      await answerCallbackQuery(cb.id, '✅ Patroon bevestigd')
      if (chatId) await sendTelegramMessage(chatId, '🧠 Goed om te weten. Dit patroon is opgeslagen in mijn langetermijngeheugen.')
      return
    }

    if (action === 'theory_reject') {
      const id = parseInt(rest, 10)
      if (!isNaN(id)) await promoteTheoryToMemory(id, false)
      await answerCallbackQuery(cb.id, '❌ Patroon verworpen')
      if (chatId) await sendTelegramMessage(chatId, '👍 Begrepen. Ik pas mijn model aan.')
      return
    }

    // ── Save journal note ──────────────────────────────────────────────────
    if (action === 'save_journal_note') {
      const inboxId = parseInt(rest, 10)
      const inbox = await queryOne<{ id: number; raw_text: string }>(
        `SELECT id, raw_text FROM inbox_items WHERE id = $1 LIMIT 1`, [inboxId]
      )
      if (!inbox) { await answerCallbackQuery(cb.id, '❌ Tekst niet meer beschikbaar'); return }
      const date = new Date().toISOString().split('T')[0]
      await execute(`
        INSERT INTO journal_entries (date, content)
        VALUES ($1, $2)
        ON CONFLICT (date) DO UPDATE SET
          content = journal_entries.content || E'\n\n' || EXCLUDED.content,
          updated_at = NOW()
      `, [date, inbox.raw_text])
      await execute(`UPDATE inbox_items SET parsed_status = 'processed', processed_at = NOW() WHERE id = $1`, [inboxId])
      await answerCallbackQuery(cb.id, '📔 Opgeslagen in dagboek!')
      if (chatId) await sendTelegramMessage(chatId, `📔 Toegevoegd aan je dagboek van vandaag.`)
      return
    }

    await answerCallbackQuery(cb.id, 'Onbekende actie')
  } catch (err) {
    console.error('[Telegram webhook] Callback error:', err instanceof Error ? err.message : err)
    await answerCallbackQuery(cb.id, '❌ Er ging iets mis')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Nudge cooldown map
// ─────────────────────────────────────────────────────────────────────────────

const NUDGE_COOLDOWN_MAP: Record<string, number> = {
  finance_silence: 48,
  open_invoices: 72,
  journal_silence: 36,
  overdue_todos: 24,
  stale_todos: 72,
  habit_streak: 24,
  inbox_overflow: 12,
  user_silence: 24,
  mood_decline: 48,
  workload_today: 12,
}
