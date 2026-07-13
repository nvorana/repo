import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { IDEA_ANGLES, studioById } from '../../data'
import type { StudioId } from '../../types'
import { Chip, Panel, PanelHeader, RoomHeader } from '../ui'
import NextRoom from './NextRoom'

const CLARITY_CHECKS = [
  'Names one specific person',
  'Names a real struggle',
  'Promises a visible outcome',
  'Only you could have written it',
]

export default function IdeaStudio({
  oneLiner,
  onOneLiner,
  onGo,
}: {
  oneLiner: string
  onOneLiner: (v: string) => void
  onGo: (id: StudioId) => void
}) {
  const s = studioById('idea')
  const [angleSet, setAngleSet] = useState(0)
  const [checks, setChecks] = useState<Set<string>>(new Set())

  const toggleCheck = (c: string) =>
    setChecks((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })

  return (
    <div className="space-y-6">
      <RoomHeader room={s.room} title={s.tagline} accent={s.accent} />

      {/* The one-liner — the idea, said out loud */}
      <Panel className="p-8">
        <PanelHeader
          eyebrow="Your one-liner"
          title="Say it in a single breath"
          aside={<span className="text-[11.5px] text-white/30">{checks.size}/4 clarity marks</span>}
        />
        <textarea
          value={oneLiner}
          onChange={(e) => onOneLiner(e.target.value)}
          rows={2}
          placeholder="I help [someone specific] go from [a felt struggle] to [a real outcome]…"
          className="serif-display mt-6 w-full resize-none bg-transparent text-[26px] leading-snug text-white/92 outline-none placeholder:text-white/20"
        />
        <div className="mt-6 border-t border-white/6 pt-5">
          <p className="mb-3 text-[12px] text-white/35">
            Read it back slowly, then mark what is honestly true of it:
          </p>
          <div className="flex flex-wrap gap-2">
            {CLARITY_CHECKS.map((c) => (
              <Chip key={c} active={checks.has(c)} onClick={() => toggleCheck(c)}>
                {c}
              </Chip>
            ))}
          </div>
        </div>
      </Panel>

      {/* Angles the companion offers */}
      <Panel className="p-8" delay={0.12}>
        <PanelHeader
          eyebrow="From Muse"
          title="Three ways to sharpen it"
          aside={
            <button
              onClick={() => setAngleSet((n) => (n + 1) % IDEA_ANGLES.length)}
              className="flex items-center gap-2 rounded-full border border-white/8 bg-white/4 px-3.5 py-2 text-[12px] text-white/50 transition-all duration-300 hover:border-white/15 hover:text-white/80"
            >
              <RefreshCw size={12.5} />
              Another view
            </button>
          }
        />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {IDEA_ANGLES[angleSet].map((a, i) => (
              <motion.div
                key={`${angleSet}-${a.title}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.45, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="glass-soft rounded-2xl p-5"
              >
                <p className="text-[13.5px] font-medium" style={{ color: s.accent }}>
                  {a.title}
                </p>
                <p className="mt-2.5 text-[13px] leading-relaxed text-white/55">{a.body}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </Panel>

      <NextRoom current="idea" onGo={onGo} />
    </div>
  )
}
