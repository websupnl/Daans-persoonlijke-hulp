'use client'

import Alert from '@mui/material/Alert'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

type ActionFeedbackTone = 'success' | 'error' | 'info' | 'warning'

export default function ActionFeedback({
  tone,
  title,
  message,
}: {
  tone: ActionFeedbackTone
  title?: string
  message: string
}) {
  return (
    <Alert
      severity={tone}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      sx={{
        border: '1px solid',
        borderColor: tone === 'error' ? 'error.light' : 'rgba(95,159,161,0.24)',
        borderRadius: 1,
        alignItems: 'center',
        '& .MuiAlert-icon': { alignItems: 'center' },
      }}
    >
      <Stack spacing={0.25}>
        {title && (
          <Typography variant="body2" sx={{ fontWeight: 850 }}>
            {title}
          </Typography>
        )}
        <Typography variant="body2">{message}</Typography>
      </Stack>
    </Alert>
  )
}
