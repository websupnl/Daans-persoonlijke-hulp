'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Box from '@mui/material/Box'
import Fab from '@mui/material/Fab'
import Tooltip from '@mui/material/Tooltip'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlined'
import Sidebar, { drawerWidth } from './Sidebar'
import BottomNav from './BottomNav'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isChat = pathname === '/chat'

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default', color: 'text.primary' }}>
      <Sidebar />
      <Box
        component="main"
        sx={{
          minHeight: '100dvh',
          pb: { xs: 'calc(72px + env(safe-area-inset-bottom))', md: 0 },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        {children}
      </Box>
      <BottomNav />

      {!isChat && (
        <Tooltip title="Open chat">
          <Fab
            component={Link}
            href="/chat"
            color="primary"
            variant="extended"
            sx={{
              display: { xs: 'none', md: 'inline-flex' },
              position: 'fixed',
              right: 24,
              bottom: 24,
              zIndex: 1200,
              gap: 1,
              fontWeight: 800,
              boxShadow: 3,
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
