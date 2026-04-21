import { ReactNode } from 'react'
import Box from '@mui/material/Box'
import MuiCard from '@mui/material/Card'
import CardContentBase from '@mui/material/CardContent'
import CardHeaderBase from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <MuiCard className={className}>{children}</MuiCard>
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <Box className={className} sx={{ p: 2.5, pb: 0 }}>{children}</Box>
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Typography className={className} variant="h4" component="h3">
      {children}
    </Typography>
  )
}

export function CardDescription({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Typography className={className} variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
      {children}
    </Typography>
  )
}

export function CardContent({ children, className }: { children: ReactNode; className?: string }) {
  return <CardContentBase className={className}>{children}</CardContentBase>
}

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  compact?: boolean
}

export function CardLow({ children, className, onClick, compact }: CardProps) {
  return (
    <MuiCard
      className={className}
      onClick={onClick}
      sx={{
        p: compact ? 1.5 : 2,
        bgcolor: '#fafafb',
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? { bgcolor: '#f4f4f5' } : undefined,
      }}
    >
      {children}
    </MuiCard>
  )
}

export function Row({ children, className, onClick, active }: { children: ReactNode; className?: string; onClick?: () => void; active?: boolean }) {
  return (
    <Box
      className={className}
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        borderRadius: 2,
        px: 1.5,
        py: 1.25,
        bgcolor: active ? '#f4f4f5' : 'transparent',
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': { bgcolor: '#f9f9fa' },
      }}
    >
      {children}
    </Box>
  )
}

export function StatChip({ label, value, sub, accent, className }: { label: string; value: string | number; sub?: string; accent?: 'blue' | 'violet' | 'green' | 'red' | 'amber'; className?: string }) {
  const color = accent === 'green' ? 'success.main' : accent === 'red' ? 'error.main' : accent === 'amber' ? 'warning.main' : accent === 'violet' ? 'secondary.main' : accent === 'blue' ? 'primary.main' : 'text.primary'
  return (
    <MuiCard className={className} sx={{ p: 2 }}>
      <Typography variant="overline" color="text.disabled">
        {label}
      </Typography>
      <Typography variant="h2" sx={{ color }}>
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" color="text.secondary">
          {sub}
        </Typography>
      )}
    </MuiCard>
  )
}

export function Tag({ children, color, className }: { children: ReactNode; color?: 'blue' | 'violet' | 'green' | 'red' | 'amber' | 'gray' | 'orange' | 'pink'; className?: string }) {
  const mapped: Record<string, any> = {
    blue: 'primary',
    violet: 'secondary',
    green: 'success',
    red: 'error',
    amber: 'warning',
    orange: 'warning',
    pink: 'secondary',
    gray: 'default',
  }
  return <Chip className={className} size="small" label={children} color={mapped[color ?? 'gray']} variant={color === 'gray' || !color ? 'outlined' : 'filled'} />
}

export function PriorityDot({ priority }: { priority: 'hoog' | 'medium' | 'laag' | string }) {
  const color = priority === 'hoog' ? 'error.main' : priority === 'medium' ? 'warning.main' : priority === 'laag' ? 'success.main' : 'divider'
  return <Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, bgcolor: color, flexShrink: 0 }} />
}
