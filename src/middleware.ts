import { NextRequest, NextResponse } from 'next/server'

import { getSessionFromRequest, getSafeRedirectPath } from '@/lib/auth/request-session'
import {
  getLogoutCookieOptions,
  hasAllowedOrigin,
  getRequestSecurityHeaders,
  getSessionTokenFromRequest,
} from '@/lib/auth/session-store'

const PUBLIC_PAGE_PATHS = new Set(['/login'])
const PUBLIC_API_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/logout',
  '/api/telegram/webhook',
])
const ALT_AUTH_API_PATHS = new Set([
  '/api/cron/pulse',
  '/api/setup',
  '/api/notifications/send-telegram',
  '/api/telegram/setup',
  '/api/telegram/deep-sync',
])

function applySecurityHeaders(response: NextResponse) {
  for (const [key, value] of Object.entries(getRequestSecurityHeaders())) {
    response.headers.set(key, value)
  }
  return response
}

function clearAuthCookies(response: NextResponse, request: NextRequest) {
  for (const cookie of getLogoutCookieOptions(request)) {
    response.cookies.set(cookie)
  }
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const isApiRoute = pathname.startsWith('/api/')

  if (PUBLIC_PAGE_PATHS.has(pathname)) {
    const token = getSessionTokenFromRequest(request)
    if (!token) {
      return applySecurityHeaders(NextResponse.next())
    }

    const session = await getSessionFromRequest(request, { touch: true })
    if (!session) {
      return clearAuthCookies(applySecurityHeaders(NextResponse.next()), request)
    }

    const nextPath = getSafeRedirectPath(request.nextUrl.searchParams.get('next'), '/')
    return applySecurityHeaders(NextResponse.redirect(new URL(nextPath, request.url)))
  }

  if (isApiRoute && (PUBLIC_API_PATHS.has(pathname) || ALT_AUTH_API_PATHS.has(pathname))) {
    return applySecurityHeaders(NextResponse.next())
  }

  const session = await getSessionFromRequest(request, { touch: true })
  if (session) {
    if (isApiRoute && !['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !hasAllowedOrigin(request)) {
      return applySecurityHeaders(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
    }
    return applySecurityHeaders(NextResponse.next())
  }

  if (isApiRoute) {
    const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return clearAuthCookies(applySecurityHeaders(response), request)
  }

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('next', `${pathname}${search}`)

  const response = NextResponse.redirect(loginUrl)
  return clearAuthCookies(applySecurityHeaders(response), request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
