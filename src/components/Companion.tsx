import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, X } from 'lucide-react'
import { COMPANION_FALLBACKS, studioById, uid } from '../data'
import type { ChatMessage, StudioId } from '../types'
import { Orb } from './ui'

/*
 * The companion — present in every room, intrusive in none.
 * Closed, it is a breathing orb in the corner. Open, it is a
 * quiet glass panel that knows which room you are standing in.
 */
export default function Companion({
  open,
  studio,
  onClose,
}: {
  open: boolean
  studio: StudioId
  onClose: () => void
}) {
  const s = studioById(studio)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking, open])

  const stream = (full: string) => {
    setThinking(true)
    const id = uid()
    const start = window.setTimeout(() => {
      setThinking(false)
      setMessages((m) => [...m, { id, role: 'companion', text: '', streaming: true }])
      let i = 0
      const tick = () => {
        i = Math.min(full.length, i + 3)
        const done = i >= full.length
        setMessages((m) =>
          m.map((msg) => (msg.id === id ? { ...msg, text: full.slice(0, i), streaming: !done } : msg)),
        )
        if (!done) timers.current.push(window.setTimeout(tick, 14))
      }
      tick()
    }, 750)
    timers.current.push(start)
  }

  const ask = (question: string, reply: string) => {
    setMessages((m) => [...m, { id: uid(), role: 'user', text: question }])
    stream(reply)
  }

  const send = () => {
    const q = input.trim()
    if (!q || thinking) return
    setInput('')
    ask(q, COMPANION_FALLBACKS[studio])
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ opacity: 0, x: 40, filter: 'blur(6px)' }}
          animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, x: 40, filter: 'blur(6px)' }}
          transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          className="relative z-20 mr-6 mb-6 hidden w-[350px] shrink-0 md:flex"
        >
          <div className="glass-deep flex w-full flex-col rounded-3xl">
            {/* Presence */}
            <div className="flex items-center gap-3 border-b border-white/6 px-5 py-4">
              <Orb size={22} />
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium text-white/90">Muse</p>
                <p className="truncate text-[11.5px] text-white/35">
                  {thinking ? 'thinking…' : `with you in ${s.room.toLowerCase()}`}
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close companion"
                className="ml-auto grid h-7 w-7 place-items-center rounded-full text-white/35 transition-colors hover:bg-white/6 hover:text-white/70"
              >
                <X size={14} />
              </button>
            </div>

            {/* Thread */}
            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {/* A quiet, room-specific note — context, not chatter */}
              <motion.div
                key={studio}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="rounded-2xl border border-white/6 bg-white/3 p-4"
              >
                <p className="eyebrow" style={{ color: s.accent }}>
                  {s.room}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-white/60">{s.companionNote}</p>
              </motion.div>

              {messages.map((m) =>
                m.role === 'user' ? (
                  <div key={m.id} className="flex justify-end">
                    <p className="max-w-[85%] rounded-2xl rounded-br-md bg-iris-500/18 px-4 py-2.5 text-[13.5px] leading-relaxed text-white/90">
                      {m.text}
                    </p>
                  </div>
                ) : (
                  <div key={m.id} className="flex gap-2.5">
                    <div className="mt-1 shrink-0">
                      <Orb size={14} quiet />
                    </div>
                    <p className="text-[13.5px] leading-relaxed text-white/75">
                      {m.text}
                      {m.streaming && <span className="animate-blink text-iris-300">▎</span>}
                    </p>
                  </div>
                ),
              )}

              {thinking && (
                <div className="flex items-center gap-2.5 pl-1">
                  <Orb size={14} />
                  <span className="text-[12.5px] text-white/35">gathering a thought…</span>
                </div>
              )}
            </div>

            {/* Suggestions — offered, never pushed */}
            <div className="space-y-1.5 px-5 pb-3">
              {s.suggestions.map((sg) => (
                <button
                  key={sg.id}
                  onClick={() => !thinking && ask(sg.label, sg.reply)}
                  className="block w-full rounded-xl border border-white/5 bg-white/2 px-3.5 py-2 text-left text-[12.5px] text-white/45 transition-all duration-300 hover:border-white/12 hover:bg-white/5 hover:text-white/80"
                >
                  {sg.label}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="border-t border-white/6 p-4">
              <div className="flex items-center gap-2 rounded-2xl border border-white/8 bg-white/4 p-1.5 pl-4 transition-colors focus-within:border-white/16">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                  placeholder="Ask anything…"
                  className="h-9 flex-1 bg-transparent text-[13.5px] text-white/90 outline-none"
                />
                <button
                  onClick={send}
                  aria-label="Send"
                  className={`grid h-9 w-9 place-items-center rounded-xl transition-all duration-300 ${
                    input.trim()
                      ? 'bg-iris-500 text-white shadow-[0_0_18px_rgba(123,121,238,0.4)]'
                      : 'bg-white/5 text-white/25'
                  }`}
                >
                  <ArrowUp size={15} strokeWidth={2.2} />
                </button>
              </div>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
