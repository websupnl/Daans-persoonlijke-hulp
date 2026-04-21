'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import { MORE_ITEMS, PRIMARY_GROUPS } from './navigation'
import WorkspaceSwitcher from './WorkspaceSwitcher'

function NavIcon({ icon: Icon, active }: { icon: React.ElementType; active: boolean }) {
  return (
    <Box sx={{ display: 'inline-flex', color: active ? 'primary.main' : 'text.secondary', '& svg': { width: 19, height: 19 } }}>
      <Icon />
    </Box>
  )
}

export default function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          maxHeight: '88dvh',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
        },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5 }}>
        <Box sx={{ width: 32, height: 4, borderRadius: 999, bgcolor: 'divider' }} />
      </Box>

      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar sx={{ width: 38, height: 38, background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', fontWeight: 900 }}>D</Avatar>
          <Box>
            <Typography variant="body2" fontWeight={800}>
              Daan&apos;s Persoonlijke Hulp
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Daan · AI actief
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose} aria-label="Sluit menu">
          <CloseIcon />
        </IconButton>
      </Stack>

      <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <WorkspaceSwitcher />
      </Box>

      <Box sx={{ overflow: 'auto', px: 1, py: 1.5, pb: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
        {[...PRIMARY_GROUPS, { label: 'Meer', items: MORE_ITEMS }].map((group) => (
          <Box key={group.label} sx={{ mb: 2 }}>
            <Typography variant="overline" color="text.disabled" sx={{ px: 2, display: 'block' }}>
              {group.label}
            </Typography>
            <List disablePadding>
              {group.items.map((item) => {
                const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                return (
                  <ListItemButton
                    key={item.href}
                    component={Link}
                    href={item.href}
                    onClick={onClose}
                    selected={active}
                    sx={{ borderRadius: 2, minHeight: 44, mx: 1, '&.Mui-selected': { bgcolor: 'primary.light', color: 'primary.main' } }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <NavIcon icon={item.icon} active={active} />
                    </ListItemIcon>
                    <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 13, fontWeight: active ? 800 : 650 }} />
                  </ListItemButton>
                )
              })}
            </List>
          </Box>
        ))}
      </Box>
    </Drawer>
  )
}
