import { ReactNode, ButtonHTMLAttributes, forwardRef } from 'react'
import Link from 'next/link'
import MuiButton from '@mui/material/Button'
import MuiIconButton from '@mui/material/IconButton'
import MuiChip from '@mui/material/Chip'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ai' | 'default' | 'destructive' | 'outline'
type Size = 'sm' | 'md' | 'lg' | 'default' | 'icon'

function mapVariant(variant: Variant): { variant: 'text' | 'outlined' | 'contained'; color: 'primary' | 'error' | 'inherit' | 'secondary' } {
  if (variant === 'danger' || variant === 'destructive') return { variant: 'contained', color: 'error' }
  if (variant === 'secondary' || variant === 'outline') return { variant: 'outlined', color: 'inherit' }
  if (variant === 'ghost') return { variant: 'text', color: 'inherit' }
  if (variant === 'ai') return { variant: 'contained', color: 'secondary' }
  return { variant: 'contained', color: 'primary' }
}

function mapSize(size: Size): 'small' | 'medium' | 'large' {
  if (size === 'sm') return 'small'
  if (size === 'lg') return 'large'
  return 'medium'
}

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  variant?: Variant
  size?: Size
  children?: ReactNode
  className?: string
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', size = 'default', className, children, disabled, ...props }, ref) => {
    const mapped = mapVariant(variant)
    return (
      <MuiButton
        ref={ref}
        disabled={disabled}
        variant={mapped.variant}
        color={mapped.color}
        size={mapSize(size)}
        className={className}
        sx={variant === 'ai' || variant === 'primary' || variant === 'default' ? {
          background: mapped.variant === 'contained' ? 'var(--brand-gradient-fallback)' : undefined,
          backgroundImage: mapped.variant === 'contained' ? 'var(--brand-gradient)' : undefined,
          color: mapped.variant === 'contained' ? 'common.white' : undefined,
          '&:hover': mapped.variant === 'contained'
            ? { backgroundImage: 'var(--brand-gradient)', filter: 'saturate(1.05) brightness(0.98)' }
            : undefined,
        } : undefined}
        {...props}
      >
        {variant === 'ai' && <AutoAwesomeIcon sx={{ mr: 1 }} fontSize="small" />}
        {children}
      </MuiButton>
    )
  }
)
Button.displayName = 'Button'

export function LinkButton({
  href,
  variant = 'default',
  size = 'default',
  className,
  children,
  iconRight,
}: {
  href: string
  variant?: Variant
  size?: Size
  className?: string
  children: ReactNode
  iconRight?: ReactNode
}) {
  const mapped = mapVariant(variant)
  return (
    <MuiButton
      component={Link}
      href={href}
      variant={mapped.variant}
      color={mapped.color}
      size={mapSize(size)}
      className={className}
      sx={variant === 'ai' || variant === 'primary' || variant === 'default' ? {
        background: mapped.variant === 'contained' ? 'var(--brand-gradient-fallback)' : undefined,
        backgroundImage: mapped.variant === 'contained' ? 'var(--brand-gradient)' : undefined,
        color: mapped.variant === 'contained' ? 'common.white' : undefined,
      } : undefined}
    >
      {variant === 'ai' && <AutoAwesomeIcon sx={{ mr: 1 }} fontSize="small" />}
      {children}
      {iconRight}
    </MuiButton>
  )
}

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  className,
  ...props
}: {
  icon: ReactNode
  label: string
  variant?: Variant
  className?: string
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'>) {
  const color = variant === 'danger' || variant === 'destructive' ? 'error' : variant === 'primary' || variant === 'default' ? 'primary' : 'default'
  return (
    <MuiIconButton aria-label={label} color={color as any} className={className} {...props}>
      {icon}
    </MuiIconButton>
  )
}

type ChipColor = 'default' | 'blue' | 'green' | 'amber' | 'red' | 'violet'

const chipColorMap: Record<ChipColor, any> = {
  default: 'default',
  blue: 'primary',
  green: 'success',
  amber: 'warning',
  red: 'error',
  violet: 'secondary',
}

export function Chip({ children, color = 'default', className }: { children: ReactNode; color?: ChipColor; className?: string }) {
  return <MuiChip className={className} size="small" color={chipColorMap[color]} label={children} variant={color === 'default' ? 'outlined' : 'filled'} />
}

export function AIChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <MuiChip
      className={className}
      size="small"
      icon={<AutoAwesomeIcon />}
      label={children}
      sx={{
        background: 'var(--brand-gradient-fallback)',
        backgroundImage: 'var(--brand-gradient)',
        color: 'common.white',
        '& .MuiChip-icon': { color: 'common.white' },
      }}
    />
  )
}
