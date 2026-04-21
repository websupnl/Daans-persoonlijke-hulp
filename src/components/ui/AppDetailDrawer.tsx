'use client'

import { type ChangeEvent, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import LoadingButton from '@/components/ui/LoadingButton'

export type DetailField = {
  label: string
  value?: React.ReactNode
}

export type DetailAction = {
  label: string
  href?: string
  onClick?: () => void
  variant?: 'text' | 'outlined' | 'contained'
  loading?: boolean
  disabled?: boolean
}

export type EditableDetailField = {
  name: string
  label: string
  value?: string | number | boolean | null
  type?: 'text' | 'textarea' | 'number' | 'date' | 'time' | 'select' | 'boolean'
  options?: Array<{ label: string; value: string | number | boolean }>
}

export type AppDetailDrawerProps = {
  open: boolean
  onClose: () => void
  eyebrow?: string
  title?: string
  subtitle?: string
  status?: string
  fields?: DetailField[]
  primaryHref?: string
  primaryLabel?: string
  actions?: DetailAction[]
  editableFields?: EditableDetailField[]
  onSave?: (values: Record<string, string | number | boolean | null>) => Promise<void> | void
  saveLabel?: string
  saving?: boolean
  defaultEditing?: boolean
  children?: React.ReactNode
}

export default function AppDetailDrawer({
  open,
  onClose,
  eyebrow,
  title,
  subtitle,
  status,
  fields = [],
  primaryHref,
  primaryLabel = 'Openen en bewerken',
  actions = [],
  editableFields = [],
  onSave,
  saveLabel = 'Opslaan',
  saving,
  defaultEditing = false,
  children,
}: AppDetailDrawerProps) {
  const [editing, setEditing] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, string | number | boolean | null>>({})
  const editableSnapshot = JSON.stringify(editableFields.map((field) => [field.name, field.value ?? '']))

  useEffect(() => {
    if (!open) return
    setSaveError(null)
    setValues(Object.fromEntries(editableFields.map((field) => [field.name, field.value ?? ''])))
    setEditing(defaultEditing && editableFields.length > 0)
    // Only reset form values when the drawer opens or the source values actually change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editableSnapshot, defaultEditing])

  async function handleSave() {
    setSaveError(null)
    try {
      await onSave?.(values)
      setEditing(false)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Opslaan is niet gelukt')
    }
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 460 },
          maxWidth: '100%',
          borderLeft: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.default',
        },
      }}
    >
      <Stack sx={{ height: '100%' }}>
        <Box
          sx={{
            p: 2.5,
            background: 'linear-gradient(90deg, rgba(168,206,207,0.24), rgba(230,174,140,0.18))',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" justifyContent="space-between" spacing={2}>
            <Box sx={{ minWidth: 0 }}>
              {eyebrow && (
                <Typography variant="overline" color="text.secondary">
                  {eyebrow}
                </Typography>
              )}
              <Typography variant="h3" sx={{ mt: 0.25 }} noWrap>
                {title || 'Details'}
              </Typography>
              {subtitle && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  {subtitle}
                </Typography>
              )}
            </Box>
            <IconButton aria-label="Sluit details" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Stack>
          {status && <Chip label={status} size="small" color="primary" sx={{ mt: 1.5 }} />}
        </Box>

        <Stack spacing={2} sx={{ p: 2.5, flex: 1, overflow: 'auto' }}>
          {editing && editableFields.length > 0 ? (
            <Stack
              component="form"
              spacing={1.5}
              onSubmit={(event) => {
                event.preventDefault()
                handleSave()
              }}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper',
                p: 2,
              }}
            >
              {saveError && <Alert severity="error">{saveError}</Alert>}
              {editableFields.map((field) => {
                const common = {
                  label: field.label,
                  value: values[field.name] ?? '',
                  fullWidth: true,
                  onChange: (event: ChangeEvent<HTMLInputElement>) => {
                    setValues((current) => ({ ...current, [field.name]: field.type === 'number' ? Number(event.target.value) : event.target.value }))
                  },
                }

                if (field.type === 'select') {
                  return (
                    <TextField key={field.name} select {...common}>
                      {(field.options ?? []).map((option) => (
                        <MenuItem key={String(option.value)} value={String(option.value)}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  )
                }

                return (
                  <TextField
                    key={field.name}
                    {...common}
                    type={field.type === 'date' || field.type === 'time' || field.type === 'number' ? field.type : 'text'}
                    multiline={field.type === 'textarea'}
                    minRows={field.type === 'textarea' ? 4 : undefined}
                  />
                )
              })}
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button type="button" variant="text" onClick={() => setEditing(false)} disabled={saving}>
                  Terug
                </Button>
                <LoadingButton type="submit" variant="contained" loading={saving} loadingText="Opslaan...">
                  {saveLabel}
                </LoadingButton>
              </Stack>
            </Stack>
          ) : fields.length > 0 && (
            <Stack
              divider={<Divider flexItem />}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 3,
                bgcolor: 'background.paper',
                overflow: 'hidden',
                boxShadow: '0 18px 52px -46px rgba(15,15,16,0.38)',
              }}
            >
              {fields.map((field) => (
                <Stack key={field.label} direction="row" spacing={2} justifyContent="space-between" sx={{ px: 2, py: 1.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 800 }}>
                    {field.label}
                  </Typography>
                  <Typography variant="body2" sx={{ textAlign: 'right', minWidth: 0 }}>
                    {field.value ?? '-'}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
          {children}
        </Stack>

        {(primaryHref || actions.length > 0 || editableFields.length > 0) && (
          <Stack direction="row" spacing={1} sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            {primaryHref && (
              <Button component="a" href={primaryHref} variant="contained" endIcon={<OpenInNewIcon />} fullWidth>
                {primaryLabel}
              </Button>
            )}
            {editableFields.length > 0 && !editing && (
              <Button variant="contained" onClick={() => setEditing(true)} fullWidth={!primaryHref}>
                Bewerken
              </Button>
            )}
            {actions.map((action) => action.href ? (
              <Button key={action.label} component="a" href={action.href} variant={action.variant ?? 'outlined'}>
                {action.label}
              </Button>
            ) : (
              <LoadingButton key={action.label} onClick={action.onClick} variant={action.variant ?? 'outlined'} loading={action.loading} disabled={action.disabled}>
                {action.label}
              </LoadingButton>
            ))}
          </Stack>
        )}
      </Stack>
    </Drawer>
  )
}
