'use client'

import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { ReactNode } from 'react'

export interface StatTileProps {
  icon: ReactNode
  label: string
  value: string | number
  helper?: string
  tone?: 'default' | 'good' | 'warn' | 'error'
  accent?: string
}

export function StatTile({
  icon,
  label,
  value,
  helper,
  tone = 'default',
  accent
}: StatTileProps) {
  const toneColors = {
    default: 'primary.main',
    good: 'success.main',
    warn: 'warning.main',
    error: 'error.main',
  }
  
  const color = toneColors[tone]

  return (
    <Paper 
      sx={{ 
        p: 2, 
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        '&::before': accent ? {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: accent === 'brand' ? 'var(--brand-gradient)' : accent,
        } : undefined
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box 
          sx={{ 
            width: 42, 
            height: 42, 
            borderRadius: 1.5, 
            display: 'grid', 
            placeItems: 'center', 
            bgcolor: 'primary.light', 
            color 
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography 
            variant="caption" 
            color="text.secondary" 
            sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 850 }}
          >
            {label}
          </Typography>
          <Typography variant="h4" noWrap>{value}</Typography>
          {helper && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {helper}
            </Typography>
          )}
        </Box>
      </Stack>
    </Paper>
  )
}

export default function ModuleStats({ stats }: { stats: StatTileProps[] }) {
  return (
    <Grid container spacing={2}>
      {stats.map((stat, index) => (
        <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={index}>
          <StatTile {...stat} />
        </Grid>
      ))}
    </Grid>
  )
}
