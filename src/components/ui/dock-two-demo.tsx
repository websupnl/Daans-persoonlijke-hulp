'use client'

import { useRouter } from 'next/navigation'
import {
  CalendarDays,
  CheckSquare,
  FileText,
  FolderOpen,
  LayoutDashboard,
  MessageSquare,
  Settings,
} from 'lucide-react'
import { Dock } from '@/components/ui/dock-two'

function DockDemo() {
  const router = useRouter()

  const items = [
    { icon: LayoutDashboard, label: 'Vandaag', onClick: () => router.push('/') },
    { icon: MessageSquare, label: 'Chat', onClick: () => router.push('/chat') },
    { icon: CheckSquare, label: 'Taken', onClick: () => router.push('/todos') },
    { icon: CalendarDays, label: 'Agenda', onClick: () => router.push('/agenda') },
    { icon: FileText, label: 'Notities', onClick: () => router.push('/notes') },
    { icon: FolderOpen, label: 'Projecten', onClick: () => router.push('/projects') },
    { icon: Settings, label: 'Instellingen', onClick: () => router.push('/settings') },
  ]

  return <Dock items={items} />
}

export { DockDemo }
