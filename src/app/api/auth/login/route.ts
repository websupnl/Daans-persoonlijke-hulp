export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getAdminPasswordHash } from '@/lib/auth/config'
import { verifyPassword } from '@/lib/auth/password'
import { getSafeRedirectPath } from '@/lib/auth/request-session'
import {
  clearFailedLogins,
  createTrustedDevice,
  createSession,
  getClientIp,
  getLoginThrottle,
  getLogoutCookieOptions,
  getSessionCookieOptions,
  getSessionTokenFromRequest,
  getTrustedDeviceCookieOptions,
  getTrustedDeviceTokenFromRequest,
  getUserAgent,
  hasAllowedOrigin,
  invalidateSessionByToken,
  invalidateTrustedDeviceByToken,
  recordFailedLogin,
} from '@/lib/auth/session-store'

const loginSchema = z.object({
  password: z.string().min(1).max(512),
  next: z.string().max(2048).optional(),
  trustDevice: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  if (!hasAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ipAddress = getClientIp(request)
  const throttle = await getLoginThrottle(ipAddress)
  if (throttle.blocked) {
    return NextResponse.json(
      {
        error: 'Te veel mislukte pogingen. Probeer het later opnieuw.',
        retryAt: throttle.retryAt,
      },
      { status: 429 }
    )
  }

  let body: z.infer<typeof loginSchema>
  try {
    body = loginSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Ongeldige invoer' }, { status: 400 })
  }

  const passwordOk = await verifyPassword(body.password, getAdminPasswordHash())

  if (!passwordOk) {
    await recordFailedLogin(ipAddress)
    return NextResponse.json({ error: 'Onjuiste inloggegevens' }, { status: 401 })
  }

  await invalidateSessionByToken(getSessionTokenFromRequest(request))
  if (body.trustDevice) {
    await invalidateTrustedDeviceByToken(getTrustedDeviceTokenFromRequest(request))
  }

  const session = await createSession({
    ipAddress,
    userAgent: getUserAgent(request),
  })

  await clearFailedLogins(ipAddress)

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

  if (body.trustDevice) {
    const trustedDevice = await createTrustedDevice({
      ipAddress,
      userAgent: getUserAgent(request),
      label: 'Eigen browser',
    })
    response.cookies.set({
      ...getTrustedDeviceCookieOptions(request),
      value: trustedDevice.token,
      expires: trustedDevice.expiresAt,
    })
  }

  return response
}
