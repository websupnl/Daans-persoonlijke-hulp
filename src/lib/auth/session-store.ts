import { Pool } from '@neondatabase/serverless'
import type { NextRequest } from 'next/server'

import {
  AUTH_ABSOLUTE_TIMEOUT_HOURS,
  AUTH_BLOCK_MINUTES,
  AUTH_IDLE_TIMEOUT_MINUTES,
  AUTH_LOGIN_MAX_ATTEMPTS,
  AUTH_LOGIN_WINDOW_MINUTES,
  AUTH_TOUCH_INTERVAL_SECONDS,
  getAllAuthCookieNames,
  getAuthCookieName,
  isProduction,
} from './config'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

let authSchemaReady = false

type SessionRow = {
  id: number
  token_hash: string
  created_at: string
  last_seen_at: string
  idle_expires_at: string
  absolute_expires_at: string
  revoked_at: string | null
  ip_address: string | null
  user_agent: string | null
}

type AttemptRow = {
  key: string
  attempt_count: number
  first_attempt_at: string
  last_attempt_at: string
  blocked_until: string | null
}

export type AuthSession = {
  id: number
  tokenHash: string
  createdAt: string
  lastSeenAt: string
  idleExpiresAt: string
  absoluteExpiresAt: string
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

function getRandomToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return bytesToHex(bytes)
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return bytesToHex(new Uint8Array(digest))
}

async function ensureAuthSchema() {
  if (authSchemaReady) return
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id SERIAL PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      idle_expires_at TIMESTAMPTZ NOT NULL,
      absolute_expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      ip_address TEXT,
      user_agent TEXT
    );

    CREATE TABLE IF NOT EXISTS auth_login_attempts (
      key TEXT PRIMARY KEY,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      blocked_until TIMESTAMPTZ
    );
  `)
  authSchemaReady = true
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000)
}

function mapSession(row: SessionRow): AuthSession {
  return {
    id: row.id,
    tokenHash: row.token_hash,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    idleExpiresAt: row.idle_expires_at,
    absoluteExpiresAt: row.absolute_expires_at,
  }
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return 'unknown'
}

export function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'unknown'
}

export function getSessionTokenFromRequest(request: NextRequest): string | null {
  for (const cookieName of getAllAuthCookieNames()) {
    const token = request.cookies.get(cookieName)?.value
    if (token) return token
  }
  return null
}

export function getSessionCookieOptions(_request?: NextRequest) {
  const secure = isProduction()
  return {
    name: getAuthCookieName(secure),
    httpOnly: true,
    secure,
    sameSite: 'strict' as const,
    path: '/',
    maxAge: AUTH_ABSOLUTE_TIMEOUT_HOURS * 60 * 60,
  }
}

export function getLogoutCookieOptions(_request?: NextRequest) {
  const secure = isProduction()
  return getAllAuthCookieNames().map((name) => ({
    name,
    value: '',
    httpOnly: true,
    secure: name.startsWith('__Host-') ? true : secure,
    sameSite: 'strict' as const,
    path: '/',
    expires: new Date(0),
    maxAge: 0,
  }))
}

export async function createSession(args: { ipAddress: string; userAgent: string }) {
  await ensureAuthSchema()

  const token = getRandomToken()
  const tokenHash = await hashToken(token)
  const now = new Date()
  const idleExpiresAt = addMinutes(now, AUTH_IDLE_TIMEOUT_MINUTES)
  const absoluteExpiresAt = addHours(now, AUTH_ABSOLUTE_TIMEOUT_HOURS)

  await pool.query(`
    INSERT INTO auth_sessions (token_hash, idle_expires_at, absolute_expires_at, ip_address, user_agent)
    VALUES ($1, $2, $3, $4, $5)
  `, [tokenHash, idleExpiresAt.toISOString(), absoluteExpiresAt.toISOString(), args.ipAddress, args.userAgent])

  return {
    token,
    idleExpiresAt,
    absoluteExpiresAt,
  }
}

export async function invalidateSessionByToken(token: string | null) {
  if (!token) return
  await ensureAuthSchema()
  const tokenHash = await hashToken(token)
  await pool.query('DELETE FROM auth_sessions WHERE token_hash = $1', [tokenHash])
}

export async function validateSessionToken(token: string | null, options?: { touch?: boolean }): Promise<AuthSession | null> {
  if (!token) return null
  await ensureAuthSchema()

  const tokenHash = await hashToken(token)
  const result = await pool.query<SessionRow>(`
    SELECT *
    FROM auth_sessions
    WHERE token_hash = $1 AND revoked_at IS NULL
    LIMIT 1
  `, [tokenHash])

  const row = result.rows[0]
  if (!row) return null

  const now = new Date()
  const idleExpiresAt = new Date(row.idle_expires_at)
  const absoluteExpiresAt = new Date(row.absolute_expires_at)

  if (idleExpiresAt <= now || absoluteExpiresAt <= now) {
    await pool.query('DELETE FROM auth_sessions WHERE token_hash = $1', [tokenHash])
    return null
  }

  if (options?.touch) {
    const lastSeenAt = new Date(row.last_seen_at)
    const elapsedSeconds = Math.floor((now.getTime() - lastSeenAt.getTime()) / 1000)
    if (elapsedSeconds >= AUTH_TOUCH_INTERVAL_SECONDS) {
      const nextIdle = addMinutes(now, AUTH_IDLE_TIMEOUT_MINUTES)
      await pool.query(`
        UPDATE auth_sessions
        SET last_seen_at = NOW(), idle_expires_at = $2
        WHERE token_hash = $1
      `, [tokenHash, nextIdle.toISOString()])
      row.last_seen_at = now.toISOString()
      row.idle_expires_at = nextIdle.toISOString()
    }
  }

  return mapSession(row)
}

function getAttemptKey(ipAddress: string) {
  return `login:${ipAddress || 'unknown'}`
}

export async function getLoginThrottle(ipAddress: string) {
  await ensureAuthSchema()
  const key = getAttemptKey(ipAddress)
  const result = await pool.query<AttemptRow>('SELECT * FROM auth_login_attempts WHERE key = $1 LIMIT 1', [key])
  const row = result.rows[0]
  if (!row) {
    return { blocked: false, attemptsRemaining: AUTH_LOGIN_MAX_ATTEMPTS }
  }

  const now = new Date()
  if (row.blocked_until && new Date(row.blocked_until) > now) {
    return {
      blocked: true,
      retryAt: row.blocked_until,
      attemptsRemaining: 0,
    }
  }

  if (new Date(row.first_attempt_at) < addMinutes(now, -AUTH_LOGIN_WINDOW_MINUTES)) {
    await pool.query('DELETE FROM auth_login_attempts WHERE key = $1', [key])
    return { blocked: false, attemptsRemaining: AUTH_LOGIN_MAX_ATTEMPTS }
  }

  return {
    blocked: false,
    attemptsRemaining: Math.max(0, AUTH_LOGIN_MAX_ATTEMPTS - row.attempt_count),
  }
}

export async function recordFailedLogin(ipAddress: string) {
  await ensureAuthSchema()
  const key = getAttemptKey(ipAddress)
  const now = new Date()
  const result = await pool.query<AttemptRow>('SELECT * FROM auth_login_attempts WHERE key = $1 LIMIT 1', [key])
  const row = result.rows[0]

  if (!row || new Date(row.first_attempt_at) < addMinutes(now, -AUTH_LOGIN_WINDOW_MINUTES)) {
    const blockedUntil = AUTH_LOGIN_MAX_ATTEMPTS <= 1 ? addMinutes(now, AUTH_BLOCK_MINUTES) : null
    await pool.query(`
      INSERT INTO auth_login_attempts (key, attempt_count, first_attempt_at, last_attempt_at, blocked_until)
      VALUES ($1, 1, NOW(), NOW(), $2)
      ON CONFLICT (key)
      DO UPDATE SET attempt_count = 1, first_attempt_at = NOW(), last_attempt_at = NOW(), blocked_until = $2
    `, [key, blockedUntil?.toISOString() || null])
    return
  }

  const nextCount = row.attempt_count + 1
  const blockedUntil = nextCount >= AUTH_LOGIN_MAX_ATTEMPTS ? addMinutes(now, AUTH_BLOCK_MINUTES).toISOString() : null

  await pool.query(`
    UPDATE auth_login_attempts
    SET attempt_count = $2,
        last_attempt_at = NOW(),
        blocked_until = COALESCE($3, blocked_until)
    WHERE key = $1
  `, [key, nextCount, blockedUntil])
}

export async function clearFailedLogins(ipAddress: string) {
  await ensureAuthSchema()
  await pool.query('DELETE FROM auth_login_attempts WHERE key = $1', [getAttemptKey(ipAddress)])
}

export function hasAllowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const fetchSite = request.headers.get('sec-fetch-site')
  const expectedOrigin = request.nextUrl.origin

  if (origin) return origin === expectedOrigin
  if (referer) return referer.startsWith(`${expectedOrigin}/`) || referer === expectedOrigin
  if (fetchSite) return fetchSite === 'same-origin' || fetchSite === 'same-site'
  return false
}

export function canUseSecureCookies(request: NextRequest): boolean {
  return request.nextUrl.protocol === 'https:' || request.nextUrl.hostname === 'localhost' || request.nextUrl.hostname === '127.0.0.1'
}

export function getRequestSecurityHeaders() {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    Pragma: 'no-cache',
    Expires: '0',
    Vary: 'Cookie',
    'Referrer-Policy': 'same-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Content-Security-Policy': "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  }
}

export function isSecureCookieEnvironment(request: NextRequest): boolean {
  return canUseSecureCookies(request) || isProduction()
}
