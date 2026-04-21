'use client'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { Spinner } from '@/components/ui/spinner'

interface AIBriefingProps {
  title?: string
  briefing: string
  score?: number | string | null
  scoreLabel?: string
  loading?: boolean
  compact?: boolean
}

export default function AIBriefing({ 
  title = "AI Briefing", 
  briefing, 
  score, 
  scoreLabel = "/100",
  loading,
  compact,
}: AIBriefingProps) {
  return (
    <Paper
      sx={{
        p: compact ? { xs: 1.5, md: 1.75 } : { xs: 2, md: 2.5 },
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(90deg, rgba(168,206,207,0.16), rgba(230,174,140,0.12)), var(--surface)',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
      }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ width: compact ? 34 : 42, height: compact ? 34 : 42, borderRadius: 1, display: 'grid', placeItems: 'center', color: 'common.white', background: 'var(--brand-gradient)', flexShrink: 0 }}>
            {loading ? <Spinner /> : <AutoAwesomeIcon fontSize={compact ? 'small' : 'medium'} />}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 850 }}>{title}</Typography>
            <Typography variant={compact ? 'body2' : 'body1'} sx={{ maxWidth: 1200, lineHeight: compact ? 1.55 : 1.7 }}>
              {briefing}
            </Typography>
          </Box>
        </Stack>
        {score !== undefined && (
          <Chip 
            color={typeof score === 'number' && score >= 70 ? 'success' : typeof score === 'number' && score < 45 ? 'warning' : 'primary'} 
            label={score == null ? 'Nog geen score' : `${score}${scoreLabel}`} 
            sx={{ fontWeight: 800 }}
          />
        )}
      </Stack>
    </Paper>
  )
}
