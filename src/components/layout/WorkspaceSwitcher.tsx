'use client'

import { useEffect, useState } from 'react'
import FormControl from '@mui/material/FormControl'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter'

type Workspace = {
  id: string
  label: string
  archived?: number | boolean
}

const DEFAULT_WORKSPACE = 'websup'
const FALLBACK_WORKSPACES: Workspace[] = [
  { id: 'websup', label: 'WebsUp.nl' },
  { id: 'bouma', label: 'Bouma' },
]

function storeWorkspace(workspace: string) {
  localStorage.setItem('app_workspace', workspace)
  document.cookie = `app_workspace=${workspace}; path=/; max-age=31536000; SameSite=Lax`
}

function readStoredWorkspace() {
  if (typeof document === 'undefined') return DEFAULT_WORKSPACE
  const cookieMatch = document.cookie.match(/(?:^|;\s*)app_workspace=([^;]+)/)
  return decodeURIComponent(cookieMatch?.[1] || localStorage.getItem('app_workspace') || DEFAULT_WORKSPACE)
}

export default function WorkspaceSwitcher() {
  const [workspace, setWorkspace] = useState(DEFAULT_WORKSPACE)
  const [workspaces, setWorkspaces] = useState<Workspace[]>(FALLBACK_WORKSPACES)

  useEffect(() => {
    const stored = readStoredWorkspace()
    setWorkspace(stored)
    storeWorkspace(stored)

    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 2500)

    fetch('/api/workspaces', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        const items = payload?.data?.workspaces
        if (!Array.isArray(items) || items.length === 0) return
        const active = payload?.data?.active || stored
        setWorkspaces(items)
        setWorkspace(active)
        storeWorkspace(active)
      })
      .catch(() => undefined)
      .finally(() => window.clearTimeout(timeout))

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [])

  function changeWorkspace(nextWorkspace: string) {
    setWorkspace(nextWorkspace)
    storeWorkspace(nextWorkspace)
    fetch('/api/workspaces', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: nextWorkspace, makeActive: true }),
    }).catch(() => undefined)
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
        <Select
          value={workspace}
          onChange={(event) => changeWorkspace(event.target.value)}
          sx={{ fontSize: 13, fontWeight: 750 }}
        >
          {workspaces.map((item) => (
            <MenuItem key={item.id} value={item.id}>
              {item.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  )
}
