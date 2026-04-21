'use client'

import { usePathname } from 'next/navigation'
import Box from '@mui/material/Box'
import Fab from '@mui/material/Fab'
import Tooltip from '@mui/material/Tooltip'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlined'
import TopNav from './TopNav'
import BottomNav from './BottomNav'
import Sidebar, { drawerWidth } from './Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isChat = pathname === '/chat'

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        color: 'text.primary',
        background:
          'radial-gradient(circle at top left, rgba(168, 206, 207, 0.12), transparent 34%), radial-gradient(circle at bottom right, rgba(230, 174, 140, 0.10), transparent 30%), #f7f7f8',
      }}
    >
      <Sidebar />
      <TopNav />
      <Box
        component="main"
        sx={{
          ml: { md: `${drawerWidth}px` },
          minHeight: '100dvh',
          pb: { xs: 'calc(72px + env(safe-area-inset-bottom))', md: 4 },
        }}
      >
        {children}
      </Box>
      <BottomNav />

      {!isChat && (
        <Tooltip title="Open chat">
          <Fab
            component="a"
            href="/chat"
            color="primary"
            variant="extended"
            sx={{
              display: { xs: 'none', md: 'inline-flex' },
              position: 'fixed',
              left: `calc(${drawerWidth}px + 24px)`,
              bottom: 24,
              zIndex: 1200,
              gap: 1,
              fontWeight: 800,
              boxShadow: 3,
              background: 'var(--brand-gradient-fallback)',
              backgroundImage: 'var(--brand-gradient)',
            }}
          >
            <ChatBubbleOutlineIcon fontSize="small" />
            Chat
          </Fab>
        </Tooltip>
      )}
    </Box>
  )
}
