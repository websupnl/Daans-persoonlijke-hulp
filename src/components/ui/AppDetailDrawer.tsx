'use client'

import Link from 'next/link'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

export type DetailField = {
  label: string
  value?: React.ReactNode
}

export type DetailAction = {
  label: string
  href?: string
  onClick?: () => void
  variant?: 'text' | 'outlined' | 'contained'
}

export type AppDetailDrawerProps = {
  open: boolean
  onClose: () => void
  eyebrow?: string
  title?: string
  subtitle?: string
  status?: string
  fields?: DetailField[]
  primaryHref?: string
  primaryLabel?: string
  actions?: DetailAction[]
  children?: React.ReactNode
}

export default function AppDetailDrawer({
  open,
  onClose,
  eyebrow,
  title,
  subtitle,
  status,
  fields = [],
  primaryHref,
  primaryLabel = 'Openen en bewerken',
  actions = [],
  children,
}: AppDetailDrawerProps) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 460 },
          maxWidth: '100%',
          borderLeft: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.default',
        },
      }}
    >
      <Stack sx={{ height: '100%' }}>
        <Box
          sx={{
            p: 2.5,
            background: 'linear-gradient(90deg, rgba(168,206,207,0.24), rgba(230,174,140,0.18))',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" justifyContent="space-between" spacing={2}>
            <Box sx={{ minWidth: 0 }}>
              {eyebrow && (
                <Typography variant="overline" color="text.secondary">
                  {eyebrow}
                </Typography>
              )}
              <Typography variant="h3" sx={{ mt: 0.25 }} noWrap>
                {title || 'Details'}
              </Typography>
              {subtitle && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  {subtitle}
                </Typography>
              )}
            </Box>
            <IconButton aria-label="Sluit details" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Stack>
          {status && <Chip label={status} size="small" color="primary" sx={{ mt: 1.5 }} />}
        </Box>

        <Stack spacing={2} sx={{ p: 2.5, flex: 1, overflow: 'auto' }}>
          {fields.length > 0 && (
            <Stack
              divider={<Divider flexItem />}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 3,
                bgcolor: 'background.paper',
                overflow: 'hidden',
                boxShadow: '0 18px 52px -46px rgba(15,15,16,0.38)',
              }}
            >
              {fields.map((field) => (
                <Stack key={field.label} direction="row" spacing={2} justifyContent="space-between" sx={{ px: 2, py: 1.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 800 }}>
                    {field.label}
                  </Typography>
                  <Typography variant="body2" sx={{ textAlign: 'right', minWidth: 0 }}>
                    {field.value ?? '-'}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
          {children}
        </Stack>

        {(primaryHref || actions.length > 0) && (
          <Stack direction="row" spacing={1} sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            {primaryHref && (
              <Button component={Link} href={primaryHref} variant="contained" endIcon={<OpenInNewIcon />} fullWidth>
                {primaryLabel}
              </Button>
            )}
            {actions.map((action) => action.href ? (
              <Button key={action.label} component={Link} href={action.href} variant={action.variant ?? 'outlined'}>
                {action.label}
              </Button>
            ) : (
              <Button key={action.label} onClick={action.onClick} variant={action.variant ?? 'outlined'}>
                {action.label}
              </Button>
            ))}
          </Stack>
        )}
      </Stack>
    </Drawer>
  )
}
