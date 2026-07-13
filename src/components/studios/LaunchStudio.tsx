import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Copy } from 'lucide-react'
import { ANNOUNCEMENT, studioById } from '../../data'
import type { LaunchItem } from '../../data'
import { Orb, Panel, PanelHeader, ProgressRing, RoomHeader } from '../ui'

const GROUPS: LaunchItem['group'][] = ['Story', 'Page', 'People']

export default function LaunchStudio({
  items,
  onToggle,
}: {
  items: LaunchItem[]
  onToggle: (id: string) => void
}) {
  const s = studioById('launch')
  const [copied, setCopied] = useState(false)
  const done = items.filter((i) => i.done).length
  const readiness = items.length ? done / items.length : 0
  const ready = readiness === 1

  const copyAnnouncement = async () => {
    try {
      await navigator.clipboard.writeText(ANNOUNCEMENT)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable — nothing to do */
    }
  }

  return (
    <div className="space-y-6">
      <RoomHeader room={s.room} title={s.tagline} accent={s.accent} />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Readiness */}
        <Panel className="flex flex-col items-center justify-center p-8 text-center">
          <ProgressRing value={readiness} accent={s.accent} label="ready" />
          <p className="mt-6 text-[13.5px] leading-relaxed text-white/50">
            {ready
              ? 'Everything is in place. The only step left is the brave one.'
              : `${items.length - done} small moves left. Each one takes minutes, not days.`}
          </p>
          {ready && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="mt-6 w-full rounded-2xl border px-5 py-4"
              style={{ borderColor: 'rgba(255,255,255,0.12)', background: s.accentSoft }}
            >
              <p className="serif-display text-[16px] text-white/95 italic">The doors are open.</p>
              <p className="mt-1 text-[12px] text-white/50">First products are acts of courage.</p>
            </motion.div>
          )}
        </Panel>

        {/* The moves */}
        <Panel className="p-8" delay={0.1}>
          <PanelHeader
            eyebrow="Launch, in small moves"
            title="Nothing here takes a whole day"
            aside={
              <span className="text-[11.5px] text-white/30">
                {done} of {items.length} done
              </span>
            }
          />
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {GROUPS.map((g) => (
              <div key={g}>
                <p className="eyebrow mb-3">{g}</p>
                <div className="space-y-1">
                  {items
                    .filter((i) => i.group === g)
                    .map((i) => (
                      <button
                        key={i.id}
                        onClick={() => onToggle(i.id)}
                        className="group flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors duration-300 hover:bg-white/3"
                      >
                        <span
                          className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-all duration-300"
                          style={{
                            borderColor: i.done ? s.accent : 'rgba(255,255,255,0.18)',
                            background: i.done ? s.accentSoft : 'transparent',
                            color: s.accent,
                          }}
                        >
                          {i.done && <Check size={11} strokeWidth={2.6} />}
                        </span>
                        <span
                          className={`text-[13px] leading-snug transition-colors duration-300 ${
                            i.done ? 'text-white/38 line-through decoration-white/20' : 'text-white/70'
                          }`}
                        >
                          {i.label}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* The announcement, already written */}
      <Panel className="p-8" delay={0.18}>
        <PanelHeader
          eyebrow="Day one, drafted"
          title="Your announcement — in your voice, ready when you are"
          aside={
            <button
              onClick={copyAnnouncement}
              className="flex items-center gap-2 rounded-full border border-white/8 bg-white/4 px-3.5 py-2 text-[12px] text-white/50 transition-all duration-300 hover:border-white/15 hover:text-white/80"
            >
              {copied ? <Check size={12.5} style={{ color: s.accent }} /> : <Copy size={12.5} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          }
        />
        <div className="mt-6 flex gap-4 rounded-2xl border border-white/6 bg-white/2 p-6 md:p-8">
          <div className="mt-1 hidden shrink-0 sm:block">
            <Orb size={18} quiet />
          </div>
          <p className="serif-display text-[16.5px] leading-[1.8] whitespace-pre-line text-white/80">
            {ANNOUNCEMENT}
          </p>
        </div>
        <p className="mt-4 text-[12px] text-white/30">
          Drafted by Muse from your one-liner and blueprint — edit freely; the best line will be the one you add.
        </p>
      </Panel>
    </div>
  )
}
