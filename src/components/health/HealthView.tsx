'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/GridLegacy'
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
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder'
import HealingOutlinedIcon from '@mui/icons-material/HealingOutlined'
import LocalDrinkOutlinedIcon from '@mui/icons-material/LocalDrinkOutlined'
import NightsStayOutlinedIcon from '@mui/icons-material/NightsStayOutlined'
import PsychologyAltOutlinedIcon from '@mui/icons-material/PsychologyAltOutlined'
import SelfImprovementOutlinedIcon from '@mui/icons-material/SelfImprovementOutlined'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import PageShell, { PageSection } from '@/components/ui/PageShell'
import AppDetailDrawer from '@/components/ui/AppDetailDrawer'
import LoadingButton from '@/components/ui/LoadingButton'

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
  return new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${String(value).split('T')[0]}T12:00:00`))
}

function formatNumber(value: number | string | null | undefined, suffix = '') {
  if (value == null || value === '') return '-'
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '-'
  return `${Number.isInteger(parsed) ? parsed : parsed.toFixed(1)}${suffix}`
}

function average(items: HealthLog[], key: keyof HealthLog) {
  const values = items.map((item) => Number(item[key])).filter((value) => Number.isFinite(value))
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function healthScore(log: HealthLog | null) {
  if (!log) return null
  const energy = Number(log.energy_level)
  const stress = Number(log.stress_level)
  const sleep = Number(log.sleep_hours)
  const pain = Number(log.pain_score)
  const parts: number[] = []
  if (Number.isFinite(energy)) parts.push(energy * 10)
  if (Number.isFinite(stress)) parts.push((11 - stress) * 10)
  if (Number.isFinite(sleep)) parts.push(Math.min(100, Math.max(20, (sleep / 8) * 100)))
  if (Number.isFinite(pain)) parts.push((10 - pain) * 10)
  if (!parts.length) return null
  return Math.round(parts.reduce((sum, value) => sum + value, 0) / parts.length)
}

function buildBriefing(today: HealthLog | null, history: HealthLog[]) {
  const score = healthScore(today)
  const avgEnergy = average(history, 'energy_level')
  const avgStress = average(history, 'stress_level')
  const avgSleep = average(history, 'sleep_hours')

  if (!today) {
    return 'Nog geen gezondheidslog voor vandaag. Vul slaap, energie en stress in; daarna kan de app patronen en planning beter meewegen.'
  }

  const fragments = []
  if (score != null) fragments.push(`Je health-score staat vandaag op ${score}/100.`)
  if (today.energy_level && avgEnergy) {
    fragments.push(Number(today.energy_level) >= avgEnergy ? 'Je energie ligt op of boven je recente gemiddelde.' : 'Je energie ligt lager dan je recente gemiddelde.')
  }
  if (today.stress_level && avgStress && Number(today.stress_level) >= avgStress + 2) {
    fragments.push('Stress springt eruit; plan vandaag liever minder strak.')
  }
  if (today.sleep_hours && avgSleep && Number(today.sleep_hours) < avgSleep - 1) {
    fragments.push('Je hebt duidelijk minder geslapen dan normaal.')
  }
  return fragments.join(' ') || 'Je log is opgeslagen. Voeg eventueel symptomen of notities toe voor betere AI-context.'
}

function ScoreButtonGroup({
  label,
  value,
  max,
  onChange,
}: {
  label: string
  value: string
  max: number
  onChange: (value: string) => void
}) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
        {Array.from({ length: max }, (_, index) => String(index + 1)).map((option) => {
          const selected = value === option
          return (
            <Button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              variant={selected ? 'contained' : 'outlined'}
              size="small"
              sx={{ minWidth: 36, px: 1, borderRadius: 999 }}
            >
              {option}
            </Button>
          )
        })}
      </Stack>
    </Box>
  )
}

function StatTile({
  icon,
  label,
  value,
  helper,
  tone = 'default',
}: {
  icon: React.ReactNode
  label: string
  value: string
  helper: string
  tone?: 'default' | 'good' | 'warn'
}) {
  const color = tone === 'good' ? 'success.main' : tone === 'warn' ? 'warning.main' : 'primary.main'
  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box sx={{ width: 42, height: 42, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: 'primary.light', color }}>
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 800 }}>
            {label}
          </Typography>
          <Typography variant="h4">{value}</Typography>
          <Typography variant="caption" color="text.secondary">{helper}</Typography>
        </Box>
      </Stack>
    </Paper>
  )
}

function MiniTrend({ history }: { history: HealthLog[] }) {
  const rows = history.slice(0, 10).reverse()
  if (!rows.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        Log een paar dagen om trends te zien.
      </Typography>
    )
  }

  return (
    <Stack spacing={1.5}>
      {rows.map((item) => {
        const energy = Number(item.energy_level || 0)
        const stress = Number(item.stress_level || 0)
        return (
          <Box key={item.id ?? item.log_date}>
            <Stack direction="row" justifyContent="space-between" spacing={1}>
              <Typography variant="caption" color="text.secondary">{formatDate(item.log_date)}</Typography>
              <Typography variant="caption" color="text.secondary">E {energy || '-'} / S {stress || '-'}</Typography>
            </Stack>
            <Stack direction="row" spacing={0.75} sx={{ mt: 0.5 }}>
              <Box sx={{ flex: 1, height: 8, borderRadius: 999, bgcolor: 'action.hover', overflow: 'hidden' }}>
                <Box sx={{ height: '100%', width: `${Math.min(100, energy * 10)}%`, bgcolor: 'success.main', borderRadius: 999 }} />
              </Box>
              <Box sx={{ flex: 1, height: 8, borderRadius: 999, bgcolor: 'action.hover', overflow: 'hidden' }}>
                <Box sx={{ height: '100%', width: `${Math.min(100, stress * 10)}%`, bgcolor: 'warning.main', borderRadius: 999 }} />
              </Box>
            </Stack>
          </Box>
        )
      })}
    </Stack>
  )
}

export default function HealthView() {
  const [today, setToday] = useState<HealthLog | null>(null)
  const [history, setHistory] = useState<HealthLog[]>([])
  const [form, setForm] = useState<HealthForm>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingLog, setSavingLog] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [selectedLog, setSelectedLog] = useState<HealthLog | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/health?days=30')
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

  const averages = useMemo(() => ({
    energy: average(history, 'energy_level'),
    stress: average(history, 'stress_level'),
    sleep: average(history, 'sleep_hours'),
  }), [history])

  const score = healthScore(today)
  const briefing = useMemo(() => buildBriefing(today, history), [today, history])

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

  async function updateHealthLog(values: Record<string, string | number | boolean | null>) {
    if (!selectedLog?.log_date) return
    setSavingLog(true)
    setError(null)
    try {
      const res = await fetch('/api/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          log_date: String(selectedLog.log_date).split('T')[0],
          sleep_hours: parseNumber(String(values.sleep_hours ?? '')),
          sleep_quality: parseNumber(String(values.sleep_quality ?? '')),
          energy_level: parseNumber(String(values.energy_level ?? '')),
          stress_level: parseNumber(String(values.stress_level ?? '')),
          pain_score: parseNumber(String(values.pain_score ?? '')),
          pain_location: String(values.pain_location ?? '').trim() || undefined,
          water_glasses: parseNumber(String(values.water_glasses ?? '')),
          symptoms: parseList(String(values.symptoms ?? '')),
          medications: parseList(String(values.medications ?? '')),
          notes: String(values.notes ?? '').trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error?.message || json.message || 'Kon gezondheidslog niet opslaan')
      await load()
      setSelectedLog((current) => current ? {
        ...current,
        sleep_hours: values.sleep_hours as string,
        sleep_quality: Number(values.sleep_quality) || null,
        energy_level: Number(values.energy_level) || null,
        stress_level: Number(values.stress_level) || null,
        pain_score: Number(values.pain_score) || null,
        pain_location: String(values.pain_location || ''),
        water_glasses: Number(values.water_glasses) || null,
        symptoms: parseList(String(values.symptoms ?? '')),
        medications: parseList(String(values.medications ?? '')),
        notes: String(values.notes || ''),
      } : current)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Kon gezondheidslog niet opslaan')
    } finally {
      setSavingLog(false)
    }
  }

  const update = (key: keyof HealthForm) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }))
  }

  const setField = (key: keyof HealthForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  if (loading) {
    return (
      <PageShell title="Gezondheid" subtitle="Slaap, energie, stress en signalen op een plek.">
        <Grid container spacing={2} sx={{ width: '100%', m: 0 }}>
          {[0, 1, 2, 3].map((item) => (
            <Grid item xs={12} sm={6} lg={3} key={item}>
              <Skeleton variant="rounded" height={104} />
            </Grid>
          ))}
        </Grid>
        <Skeleton variant="rounded" height={460} />
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Gezondheid"
      subtitle="Dagelijkse signalen voor betere planning, patronen en AI-context."
      actions={<Button variant="outlined" onClick={load}>Vernieuwen</Button>}
    >
      {error && <Alert severity="error">{error}</Alert>}
      {saved && <Alert severity="success">Gezondheid opgeslagen.</Alert>}

      <Paper
        sx={{
          p: { xs: 2, md: 2.5 },
          background: 'linear-gradient(90deg, rgba(168,206,207,0.22), rgba(230,174,140,0.18))',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ width: 44, height: 44, borderRadius: 3, display: 'grid', placeItems: 'center', color: 'common.white', background: 'var(--brand-gradient)' }}>
              <FavoriteBorderIcon />
            </Box>
            <Box>
              <Typography variant="overline" color="text.secondary">Health briefing</Typography>
              <Typography variant="body1" sx={{ maxWidth: 760, lineHeight: 1.8 }}>{briefing}</Typography>
            </Box>
          </Stack>
          <Chip color={score != null && score >= 70 ? 'success' : score != null && score < 45 ? 'warning' : 'primary'} label={score == null ? 'Nog geen score' : `${score}/100`} />
        </Stack>
      </Paper>

      <Grid container spacing={2} sx={{ width: '100%', m: 0 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatTile icon={<NightsStayOutlinedIcon />} label="Slaap" value={formatNumber(today?.sleep_hours, 'u')} helper={`30d gem. ${averages.sleep ? averages.sleep.toFixed(1) + 'u' : '-'}`} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatTile icon={<SelfImprovementOutlinedIcon />} label="Energie" value={today?.energy_level ? `${today.energy_level}/10` : '-'} helper={`30d gem. ${averages.energy ? averages.energy.toFixed(1) : '-'}`} tone={today?.energy_level && Number(today.energy_level) >= 7 ? 'good' : 'default'} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatTile icon={<PsychologyAltOutlinedIcon />} label="Stress" value={today?.stress_level ? `${today.stress_level}/10` : '-'} helper={`30d gem. ${averages.stress ? averages.stress.toFixed(1) : '-'}`} tone={today?.stress_level && Number(today.stress_level) >= 7 ? 'warn' : 'default'} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatTile icon={<LocalDrinkOutlinedIcon />} label="Water" value={today?.water_glasses ? `${today.water_glasses}` : '-'} helper="glazen vandaag" />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ width: '100%', m: 0 }}>
        <Grid item xs={12} lg={5}>
          <Paper component="form" onSubmit={handleSubmit} sx={{ p: 2.5 }}>
            <Stack spacing={2.5}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box sx={{ width: 40, height: 40, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: 'primary.light', color: 'primary.main' }}>
                  <HealingOutlinedIcon />
                </Box>
                <Box>
                  <Typography variant="h5">Vandaag loggen</Typography>
                  <Typography variant="body2" color="text.secondary">Snel genoeg voor dagelijks gebruik, rijk genoeg voor patronen.</Typography>
                </Box>
              </Stack>
              <Grid container spacing={1.5} sx={{ width: '100%', m: 0 }}>
                <Grid item xs={12} sm={6}>
                  <TextField label="Slaapuren" value={form.sleep_hours} onChange={update('sleep_hours')} type="number" inputProps={{ step: 0.25, min: 0 }} fullWidth />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField select label="Slaapkwaliteit" value={form.sleep_quality} onChange={update('sleep_quality')} fullWidth>
                    <MenuItem value="">Onbekend</MenuItem>
                    {[1, 2, 3, 4, 5].map((value) => <MenuItem key={value} value={value}>{value}/5</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <ScoreButtonGroup label="Energie" value={form.energy_level} max={10} onChange={(value) => setField('energy_level', value)} />
                </Grid>
                <Grid item xs={12}>
                  <ScoreButtonGroup label="Stress" value={form.stress_level} max={10} onChange={(value) => setField('stress_level', value)} />
                </Grid>
                <Grid item xs={12}>
                  <ScoreButtonGroup label="Pijn" value={form.pain_score} max={10} onChange={(value) => setField('pain_score', value)} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Pijnlocatie" value={form.pain_location} onChange={update('pain_location')} fullWidth placeholder="bijv. rug, hoofd" />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Water glazen" value={form.water_glasses} onChange={update('water_glasses')} type="number" inputProps={{ min: 0 }} fullWidth />
                </Grid>
                <Grid item xs={12}>
                  <TextField label="Symptomen" value={form.symptoms} onChange={update('symptoms')} fullWidth placeholder="bijv. hoofdpijn, moe" helperText="Scheid meerdere items met komma's." />
                </Grid>
                <Grid item xs={12}>
                  <TextField label="Medicatie" value={form.medications} onChange={update('medications')} fullWidth placeholder="bijv. paracetamol" helperText="Scheid meerdere items met komma's." />
                </Grid>
                <Grid item xs={12}>
                  <TextField label="Notities" value={form.notes} onChange={update('notes')} multiline minRows={4} fullWidth placeholder="Wat viel op vandaag?" />
                </Grid>
              </Grid>
              <LoadingButton type="submit" variant="contained" disabled={saving} loading={saving} loadingText="Opslaan..." size="large">
                {today ? 'Vandaag bijwerken' : 'Gezondheid opslaan'}
              </LoadingButton>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={7}>
          <Stack spacing={2}>
            <Paper sx={{ p: 2.5 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                <TrendingUpIcon color="primary" />
                <Box>
                  <Typography variant="h5">Trendbeeld</Typography>
                  <Typography variant="body2" color="text.secondary">Energie en stress over je laatste logs.</Typography>
                </Box>
              </Stack>
              <MiniTrend history={history} />
            </Paper>

            <PageSection title="Historie">
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Datum</TableCell>
                      <TableCell align="right">Score</TableCell>
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
                        <TableCell colSpan={7}>
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
                        <TableCell align="right">
                          <Chip size="small" label={healthScore(item) ?? '-'} color={(healthScore(item) ?? 0) >= 70 ? 'success' : 'default'} variant="outlined" />
                        </TableCell>
                        <TableCell align="right">{formatNumber(item.sleep_hours, 'u')}</TableCell>
                        <TableCell align="right">{item.energy_level ?? '-'}</TableCell>
                        <TableCell align="right">{item.stress_level ?? '-'}</TableCell>
                        <TableCell align="right">{item.pain_score ?? '-'}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                            {(item.symptoms ?? []).slice(0, 3).map((symptom) => (
                              <Chip key={symptom} size="small" label={symptom} variant="outlined" />
                            ))}
                            {item.notes && (
                              <Tooltip title={item.notes}>
                                <Chip size="small" label="notitie" color="primary" variant="outlined" />
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </PageSection>
          </Stack>
        </Grid>
      </Grid>

      <AppDetailDrawer
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        eyebrow="Gezondheidslog"
        title={selectedLog?.log_date ? formatDate(selectedLog.log_date) : 'Gezondheidslog'}
        subtitle={selectedLog?.notes || 'Dagelijkse signalen en gezondheidspatronen.'}
        status={selectedLog ? `Score ${healthScore(selectedLog) ?? '-'}/100` : undefined}
        fields={[
          { label: 'Slaap', value: formatNumber(selectedLog?.sleep_hours, 'u') },
          { label: 'Slaapkwaliteit', value: selectedLog?.sleep_quality ? `${selectedLog.sleep_quality}/5` : '-' },
          { label: 'Energie', value: selectedLog?.energy_level ? `${selectedLog.energy_level}/10` : '-' },
          { label: 'Stress', value: selectedLog?.stress_level ? `${selectedLog.stress_level}/10` : '-' },
          { label: 'Pijn', value: selectedLog?.pain_score != null ? `${selectedLog.pain_score}/10` : '-' },
          { label: 'Pijnlocatie', value: selectedLog?.pain_location || '-' },
          { label: 'Water', value: selectedLog?.water_glasses != null ? `${selectedLog.water_glasses} glazen` : '-' },
          { label: 'Symptomen', value: selectedLog?.symptoms?.length ? selectedLog.symptoms.join(', ') : '-' },
          { label: 'Medicatie', value: selectedLog?.medications?.length ? selectedLog.medications.join(', ') : '-' },
        ]}
        editableFields={selectedLog ? [
          { name: 'sleep_hours', label: 'Slaapuren', value: selectedLog.sleep_hours ?? '', type: 'number' },
          { name: 'sleep_quality', label: 'Slaapkwaliteit', value: selectedLog.sleep_quality ?? '', type: 'number' },
          { name: 'energy_level', label: 'Energie', value: selectedLog.energy_level ?? '', type: 'number' },
          { name: 'stress_level', label: 'Stress', value: selectedLog.stress_level ?? '', type: 'number' },
          { name: 'pain_score', label: 'Pijn', value: selectedLog.pain_score ?? '', type: 'number' },
          { name: 'pain_location', label: 'Pijnlocatie', value: selectedLog.pain_location ?? '', type: 'text' },
          { name: 'water_glasses', label: 'Water glazen', value: selectedLog.water_glasses ?? '', type: 'number' },
          { name: 'symptoms', label: 'Symptomen', value: selectedLog.symptoms?.join(', ') ?? '', type: 'text' },
          { name: 'medications', label: 'Medicatie', value: selectedLog.medications?.join(', ') ?? '', type: 'text' },
          { name: 'notes', label: 'Notities', value: selectedLog.notes ?? '', type: 'textarea' },
        ] : []}
        onSave={updateHealthLog}
        saving={savingLog}
      />
    </PageShell>
  )
}
