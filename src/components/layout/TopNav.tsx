'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import AppBar from '@mui/material/AppBar'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Stack from '@mui/material/Stack'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import MenuIcon from '@mui/icons-material/Menu'
import SearchIcon from '@mui/icons-material/Search'
import WorkspaceSwitcher from './WorkspaceSwitcher'
import MobileDrawer from './MobileDrawer'
import { FOOTER_ITEMS, MORE_ITEMS, PRIMARY_GROUPS } from './navigation'
import { drawerWidth } from './Sidebar'

const NAV_ITEMS = [
  ...PRIMARY_GROUPS.flatMap((group) => group.items),
  ...MORE_ITEMS,
  ...FOOTER_ITEMS,
]

export default function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')

  const currentPage = useMemo(() => {
    return NAV_ITEMS.find((item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)))?.label || 'Vandaag'
  }, [pathname])

  const handleSearch = (event: React.KeyboardEvent) => {
    if (event.key !== 'Enter' || !searchValue.trim()) return
    const query = searchValue.trim()
    router.push(query.startsWith('/') ? `/chat?q=${encodeURIComponent(query)}` : `/search?q=${encodeURIComponent(query)}`)
    setSearchValue('')
  }

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          ml: { md: `${drawerWidth}px` },
          width: { md: `calc(100% - ${drawerWidth}px)` },
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(18px)',
          borderBottom: '1px solid',
          borderColor: 'divider',
          color: 'text.primary',
          zIndex: 1200,
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 58, md: 64 }, px: { xs: 2, md: 3 }, gap: 2 }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0, flexShrink: 0 }}>
            <IconButton
              onClick={() => setDrawerOpen(true)}
              edge="start"
              aria-label="Menu openen"
              sx={{ display: { xs: 'inline-flex', md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>

            <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    fontWeight: 900,
                    fontSize: 15,
                    background: 'var(--brand-gradient-fallback)',
                    backgroundImage: 'var(--brand-gradient)',
                  }}
                >
                  L
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 900, lineHeight: 1.1 }} noWrap>
                    LeefKompas
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' }, lineHeight: 1.1 }} noWrap>
                    {currentPage}
                  </Typography>
                </Box>
              </Stack>
            </Link>
          </Stack>

          <Box sx={{ flex: 1, display: { xs: 'none', md: 'flex' }, justifyContent: 'center' }}>
            <Box
              sx={{
                width: '100%',
                maxWidth: 520,
                display: 'flex',
                alignItems: 'center',
                bgcolor: 'grey.100',
                px: 1.5,
                py: 0.75,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                '&:focus-within': {
                  bgcolor: 'common.white',
                  borderColor: 'primary.main',
                  boxShadow: '0 0 0 3px rgba(95,159,161,0.1)',
                },
              }}
            >
              <SearchIcon sx={{ color: 'text.disabled', fontSize: 20, mr: 1 }} />
              <InputBase
                fullWidth
                placeholder="Zoek of typ een commando..."
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                onKeyDown={handleSearch}
                sx={{ fontSize: 13, fontWeight: 600 }}
              />
              <Typography
                variant="caption"
                sx={{
                  color: 'text.disabled',
                  fontWeight: 800,
                  bgcolor: 'common.white',
                  px: 0.6,
                  py: 0.2,
                  borderRadius: 0.5,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                /
              </Typography>
            </Box>
          </Box>

          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ ml: 'auto' }}>
            <Box sx={{ width: 210, display: { xs: 'none', lg: 'block' } }}>
              <WorkspaceSwitcher />
            </Box>
            <Avatar
              sx={{
                width: 34,
                height: 34,
                bgcolor: alpha('#5f9fa1', 0.14),
                color: 'primary.dark',
                fontSize: 14,
                fontWeight: 850,
              }}
            >
              DK
            </Avatar>
          </Stack>
        </Toolbar>
      </AppBar>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
