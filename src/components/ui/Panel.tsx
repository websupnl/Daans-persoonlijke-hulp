import { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'

type PanelTone = 'default' | 'muted' | 'accent' | 'inverse' | 'warning' | 'ai' | 'success'
type PanelPadding = 'sm' | 'md' | 'lg' | 'none'

const toneSx: Record<PanelTone, object> = {
  default: {
    bgcolor: 'rgba(255,255,255,0.94)',
    border: '1px solid',
    borderColor: 'divider',
    backdropFilter: 'blur(10px)',
  },
  muted: {
    background: 'linear-gradient(135deg, rgba(255,255,255,0.88), rgba(250,250,251,0.96))',
    border: '1px solid',
    borderColor: 'divider',
  },
  accent: {
    background: 'linear-gradient(90deg, rgba(168,206,207,0.22), rgba(230,174,140,0.18))',
    border: '1px solid',
    borderColor: 'divider',
    borderLeft: '4px solid',
    borderLeftColor: 'primary.main',
  },
  inverse: { bgcolor: 'text.primary', color: 'common.white' },
  warning: { bgcolor: 'warning.light', border: '1px solid', borderColor: '#fcd34d', borderLeft: '4px solid', borderLeftColor: 'warning.main' },
  ai: {
    background: 'linear-gradient(90deg, rgba(168,206,207,0.18), rgba(230,174,140,0.18))',
    border: '1px solid',
    borderColor: 'divider',
    borderLeft: '4px solid',
    borderLeftColor: 'secondary.main',
  },
  success: { bgcolor: 'success.light', border: '1px solid', borderColor: '#6ee7b7', borderLeft: '4px solid', borderLeftColor: 'success.main' },
}

const paddingSx: Record<PanelPadding, number> = {
  none: 0,
  sm: 2,
  md: 2.5,
  lg: 3,
}

export function Panel({
  children,
  className,
  tone = 'default',
  padding = 'md',
  interactive = false,
}: {
  children?: ReactNode
  className?: string
  tone?: PanelTone
  padding?: PanelPadding
  interactive?: boolean
}) {
  return (
    <Paper
      className={className}
      sx={{
        ...toneSx[tone],
        p: paddingSx[padding],
        borderRadius: 3,
        boxShadow: '0 18px 52px -46px rgba(15,15,16,0.38)',
        transition: '180ms cubic-bezier(0.16, 1, 0.3, 1)',
        ...(interactive && { cursor: 'pointer', '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 } }),
      }}
    >
      {children}
    </Paper>
  )
}

export function PanelHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <Stack className={className} direction="row" spacing={2} alignItems="flex-start" justifyContent="space-between">
      <Box sx={{ minWidth: 0 }}>
        {eyebrow && (
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 850, letterSpacing: 1.2 }}>
            {eyebrow}
          </Typography>
        )}
        <Typography variant="h4" component="h2">
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 760 }}>
            {description}
          </Typography>
        )}
      </Box>
      {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
    </Stack>
  )
}

export function AICard({
  label = 'AI Analyse',
  children,
  className,
  generatedAt,
  confidence,
}: {
  label?: string
  children: ReactNode
  className?: string
  generatedAt?: string
  confidence?: 'Hoog' | 'Gemiddeld' | 'Laag'
}) {
  return (
    <Card
      className={className}
      sx={{
        p: 2.5,
        borderLeft: '4px solid',
        borderLeftColor: 'primary.main',
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        background: 'radial-gradient(circle at left center, rgba(168,206,207,0.22), transparent 30%), linear-gradient(90deg, rgba(168,206,207,0.18), rgba(230,174,140,0.16))',
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AutoAwesomeIcon color="secondary" fontSize="small" />
          <Typography variant="overline" color="text.secondary">
            {label}
          </Typography>
        </Stack>
        {confidence && <Chip size="small" label={confidence} color={confidence === 'Hoog' ? 'success' : confidence === 'Gemiddeld' ? 'warning' : 'default'} />}
      </Stack>
      <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
        {children}
      </Typography>
      {generatedAt && (
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1.5 }}>
          Gegenereerd {generatedAt}
        </Typography>
      )}
    </Card>
  )
}

type InsightType = 'warning' | 'positive' | 'suggestion'

export function InsightBlock({
  type,
  title,
  detail,
  action,
  actionHref,
  className,
}: {
  type: InsightType
  title: string
  detail?: string
  action?: string
  actionHref?: string
  className?: string
}) {
  const icon = type === 'warning' ? <ErrorOutlineIcon color="warning" /> : type === 'suggestion' ? <LightbulbOutlinedIcon color="primary" /> : <AutoAwesomeIcon color="secondary" />

  return (
    <Stack className={className} direction="row" spacing={1.5} sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ mt: 0.25 }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" fontWeight={750}>
          {title}
        </Typography>
        {detail && (
          <Typography variant="body2" color="text.secondary">
            {detail}
          </Typography>
        )}
        {action && actionHref && (
          <Button component="a" href={actionHref} size="small" sx={{ mt: 0.5, px: 0 }}>
            {action} →
          </Button>
        )}
      </Box>
    </Stack>
  )
}

export function StatStrip({
  stats,
  className,
}: {
  stats: Array<{
    label: string
    value: ReactNode
    meta?: ReactNode
    accent?: 'blue' | 'violet' | 'green' | 'red' | 'amber' | 'orange' | 'pink'
  }>
  className?: string
}) {
  const colors: Record<string, string> = {
    blue: 'primary.main',
    violet: 'secondary.main',
    green: 'success.main',
    red: 'error.main',
    amber: 'warning.main',
    orange: 'warning.main',
    pink: 'secondary.main',
  }

  return (
    <Box className={className} sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, minmax(0, 1fr))' } }}>
      {stats.map((stat, index) => (
        <Paper
          key={index}
          sx={{
            p: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 3,
            position: 'relative',
            overflow: 'hidden',
            background: index === 0
              ? 'linear-gradient(90deg, rgba(168,206,207,0.22), rgba(230,174,140,0.16))'
              : 'rgba(255,255,255,0.94)',
            boxShadow: '0 18px 52px -46px rgba(15,15,16,0.38)',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: stat.accent ? colors[stat.accent] : 'var(--brand-gradient)',
            },
          }}
        >
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 850 }}>
            {stat.label}
          </Typography>
          <Typography variant="h2" sx={{ color: stat.accent ? colors[stat.accent] : 'text.primary', mt: 0.5 }}>
            {stat.value}
          </Typography>
          {stat.meta && (
            <Typography variant="caption" color="text.secondary">
              {stat.meta}
            </Typography>
          )}
        </Paper>
      ))}
    </Box>
  )
}

export function SectionHeader({ title, action, className }: { title: string; action?: ReactNode; className?: string }) {
  return (
    <Stack className={className} direction="row" alignItems="center" justifyContent="space-between">
      <Typography variant="overline" color="text.disabled">
        {title}
      </Typography>
      {action && <Box>{action}</Box>}
    </Stack>
  )
}

export function MetricTile({
  label,
  value,
  meta,
  icon,
  trend,
  className,
}: {
  label: string
  value: ReactNode
  meta?: ReactNode
  icon?: ReactNode
  trend?: 'up' | 'down' | 'flat'
  className?: string
}) {
  return (
    <Paper
      className={className}
      sx={{
        p: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        background: 'rgba(255,255,255,0.94)',
        boxShadow: '0 18px 52px -46px rgba(15,15,16,0.38)',
      }}
    >
      <Stack direction="row" spacing={2} justifyContent="space-between">
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 850 }}>
            {label}
          </Typography>
          <Stack direction="row" spacing={0.75} alignItems="flex-end">
            <Typography variant="h2">{value}</Typography>
            {trend && (
              <Typography variant="body2" color={trend === 'up' ? 'success.main' : trend === 'down' ? 'error.main' : 'text.disabled'} sx={{ pb: 0.5 }}>
                {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—'}
              </Typography>
            )}
          </Stack>
          {meta && (
            <Typography variant="caption" color="text.secondary">
              {meta}
            </Typography>
          )}
        </Box>
        {icon && (
          <Box sx={{ width: 42, height: 42, borderRadius: 2.5, bgcolor: 'primary.light', color: 'primary.main', display: 'grid', placeItems: 'center' }}>
            {icon}
          </Box>
        )}
      </Stack>
    </Paper>
  )
}

export function EmptyPanel({
  title,
  description,
  action,
  className,
}: {
  title: string
  description: string
  action?: ReactNode
  className?: string
}) {
  return (
    <Paper
      className={className}
      sx={{
        p: 4,
        textAlign: 'center',
        border: '1px dashed',
        borderColor: 'divider',
        borderRadius: 3,
        background: 'linear-gradient(90deg, rgba(168,206,207,0.12), rgba(230,174,140,0.10))',
      }}
    >
      <Typography variant="h4">{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mx: 'auto', maxWidth: 360 }}>
        {description}
      </Typography>
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Paper>
  )
}

export function ActionPill({ children, className }: { children: ReactNode; className?: string }) {
  return <Chip className={className} size="small" label={children} variant="outlined" />
}

export function DividerLine({ className }: { className?: string }) {
  return <Divider className={className} />
}

export { DividerLine as Divider }

export function SystemActionBubble({
  icon,
  title,
  detail,
  onUndo,
  undoLabel = 'Ongedaan maken',
  className,
}: {
  icon: ReactNode
  title: string
  detail?: string
  onUndo?: () => void
  undoLabel?: string
  className?: string
}) {
  return (
    <Stack className={className} alignItems="center" sx={{ my: 1 }}>
      <Paper sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderLeft: '4px solid', borderLeftColor: 'primary.main', borderRadius: 2, maxWidth: 520 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ color: 'primary.main' }}>{icon}</Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" fontWeight={800}>
              {title}
            </Typography>
            {detail && (
              <Typography variant="caption" color="text.secondary">
                {detail}
              </Typography>
            )}
          </Box>
          {onUndo && (
            <Button size="small" onClick={onUndo}>
              {undoLabel}
            </Button>
          )}
        </Stack>
      </Paper>
    </Stack>
  )
}
