import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Moon, Search, Sparkle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { STUDIOS } from '../data'
import type { StudioId } from '../types'

interface Command {
  id: string
  label: string
  hint: string
  icon: LucideIcon
  run: () => void
}

export default function CommandPalette({
  open,
  onClose,
  onGo,
  onToggleCompanion,
  onFocusMode,
}: {
  open: boolean
  onClose: () => void
  onGo: (id: StudioId) => void
  onToggleCompanion: () => void
  onFocusMode: () => void
}) {
  return (
    <AnimatePresence>
      {open && (
        <Palette
          onClose={onClose}
          onGo={onGo}
          onToggleCompanion={onToggleCompanion}
          onFocusMode={onFocusMode}
        />
      )}
    </AnimatePresence>
  )
}

/* Mounted fresh each time the palette opens, so its state starts clean. */
function Palette({
  onClose,
  onGo,
  onToggleCompanion,
  onFocusMode,
}: {
  onClose: () => void
  onGo: (id: StudioId) => void
  onToggleCompanion: () => void
  onFocusMode: () => void
}) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)

  const commands = useMemo<Command[]>(
    () => [
      ...STUDIOS.map((s) => ({
        id: s.id,
        label: `Go to ${s.name}`,
        hint: s.room,
        icon: s.icon,
        run: () => onGo(s.id),
      })),
      { id: 'companion', label: 'Toggle companion', hint: 'Muse', icon: Sparkle, run: onToggleCompanion },
      { id: 'focus', label: 'Enter focus mode', hint: 'Hide everything but the work', icon: Moon, run: onFocusMode },
    ],
    [onGo, onToggleCompanion, onFocusMode],
  )

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => `${c.label} ${c.hint}`.toLowerCase().includes(q))
  }, [commands, query])

  const runAt = (i: number) => {
    const cmd = results[i]
    if (cmd) {
      onClose()
      cmd.run()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 bg-ink-950/55 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: -14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="glass-deep mx-auto mt-[16vh] w-full max-w-lg overflow-hidden rounded-3xl"
      >
        <div className="flex items-center gap-3 border-b border-white/6 px-5 py-4">
          <Search size={16} className="text-white/35" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setCursor(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setCursor((c) => Math.min(results.length - 1, c + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setCursor((c) => Math.max(0, c - 1))
              } else if (e.key === 'Enter') {
                runAt(cursor)
              } else if (e.key === 'Escape') {
                onClose()
              }
            }}
            placeholder="Where to?"
            className="flex-1 bg-transparent text-[15px] text-white/90 outline-none"
          />
          <kbd className="key">esc</kbd>
        </div>

        <div className="max-h-[320px] overflow-y-auto p-2">
          {results.length === 0 && (
            <p className="px-4 py-6 text-center text-[13px] text-white/30">Nothing matches — yet.</p>
          )}
          {results.map((c, i) => {
            const Icon = c.icon
            return (
              <button
                key={c.id}
                onClick={() => runAt(i)}
                onMouseEnter={() => setCursor(i)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-colors duration-150 ${
                  i === cursor ? 'bg-white/7' : ''
                }`}
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg border border-white/8 bg-white/4 text-white/55">
                  <Icon size={14} strokeWidth={1.8} />
                </span>
                <span className="text-[13.5px] text-white/85">{c.label}</span>
                <span className="ml-auto text-[11.5px] text-white/30">{c.hint}</span>
              </button>
            )
          })}
        </div>
      </motion.div>
    </motion.div>
  )
}
