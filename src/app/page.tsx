import AppShell from '@/components/layout/AppShell'
import Dashboard from '@/components/dashboard/Dashboard'

export const dynamic = 'force-dynamic'

export default function HomePage() {
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  )
}
