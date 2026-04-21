'use client'

import { useEffect, useState } from 'react'
import FormControl from '@mui/material/FormControl'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter'
import { Spinner } from '@/components/ui/spinner'

type Workspace = {
  id: string
  label: string
  archived?: number | boolean
}

const DEFAULT_WORKSPACE = 'websup'

function storeWorkspace(workspace: string) {
  localStorage.setItem('app_workspace', workspace)
  document.cookie = `app_workspace=${workspace}; path=/; max-age=31536000; SameSite=Lax`
}

export default function WorkspaceSwitcher() {
  const [workspace, setWorkspace] = useState(DEFAULT_WORKSPACE)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadWorkspaces() {
      try {
        const response = await fetch('/api/workspaces')
        const payload = await response.json()
        if (cancelled) return

        const items = payload.data?.workspaces || []
        const active = payload.data?.active || localStorage.getItem('app_workspace') || DEFAULT_WORKSPACE
        setWorkspaces(items)
        setWorkspace(active)
        storeWorkspace(active)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadWorkspaces()
    return () => {
      cancelled = true
    }
  }, [])

  async function changeWorkspace(nextWorkspace: string) {
    setWorkspace(nextWorkspace)
    storeWorkspace(nextWorkspace)
    await fetch('/api/workspaces', {
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
          disabled={loading}
          sx={{ fontSize: 13, fontWeight: 750 }}
        >
          {loading && (
            <MenuItem value={workspace}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Spinner className="h-3.5 w-3.5" />
                <span>Laden...</span>
              </Stack>
            </MenuItem>
          )}
          {!loading && workspaces.map((item) => (
            <MenuItem key={item.id} value={item.id}>
              {item.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  )
}
