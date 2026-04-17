import AppShell from '@/components/layout/AppShell'
import GroceryView from '@/components/groceries/GroceryView'

export const dynamic = 'force-dynamic'

export default function GroceriesPage() {
  return (
    <AppShell>
      <GroceryView />
    </AppShell>
  )
}
