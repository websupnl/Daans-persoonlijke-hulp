import AppShell from '@/components/layout/AppShell'
import PatternsClient from '@/components/patterns/PatternsClient'

export const dynamic = 'force-dynamic'

export default function PatternsPage() {
  return (
    <AppShell>
      <PatternsClient />
    </AppShell>
  )
}
