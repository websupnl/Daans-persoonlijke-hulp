'use client'

import { useCallback, useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import BellIcon from '@mui/icons-material/Notifications'
import BrainIcon from '@mui/icons-material/Psychology'
import BusinessIcon from '@mui/icons-material/Business'
import TelegramIcon from '@mui/icons-material/Telegram'
import DeleteIcon from '@mui/icons-material/DeleteOutline'
import PlusIcon from '@mui/icons-material/Add'
import PageShell from '@/components/ui/PageShell'
import LoadingButton from '@/components/ui/LoadingButton'
import { Spinner } from '@/components/ui/spinner'

interface Settings {
  debug_mode: boolean
  module_gezondheid: boolean
  module_groceries: boolean
  module_agenda: boolean
  module_financien: boolean
  notification_morning_hour: number
  notification_enabled: boolean
  life_coach_enabled: boolean
}

interface TelegramSettings {
  workspace: string
  hasToken: boolean
  tokenMasked: string | null
  chatId: string | null
  webhook?: { result?: { url?: string; pending_update_count?: number } } | null
}

interface Workspace {
  id: string
  label: string
  description?: string | null
  color?: string | null
  is_default?: number | boolean
}

export default function SettingsView() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeWorkspace, setActiveWorkspace] = useState('websup')
  const [newWorkspace, setNewWorkspace] = useState({ label: '', description: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [telegram, setTelegram] = useState<TelegramSettings | null>(null)
  const [telegramForm, setTelegramForm] = useState({ token: '', chatId: '' })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [settingsRes, workspaceRes, telegramRes] = await Promise.all([
        fetch('/api/settings').then((response) => response.json()),
        fetch('/api/workspaces').then((response) => response.json()),
        fetch('/api/settings/telegram').then((response) => response.json()),
      ])

      setSettings(settingsRes.data)
      setWorkspaces(workspaceRes.data?.workspaces || [])
      setActiveWorkspace(workspaceRes.data?.active || 'websup')
      setTelegram(telegramRes.data || null)
      setTelegramForm({ token: '', chatId: telegramRes.data?.chatId || '' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function updateSetting(key: keyof Settings, value: boolean | number) {
    setSaving(key)
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      })
      setSettings((current) => current ? { ...current, [key]: value } : current)
    } finally {
      setSaving(null)
    }
  }

  async function createWorkspace() {
    if (!newWorkspace.label.trim()) return
    setSaving('workspace-create')
    setFeedback(null)
    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWorkspace),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Workspace kon niet worden aangemaakt')

      setNewWorkspace({ label: '', description: '' })
      setFeedback({ type: 'success', text: 'Workspace aangemaakt en actief gezet.' })
      await loadData()
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Workspace kon niet worden aangemaakt.' })
    } finally {
      setSaving(null)
    }
  }

  async function activateWorkspace(id: string) {
    setSaving(`activate-${id}`)
    setFeedback(null)
    try {
      await fetch('/api/workspaces', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, makeActive: true }),
      })
      localStorage.setItem('app_workspace', id)
      document.cookie = `app_workspace=${id}; path=/; max-age=31536000; SameSite=Lax`
      setActiveWorkspace(id)
      setFeedback({ type: 'success', text: 'Workspace actief gezet. De pagina wordt vernieuwd.' })
      window.location.reload()
    } finally {
      setSaving(null)
    }
  }



  async function saveTelegramSettings() {
    setSaving('telegram-save')
    setFeedback(null)
    try {
      const response = await fetch('/api/settings/telegram', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telegramForm),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Kon Telegram instellingen niet opslaan')

      setTelegram(payload.data)
      setTelegramForm((current) => ({ ...current, token: '' }))
      setFeedback({ type: 'success', text: 'Telegram instellingen zijn opgeslagen voor deze workspace.' })
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Telegram instellingen konden niet opgeslagen worden.' })
    } finally {
      setSaving(null)
    }
  }

  async function setupTelegramWebhook() {
    setSaving('telegram-webhook')
    setFeedback(null)
    try {
      const response = await fetch('/api/settings/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Webhook setup mislukt')
      setFeedback({ type: 'success', text: 'Telegram webhook is ingesteld voor deze workspace.' })
      await loadData()
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Webhook kon niet ingesteld worden.' })
    } finally {
      setSaving(null)
    }
  }

  async function removeWorkspace(workspace: Workspace) {
    if (!window.confirm(`Workspace "${workspace.label}" verwijderen? Dit kan alleen als er geen data in staat.`)) return

    setSaving(`delete-${workspace.id}`)
    setFeedback(null)
    try {
      const response = await fetch('/api/workspaces', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: workspace.id }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Workspace kon niet worden verwijderd')

      setFeedback({ type: 'success', text: 'Workspace verwijderd.' })
      await loadData()
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Workspace kon niet worden verwijderd.' })
    } finally {
      setSaving(null)
    }
  }

  if (loading && !settings) {
    return (
      <PageShell title="Instellingen" subtitle="Beheer je profiel, workspaces en AI voorkeuren">
        <Paper sx={{ p: 3, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Spinner className="h-4 w-4" />
            <Typography variant="body2" color="text.secondary">Instellingen laden...</Typography>
          </Stack>
        </Paper>
      </PageShell>
    )
  }

  return (
    <PageShell title="Instellingen" subtitle="Beheer gebruikersgedrag, workspaces en AI voorkeuren">
      <Stack spacing={4}>
        {feedback && <Alert severity={feedback.type}>{feedback.text}</Alert>}

        <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
          <Stack spacing={3}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'primary.light', color: 'primary.main', display: 'flex' }}>
                <BusinessIcon fontSize="small" />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 850 }}>Workspaces</Typography>
                <Typography variant="caption" color="text.secondary">
                  Scheid data per omgeving. De actieve workspace bepaalt wat de app en AI-context gebruiken.
                </Typography>
              </Box>
            </Stack>

            <Stack spacing={1.5}>
              {workspaces.map((workspace) => {
                const isActive = workspace.id === activeWorkspace
                const isDefault = Boolean(workspace.is_default)
                return (
                  <Box
                    key={workspace.id}
                    sx={{
                      p: 2,
                      borderRadius: 1,
                      bgcolor: isActive ? 'primary.light' : 'grey.50',
                      border: '1px solid',
                      borderColor: isActive ? 'primary.main' : 'divider',
                      display: 'flex',
                      gap: 2,
                      alignItems: { xs: 'stretch', sm: 'center' },
                      justifyContent: 'space-between',
                      flexDirection: { xs: 'column', sm: 'row' },
                    }}
                  >
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography variant="body2" sx={{ fontWeight: 850 }}>{workspace.label}</Typography>
                        {isActive && <Chip label="Actief" size="small" color="primary" />}
                        {isDefault && <Chip label="Standaard" size="small" variant="outlined" />}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">{workspace.id}</Typography>
                      {workspace.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {workspace.description}
                        </Typography>
                      )}
                    </Box>

                    <Stack direction="row" spacing={1}>
                      {!isActive && (
                        <LoadingButton
                          size="small"
                          variant="outlined"
                          loading={saving === `activate-${workspace.id}`}
                          onClick={() => activateWorkspace(workspace.id)}
                        >
                          Gebruik
                        </LoadingButton>
                      )}
                      {!isDefault && (
                        <LoadingButton
                          size="small"
                          color="error"
                          variant="outlined"
                          startIcon={<DeleteIcon fontSize="small" />}
                          loading={saving === `delete-${workspace.id}`}
                          onClick={() => removeWorkspace(workspace)}
                        >
                          Verwijder
                        </LoadingButton>
                      )}
                    </Stack>
                  </Box>
                )
              })}
            </Stack>

            <Divider />

            <Stack spacing={2}>
              <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>Nieuwe workspace</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    label="Naam"
                    placeholder="Bijv. Prive, Bouma of WebsUp"
                    fullWidth
                    size="small"
                    value={newWorkspace.label}
                    onChange={(event) => setNewWorkspace((current) => ({ ...current, label: event.target.value }))}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Omschrijving"
                    placeholder="Waarvoor gebruik je deze omgeving?"
                    fullWidth
                    size="small"
                    value={newWorkspace.description}
                    onChange={(event) => setNewWorkspace((current) => ({ ...current, description: event.target.value }))}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <LoadingButton
                    fullWidth
                    variant="contained"
                    startIcon={<PlusIcon />}
                    loading={saving === 'workspace-create'}
                    onClick={createWorkspace}
                    disabled={!newWorkspace.label.trim()}
                  >
                    Toevoegen
                  </LoadingButton>
                </Grid>
              </Grid>
            </Stack>
          </Stack>
        </Paper>


        <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'primary.light', color: 'primary.main', display: 'flex' }}>
                <TelegramIcon fontSize="small" />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 850 }}>Telegram per workspace</Typography>
                <Typography variant="caption" color="text.secondary">
                  Sla per workspace een eigen bot key op. Zo blijft Telegram-koppeling gescheiden tussen accounts.
                </Typography>
              </Box>
            </Stack>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 7 }}>
                <TextField
                  label="Telegram API key"
                  placeholder={telegram?.tokenMasked || '123456:ABC...'}
                  fullWidth
                  size="small"
                  type="password"
                  value={telegramForm.token}
                  onChange={(event) => setTelegramForm((current) => ({ ...current, token: event.target.value }))}
                  helperText={telegram?.hasToken ? `Huidige key: ${telegram?.tokenMasked}` : 'Nog geen key opgeslagen voor deze workspace'}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 5 }}>
                <TextField
                  label="Telegram chat ID (optioneel)"
                  placeholder="Bijv. 123456789"
                  fullWidth
                  size="small"
                  value={telegramForm.chatId}
                  onChange={(event) => setTelegramForm((current) => ({ ...current, chatId: event.target.value }))}
                />
              </Grid>
            </Grid>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <LoadingButton
                variant="contained"
                loading={saving === 'telegram-save'}
                onClick={saveTelegramSettings}
              >
                Telegram opslaan
              </LoadingButton>
              <LoadingButton
                variant="outlined"
                loading={saving === 'telegram-webhook'}
                onClick={setupTelegramWebhook}
                disabled={!telegram?.hasToken && !telegramForm.token.trim()}
              >
                Webhook instellen
              </LoadingButton>
            </Stack>
          </Stack>
        </Paper>


        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3, borderRadius: 1, border: '1px solid', borderColor: 'divider', height: '100%' }}>
              <Stack spacing={3}>
                <Typography variant="subtitle2" sx={{ fontWeight: 850, textTransform: 'uppercase', color: 'text.secondary', fontSize: 11 }}>
                  Modules & AI
                </Typography>

                <SettingRow
                  label="Life Coach"
                  desc="Proactieve vragen en reflecties"
                  icon={<BrainIcon fontSize="small" />}
                  control={<Switch size="small" checked={Boolean(settings?.life_coach_enabled)} disabled={saving === 'life_coach_enabled'} onChange={(event) => updateSetting('life_coach_enabled', event.target.checked)} />}
                />

                <SettingRow
                  label="Debugmodus"
                  desc="Toon AI-acties in chat en timeline"
                  icon={<BrainIcon fontSize="small" />}
                  control={<Switch size="small" checked={Boolean(settings?.debug_mode)} disabled={saving === 'debug_mode'} onChange={(event) => updateSetting('debug_mode', event.target.checked)} />}
                />

                <Divider />

                <SettingRow
                  label="Gezondheid"
                  desc="Slaap, energie en daglogs"
                  control={<Switch size="small" checked={Boolean(settings?.module_gezondheid)} disabled={saving === 'module_gezondheid'} onChange={(event) => updateSetting('module_gezondheid', event.target.checked)} />}
                />
                <SettingRow
                  label="Financien"
                  desc="Transacties en budgetten"
                  control={<Switch size="small" checked={Boolean(settings?.module_financien)} disabled={saving === 'module_financien'} onChange={(event) => updateSetting('module_financien', event.target.checked)} />}
                />
              </Stack>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3, borderRadius: 1, border: '1px solid', borderColor: 'divider', height: '100%' }}>
              <Stack spacing={3}>
                <Typography variant="subtitle2" sx={{ fontWeight: 850, textTransform: 'uppercase', color: 'text.secondary', fontSize: 11 }}>
                  Notificaties
                </Typography>

                <SettingRow
                  label="Meldingen actief"
                  desc="Telegram ochtendplanning"
                  icon={<BellIcon fontSize="small" />}
                  control={<Switch size="small" checked={Boolean(settings?.notification_enabled)} disabled={saving === 'notification_enabled'} onChange={(event) => updateSetting('notification_enabled', event.target.checked)} />}
                />

                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>Ochtendmelding tijdstip</Typography>
                  <Select
                    size="small"
                    fullWidth
                    value={settings?.notification_morning_hour || 8}
                    disabled={saving === 'notification_morning_hour'}
                    onChange={(event) => updateSetting('notification_morning_hour', Number(event.target.value))}
                    sx={{ borderRadius: 1 }}
                  >
                    {[6, 7, 8, 9, 10].map((hour) => <MenuItem key={hour} value={hour}>{hour}:00 uur</MenuItem>)}
                  </Select>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Stack>
    </PageShell>
  )
}

function SettingRow({ label, desc, icon, control }: { label: string; desc: string; icon?: React.ReactNode; control: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        {icon && <Box sx={{ color: 'text.secondary', display: 'flex' }}>{icon}</Box>}
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{label}</Typography>
          <Typography variant="caption" color="text.secondary">{desc}</Typography>
        </Box>
      </Stack>
      {control}
    </Box>
  )
}
