import AppShell from '@/components/layout/AppShell'
import SearchView from '@/components/search/SearchView'

export const dynamic = 'force-dynamic'

export default function SearchPage() {
  return (
    <AppShell>
      <SearchView />
    </AppShell>
  )
}
