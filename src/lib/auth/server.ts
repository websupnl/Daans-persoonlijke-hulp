import { cookies } from 'next/headers'

import { getAllAuthCookieNames, getAllTrustedDeviceCookieNames } from './config'
import { validateSessionToken } from './session-store'

export async function getCurrentSession(options?: { touch?: boolean }) {
  const cookieStore = cookies()

  for (const cookieName of getAllAuthCookieNames()) {
    const token = cookieStore.get(cookieName)?.value
    if (!token) continue
    const session = await validateSessionToken(token, options)
    if (session) return session
  }

  return null
}

export function hasTrustedDeviceCookie(): boolean {
  const cookieStore = cookies()
  return getAllTrustedDeviceCookieNames().some((cookieName) => !!cookieStore.get(cookieName)?.value)
}
