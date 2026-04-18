/**
 * Herbruikbare Telegram keyboard builders.
 * Elke functie retourneert een InlineKeyboardMarkup.
 */

import type { InlineKeyboardMarkup } from '@/lib/telegram/send-message'

/** Hoofd module-menu — bij /menu, /start en bij lage confidence */
export function mainMenuKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '✅ Todo', callback_data: 'flow_start:todo' },
        { text: '💸 Transactie', callback_data: 'flow_start:transactie' },
        { text: '🛒 Boodschappen', callback_data: 'flow_start:boodschappen' },
      ],
      [
        { text: '📔 Dagboek', callback_data: 'flow_start:dagboek' },
        { text: '⏱️ Werklog', callback_data: 'flow_start:werklog' },
        { text: '📌 Notitie', callback_data: 'flow_start:notitie' },
      ],
      [
        { text: '💡 Idee', callback_data: 'flow_start:idee' },
        { text: '🔄 Gewoonte', callback_data: 'flow_start:gewoonte' },
        { text: '👤 Contact', callback_data: 'flow_start:contact' },
      ],
      [
        { text: '📊 Status', callback_data: 'status_overview' },
        { text: '💬 Reflectievraag', callback_data: 'generate_question' },
        { text: '🔄 Deep sync', callback_data: 'deep_sync_trigger' },
      ],
    ],
  }
}

/** Bevestiging / annulering voor pending actions */
export function confirmCancelKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      { text: '✅ Bevestigen', callback_data: 'confirm_pending' },
      { text: '❌ Annuleren', callback_data: 'cancel_pending' },
    ]],
  }
}

/** Na een actie: terug naar menu of annuleer lopende flow */
export function flowCancelKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      { text: '❌ Annuleer', callback_data: 'flow_cancel' },
      { text: '📋 Menu', callback_data: 'show_menu' },
    ]],
  }
}

/** Quick-access na todo aanmaken */
export function todoCreatedKeyboard(todoId: number): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      { text: '✓ Direct afronden', callback_data: `todo_complete:${todoId}` },
      { text: '📋 Alle taken', callback_data: 'todos_overview' },
    ]],
  }
}

/** Financiën overview knop */
export function financeKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      { text: '💰 Financiën overzicht', callback_data: 'finance_overview' },
      { text: '➕ Nieuwe transactie', callback_data: 'flow_start:transactie' },
    ]],
  }
}

/** Boodschappenlijst knop */
export function groceriesKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      { text: '🛒 Boodschappenlijst', callback_data: 'groceries_overview' },
      { text: '➕ Item toevoegen', callback_data: 'flow_start:boodschappen' },
    ]],
  }
}

/** Dagboek knoppen */
export function journalKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      { text: '💬 Reflectievraag', callback_data: 'generate_question' },
      { text: '📔 Nieuw dagboek', callback_data: 'flow_start:dagboek' },
    ]],
  }
}
