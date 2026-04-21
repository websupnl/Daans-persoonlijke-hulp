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
  children: ReactNode
  className?: string
  compact?: boolean
}

export default function PageShell({ title, subtitle, actions, children, compact }: PageShellProps) {
  return (
    <Container maxWidth="xl" sx={{ py: compact ? 2.5 : 3, px: { xs: 2, sm: 3 } }}>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          mx: { xs: -2, sm: -3 },
          mb: 3,
          px: { xs: 2, sm: 3 },
          py: 2,
          bgcolor: 'rgba(247,247,248,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 0.75, display: { xs: 'none', sm: 'flex' } }}>
          <Typography variant="caption" color="text.secondary">
            Daan
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {title}
          </Typography>
        </Breadcrumbs>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'flex-start' }} justifyContent="space-between">
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h2" component="h1">
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 760 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          {actions && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}>
              {actions}
            </Stack>
          )}
        </Stack>
      </Box>

      <Stack spacing={2.5}>{children}</Stack>
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
