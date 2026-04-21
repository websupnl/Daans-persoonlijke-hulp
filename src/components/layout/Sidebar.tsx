'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import LogoutIcon from '@mui/icons-material/Logout'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { FOOTER_ITEMS, MORE_ITEMS, PRIMARY_GROUPS } from './navigation'
import WorkspaceSwitcher from './WorkspaceSwitcher'

export const drawerWidth = 264

function NavIcon({ icon: Icon, active }: { icon: React.ElementType; active: boolean }) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        color: active ? 'primary.dark' : 'text.secondary',
        '& svg': { width: 19, height: 19, strokeWidth: active ? 2.4 : 1.9 },
      }}
    >
      <Icon />
    </Box>
  )
}

function NavRow({ href, label, icon }: { href: string; label: string; icon: React.ElementType }) {
  const pathname = usePathname()
  const active = pathname === href || (href !== '/' && pathname.startsWith(href))

  return (
    <ListItemButton
      component={Link}
      href={href}
      selected={active}
      sx={{
        mx: 1.5,
        my: 0.25,
        minHeight: 40,
        borderRadius: 2,
        color: active ? 'primary.dark' : 'text.secondary',
        '&.Mui-selected': {
          background: 'linear-gradient(90deg, rgba(168,206,207,0.22), rgba(230,174,140,0.2))',
          fontWeight: 800,
          '&:hover': { background: 'linear-gradient(90deg, rgba(168,206,207,0.28), rgba(230,174,140,0.24))' },
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 6,
            top: '50%',
            width: 4,
            height: 22,
            borderRadius: 999,
            transform: 'translateY(-50%)',
            background: 'var(--brand-gradient-fallback)',
            backgroundImage: 'var(--brand-gradient)',
          },
        },
      }}
    >
      <ListItemIcon sx={{ minWidth: 34 }}>
        <NavIcon icon={icon} active={active} />
      </ListItemIcon>
      <ListItemText
        primary={label}
        primaryTypographyProps={{
          fontSize: 13,
          fontWeight: active ? 800 : 650,
          noWrap: true,
        }}
      />
    </ListItemButton>
  )
}

export default function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const moreActive = MORE_ITEMS.some((item) => item.href !== '/' && pathname.startsWith(item.href))

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      router.replace('/login')
      router.refresh()
      setLoggingOut(false)
    }
  }

  return (
    <Drawer
      variant="permanent"
      sx={{
        display: { xs: 'none', md: 'block' },
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          borderRight: '1px solid',
          borderColor: 'divider',
        },
      }}
      open
    >
      <Stack sx={{ height: '100%', py: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 2.5, pb: 2 }}>
          <Avatar
            sx={{
              width: 38,
              height: 38,
              fontWeight: 900,
              background: 'var(--brand-gradient-fallback)',
              backgroundImage: 'var(--brand-gradient)',
            }}
          >
            D
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={800} noWrap>
              Daan
            </Typography>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Box sx={{ width: 8, height: 8, borderRadius: 999, bgcolor: 'success.main' }} />
              <Typography variant="caption" color="text.secondary">
                AI actief
              </Typography>
            </Stack>
          </Box>
        </Stack>

        <Box sx={{ px: 2, pb: 2 }}>
          <WorkspaceSwitcher />
        </Box>

        <Divider sx={{ mx: 2 }} />

        <Box sx={{ flex: 1, overflow: 'auto', py: 1.5 }}>
          {PRIMARY_GROUPS.map((group) => (
            <Box key={group.label} sx={{ mb: 2 }}>
              <Typography variant="overline" color="text.disabled" sx={{ px: 3, display: 'block' }}>
                {group.label}
              </Typography>
              <List disablePadding>
                {group.items.map((item) => (
                  <NavRow key={item.href} {...item} />
                ))}
              </List>
            </Box>
          ))}

          <Divider sx={{ mx: 2, my: 1 }} />
          <ListItemButton
            onClick={() => setMoreOpen((value) => !value)}
            selected={moreActive}
            sx={{ mx: 1.5, borderRadius: 2, color: 'text.secondary' }}
          >
            <ListItemIcon sx={{ minWidth: 34 }}>
              <AutoAwesomeIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Overige modules" primaryTypographyProps={{ fontSize: 13, fontWeight: 700 }} />
            <ExpandMoreIcon sx={{ transform: moreOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '200ms' }} />
          </ListItemButton>
          <Collapse in={moreOpen || moreActive} timeout="auto" unmountOnExit>
            <List disablePadding>
              {MORE_ITEMS.map((item) => (
                <NavRow key={item.href} {...item} />
              ))}
            </List>
          </Collapse>
        </Box>

        <Divider sx={{ mx: 2 }} />
        <Box sx={{ p: 1.5 }}>
          <Stack spacing={0.75}>
            {FOOTER_ITEMS.map((item) => (
              <NavRow key={item.href} {...item} />
            ))}
            <Button
              color="inherit"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
              disabled={loggingOut}
              sx={{ justifyContent: 'flex-start', color: 'text.secondary', px: 2, borderRadius: 2 }}
            >
              {loggingOut ? 'Uitloggen...' : 'Uitloggen'}
            </Button>
            <Chip size="small" label="Material UI shell" color="primary" sx={{ alignSelf: 'flex-start', mt: 1 }} />
          </Stack>
        </Box>
      </Stack>
    </Drawer>
  )
}
