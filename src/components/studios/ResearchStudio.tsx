import { Check } from 'lucide-react'
import { AUDIENCE_SIGNALS, LANDSCAPE, RESEARCH_QUESTIONS, studioById } from '../../data'
import type { StudioId } from '../../types'
import { Panel, PanelHeader, RoomHeader } from '../ui'
import NextRoom from './NextRoom'

export default function ResearchStudio({
  answered,
  onToggleQuestion,
  onGo,
}: {
  answered: string[]
  onToggleQuestion: (q: string) => void
  onGo: (id: StudioId) => void
}) {
  const s = studioById('research')

  return (
    <div className="space-y-6">
      <RoomHeader room={s.room} title={s.tagline} accent={s.accent} />

      {/* Who is out there */}
      <Panel className="p-8">
        <PanelHeader
          eyebrow="Audience signals"
          title="The people waiting for this"
          aside={<span className="text-[11.5px] text-white/30">early hypotheses — verify in conversation</span>}
        />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {AUDIENCE_SIGNALS.map((a) => (
            <div key={a.persona} className="glass-soft flex flex-col rounded-2xl p-5">
              <p className="text-[13.5px] font-medium text-white/90">{a.persona}</p>
              <p className="mt-2.5 flex-1 text-[13px] leading-relaxed text-white/55">{a.detail}</p>
              <p
                className="serif-display mt-4 border-t border-white/6 pt-4 text-[14px] italic leading-relaxed"
                style={{ color: s.accent }}
              >
                {a.quote}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      {/* What already exists */}
      <Panel className="p-8" delay={0.12}>
        <PanelHeader eyebrow="The landscape" title="What exists — and where the gap is" />
        <div className="mt-6 space-y-3">
          {LANDSCAPE.map((c) => (
            <div
              key={c.name}
              className="glass-soft grid gap-3 rounded-2xl p-5 md:grid-cols-[200px_1fr_1fr] md:gap-6"
            >
              <p className="text-[13.5px] font-medium text-white/90">{c.name}</p>
              <div>
                <p className="eyebrow mb-1.5">Their angle</p>
                <p className="text-[13px] leading-relaxed text-white/55">{c.angle}</p>
              </div>
              <div>
                <p className="eyebrow mb-1.5" style={{ color: s.accent }}>
                  Your opening
                </p>
                <p className="text-[13px] leading-relaxed text-white/70">{c.gap}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* What to verify */}
      <Panel className="p-8" delay={0.2}>
        <PanelHeader
          eyebrow="Questions worth answering"
          title="Beliefs to check before you build"
          aside={
            <span className="text-[11.5px] text-white/30">
              {answered.length} of {RESEARCH_QUESTIONS.length} answered
            </span>
          }
        />
        <div className="mt-6 space-y-1.5">
          {RESEARCH_QUESTIONS.map((q) => {
            const done = answered.includes(q)
            return (
              <button
                key={q}
                onClick={() => onToggleQuestion(q)}
                className="group flex w-full items-center gap-3.5 rounded-2xl px-4 py-3.5 text-left transition-colors duration-300 hover:bg-white/3"
              >
                <span
                  className="grid h-5.5 w-5.5 shrink-0 place-items-center rounded-full border transition-all duration-300"
                  style={{
                    borderColor: done ? s.accent : 'rgba(255,255,255,0.18)',
                    background: done ? s.accentSoft : 'transparent',
                    color: s.accent,
                  }}
                >
                  {done && <Check size={12} strokeWidth={2.6} />}
                </span>
                <span
                  className={`text-[14px] transition-colors duration-300 ${
                    done ? 'text-white/40 line-through decoration-white/20' : 'text-white/75'
                  }`}
                >
                  {q}
                </span>
              </button>
            )
          })}
        </div>
      </Panel>

      <NextRoom current="research" onGo={onGo} />
    </div>
  )
}
