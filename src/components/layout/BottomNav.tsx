'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import BottomNavigation from '@mui/material/BottomNavigation'
import BottomNavigationAction from '@mui/material/BottomNavigationAction'
import Paper from '@mui/material/Paper'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import MobileDrawer from './MobileDrawer'
import { MOBILE_PRIMARY_ITEMS } from './navigation'

function NavIcon({ icon: Icon }: { icon: React.ElementType }) {
  return <Icon />
}

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const active = MOBILE_PRIMARY_ITEMS.find((item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)))?.href ?? false

  return (
    <>
      <Paper
        elevation={3}
        sx={{
          display: { xs: 'block', md: 'none' },
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1300,
          borderTop: '1px solid',
          borderColor: 'divider',
          pb: 'env(safe-area-inset-bottom)',
        }}
      >
        <BottomNavigation
          value={active}
          onChange={(_, value) => {
            if (value === 'more') setDrawerOpen(true)
            else router.push(value)
          }}
          showLabels
          sx={{ height: 64 }}
        >
          {MOBILE_PRIMARY_ITEMS.map((item) => (
            <BottomNavigationAction
              key={item.href}
              label={item.label}
              value={item.href}
              icon={<NavIcon icon={item.icon} />}
              sx={{ '& svg': { width: 22, height: 22 } }}
            />
          ))}
          <BottomNavigationAction label="Meer" value="more" icon={<MoreHorizIcon />} />
        </BottomNavigation>
      </Paper>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
