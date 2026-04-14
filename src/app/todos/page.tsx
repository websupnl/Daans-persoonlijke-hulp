import AppShell from '@/components/layout/AppShell'
import TodosView from '@/components/todos/TodosView'

export const dynamic = 'force-dynamic'

export default function TodosPage() {
  return (
    <AppShell>
      <TodosView />
    </AppShell>
  )
}
