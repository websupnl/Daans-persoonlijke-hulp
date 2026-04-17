export const AUTH_PRODUCTION_COOKIE_NAME = '__Host-daan_session'
export const AUTH_DEVELOPMENT_COOKIE_NAME = 'daan_session_dev'

export const AUTH_IDLE_TIMEOUT_MINUTES = Number(process.env.AUTH_IDLE_TIMEOUT_MINUTES || 30)
export const AUTH_ABSOLUTE_TIMEOUT_HOURS = Number(process.env.AUTH_ABSOLUTE_TIMEOUT_HOURS || 168)
export const AUTH_TOUCH_INTERVAL_SECONDS = Number(process.env.AUTH_TOUCH_INTERVAL_SECONDS || 300)
export const AUTH_LOGIN_WINDOW_MINUTES = Number(process.env.AUTH_LOGIN_WINDOW_MINUTES || 15)
export const AUTH_LOGIN_MAX_ATTEMPTS = Number(process.env.AUTH_LOGIN_MAX_ATTEMPTS || 5)
export const AUTH_BLOCK_MINUTES = Number(process.env.AUTH_BLOCK_MINUTES || 15)

export function getAdminPasswordHash(): string {
  const value = process.env.AUTH_ADMIN_PASSWORD_HASH
  if (!value) {
    throw new Error('AUTH_ADMIN_PASSWORD_HASH ontbreekt')
  }
  return value
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

export function getAuthCookieName(useSecureCookie = isProduction()): string {
  return useSecureCookie ? AUTH_PRODUCTION_COOKIE_NAME : AUTH_DEVELOPMENT_COOKIE_NAME
}

export function getAllAuthCookieNames(): string[] {
  return [AUTH_PRODUCTION_COOKIE_NAME, AUTH_DEVELOPMENT_COOKIE_NAME]
}
