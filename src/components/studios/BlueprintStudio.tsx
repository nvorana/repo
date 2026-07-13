import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'
import { FORMATS, PRICES, SIZES, studioById, uid } from '../../data'
import type { Module, StudioId } from '../../types'
import { Chip, Panel, PanelHeader, RoomHeader } from '../ui'
import NextRoom from './NextRoom'

export interface Scope {
  format: string
  size: string
  price: string
}

export default function BlueprintStudio({
  modules,
  onModules,
  scope,
  onScope,
  onGo,
}: {
  modules: Module[]
  onModules: (m: Module[]) => void
  scope: Scope
  onScope: (s: Scope) => void
  onGo: (id: StudioId) => void
}) {
  const s = studioById('blueprint')
  const [draft, setDraft] = useState('')

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= modules.length) return
    const next = [...modules]
    ;[next[i], next[j]] = [next[j], next[i]]
    onModules(next)
  }

  const remove = (id: string) => onModules(modules.filter((m) => m.id !== id))

  const add = () => {
    const title = draft.trim()
    if (!title) return
    onModules([...modules, { id: uid(), title, summary: 'A chapter of your own — give it a promise in the Writing room.' }])
    setDraft('')
  }

  return (
    <div className="space-y-6">
      <RoomHeader room={s.room} title={s.tagline} accent={s.accent} />

      {/* The arc */}
      <Panel className="p-8">
        <PanelHeader
          eyebrow="The arc"
          title="Chapters, in the reader's order"
          aside={<span className="text-[11.5px] text-white/30">{modules.length} chapters · cut without guilt</span>}
        />
        <div className="mt-6 space-y-2.5">
          <AnimatePresence initial={false}>
            {modules.map((m, i) => (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="glass-soft group flex items-center gap-4 rounded-2xl p-4 pl-5"
              >
                <span className="serif-display w-7 shrink-0 text-[17px]" style={{ color: s.accent }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-medium text-white/90">{m.title}</p>
                  <p className="truncate text-[12.5px] text-white/40">{m.summary}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <button
                    onClick={() => move(i, -1)}
                    aria-label="Move up"
                    className="grid h-7 w-7 place-items-center rounded-lg text-white/40 hover:bg-white/6 hover:text-white/80"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    aria-label="Move down"
                    className="grid h-7 w-7 place-items-center rounded-lg text-white/40 hover:bg-white/6 hover:text-white/80"
                  >
                    <ArrowDown size={13} />
                  </button>
                  <button
                    onClick={() => remove(m.id)}
                    aria-label="Remove chapter"
                    className="grid h-7 w-7 place-items-center rounded-lg text-white/40 hover:bg-white/6 hover:text-red-300/80"
                  >
                    <X size={13} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-white/10 p-2 pl-5">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="A chapter you know belongs here…"
              className="h-10 flex-1 bg-transparent text-[13.5px] text-white/85 outline-none"
            />
            <button
              onClick={add}
              aria-label="Add chapter"
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/8 bg-white/4 text-white/50 transition-all duration-300 hover:border-white/16 hover:text-white/90"
            >
              <Plus size={15} />
            </button>
          </div>
        </div>
      </Panel>

      {/* Scope decisions */}
      <Panel className="p-8" delay={0.12}>
        <PanelHeader eyebrow="Scope" title="Three decisions that make it finishable" />
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {(
            [
              ['Form it takes', FORMATS, scope.format, (v: string) => onScope({ ...scope, format: v })],
              ['Time it asks for', SIZES, scope.size, (v: string) => onScope({ ...scope, size: v })],
              ['Price it earns', PRICES, scope.price, (v: string) => onScope({ ...scope, price: v })],
            ] as const
          ).map(([label, options, value, set]) => (
            <div key={label}>
              <p className="eyebrow mb-3">{label}</p>
              <div className="flex flex-wrap gap-2">
                {options.map((o) => (
                  <Chip key={o} active={value === o} onClick={() => set(o)}>
                    {o}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-7 rounded-2xl border border-white/6 bg-white/2 px-5 py-4 text-[13px] leading-relaxed text-white/50">
          Taking shape: <span className="text-white/85">a {scope.size.toLowerCase()}</span> in the form of{' '}
          <span className="text-white/85">a {scope.format.toLowerCase()}</span>, priced at{' '}
          <span style={{ color: s.accent }}>{scope.price}</span> — small enough to finish, honest enough to charge for.
        </p>
      </Panel>

      {/* The promise arc */}
      <Panel className="p-8" delay={0.2}>
        <PanelHeader eyebrow="The promise" title="Before and after, in one glance" />
        <div className="mt-6 grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
          <div className="glass-soft rounded-2xl p-6">
            <p className="eyebrow mb-2">Where they start</p>
            <p className="serif-display text-[17px] leading-relaxed text-white/70 italic">
              “I have the skill and the idea — but no sequence, and no proof anyone would pay.”
            </p>
          </div>
          <div className="hidden text-white/25 md:block">
            <svg width="46" height="12" viewBox="0 0 46 12" fill="none">
              <path d="M0 6h42m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </div>
          <div
            className="rounded-2xl border p-6"
            style={{ borderColor: 'rgba(255,255,255,0.1)', background: s.accentSoft }}
          >
            <p className="eyebrow mb-2" style={{ color: s.accent }}>
              Where they arrive
            </p>
            <p className="serif-display text-[17px] leading-relaxed text-white/90 italic">
              “I shipped a finished product, priced with a straight face, into the hands of real buyers.”
            </p>
          </div>
        </div>
      </Panel>

      <NextRoom current="blueprint" onGo={onGo} />
    </div>
  )
}
