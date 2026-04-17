import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)

const KEY_LENGTH = 64

function normalizeStoredHash(storedHash: string): string {
  let normalized = storedHash.trim()

  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim()
  }

  return normalized.replace(/\u200B/g, '')
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derived = await scrypt(password, salt, KEY_LENGTH) as Buffer
  return `scrypt:${salt}:${derived.toString('hex')}`
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, salt, expectedHex] = normalizeStoredHash(storedHash).split(':')
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false

  const actual = await scrypt(password, salt, KEY_LENGTH) as Buffer
  if (!/^[a-f0-9]+$/i.test(expectedHex)) return false
  const expected = Buffer.from(expectedHex.toLowerCase(), 'hex')

  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}
