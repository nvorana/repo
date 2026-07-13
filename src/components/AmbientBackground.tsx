import { AnimatePresence, motion } from 'framer-motion'
import { studioById } from '../data'
import type { StudioId } from '../types'

/*
 * The room's lighting. Each studio casts its own soft glow;
 * moving between studios crossfades the light like walking
 * from one room into another.
 */
export default function AmbientBackground({ studio }: { studio: StudioId | null }) {
  const s = studio ? studioById(studio) : null
  const glowA = s?.glowA ?? 'rgba(123, 121, 238, 0.10)'
  const glowB = s?.glowB ?? 'rgba(224, 177, 130, 0.07)'

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-ink-900">
      {/* A faint skylight from above */}
      <div
        className="absolute inset-x-0 top-0 h-[42vh]"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.045), transparent)' }}
      />

      <AnimatePresence>
        <motion.div
          key={studio ?? 'welcome'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.6, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          <div
            className="absolute -top-[28vh] left-[8vw] h-[80vh] w-[64vw] rounded-full blur-3xl"
            style={{ background: `radial-gradient(closest-side, ${glowA}, transparent 70%)` }}
          />
          <div
            className="absolute -bottom-[30vh] right-[2vw] h-[85vh] w-[58vw] rounded-full blur-3xl"
            style={{ background: `radial-gradient(closest-side, ${glowB}, transparent 70%)` }}
          />
        </motion.div>
      </AnimatePresence>

      {/* Vignette keeps the eye in the middle of the room */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 90% at 50% 42%, transparent 55%, rgba(5,6,8,0.55) 100%)' }}
      />

      <div className="grain" />
    </div>
  )
}
