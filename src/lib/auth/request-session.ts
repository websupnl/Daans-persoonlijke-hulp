import type { NextRequest } from 'next/server'

import { getSessionTokenFromRequest, validateSessionToken } from './session-store'

export async function getSessionFromRequest(request: NextRequest, options?: { touch?: boolean }) {
  const token = getSessionTokenFromRequest(request)
  return validateSessionToken(token, options)
}

export function getSafeRedirectPath(input: string | null | undefined, fallback = '/'): string {
  if (!input) return fallback
  if (!input.startsWith('/')) return fallback
  if (input.startsWith('//')) return fallback
  return input
}
