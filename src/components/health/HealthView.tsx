'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/GridLegacy'
import LinearProgress from '@mui/material/LinearProgress'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder'
import LocalDrinkOutlinedIcon from '@mui/icons-material/LocalDrinkOutlined'
import NightsStayOutlinedIcon from '@mui/icons-material/NightsStayOutlined'
import PsychologyAltOutlinedIcon from '@mui/icons-material/PsychologyAltOutlined'
import SelfImprovementOutlinedIcon from '@mui/icons-material/SelfImprovementOutlined'
import PageShell, { PageSection } from '@/components/ui/PageShell'
import AppDetailDrawer from '@/components/ui/AppDetailDrawer'

type HealthLog = {
  id?: number
  log_date?: string
  sleep_hours?: number | string | null
  sleep_quality?: number | null
  energy_level?: number | null
  stress_level?: number | null
  pain_score?: number | null
  pain_location?: string | null
  water_glasses?: number | null
  symptoms?: string[] | null
  medications?: string[] | null
  notes?: string | null
}

type HealthForm = {
  sleep_hours: string
  sleep_quality: string
  energy_level: string
  stress_level: string
  pain_score: string
  pain_location: string
  water_glasses: string
  symptoms: string
  medications: string
  notes: string
}

const emptyForm: HealthForm = {
  sleep_hours: '',
  sleep_quality: '',
  energy_level: '',
  stress_level: '',
  pain_score: '',
  pain_location: '',
  water_glasses: '',
  symptoms: '',
  medications: '',
  notes: '',
}

function toForm(log?: HealthLog | null): HealthForm {
  if (!log) return emptyForm
  return {
    sleep_hours: log.sleep_hours == null ? '' : String(log.sleep_hours),
    sleep_quality: log.sleep_quality == null ? '' : String(log.sleep_quality),
    energy_level: log.energy_level == null ? '' : String(log.energy_level),
    stress_level: log.stress_level == null ? '' : String(log.stress_level),
    pain_score: log.pain_score == null ? '' : String(log.pain_score),
    pain_location: log.pain_location ?? '',
    water_glasses: log.water_glasses == null ? '' : String(log.water_glasses),
    symptoms: Array.isArray(log.symptoms) ? log.symptoms.join(', ') : '',
    medications: Array.isArray(log.medications) ? log.medications.join(', ') : '',
    notes: log.notes ?? '',
  }
}

function parseList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function parseNumber(value: string) {
  if (value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function formatDate(value?: string) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(value))
}

function StatTile({ icon, label, value, helper }: { icon: React.ReactNode; label: string; value: string; helper: string }) {
  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'primary.light', color: 'primary.main' }}>
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
            {label}
          </Typography>
          <Typography variant="h4">{value}</Typography>
          <Typography variant="caption" color="text.secondary">{helper}</Typography>
        </Box>
      </Stack>
    </Paper>
  )
}

export default function HealthView() {
  const [today, setToday] = useState<HealthLog | null>(null)
  const [history, setHistory] = useState<HealthLog[]>([])
  const [form, setForm] = useState<HealthForm>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [selectedLog, setSelectedLog] = useState<HealthLog | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/health?days=14')
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error?.message || json.message || 'Kon gezondheid niet laden')
      const nextToday = json.data?.today ?? null
      setToday(nextToday)
      setHistory(json.data?.history ?? [])
      setForm(toForm(nextToday))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Kon gezondheid niet laden')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const averages = useMemo(() => {
    const average = (items: HealthLog[], key: keyof HealthLog) => {
      const values = items.map((item) => Number(item[key])).filter((value) => Number.isFinite(value))
      if (!values.length) return null
      return values.reduce((sum, value) => sum + value, 0) / values.length
    }
    return {
      energy: average(history, 'energy_level'),
      stress: average(history, 'stress_level'),
      sleep: average(history, 'sleep_hours'),
    }
  }, [history])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch('/api/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sleep_hours: parseNumber(form.sleep_hours),
          sleep_quality: parseNumber(form.sleep_quality),
          energy_level: parseNumber(form.energy_level),
          stress_level: parseNumber(form.stress_level),
          pain_score: parseNumber(form.pain_score),
          pain_location: form.pain_location.trim() || undefined,
          water_glasses: parseNumber(form.water_glasses),
          symptoms: parseList(form.symptoms),
          medications: parseList(form.medications),
          notes: form.notes.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error?.message || json.message || 'Kon gezondheid niet opslaan')
      setToday(json.data)
      setSaved(true)
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Kon gezondheid niet opslaan')
    } finally {
      setSaving(false)
    }
  }

  const update = (key: keyof HealthForm) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }))
  }

  if (loading) {
    return (
      <PageShell title="Gezondheid" subtitle="Slaap, energie, stress en signalen op een plek.">
        <Grid container spacing={2}>
          {[0, 1, 2, 3].map((item) => (
            <Grid item xs={12} sm={6} lg={3} key={item}>
              <Skeleton variant="rounded" height={96} />
            </Grid>
          ))}
        </Grid>
        <Skeleton variant="rounded" height={420} />
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Gezondheid"
      subtitle="Log je dagelijkse signalen. De AI gebruikt dit voor betere patronen, planning en coaching."
      actions={<Button variant="outlined" onClick={load}>Vernieuwen</Button>}
    >
      {error && <Alert severity="error">{error}</Alert>}
      {saved && <Alert severity="success">Gezondheid opgeslagen.</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatTile icon={<NightsStayOutlinedIcon />} label="Slaap" value={today?.sleep_hours ? `${today.sleep_hours}u` : '-'} helper={`14d gem. ${averages.sleep ? averages.sleep.toFixed(1) + 'u' : '-'}`} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatTile icon={<SelfImprovementOutlinedIcon />} label="Energie" value={today?.energy_level ? `${today.energy_level}/10` : '-'} helper={`14d gem. ${averages.energy ? averages.energy.toFixed(1) : '-'}`} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatTile icon={<PsychologyAltOutlinedIcon />} label="Stress" value={today?.stress_level ? `${today.stress_level}/10` : '-'} helper={`14d gem. ${averages.stress ? averages.stress.toFixed(1) : '-'}`} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatTile icon={<LocalDrinkOutlinedIcon />} label="Water" value={today?.water_glasses ? `${today.water_glasses}` : '-'} helper="glazen vandaag" />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={5}>
          <Paper component="form" onSubmit={handleSubmit} sx={{ p: 2.5 }}>
            <Stack spacing={2}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <FavoriteBorderIcon color="primary" />
                <Box>
                  <Typography variant="h5">Vandaag loggen</Typography>
                  <Typography variant="body2" color="text.secondary">Korte input, bruikbare patronen later.</Typography>
                </Box>
              </Stack>
              {saving && <LinearProgress />}
              <Grid container spacing={1.5}>
                <Grid item xs={6}><TextField label="Slaapuren" value={form.sleep_hours} onChange={update('sleep_hours')} type="number" inputProps={{ step: 0.25, min: 0 }} fullWidth /></Grid>
                <Grid item xs={6}>
                  <TextField select label="Slaapkwaliteit" value={form.sleep_quality} onChange={update('sleep_quality')} fullWidth>
                    <MenuItem value="">Onbekend</MenuItem>
                    {[1, 2, 3, 4, 5].map((value) => <MenuItem key={value} value={value}>{value}/5</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={6}>
                  <TextField select label="Energie" value={form.energy_level} onChange={update('energy_level')} fullWidth>
                    <MenuItem value="">Onbekend</MenuItem>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => <MenuItem key={value} value={value}>{value}/10</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={6}>
                  <TextField select label="Stress" value={form.stress_level} onChange={update('stress_level')} fullWidth>
                    <MenuItem value="">Onbekend</MenuItem>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => <MenuItem key={value} value={value}>{value}/10</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={6}>
                  <TextField select label="Pijnscore" value={form.pain_score} onChange={update('pain_score')} fullWidth>
                    <MenuItem value="">Geen/onbekend</MenuItem>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => <MenuItem key={value} value={value}>{value}/10</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={6}><TextField label="Pijnlocatie" value={form.pain_location} onChange={update('pain_location')} fullWidth placeholder="bijv. rug" /></Grid>
                <Grid item xs={12}><TextField label="Water glazen" value={form.water_glasses} onChange={update('water_glasses')} type="number" inputProps={{ min: 0 }} fullWidth /></Grid>
                <Grid item xs={12}><TextField label="Symptomen" value={form.symptoms} onChange={update('symptoms')} fullWidth placeholder="bijv. hoofdpijn, moe" helperText="Scheid meerdere items met komma's." /></Grid>
                <Grid item xs={12}><TextField label="Medicatie" value={form.medications} onChange={update('medications')} fullWidth placeholder="bijv. paracetamol" helperText="Scheid meerdere items met komma's." /></Grid>
                <Grid item xs={12}><TextField label="Notities" value={form.notes} onChange={update('notes')} multiline minRows={4} fullWidth placeholder="Wat viel op vandaag?" /></Grid>
              </Grid>
              <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Opslaan...' : 'Gezondheid opslaan'}</Button>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={7}>
          <PageSection title="Historie">
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Datum</TableCell>
                    <TableCell align="right">Slaap</TableCell>
                    <TableCell align="right">Energie</TableCell>
                    <TableCell align="right">Stress</TableCell>
                    <TableCell align="right">Pijn</TableCell>
                    <TableCell>Signalen</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                          Nog geen gezondheidslogs. Vul vandaag je eerste meting in.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : history.map((item) => (
                    <TableRow
                      key={item.id ?? item.log_date}
                      hover
                      onClick={() => setSelectedLog(item)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>{formatDate(item.log_date)}</TableCell>
                      <TableCell align="right">{item.sleep_hours ? `${item.sleep_hours}u` : '-'}</TableCell>
                      <TableCell align="right">{item.energy_level ?? '-'}</TableCell>
                      <TableCell align="right">{item.stress_level ?? '-'}</TableCell>
                      <TableCell align="right">{item.pain_score ?? '-'}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          {(item.symptoms ?? []).slice(0, 3).map((symptom) => (
                            <Chip key={symptom} size="small" label={symptom} variant="outlined" />
                          ))}
                          {item.notes && <Chip size="small" label="notitie" color="primary" variant="outlined" />}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </PageSection>
        </Grid>
      </Grid>
      <AppDetailDrawer
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        eyebrow="Gezondheidslog"
        title={selectedLog?.log_date ? formatDate(selectedLog.log_date) : 'Gezondheidslog'}
        subtitle={selectedLog?.notes || 'Dagelijkse signalen en gezondheidspatronen.'}
        status={selectedLog?.energy_level ? `Energie ${selectedLog.energy_level}/10` : undefined}
        fields={[
          { label: 'Slaap', value: selectedLog?.sleep_hours ? `${selectedLog.sleep_hours}u` : '-' },
          { label: 'Slaapkwaliteit', value: selectedLog?.sleep_quality ? `${selectedLog.sleep_quality}/5` : '-' },
          { label: 'Stress', value: selectedLog?.stress_level ? `${selectedLog.stress_level}/10` : '-' },
          { label: 'Pijn', value: selectedLog?.pain_score != null ? `${selectedLog.pain_score}/10` : '-' },
          { label: 'Pijnlocatie', value: selectedLog?.pain_location || '-' },
          { label: 'Water', value: selectedLog?.water_glasses != null ? `${selectedLog.water_glasses} glazen` : '-' },
          { label: 'Symptomen', value: selectedLog?.symptoms?.length ? selectedLog.symptoms.join(', ') : '-' },
          { label: 'Medicatie', value: selectedLog?.medications?.length ? selectedLog.medications.join(', ') : '-' },
        ]}
      />
    </PageShell>
  )
}
