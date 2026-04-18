/**
 * MiniChart — pure SVG visualizations without external dependencies.
 * Components: Sparkline, BarChart, DonutRing, HeatRow, ProgressArc
 */

'use client'

import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Sparkline — tiny line chart
// ─────────────────────────────────────────────────────────────────────────────

export function Sparkline({
  data,
  width = 80,
  height = 28,
  color = '#ec4899',
  fill = true,
  className,
}: {
  data: number[]
  width?: number
  height?: number
  color?: string
  fill?: boolean
  className?: string
}) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * height * 0.85 - height * 0.05
    return [x, y] as [number, number]
  })

  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')
  const area = `${line} L ${pts[pts.length - 1][0]} ${height} L 0 ${height} Z`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('overflow-visible', className)}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`spark-fill-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {fill && (
        <path
          d={area}
          fill={`url(#spark-fill-${color.replace('#', '')})`}
        />
      )}
      <path
        d={line}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      <circle
        cx={pts[pts.length - 1][0]}
        cy={pts[pts.length - 1][1]}
        r={2.5}
        fill={color}
      />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MiniBarChart — small bar chart
// ─────────────────────────────────────────────────────────────────────────────

export function MiniBarChart({
  data,
  labels,
  width = 120,
  height = 36,
  barColor = '#ec4899',
  activeIndex,
  className,
}: {
  data: number[]
  labels?: string[]
  width?: number
  height?: number
  barColor?: string
  activeIndex?: number
  className?: string
}) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data) || 1
  const barW = (width / data.length) * 0.6
  const gap   = (width / data.length) * 0.4

  return (
    <svg
      width={width}
      height={height + (labels ? 14 : 0)}
      viewBox={`0 0 ${width} ${height + (labels ? 14 : 0)}`}
      className={cn('overflow-visible', className)}
    >
      {data.map((v, i) => {
        const barH  = Math.max(2, (v / max) * (height - 4))
        const x     = i * (width / data.length) + gap / 2
        const y     = height - barH
        const active = i === activeIndex
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={2}
              fill={active ? barColor : `${barColor}55`}
            />
            {labels?.[i] && (
              <text
                x={x + barW / 2}
                y={height + 11}
                textAnchor="middle"
                fontSize={7}
                fill="#5b605f"
                fontFamily="Inter, sans-serif"
              >
                {labels[i]}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DonutRing — circular progress ring
// ─────────────────────────────────────────────────────────────────────────────

export function DonutRing({
  value,
  max = 100,
  size = 48,
  strokeWidth = 5,
  color = '#ec4899',
  bg = '#eceeed',
  label,
  className,
}: {
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  color?: string
  bg?: string
  label?: string
  className?: string
}) {
  const r       = (size - strokeWidth) / 2
  const circ    = 2 * Math.PI * r
  const pct     = Math.min(1, Math.max(0, value / max))
  const dash    = circ * pct
  const gap     = circ - dash

  return (
    <div className={cn('relative flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} stroke={bg} strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size/2} cy={size/2} r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${dash} ${gap}`}
          strokeLinecap="round"
        />
      </svg>
      {label && (
        <span className="absolute text-[10px] font-bold font-headline text-on-surface">
          {label}
        </span>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HeatRow — weekly activity dots (like GitHub heatmap, single row)
// ─────────────────────────────────────────────────────────────────────────────

export function HeatRow({
  data,
  days = ['M', 'D', 'W', 'D', 'V', 'Z', 'Z'],
  color = '#ec4899',
  className,
}: {
  data: number[]  // 0-1 intensity per day
  days?: string[]
  color?: string
  className?: string
}) {
  return (
    <div className={cn('flex items-end gap-1', className)}>
      {days.map((d, i) => {
        const intensity = data[i] ?? 0
        return (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <div
              className="w-4 h-4 rounded-[4px]"
              style={{
                backgroundColor: intensity > 0 ? color : '#eceeed',
                opacity: intensity > 0 ? 0.3 + intensity * 0.7 : 1,
              }}
              title={`${d}: ${Math.round(intensity * 100)}%`}
            />
            <span className="text-[8px] text-on-surface-variant">{d}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TrendBadge — inline delta indicator
// ─────────────────────────────────────────────────────────────────────────────

export function TrendBadge({ delta, suffix = '%' }: { delta: number; suffix?: string }) {
  const up = delta >= 0
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-lg',
      up ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
    )}>
      {up ? '↑' : '↓'} {Math.abs(delta)}{suffix}
    </span>
  )
}
