import { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Breadcrumbs from '@mui/material/Breadcrumbs'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

interface PageShellProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  desktopSearch?: ReactNode
  children: ReactNode
  className?: string
  compact?: boolean
}

export default function PageShell({ title, subtitle, actions, desktopSearch, children, compact }: PageShellProps) {
  return (
    <Container
      maxWidth={false}
      sx={{
        py: compact ? 2.5 : 3.5,
        px: { xs: 2, sm: 3, lg: 5 },
        position: 'relative',
      }}
    >
      <Box
        sx={{
          position: 'relative',
          zIndex: 10,
          mb: compact ? 2 : 3.25,
          p: { xs: 2.25, sm: 2.75, md: compact ? 2.5 : 3.5 },
          border: '1px solid',
          borderColor: 'rgba(95,159,161,0.28)',
          borderRadius: 1,
          overflow: 'hidden',
          background:
            'linear-gradient(135deg, rgba(168,206,207,0.34), rgba(230,174,140,0.24)), rgba(255,255,255,0.9)',
          boxShadow: '0 24px 68px -48px rgba(15,15,16,0.55)',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.36), transparent 58%)',
            pointerEvents: 'none',
          },
        }}
      >
        <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 0.75, display: { xs: 'none', sm: 'flex' } }}>
          <Typography variant="caption" color="text.secondary">
            LeefKompas
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {title}
          </Typography>
        </Breadcrumbs>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'flex-start' }} justifyContent="space-between">
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
            <Box
              sx={{
                width: 5,
                alignSelf: 'stretch',
                minHeight: { xs: 58, md: 76 },
                borderRadius: 999,
                background: 'var(--brand-gradient)',
                flexShrink: 0,
              }}
            />
            <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="h1"
              component="h1"
              sx={{
                display: 'inline-block',
                color: 'text.primary',
                fontSize: { xs: 34, md: 46 },
                lineHeight: { xs: '40px', md: '54px' },
                fontWeight: 900,
              }}
            >
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body1" color="text.secondary" sx={{ mt: 0.75, maxWidth: 820, fontWeight: 600 }}>
                {subtitle}
              </Typography>
            )}
            </Box>
          </Stack>
          {(desktopSearch || actions) && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent={{ xs: 'flex-start', sm: 'flex-end' }} alignItems="center">
              {desktopSearch && <Box sx={{ minWidth: { sm: 260 }, flex: { xs: '1 1 100%', sm: '0 1 auto' } }}>{desktopSearch}</Box>}
              {actions}
            </Stack>
          )}
        </Stack>
      </Box>

      <Stack spacing={2.75}>{children}</Stack>
    </Container>
  )
}

export function PageSection({
  title,
  action,
  children,
}: {
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Stack spacing={1.25}>
      {title && (
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="overline" color="text.disabled">
            {title}
          </Typography>
          {action && <Box>{action}</Box>}
        </Stack>
      )}
      {children}
    </Stack>
  )
}

export function StatsRow({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 4 }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 1.5,
        gridTemplateColumns: { xs: '1fr 1fr', lg: cols === 4 ? 'repeat(4, minmax(0, 1fr))' : '1fr 1fr' },
      }}
    >
      {children}
    </Box>
  )
}
