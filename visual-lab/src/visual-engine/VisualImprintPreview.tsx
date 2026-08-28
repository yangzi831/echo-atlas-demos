import { useId, useMemo, type ReactNode } from 'react'
import { createVisualImprint, echoFormPath } from './imprint'
import { seededNoise } from './seed'
import type { VisualImprintPreviewProps } from './types'

const WIDTH = 640
const HEIGHT = 240
const INSET = 30

const position = (x: number, y: number) => ({
  x: INSET + x * (WIDTH - INSET * 2),
  y: HEIGHT / 2 + y * HEIGHT * 0.74,
})

export function VisualImprintPreview({
  memory,
  preset = 'trace',
  animated = false,
  className = '',
  title,
  onClick,
}: VisualImprintPreviewProps) {
  const form = useMemo(() => createVisualImprint(memory), [memory])
  const gradientId = `echo-${useId().replaceAll(':', '')}`
  const path = echoFormPath(form, WIDTH, HEIGHT, INSET)
  const rootClass = `visual-imprint-preview preset-${preset} ${animated ? 'is-animated' : 'is-static'} ${className}`.trim()

  let grammar: ReactNode
  if (preset === 'field') {
    grammar = (
      <g className="imprint-field">
        {Array.from({ length: 110 }, (_, index) => {
          const point = form.points[(index * 11 + form.seed) % form.points.length]
          const anchor = position(point.x, point.y)
          const radius = 7 + Math.abs(seededNoise(form.seed ^ 0x51, index)) * (26 + form.summary.high * 52)
          const angle = seededNoise(form.seed, index) * Math.PI
          return (
            <circle
              key={index}
              cx={anchor.x + Math.cos(angle) * radius}
              cy={anchor.y + Math.sin(angle) * radius * 0.5}
              r={0.55 + Math.abs(seededNoise(form.seed ^ 0x93, index)) * 1.5}
              fill={index % 8 === 0 ? form.palette[1] : form.palette[0]}
              opacity={0.16 + point.high * 0.32}
            />
          )
        })}
        <path d={path} fill="none" stroke={form.palette[2]} strokeOpacity="0.22" strokeWidth="1" />
      </g>
    )
  } else if (preset === 'archive') {
    grammar = (
      <g className="imprint-archive">
        {Array.from({ length: 9 }, (_, index) => (
          <path
            key={index}
            d={path}
            transform={`translate(0 ${(index - 4) * (8 + form.summary.low * 7)})`}
            fill="none"
            stroke={index === 4 ? form.palette[1] : form.palette[0]}
            strokeOpacity={index === 4 ? 0.7 : 0.08 + (1 - Math.abs(index - 4) / 5) * 0.14}
            strokeWidth={index === 4 ? 1.8 : 0.85}
          />
        ))}
      </g>
    )
  } else if (preset === 'growth') {
    grammar = (
      <g className="imprint-growth">
        <path d={path} fill="none" stroke={`url(#${gradientId})`} strokeWidth={1.6 + form.summary.rms * 2.6} />
        {form.points.map((point, index) => {
          if (point.branch < 0.36 || index < 3 || index > form.points.length - 4) return null
          const anchor = position(point.x, point.y)
          const side = seededNoise(form.seed ^ 0x7a, index) > 0 ? 1 : -1
          const length = 12 + point.branch * 42
          const endX = anchor.x + length
          const endY = anchor.y + side * length
          return (
            <g key={index}>
              <path d={`M${anchor.x},${anchor.y} Q${anchor.x + length * 0.5},${anchor.y + side * length * 0.2} ${endX},${endY}`} fill="none" stroke={form.palette[index % 3 === 0 ? 1 : 2]} strokeOpacity={0.24 + point.high * 0.5} strokeWidth={0.6 + point.rms * 1.5} />
              <circle cx={endX} cy={endY} r={0.8 + point.high * 1.6} fill={form.palette[1]} opacity={0.58} />
            </g>
          )
        })}
      </g>
    )
  } else {
    grammar = (
      <g className="imprint-trace">
        <path d={path} transform={`translate(0 ${9 + form.summary.high * 11})`} fill="none" stroke={form.palette[2]} strokeOpacity="0.13" strokeWidth="0.8" />
        <path d={path} transform={`translate(0 ${-7 - form.summary.high * 8})`} fill="none" stroke={form.palette[0]} strokeOpacity="0.11" strokeWidth="0.7" />
        <path d={path} fill="none" stroke={`url(#${gradientId})`} strokeWidth={1.5 + form.summary.rms * 3} />
        {form.points.map((point, index) => {
          if (point.onset < 0.22) return null
          const node = position(point.x, point.y)
          return <circle key={index} cx={node.x} cy={node.y} r={1.2 + point.onset * 3.2} fill={form.palette[1]} opacity={0.72} />
        })}
      </g>
    )
  }

  const svg = (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={title ?? `${memory.title ?? 'Sound memory'} visual imprint`}>
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1">
          <stop offset="0" stopColor={form.palette[0]} stopOpacity="0.24" />
          <stop offset="0.55" stopColor={form.palette[0]} stopOpacity="0.94" />
          <stop offset="1" stopColor={form.palette[1]} stopOpacity="0.52" />
        </linearGradient>
      </defs>
      <rect width={WIDTH} height={HEIGHT} fill="#08100f" />
      <path d="M28 120 H612" stroke="#d9eee5" strokeOpacity="0.045" />
      {grammar}
      {animated && <circle className="imprint-playhead" r="4" fill={form.palette[1]}><animateMotion dur={`${8 + (1 - form.summary.rhythmDensity) * 8}s`} repeatCount="indefinite" path={path} /></circle>}
    </svg>
  )

  if (onClick) return <button type="button" className={rootClass} onClick={onClick}>{svg}</button>
  return <div className={rootClass}>{svg}</div>
}
