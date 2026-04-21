'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import AppBar from '@mui/material/AppBar'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import WorkspaceSwitcher from './WorkspaceSwitcher'
import { MOBILE_PRIMARY_ITEMS, NavItem } from './navigation'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import SearchIcon from '@mui/icons-material/Search'
import InputBase from '@mui/material/InputBase'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const TOP_NAV_ITEMS: NavItem[] = [
  ...MOBILE_PRIMARY_ITEMS,
  { href: '/agenda', label: 'Agenda', icon: require('@mui/icons-material/CalendarMonth').default },
]

export default function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [searchValue, setSearchValue] = useState('')

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchValue.trim()) {
      if (searchValue.startsWith('/')) {
        router.push(`/chat?q=${encodeURIComponent(searchValue)}`)
      } else {
        router.push(`/search?q=${encodeURIComponent(searchValue)}`)
      }
      setSearchValue('')
    }
  }

  const handleOpenMore = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleCloseMore = () => {
    setAnchorEl(null)
  }

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        display: { xs: 'none', md: 'block' },
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid',
        borderColor: 'divider',
        color: 'text.primary',
        zIndex: 1100,
      }}
    >
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ height: 64, justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={3} alignItems="center">
            <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    fontWeight: 900,
                    fontSize: 16,
                    background: 'var(--brand-gradient-fallback)',
                    backgroundImage: 'var(--brand-gradient)',
                  }}
                >
                  D
                </Avatar>
                <Typography variant="h6" sx={{ fontWeight: 850, letterSpacing: -0.5 }}>
                  Daan
                </Typography>
              </Stack>
            </Link>

            <Stack direction="row" spacing={1} sx={{ ml: 4 }}>
              {TOP_NAV_ITEMS.map((item) => {
                const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                return (
                  <Button
                    key={item.href}
                    component={Link}
                    href={item.href}
                    variant={active ? 'contained' : 'text'}
                    color={active ? 'primary' : 'inherit'}
                    size="small"
                    startIcon={<item.icon sx={{ fontSize: '18px !important' }} />}
                    sx={{
                      px: 2,
                      height: 36,
                      fontWeight: active ? 800 : 650,
                      color: active ? 'common.white' : 'text.secondary',
                      '&:hover': {
                        bgcolor: active ? undefined : alpha('#000', 0.04),
                      },
                      ...(active && {
                        boxShadow: '0 4px 12px rgba(95,159,161,0.24)',
                      })
                    }}
                  >
                    {item.label}
                  </Button>
                )
              })}
              
              <Button
                color="inherit"
                size="small"
                startIcon={<MoreHorizIcon />}
                onClick={handleOpenMore}
                sx={{ px: 2, height: 36, fontWeight: 650, color: 'text.secondary' }}
              >
                Meer
              </Button>
            </Stack>
          </Stack>

          <Box sx={{ flex: 1, maxWidth: 400, mx: 4, display: { xs: 'none', lg: 'block' } }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              bgcolor: 'grey.100', 
              px: 2, 
              py: 0.75, 
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              '&:focus-within': {
                bgcolor: 'common.white',
                borderColor: 'primary.main',
                boxShadow: '0 0 0 3px rgba(95,159,161,0.1)'
              }
            }}>
              <SearchIcon sx={{ color: 'text.disabled', fontSize: 20, mr: 1 }} />
              <InputBase
                fullWidth
                placeholder="Typ een commando (bijv. /taak) of zoek..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={handleSearch}
                sx={{ fontSize: 13, fontWeight: 600 }}
              />
              <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 800, bgcolor: 'common.white', px: 0.6, py: 0.2, borderRadius: 0.5, border: '1px solid', borderColor: 'divider' }}>
                /
              </Typography>
            </Box>
          </Box>

          <Stack direction="row" spacing={2} alignItems="center">
            <Box sx={{ width: 200 }}>
              <WorkspaceSwitcher />
            </Box>
            <Avatar sx={{ width: 32, height: 32, cursor: 'pointer', bgcolor: 'primary.light', color: 'primary.main', fontSize: 14, fontWeight: 800 }}>
              DK
            </Avatar>
          </Stack>
        </Toolbar>
      </Container>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMore}
        sx={{ mt: 1 }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={handleCloseMore} component={Link} href="/projects">
          Projecten
        </MenuItem>
        <MenuItem onClick={handleCloseMore} component={Link} href="/notes">
          Notities
        </MenuItem>
        <MenuItem onClick={handleCloseMore} component={Link} href="/worklogs">
          Werklog
        </MenuItem>
        <MenuItem onClick={handleCloseMore} component={Link} href="/settings">
          Instellingen
        </MenuItem>
      </Menu>
    </AppBar>
  )
}
