import AppShell from '@/components/layout/AppShell'
import NoteEditor from '@/components/notes/NoteEditor'

export default function NotePage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <NoteEditor id={params.id} />
    </AppShell>
  )
}
