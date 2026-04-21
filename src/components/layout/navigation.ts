import {
  Activity,
  BookOpen,
  Brain,
  CalendarDays,
  CheckSquare,
  Clock3,
  Euro,
  FileText,
  FolderOpen,
  History,
  Inbox,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  MessageSquare,
  Search,
  Settings,
  ShoppingCart,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react'

export type NavItem = {
  href: string
  label: string
  icon: React.ElementType
}

export const PRIMARY_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Dagelijks',
    items: [
      { href: '/', label: 'Vandaag', icon: LayoutDashboard },
      { href: '/chat', label: 'Chat', icon: MessageSquare },
      { href: '/journal', label: 'Dagboek', icon: BookOpen },
    ],
  },
  {
    label: 'Bijhouden',
    items: [
      { href: '/todos', label: 'Taken', icon: CheckSquare },
      { href: '/finance', label: 'Financiën', icon: Euro },
      { href: '/health', label: 'Gezondheid', icon: Activity },
      { href: '/memory', label: 'Geheugen', icon: Brain },
    ],
  },
  {
    label: 'Inzichten',
    items: [
      { href: '/patterns', label: 'Patronen & AI', icon: Sparkles },
    ],
  },
]

export const MORE_ITEMS: NavItem[] = [
  { href: '/projects', label: 'Projecten', icon: FolderOpen },
  { href: '/notes', label: 'Notities', icon: FileText },
  { href: '/worklogs', label: 'Werklog', icon: Clock3 },
  { href: '/habits', label: 'Gewoontes', icon: Activity },
  { href: '/agenda', label: 'Agenda', icon: CalendarDays },
  { href: '/contacts', label: 'Contacten', icon: Users },
  { href: '/ideas', label: 'Ideeën', icon: Lightbulb },
  { href: '/groceries', label: 'Boodschappen', icon: ShoppingCart },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/search', label: 'Zoeken', icon: Search },
  { href: '/timeline', label: 'Timeline', icon: History },
  { href: '/import', label: 'Importeren', icon: Upload },
]

export const FOOTER_ITEMS: NavItem[] = [
  { href: '/settings', label: 'Instellingen', icon: Settings },
]

export const MOBILE_PRIMARY_ITEMS: NavItem[] = [
  { href: '/', label: 'Vandaag', icon: LayoutDashboard },
  { href: '/todos', label: 'Taken', icon: CheckSquare },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/finance', label: 'Financiën', icon: Euro },
]

export const LOGOUT_ITEM = { href: '/logout', label: 'Uitloggen', icon: LogOut }
