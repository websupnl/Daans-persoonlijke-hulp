import AppShell from '@/components/layout/AppShell'
import TimelineView from '@/components/timeline/TimelineView'

export const dynamic = 'force-dynamic'

export default function TimelinePage() {
  return (
    <AppShell>
      <TimelineView />
    </AppShell>
  )
}
