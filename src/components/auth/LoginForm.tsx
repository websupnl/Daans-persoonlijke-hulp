'use client'

import { FormEvent, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { KeyRound, LockKeyhole } from 'lucide-react'

function getSafeNextPath(value: string | null): string {
  if (!value) return '/'
  if (!value.startsWith('/')) return '/'
  if (value.startsWith('//')) return '/'
  return value
}

export default function LoginForm({ hasQuickUnlock = false }: { hasQuickUnlock?: boolean }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = useMemo(() => getSafeNextPath(searchParams.get('next')), [searchParams])

  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [trustDevice, setTrustDevice] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'password' | 'pin'>(hasQuickUnlock ? 'pin' : 'password')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    if (mode === 'password' && !password) return
    if (mode === 'pin' && !pin) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(mode === 'pin' ? '/api/auth/unlock' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'pin'
            ? { pin, next: nextPath }
            : { password, next: nextPath, trustDevice }
        ),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(data.error || 'Inloggen mislukt')
        return
      }

      router.replace(data.redirectTo || nextPath || '/')
      router.refresh()
    } catch {
      setError('Inloggen mislukt')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md rounded-[2rem] border border-gray-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)' }}>
          <LockKeyhole size={24} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Beveiligde toegang</h1>
        <p className="mt-2 text-sm text-gray-500">
          Log in om je persoonlijke app te openen.
        </p>
      </div>

      {hasQuickUnlock && (
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('pin')
              setError(null)
            }}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${mode === 'pin' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
          >
            Pincode
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('password')
              setError(null)
            }}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${mode === 'password' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
          >
            Wachtwoord
          </button>
        </div>
      )}

      {mode === 'password' ? (
        <>
          <label className="mb-3 block text-sm font-semibold text-gray-700" htmlFor="password">
            Wachtwoord
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mb-4 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition-colors focus:border-pink-300 focus:ring-4 focus:ring-pink-100"
            placeholder="Voer je wachtwoord in"
            disabled={loading}
          />

          <label className="mb-5 flex items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
            <input
              type="checkbox"
              checked={trustDevice}
              onChange={(event) => setTrustDevice(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-pink-500 focus:ring-pink-400"
            />
            <span className="text-sm text-gray-600">
              Vertrouw deze browser zodat je hier later met pincode kunt ontgrendelen.
            </span>
          </label>
        </>
      ) : (
        <>
          <label className="mb-3 block text-sm font-semibold text-gray-700" htmlFor="pin">
            Pincode
          </label>
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 focus-within:border-pink-300 focus-within:ring-4 focus-within:ring-pink-100">
            <KeyRound size={18} className="text-gray-400" />
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              className="w-full bg-transparent text-gray-900 outline-none"
              placeholder="Voer je pincode in"
              disabled={loading}
            />
          </div>
          <p className="mb-5 text-sm text-gray-500">
            Alleen beschikbaar op een eerder vertrouwde browser.
          </p>
        </>
      )}

      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || (mode === 'password' ? !password : !pin)}
        className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)' }}
      >
        {loading ? 'Bezig...' : mode === 'pin' ? 'Ontgrendelen met pincode' : 'Inloggen'}
      </button>
    </form>
  )
}
