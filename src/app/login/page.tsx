import { redirect } from 'next/navigation'

import LoginForm from '@/components/auth/LoginForm'
import { getSafeRedirectPath } from '@/lib/auth/request-session'
import { getCurrentSession } from '@/lib/auth/server'

export const dynamic = 'force-dynamic'

type LoginPageProps = {
  searchParams?: Record<string, string | string[] | undefined>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getCurrentSession()
  const nextParam = searchParams?.next
  const nextPath = Array.isArray(nextParam) ? nextParam[0] : nextParam

  if (session) {
    redirect(getSafeRedirectPath(nextPath, '/'))
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#ffe2d1,transparent_35%),linear-gradient(180deg,#fff7f7_0%,#ffffff_45%,#f8fafc_100%)] px-6 py-12">
      <LoginForm />
    </main>
  )
}
