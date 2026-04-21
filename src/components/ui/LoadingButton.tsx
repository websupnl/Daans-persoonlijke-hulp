'use client'

import Button, { ButtonProps } from '@mui/material/Button'
import { Spinner } from '@/components/ui/spinner'

type LoadingButtonProps = ButtonProps & {
  loading?: boolean
  loadingText?: string
}

export default function LoadingButton({
  loading,
  loadingText,
  disabled,
  startIcon,
  children,
  ...props
}: LoadingButtonProps) {
  return (
    <Button
      disabled={disabled || loading}
      startIcon={loading ? <Spinner className="h-3.5 w-3.5" /> : startIcon}
      aria-busy={loading ? 'true' : undefined}
      {...props}
    >
      {loading && loadingText ? loadingText : children}
    </Button>
  )
}
