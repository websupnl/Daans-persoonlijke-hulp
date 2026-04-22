import { execute, queryOne } from '@/lib/db'
import { DEFAULT_WORKSPACE_ID, normalizeWorkspace } from '@/lib/workspace'

const tokenKey = (workspace: string) => `telegram_bot_token__${normalizeWorkspace(workspace)}`
const chatIdKey = (workspace: string) => `telegram_chat_id__${normalizeWorkspace(workspace)}`

function maskToken(token: string): string {
  if (token.length <= 10) return '••••••••'
  return `${token.slice(0, 6)}••••••${token.slice(-4)}`
}

export interface TelegramWorkspaceConfig {
  workspace: string
  hasToken: boolean
  tokenMasked: string | null
  chatId: string | null
}

export async function getTelegramBotToken(workspace = DEFAULT_WORKSPACE_ID): Promise<string | null> {
  const normalized = normalizeWorkspace(workspace)
  const row = await queryOne<{ value: string }>('SELECT value FROM user_settings WHERE key = $1', [tokenKey(normalized)])
  const stored = row?.value?.trim()
  if (stored) return stored

  if (normalized === DEFAULT_WORKSPACE_ID) {
    return process.env.TELEGRAM_BOT_TOKEN?.trim() || null
  }

  return null
}

export async function getTelegramChatId(workspace = DEFAULT_WORKSPACE_ID): Promise<string | null> {
  const normalized = normalizeWorkspace(workspace)
  const row = await queryOne<{ value: string }>('SELECT value FROM user_settings WHERE key = $1', [chatIdKey(normalized)])
  const stored = row?.value?.trim()
  if (stored) return stored

  if (normalized === DEFAULT_WORKSPACE_ID) {
    return process.env.TELEGRAM_CHAT_ID?.trim() || null
  }

  return null
}

export async function getTelegramWorkspaceConfig(workspace = DEFAULT_WORKSPACE_ID): Promise<TelegramWorkspaceConfig> {
  const normalized = normalizeWorkspace(workspace)
  const [token, chatId] = await Promise.all([
    getTelegramBotToken(normalized),
    getTelegramChatId(normalized),
  ])

  return {
    workspace: normalized,
    hasToken: Boolean(token),
    tokenMasked: token ? maskToken(token) : null,
    chatId,
  }
}

export async function setTelegramWorkspaceConfig(
  workspace: string,
  values: { token?: string | null; chatId?: string | null }
): Promise<void> {
  const normalized = normalizeWorkspace(workspace)

  if (values.token !== undefined) {
    await upsertSetting(tokenKey(normalized), values.token?.trim() || '')
  }

  if (values.chatId !== undefined) {
    await upsertSetting(chatIdKey(normalized), values.chatId?.trim() || '')
  }
}

async function upsertSetting(key: string, value: string): Promise<void> {
  await execute(
    `INSERT INTO user_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, value]
  )
}
