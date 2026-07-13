import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { studioById, WRITING_THREADS } from '../../data'
import type { Module, StudioId } from '../../types'
import { Panel, RoomHeader } from '../ui'
import NextRoom from './NextRoom'

const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0)

export default function WritingStudio({
  modules,
  drafts,
  onDraft,
  onGo,
}: {
  modules: Module[]
  drafts: Record<string, string>
  onDraft: (moduleId: string, text: string) => void
  onGo: (id: StudioId) => void
}) {
  const s = studioById('writing')
  const [activeId, setActiveId] = useState(modules[0]?.id ?? '')
  const [thread, setThread] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const active = modules.find((m) => m.id === activeId) ?? modules[0]
  const draft = active ? (drafts[active.id] ?? '') : ''

  /* Muse offers a thread only when the pen has rested */
  useEffect(() => {
    if (!draft.trim() || words(draft) < 12) return
    const t = setTimeout(() => {
      setThread(WRITING_THREADS[words(draft) % WRITING_THREADS.length])
    }, 2000)
    return () => clearTimeout(t)
  }, [draft])

  const write = (text: string) => {
    if (active) onDraft(active.id, text)
    setThread(null)
  }

  const openChapter = (id: string) => {
    setActiveId(id)
    setThread(null)
  }

  /* The page grows with the writing */
  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${Math.max(280, el.scrollHeight)}px`
    }
  }, [draft, activeId])

  const acceptThread = () => {
    if (!thread || !active) return
    const lead = draft.endsWith('\n') || draft === '' ? '' : '\n\n'
    onDraft(active.id, `${draft}${lead}`)
    setThread(null)
    textareaRef.current?.focus()
  }

  if (!active) {
    return (
      <div className="space-y-6">
        <RoomHeader room={s.room} title={s.tagline} accent={s.accent} />
        <Panel className="p-10 text-center">
          <p className="text-[14px] text-white/50">
            The desk is empty — sketch some chapters at the Drafting Table first.
          </p>
        </Panel>
        <NextRoom current="writing" onGo={onGo} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <RoomHeader room={s.room} title={s.tagline} accent={s.accent} />

      <Panel className="overflow-hidden">
        <div className="grid md:grid-cols-[230px_1fr]">
          {/* Chapter rail */}
          <div className="border-b border-white/6 p-4 md:border-r md:border-b-0">
            <p className="eyebrow px-3 pt-2 pb-3">Chapters</p>
            <div className="space-y-1">
              {modules.map((m, i) => {
                const count = words(drafts[m.id] ?? '')
                const isActive = m.id === active.id
                return (
                  <button
                    key={m.id}
                    onClick={() => openChapter(m.id)}
                    className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors duration-300 ${
                      isActive ? 'bg-white/7' : 'hover:bg-white/3'
                    }`}
                  >
                    <span className={`block truncate text-[13px] ${isActive ? 'text-white/90' : 'text-white/50'}`}>
                      {String(i + 1).padStart(2, '0')} · {m.title}
                    </span>
                    <span className="block text-[11px] text-white/28">
                      {count > 0 ? `${count} words` : 'untouched'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* The page */}
          <div className="px-8 py-10 md:px-14">
            <div className="mx-auto max-w-xl">
              <p className="eyebrow" style={{ color: s.accent }}>
                Chapter {String(modules.indexOf(active) + 1).padStart(2, '0')}
              </p>
              <h2 className="serif-display mt-2 text-[28px] leading-snug text-white/95">{active.title}</h2>
              <p className="mt-1.5 text-[13px] text-white/38">{active.summary}</p>

              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => write(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Tab' && thread) {
                    e.preventDefault()
                    acceptThread()
                  }
                }}
                placeholder="Begin anywhere but the beginning…"
                className="serif-display mt-8 w-full resize-none bg-transparent text-[18.5px] leading-[1.75] font-normal text-white/85 outline-none placeholder:italic"
                style={{ minHeight: 280 }}
              />

              {/* A thread to pull — offered, dismissible, never blocking */}
              <AnimatePresence>
                {thread && (
                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.5 }}
                    onClick={acceptThread}
                    className="mt-2 flex w-full items-start gap-3 rounded-2xl border border-white/6 bg-white/2 p-4 text-left transition-colors duration-300 hover:border-white/12 hover:bg-white/4"
                  >
                    <span className="mt-0.5 shrink-0" style={{ color: s.accent }}>
                      ✦
                    </span>
                    <span className="serif-display text-[14.5px] leading-relaxed text-white/50 italic">
                      {thread}
                    </span>
                    <kbd className="key mt-0.5 ml-auto shrink-0">⇥</kbd>
                  </motion.button>
                )}
              </AnimatePresence>

              <div className="mt-8 flex items-center justify-between border-t border-white/6 pt-5 text-[12px] text-white/30">
                <span>
                  {words(draft)} words
                  {words(draft) > 0 && ' · saved as you write'}
                </span>
                <span className="italic">write badly, then write truly</span>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <NextRoom current="writing" onGo={onGo} />
    </div>
  )
}
