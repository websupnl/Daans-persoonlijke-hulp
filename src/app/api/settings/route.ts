export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getUserSettings, setSetting } from '@/lib/data-service'
import { jsonFail, jsonOk } from '@/lib/contracts/api-http'

export async function GET() {
  try {
    const settings = await getUserSettings()
    return jsonOk(settings)
  } catch (error: any) {
    return jsonFail('SETTINGS_GET_FAILED', error.message || 'Kon settings niet ophalen', 500, error)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    await Promise.all(
      Object.entries(body).map(([key, value]) => setSetting(key, String(value)))
    )
    const settings = await getUserSettings()
    return jsonOk(settings, undefined, req)
  } catch (error: any) {
    return jsonFail('SETTINGS_PATCH_FAILED', error.message || 'Kon settings niet opslaan', 500, error, req)
  }
}
