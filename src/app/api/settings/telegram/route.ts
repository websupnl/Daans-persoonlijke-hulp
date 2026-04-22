export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { jsonFail, jsonOk } from '@/lib/contracts/api-http'
import { getWorkspaceFromRequest } from '@/lib/workspace'
import { getTelegramWorkspaceConfig, setTelegramWorkspaceConfig } from '@/lib/telegram/config'
import { getWebhookInfo, setWebhook } from '@/lib/telegram/send-message'

function validateToken(token: string): boolean {
  return /^\d+:[A-Za-z0-9_-]{20,}$/.test(token.trim())
}

export async function GET(req: NextRequest) {
  try {
    const workspace = getWorkspaceFromRequest(req)
    const config = await getTelegramWorkspaceConfig(workspace)

    let webhook: Record<string, unknown> | null = null
    if (config.hasToken) {
      webhook = await getWebhookInfo({ workspace }).catch(() => null)
    }

    return jsonOk({ ...config, webhook }, undefined, req)
  } catch (error) {
    return jsonFail('TELEGRAM_SETTINGS_GET_FAILED', 'Kon Telegram instellingen niet ophalen', 500, error, req)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const workspace = getWorkspaceFromRequest(req)
    const body = await req.json() as { token?: string; chatId?: string }

    if (body.token !== undefined && body.token.trim() && !validateToken(body.token)) {
      return jsonFail('TELEGRAM_TOKEN_INVALID', 'Telegram API key lijkt ongeldig.', 400, body.token, req)
    }

    await setTelegramWorkspaceConfig(workspace, {
      token: body.token,
      chatId: body.chatId,
    })

    const config = await getTelegramWorkspaceConfig(workspace)
    return jsonOk(config, undefined, req)
  } catch (error) {
    return jsonFail('TELEGRAM_SETTINGS_PATCH_FAILED', 'Kon Telegram instellingen niet opslaan', 500, error, req)
  }
}

export async function POST(req: NextRequest) {
  try {
    const workspace = getWorkspaceFromRequest(req)
    const body = await req.json().catch(() => ({})) as { webhookUrl?: string }

    const config = await getTelegramWorkspaceConfig(workspace)
    if (!config.hasToken) {
      return jsonFail('TELEGRAM_TOKEN_MISSING', 'Sla eerst een Telegram API key op voor deze workspace.', 400, undefined, req)
    }

    const webhookUrl = body.webhookUrl?.trim()
      || `https://${req.headers.get('host')}/api/telegram/webhook?workspace=${encodeURIComponent(workspace)}`

    const result = await setWebhook(webhookUrl, { workspace })
    return jsonOk({ webhookUrl, telegram: result }, undefined, req)
  } catch (error) {
    return jsonFail('TELEGRAM_WEBHOOK_SETUP_FAILED', 'Webhook registreren is mislukt', 500, error, req)
  }
}
