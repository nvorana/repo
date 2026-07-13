import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

/* Floating glass panel — the basic surface of every room */
export function Panel({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`glass rounded-3xl ${className}`}
    >
      {children}
    </motion.section>
  )
}

export function PanelHeader({
  eyebrow,
  title,
  aside,
}: {
  eyebrow: string
  title: string
  aside?: ReactNode
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="serif-display mt-1.5 text-[22px] leading-snug text-white/92">{title}</h2>
      </div>
      {aside && <div className="shrink-0 pb-0.5">{aside}</div>}
    </div>
  )
}

/* Header for an entire room */
export function RoomHeader({
  room,
  title,
  accent,
}: {
  room: string
  title: string
  accent: string
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="mb-8"
    >
      <p className="eyebrow flex items-center gap-2">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: accent, boxShadow: `0 0 12px ${accent}` }}
        />
        {room}
      </p>
      <h1 className="serif-display mt-2 text-[34px] leading-tight text-white/95">{title}</h1>
    </motion.header>
  )
}

export function Chip({
  children,
  active = false,
  onClick,
}: {
  children: ReactNode
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-[13px] transition-all duration-300 ${
        active
          ? 'border-white/20 bg-white/12 text-white/95'
          : 'border-white/8 bg-white/4 text-white/55 hover:border-white/15 hover:bg-white/8 hover:text-white/85'
      }`}
    >
      {children}
    </button>
  )
}

/* Quiet primary action */
export function SoftButton({
  children,
  onClick,
  accent,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  accent?: string
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`group inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-5 py-2.5 text-[13.5px] font-medium text-white/85 transition-all duration-300 hover:border-white/20 hover:bg-white/10 hover:text-white ${className}`}
      style={accent ? { boxShadow: `inset 0 0 24px ${accent}` } : undefined}
    >
      {children}
    </button>
  )
}

/* Circular progress — used for launch readiness */
export function ProgressRing({
  value,
  size = 116,
  stroke = 5,
  accent,
  label,
}: {
  value: number
  size?: number
  stroke?: number
  accent: string
  label?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - value) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${accent})` }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-[22px] font-semibold tracking-tight text-white/95">{Math.round(value * 100)}%</p>
        {label && <p className="mt-0.5 text-[10.5px] uppercase tracking-[0.12em] text-white/40">{label}</p>}
      </div>
    </div>
  )
}

/* The companion's presence — a soft living orb */
export function Orb({ size = 26, quiet = false }: { size?: number; quiet?: boolean }) {
  return (
    <span
      className={quiet ? '' : 'animate-breathe'}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background:
          'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.92) 0%, rgba(205,204,250,0.9) 18%, rgba(123,121,238,0.95) 55%, rgba(76,74,184,0.9) 100%)',
        boxShadow: '0 0 18px rgba(123,121,238,0.45), 0 0 44px rgba(123,121,238,0.18)',
      }}
    />
  )
}
