'use client'

import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import List from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import PageShell from '@/components/ui/PageShell'
import UserIcon from '@mui/icons-material/Person'
import BrainIcon from '@mui/icons-material/Psychology'
import GridIcon from '@mui/icons-material/GridView'
import BellIcon from '@mui/icons-material/Notifications'
import DeleteIcon from '@mui/icons-material/DeleteOutline'
import SaveIcon from '@mui/icons-material/Save'
import PlusIcon from '@mui/icons-material/Add'
import BusinessIcon from '@mui/icons-material/Business'
import TelegramIcon from '@mui/icons-material/Telegram'

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

interface Tenant {
  id: string
  name: string
  database_url?: string
  telegram_bot_token?: string
}

export default function SettingsView() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, tRes] = await Promise.all([
        fetch('/api/settings').then(r => r.json()),
        fetch('/api/admin/tenants').then(r => r.json()).catch(() => ({ data: [] }))
      ])
      setSettings(sRes.data)
      setTenants(tRes.data || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function updateSetting(key: keyof Settings, value: any) {
    setSaving(key)
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      })
      setSettings(prev => prev ? { ...prev, [key]: value } : null)
    } finally {
      setSaving(null)
    }
  }

  if (loading && !settings) {
    return (
      <PageShell title="Instellingen" subtitle="Laden...">
        <Box />
      </PageShell>
    )
  }

  return (
    <PageShell title="Instellingen" subtitle="Beheer je profiel, workspaces en AI voorkeuren">
      <Stack spacing={4}>
        
        {/* Workspaces Management */}
        <Paper sx={{ p: 3, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
            <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'primary.light', color: 'primary.main', display: 'flex' }}>
              <BusinessIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 850 }}>Workspaces</Typography>
              <Typography variant="caption" color="text.secondary">Beheer je verschillende omgevingen en data-bronnen</Typography>
            </Box>
          </Stack>

          <Stack spacing={2}>
            {tenants.map((t) => (
              <Box key={t.id} sx={{ p: 2, borderRadius: 1, bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>{t.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{t.id}</Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  {t.telegram_bot_token && <Chip icon={<TelegramIcon sx={{ fontSize: '14px !important' }} />} label="Bot actief" size="small" color="success" variant="outlined" sx={{ fontSize: 10, fontWeight: 700 }} />}
                  <Button size="small" variant="outlined" sx={{ fontWeight: 700 }}>Config</Button>
                </Stack>
              </Box>
            ))}
            <Button startIcon={<PlusIcon />} variant="outlined" sx={{ borderStyle: 'dashed', borderColor: 'divider', py: 2 }}>
              Nieuwe Workspace Toevoegen
            </Button>
          </Stack>
        </Paper>

        <Grid container spacing={3}>
          {/* Modules & AI */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3, borderRadius: 1, border: '1px solid', borderColor: 'divider', height: '100%' }}>
              <Stack spacing={3}>
                <Typography variant="subtitle2" sx={{ fontWeight: 850, textTransform: 'uppercase', letterSpacing: 1, color: 'text.secondary', fontSize: 11 }}>Modules & AI</Typography>
                
                <SettingRow 
                  label="Life Coach" 
                  desc="Proactieve vragen en reflecties" 
                  icon={<BrainIcon fontSize="small" />}
                  control={<Switch size="small" checked={settings?.life_coach_enabled} onChange={(e) => updateSetting('life_coach_enabled', e.target.checked)} />}
                />
                
                <SettingRow 
                  label="Debug Modus" 
                  desc="Toon AI-acties in de chat" 
                  icon={<BrainIcon fontSize="small" />}
                  control={<Switch size="small" checked={settings?.debug_mode} onChange={(e) => updateSetting('debug_mode', e.target.checked)} />}
                />

                <Divider />

                <SettingRow 
                  label="Gezondheid" 
                  desc="Slaap en energie logs" 
                  control={<Switch size="small" checked={settings?.module_gezondheid} onChange={(e) => updateSetting('module_gezondheid', e.target.checked)} />}
                />
                <SettingRow 
                  label="Financiën" 
                  desc="Transacties en budgetten" 
                  control={<Switch size="small" checked={settings?.module_financien} onChange={(e) => updateSetting('module_financien', e.target.checked)} />}
                />
              </Stack>
            </Paper>
          </Grid>

          {/* Notificaties */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3, borderRadius: 1, border: '1px solid', borderColor: 'divider', height: '100%' }}>
              <Stack spacing={3}>
                <Typography variant="subtitle2" sx={{ fontWeight: 850, textTransform: 'uppercase', letterSpacing: 1, color: 'text.secondary', fontSize: 11 }}>Notificaties</Typography>
                
                <SettingRow 
                  label="Meldingen Actief" 
                  desc="Telegram ochtendplanning" 
                  icon={<BellIcon fontSize="small" />}
                  control={<Switch size="small" checked={settings?.notification_enabled} onChange={(e) => updateSetting('notification_enabled', e.target.checked)} />}
                />

                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>Ochtendmelding tijdstip</Typography>
                  <Select
                    size="small"
                    fullWidth
                    value={settings?.notification_morning_hour || 8}
                    onChange={(e) => updateSetting('notification_morning_hour', e.target.value)}
                    sx={{ borderRadius: 1 }}
                  >
                    {[6, 7, 8, 9, 10].map(h => <MenuItem key={h} value={h}>{h}:00 uur</MenuItem>)}
                  </Select>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        </Grid>

        {/* Profiel & Feiten */}
        <Paper sx={{ p: 3, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 850, textTransform: 'uppercase', letterSpacing: 1, color: 'text.secondary', fontSize: 11, mb: 3 }}>AI Geheugen (Feiten)</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Deze feiten gebruikt de AI om je beter te begrijpen en persoonlijker te antwoorden.
          </Typography>
          <Button startIcon={<PlusIcon />} size="small" sx={{ fontWeight: 700 }}>Feit toevoegen</Button>
        </Paper>

      </Stack>
    </PageShell>
  )
}

function SettingRow({ label, desc, icon, control }: { label: string, desc: string, icon?: React.ReactNode, control: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
