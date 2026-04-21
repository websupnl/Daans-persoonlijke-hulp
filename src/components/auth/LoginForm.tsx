'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Alert from '@mui/material/Alert'
import Avatar from '@mui/material/Avatar'
import LockIcon from '@mui/icons-material/LockOutlined'
import { Spinner } from '@/components/ui/spinner'

interface LoginFormProps {
  hasQuickUnlock?: boolean
}

export default function LoginForm({ hasQuickUnlock }: LoginFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/'

  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, next }),
      })

      if (response.ok) {
        const data = await response.json().catch(() => null)
        router.push(data?.redirectTo || next)
        router.refresh()
        return
      }

      const data = await response.json().catch(() => null)
      setError(data?.error || 'Inloggen mislukt. Controleer je wachtwoord.')
    } catch {
      setError('Er is een onbekende fout opgetreden.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Paper
      elevation={0}
      sx={{
        width: '100%',
        maxWidth: 420,
        p: { xs: 3, md: 5 },
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: '0 24px 48px -12px rgba(0,0,0,0.08)',
      }}
    >
      <Stack spacing={4} alignItems="center">
        <Stack spacing={1.5} alignItems="center">
          <Avatar
            sx={{
              width: 56,
              height: 56,
              background: 'var(--brand-gradient)',
              mb: 1,
            }}
          >
            <LockIcon sx={{ fontSize: 28 }} />
          </Avatar>
          <Typography variant="h2" sx={{ fontWeight: 850, textAlign: 'center' }}>
            Welkom terug
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            Log in op LeefKompas
          </Typography>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ width: '100%', borderRadius: 1 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
          <Stack spacing={2.5}>
            <TextField
              label="Wachtwoord"
              placeholder="Voer je wachtwoord in"
              type="password"
              fullWidth
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              variant="outlined"
              autoFocus
              autoComplete="current-password"
              disabled={loading}
              sx={{
                '& .MuiOutlinedInput-root': {
                  minHeight: 56,
                  borderRadius: 1,
                  bgcolor: 'background.default',
                  transition: 'box-shadow .18s ease, background-color .18s ease',
                  '&:hover': {
                    bgcolor: 'background.paper',
                  },
                  '&.Mui-focused': {
                    bgcolor: 'background.paper',
                    boxShadow: '0 0 0 4px rgba(95,159,161,0.14)',
                  },
                },
                '& .MuiInputLabel-root': {
                  fontWeight: 750,
                },
              }}
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              sx={{
                py: 1.5,
                fontWeight: 800,
                fontSize: 16,
                boxShadow: '0 8px 16px -4px rgba(95,159,161,0.25)',
                '&:hover': {
                  boxShadow: '0 12px 20px -4px rgba(95,159,161,0.35)',
                },
              }}
            >
              {loading ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Spinner className="h-4 w-4" />
                  <span>Inloggen...</span>
                </Stack>
              ) : (
                'Inloggen'
              )}
            </Button>

            {hasQuickUnlock && (
              <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                Dit apparaat is herkend.
              </Typography>
            )}

            <Typography variant="caption" color="text.disabled" sx={{ textAlign: 'center', mt: 1 }}>
              Beveiligde toegang - {new Date().getFullYear()} LeefKompas
            </Typography>
          </Stack>
        </Box>
      </Stack>
    </Paper>
  )
}
