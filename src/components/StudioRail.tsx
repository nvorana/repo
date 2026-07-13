import { motion } from 'framer-motion'
import { Check, Moon } from 'lucide-react'
import { STUDIOS } from '../data'
import type { StudioId } from '../types'

/*
 * The journey — five rooms connected by a single thread.
 * Always visible, never loud.
 */
export default function StudioRail({
  studio,
  visited,
  onSelect,
  onFocusMode,
}: {
  studio: StudioId
  visited: Set<StudioId>
  onSelect: (id: StudioId) => void
  onFocusMode: () => void
}) {
  const currentIndex = STUDIOS.findIndex((s) => s.id === studio)

  return (
    <motion.nav
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-20 hidden w-60 shrink-0 flex-col justify-between py-4 pl-6 lg:flex"
    >
      <div className="glass flex flex-col gap-1 rounded-3xl p-3">
        {STUDIOS.map((s, i) => {
          const Icon = s.icon
          const isCurrent = s.id === studio
          const isDone = visited.has(s.id) && i < currentIndex
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={`group relative flex items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all duration-300 ${
                isCurrent ? 'bg-white/8' : 'hover:bg-white/4'
              }`}
            >
              {isCurrent && (
                <motion.span
                  layoutId="rail-glow"
                  className="absolute inset-0 rounded-2xl"
                  style={{ boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.1), inset 0 0 30px ${s.accentSoft}` }}
                  transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                />
              )}
              <span
                className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-all duration-300"
                style={{
                  borderColor: isCurrent ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.07)',
                  background: isCurrent ? s.accentSoft : 'rgba(255,255,255,0.03)',
                  color: isCurrent ? s.accent : isDone ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.35)',
                }}
              >
                {isDone && !isCurrent ? <Check size={15} strokeWidth={2.4} /> : <Icon size={16} strokeWidth={1.8} />}
              </span>
              <span className="relative min-w-0">
                <span
                  className={`block text-[13.5px] font-medium transition-colors duration-300 ${
                    isCurrent ? 'text-white/95' : isDone ? 'text-white/60' : 'text-white/45 group-hover:text-white/70'
                  }`}
                >
                  {s.name}
                </span>
                <span className="block truncate text-[11px] text-white/30">{s.room}</span>
              </span>
              <span className="relative ml-auto text-[10px] font-medium tracking-wider text-white/22">
                {String(i + 1).padStart(2, '0')}
              </span>
            </button>
          )
        })}
      </div>

      <div className="px-2">
        <button
          onClick={onFocusMode}
          className="flex w-full items-center gap-2.5 rounded-2xl border border-white/6 bg-white/3 px-4 py-3 text-[12.5px] text-white/40 transition-all duration-300 hover:border-white/12 hover:bg-white/6 hover:text-white/70"
        >
          <Moon size={14} strokeWidth={1.8} />
          Focus mode
          <kbd className="key ml-auto">⇧F</kbd>
        </button>
      </div>
    </motion.nav>
  )
}
