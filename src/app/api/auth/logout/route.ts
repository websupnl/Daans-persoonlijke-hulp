export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

import {
  getLogoutCookieOptions,
  getSessionTokenFromRequest,
  hasAllowedOrigin,
  invalidateSessionByToken,
} from '@/lib/auth/session-store'

export async function POST(request: NextRequest) {
  if (!hasAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await invalidateSessionByToken(getSessionTokenFromRequest(request))

  const response = NextResponse.json({ ok: true })
  for (const cookie of getLogoutCookieOptions(request)) {
    response.cookies.set(cookie)
  }
  return response
}
