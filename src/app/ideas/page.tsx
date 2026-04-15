import AppShell from '@/components/layout/AppShell'
import IdeasView from '@/components/ideas/IdeasView'

export const dynamic = 'force-dynamic'

export default function IdeasPage() {
  return (
    <AppShell>
      <IdeasView />
    </AppShell>
  )
}
