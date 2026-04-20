export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getUserProfile, setUserFact, deleteUserFact } from '@/lib/data-service'
import { jsonFail, jsonOk } from '@/lib/contracts/api-http'

export async function GET() {
  try {
    const profile = await getUserProfile()
    return jsonOk(profile)
  } catch (error: any) {
    return jsonFail('PROFILE_GET_FAILED', error.message || 'Kon profiel niet ophalen', 500, error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { label, value, type, category, confidence, source } = await req.json()
    if (!label || !value) return jsonFail('PROFILE_VALIDATION', 'label en value verplicht', 400, undefined, req)
    await setUserFact(label, value, { type, category, confidence, source })
    return jsonOk({ success: true }, undefined, req)
  } catch (error: any) {
    return jsonFail('PROFILE_SAVE_FAILED', error.message || 'Kon profiel niet opslaan', 500, error, req)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const label = searchParams.get('label')
    if (!label) return jsonFail('PROFILE_LABEL_REQUIRED', 'label verplicht', 400, undefined, req)
    await deleteUserFact(label)
    return jsonOk({ success: true }, undefined, req)
  } catch (error: any) {
    return jsonFail('PROFILE_DELETE_FAILED', error.message || 'Kon profiel-item niet verwijderen', 500, error, req)
  }
}
