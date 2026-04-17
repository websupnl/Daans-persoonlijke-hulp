export const AUTH_PRODUCTION_COOKIE_NAME = '__Host-daan_session'
export const AUTH_DEVELOPMENT_COOKIE_NAME = 'daan_session_dev'
export const AUTH_TRUSTED_DEVICE_PRODUCTION_COOKIE_NAME = '__Host-daan_trusted_device'
export const AUTH_TRUSTED_DEVICE_DEVELOPMENT_COOKIE_NAME = 'daan_trusted_device_dev'

export const AUTH_IDLE_TIMEOUT_MINUTES = Number(process.env.AUTH_IDLE_TIMEOUT_MINUTES || 30)
export const AUTH_ABSOLUTE_TIMEOUT_HOURS = Number(process.env.AUTH_ABSOLUTE_TIMEOUT_HOURS || 168)
export const AUTH_TOUCH_INTERVAL_SECONDS = Number(process.env.AUTH_TOUCH_INTERVAL_SECONDS || 300)
export const AUTH_LOGIN_WINDOW_MINUTES = Number(process.env.AUTH_LOGIN_WINDOW_MINUTES || 15)
export const AUTH_LOGIN_MAX_ATTEMPTS = Number(process.env.AUTH_LOGIN_MAX_ATTEMPTS || 5)
export const AUTH_BLOCK_MINUTES = Number(process.env.AUTH_BLOCK_MINUTES || 15)
export const AUTH_TRUSTED_DEVICE_DAYS = Number(process.env.AUTH_TRUSTED_DEVICE_DAYS || 30)

export function getAdminPasswordHash(): string {
  const value = process.env.AUTH_ADMIN_PASSWORD_HASH
  if (!value) {
    throw new Error('AUTH_ADMIN_PASSWORD_HASH ontbreekt')
  }
  return value
}

export function getTenantId(): string {
  return process.env.TENANT_ID || 'daan'
}

export function getTenantConfig() {
  const tenantId = getTenantId()
  
  const tenantConfigs: Record<string, { 
  name: string; 
  adminPasswordHash: string | undefined; 
  devicePinHash: string | undefined; 
  cookiePrefix: string; 
}> = {
    daan: {
      name: 'Daan',
      adminPasswordHash: process.env.AUTH_ADMIN_PASSWORD_HASH_DAAN || process.env.AUTH_ADMIN_PASSWORD_HASH,
      devicePinHash: process.env.AUTH_DEVICE_PIN_HASH_DAAN || process.env.AUTH_DEVICE_PIN_HASH,
      cookiePrefix: 'daan'
    },
    broer: {
      name: 'Broer',
      adminPasswordHash: process.env.AUTH_ADMIN_PASSWORD_HASH_BROER,
      devicePinHash: process.env.AUTH_DEVICE_PIN_HASH_BROER,
      cookiePrefix: 'broer'
    }
  }
  
  return tenantConfigs[tenantId] || tenantConfigs.daan
}

export function getDevicePinHash(): string | null {
  const value = process.env.AUTH_DEVICE_PIN_HASH?.trim()
  return value || null
}

export function isQuickUnlockEnabled(): boolean {
  return !!getDevicePinHash()
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

export function getTrustedDeviceCookieName(useSecureCookie = isProduction()): string {
  return useSecureCookie
    ? AUTH_TRUSTED_DEVICE_PRODUCTION_COOKIE_NAME
    : AUTH_TRUSTED_DEVICE_DEVELOPMENT_COOKIE_NAME
}

export function getAllTrustedDeviceCookieNames(): string[] {
  return [
    AUTH_TRUSTED_DEVICE_PRODUCTION_COOKIE_NAME,
    AUTH_TRUSTED_DEVICE_DEVELOPMENT_COOKIE_NAME,
  ]
}
