export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getDevicePinHash, isQuickUnlockEnabled } from '@/lib/auth/config'
import { verifyPassword } from '@/lib/auth/password'
import { getSafeRedirectPath } from '@/lib/auth/request-session'
import {
  createSession,
  getClientIp,
  getLogoutCookieOptions,
  getSessionCookieOptions,
  getTrustedDeviceTokenFromRequest,
  getUserAgent,
  hasAllowedOrigin,
  validateTrustedDeviceToken,
} from '@/lib/auth/session-store'

const unlockSchema = z.object({
  pin: z.string().min(4).max(32),
  next: z.string().max(2048).optional(),
})

export async function POST(request: NextRequest) {
  if (!hasAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!isQuickUnlockEnabled()) {
    return NextResponse.json({ error: 'Snelle ontgrendeling is niet ingeschakeld' }, { status: 400 })
  }

  let body: z.infer<typeof unlockSchema>
  try {
    body = unlockSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Ongeldige invoer' }, { status: 400 })
  }

  const trustedToken = getTrustedDeviceTokenFromRequest(request)
  const trustedDevice = await validateTrustedDeviceToken(trustedToken, {
    userAgent: getUserAgent(request),
    ipAddress: getClientIp(request),
  })

  if (!trustedDevice) {
    return NextResponse.json({ error: 'Dit apparaat is niet vertrouwd. Log eerst volledig in.' }, { status: 401 })
  }

  const pinHash = getDevicePinHash()
  const pinOk = pinHash ? await verifyPassword(body.pin, pinHash) : false
  if (!pinOk) {
    return NextResponse.json({ error: 'Onjuiste pincode' }, { status: 401 })
  }

  const session = await createSession({
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request),
  })

  const response = NextResponse.json({
    ok: true,
    redirectTo: getSafeRedirectPath(body.next, '/'),
  })

  for (const cookie of getLogoutCookieOptions(request)) {
    response.cookies.set(cookie)
  }

  response.cookies.set({
    ...getSessionCookieOptions(request),
    value: session.token,
    expires: session.absoluteExpiresAt,
  })

  return response
}
