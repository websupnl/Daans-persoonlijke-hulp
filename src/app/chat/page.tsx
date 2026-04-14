import AppShell from '@/components/layout/AppShell'
import ChatView from '@/components/chat/ChatView'

export const dynamic = 'force-dynamic'

export default function ChatPage() {
  return (
    <AppShell>
      <ChatView />
    </AppShell>
  )
}
