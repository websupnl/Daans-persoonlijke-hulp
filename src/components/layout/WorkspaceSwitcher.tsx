'use client'

import { useEffect, useState } from 'react'
import FormControl from '@mui/material/FormControl'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter'
import { DEFAULT_WORKSPACE_ID, WORKSPACES, normalizeWorkspace } from '@/lib/workspace'

export default function WorkspaceSwitcher() {
  const [workspace, setWorkspace] = useState(DEFAULT_WORKSPACE_ID)

  useEffect(() => {
    const cookieMatch = document.cookie.match(/(?:^|;\s*)app_workspace=([^;]+)/)
    const rawStored = cookieMatch?.[1] || localStorage.getItem('app_workspace') || DEFAULT_WORKSPACE_ID
    const migratedDefault = localStorage.getItem('app_workspace_websup_default_migrated') === '1'
    const stored = rawStored === 'bouma' && !migratedDefault
      ? DEFAULT_WORKSPACE_ID
      : normalizeWorkspace(rawStored)
    setWorkspace(stored)
    localStorage.setItem('app_workspace_websup_default_migrated', '1')
    localStorage.setItem('app_workspace', stored)
    document.cookie = `app_workspace=${stored}; path=/; max-age=31536000; SameSite=Lax`
  }, [])

  function changeWorkspace(nextWorkspace: string) {
    setWorkspace(nextWorkspace)
    localStorage.setItem('app_workspace', nextWorkspace)
    document.cookie = `app_workspace=${nextWorkspace}; path=/; max-age=31536000; SameSite=Lax`
    window.location.reload()
  }

  return (
    <Stack spacing={0.75}>
      <Stack direction="row" spacing={0.75} alignItems="center">
        <BusinessCenterIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
        <Typography variant="caption" color="text.secondary" fontWeight={800}>
          Workspace
        </Typography>
      </Stack>
      <FormControl size="small" fullWidth>
        <Select value={workspace} onChange={(event) => changeWorkspace(event.target.value)} sx={{ fontSize: 13, fontWeight: 750 }}>
          {WORKSPACES.map((item) => (
            <MenuItem key={item.id} value={item.id}>
              {item.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  )
}
