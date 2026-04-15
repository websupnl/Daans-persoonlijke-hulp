import AppShell from '@/components/layout/AppShell'
import MemoryView from '@/components/memory/MemoryView'

export const dynamic = 'force-dynamic'

export default function MemoryPage() {
  return (
    <AppShell>
      <MemoryView />
    </AppShell>
  )
}
