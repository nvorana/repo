import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { STUDIOS, studioById } from '../../data'
import type { StudioId } from '../../types'

/* The doorway at the end of each room. */
export default function NextRoom({
  current,
  onGo,
}: {
  current: StudioId
  onGo: (id: StudioId) => void
}) {
  const s = studioById(current)
  const next = STUDIOS[s.index + 1]
  if (!next) return null
  const NextIcon = next.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center justify-between rounded-3xl border border-white/6 bg-white/2 px-6 py-5"
    >
      <p className="text-[13.5px] text-white/40">
        When this room feels settled, the next one is ready for you.
      </p>
      <button
        onClick={() => onGo(next.id)}
        className="group flex shrink-0 items-center gap-3 rounded-full border border-white/12 bg-white/6 py-2.5 pr-4 pl-5 text-[13.5px] font-medium text-white/90 transition-all duration-300 hover:border-white/22 hover:bg-white/10"
        style={{ boxShadow: `inset 0 0 26px ${next.accentSoft}` }}
      >
        <NextIcon size={15} strokeWidth={1.9} style={{ color: next.accent }} />
        Continue to {next.name}
        <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-0.5" />
      </button>
    </motion.div>
  )
}
