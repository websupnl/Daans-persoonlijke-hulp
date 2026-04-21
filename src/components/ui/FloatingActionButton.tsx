'use client'

import type { MouseEvent, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Fab from '@mui/material/Fab'
import Tooltip from '@mui/material/Tooltip'
import AddIcon from '@mui/icons-material/Add'

type FloatingActionButtonProps = {
  label: string
  shortLabel?: string
  href?: string
  onClick?: () => void
  icon?: ReactNode
}

export default function FloatingActionButton({ label, shortLabel = 'Voeg toe', href, onClick, icon = <AddIcon /> }: FloatingActionButtonProps) {
  const router = useRouter()
  const content = (
    <Fab
      variant="extended"
      component={href ? 'a' : 'button'}
      href={href}
      onClick={(event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
        onClick?.()
        if (!href || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        router.push(href)
      }}
      color="primary"
      aria-label={label}
      sx={{
        position: 'fixed',
        right: { xs: 18, md: 28 },
        bottom: { xs: 'calc(82px + env(safe-area-inset-bottom))', md: 28 },
        zIndex: 1290,
        gap: 1,
        px: 2.25,
        minWidth: 0,
        fontWeight: 850,
        background: 'var(--brand-gradient-fallback)',
        backgroundImage: 'var(--brand-gradient)',
        color: 'common.white',
        boxShadow: '0 14px 34px rgba(95, 159, 161, 0.28)',
        '&:hover': {
          backgroundImage: 'var(--brand-gradient)',
          filter: 'saturate(1.05) brightness(0.98)',
        },
      }}
    >
      {icon}
      <span>{shortLabel}</span>
    </Fab>
  )

  return <Tooltip title={label}>{content}</Tooltip>
}
