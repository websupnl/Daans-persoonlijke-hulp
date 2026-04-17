'use client'

import { FormEvent, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LockKeyhole } from 'lucide-react'

function getSafeNextPath(value: string | null): string {
  if (!value) return '/'
  if (!value.startsWith('/')) return '/'
  if (value.startsWith('//')) return '/'
  return value
}

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = useMemo(() => getSafeNextPath(searchParams.get('next')), [searchParams])

  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!password || loading) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, next: nextPath }),
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

      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !password}
        className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)' }}
      >
        {loading ? 'Bezig met inloggen...' : 'Inloggen'}
      </button>
    </form>
  )
}
