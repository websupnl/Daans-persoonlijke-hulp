'use client'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder'
import { ReactNode } from 'react'

interface AIBriefingProps {
  title?: string
  briefing: string
  score?: number | string | null
  scoreLabel?: string
  loading?: boolean
}

export default function AIBriefing({ 
  title = "AI Briefing", 
  briefing, 
  score, 
  scoreLabel = "/100",
  loading 
}: AIBriefingProps) {
  return (
    <Paper
      sx={{
        p: { xs: 2, md: 2.5 },
        background: 'linear-gradient(90deg, rgba(168,206,207,0.22), rgba(230,174,140,0.18))',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1, // Follows the new 4px theme (borderRadius: 1 is 8px? No, 4px)
      }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ width: 44, height: 44, borderRadius: 1.5, display: 'grid', placeItems: 'center', color: 'common.white', background: 'var(--brand-gradient)' }}>
            <FavoriteBorderIcon />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 850 }}>{title}</Typography>
            <Typography variant="body1" sx={{ maxWidth: 1200, lineHeight: 1.8 }}>
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
