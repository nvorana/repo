import { motion } from 'framer-motion'
import { Command } from 'lucide-react'
import { STUDIOS, studioById } from '../data'
import type { StudioId } from '../types'
import { Orb } from './ui'

export default function TopBar({
  spark,
  studio,
  focusMode,
  companionOpen,
  onOpenPalette,
  onToggleCompanion,
}: {
  spark: string
  studio: StudioId
  focusMode: boolean
  companionOpen: boolean
  onOpenPalette: () => void
  onToggleCompanion: () => void
}) {
  const current = studioById(studio)

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-20 flex h-16 shrink-0 items-center justify-between px-6"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-[12px] font-semibold tracking-[0.2em] text-white/70 uppercase">Atelier</span>
        <span className="text-white/20">/</span>
        <span className="truncate text-[13px] text-white/45 max-w-[320px]" title={spark}>
          {spark}
        </span>
      </div>

      {/* Journey dots — a quiet map of the five rooms */}
      {!focusMode && (
        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-2.5 md:flex">
          {STUDIOS.map((s) => (
            <span
              key={s.id}
              className="h-1.5 rounded-full transition-all duration-500"
              style={{
                width: s.id === studio ? 22 : 6,
                background: s.id === studio ? current.accent : 'rgba(255,255,255,0.16)',
                boxShadow: s.id === studio ? `0 0 10px ${current.accent}` : 'none',
              }}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpenPalette}
          className="flex items-center gap-2 rounded-full border border-white/8 bg-white/4 px-3.5 py-2 text-[12.5px] text-white/45 transition-all duration-300 hover:border-white/15 hover:bg-white/8 hover:text-white/75"
        >
          <Command size={13} />
          <span className="hidden sm:inline">Anywhere</span>
          <kbd className="key">⌘K</kbd>
        </button>

        <button
          onClick={onToggleCompanion}
          aria-label="Toggle companion"
          className={`grid h-9 w-9 place-items-center rounded-full border transition-all duration-300 ${
            companionOpen
              ? 'border-iris-500/40 bg-iris-500/12'
              : 'border-white/8 bg-white/4 hover:border-white/15 hover:bg-white/8'
          }`}
        >
          <Orb size={16} quiet={!companionOpen} />
        </button>
      </div>
    </motion.header>
  )
}
