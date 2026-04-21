'use client'

import Link from 'next/link'
import Fab from '@mui/material/Fab'
import Tooltip from '@mui/material/Tooltip'
import AddIcon from '@mui/icons-material/Add'

type FloatingActionButtonProps = {
  label: string
  href?: string
  onClick?: () => void
  icon?: React.ReactNode
}

export default function FloatingActionButton({ label, href, onClick, icon = <AddIcon /> }: FloatingActionButtonProps) {
  const content = (
    <Fab
      component={href ? Link : 'button'}
      href={href}
      onClick={onClick}
      color="primary"
      aria-label={label}
      sx={{
        position: 'fixed',
        right: { xs: 18, md: 28 },
        bottom: { xs: 'calc(82px + env(safe-area-inset-bottom))', md: 28 },
        zIndex: 1290,
        background: 'var(--brand-gradient-fallback)',
        backgroundImage: 'var(--brand-gradient)',
        color: 'common.white',
        boxShadow: '0 14px 34px rgba(95, 159, 161, 0.28)',
      }}
    >
      {icon}
    </Fab>
  )

  return <Tooltip title={label}>{content}</Tooltip>
}
