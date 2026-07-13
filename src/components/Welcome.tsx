import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Orb } from './ui'

export default function Welcome({ onEnter }: { onEnter: (spark: string) => void }) {
  const [spark, setSpark] = useState('')
  const ready = spark.trim().length > 2

  const enter = () => {
    if (ready) onEnter(spark.trim())
  }

  return (
    <motion.div
      exit={{ opacity: 0, scale: 1.02, filter: 'blur(8px)' }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="flex h-full flex-col items-center justify-center px-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="flex w-full max-w-2xl flex-col items-center text-center"
      >
        <div className="flex items-center gap-2.5">
          <Orb size={18} quiet />
          <span className="text-[13px] font-medium tracking-[0.22em] text-white/60 uppercase">Atelier</span>
        </div>

        <h1 className="serif-display mt-10 text-[44px] leading-[1.15] text-white/95 sm:text-[54px]">
          Every product begins
          <br />
          as a quiet idea.
        </h1>

        <p className="mt-6 max-w-md text-[15.5px] leading-relaxed text-white/50">
          Atelier is a studio for making your first digital product — five rooms, one calm path, and a
          collaborator who has done this before.
        </p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="glass mt-12 flex w-full items-center gap-3 rounded-2xl p-2 pl-6"
        >
          <input
            autoFocus
            value={spark}
            onChange={(e) => setSpark(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && enter()}
            placeholder="A guide to… a course about… a template for…"
            className="h-12 flex-1 bg-transparent text-[16px] text-white/90 outline-none"
          />
          <button
            onClick={enter}
            disabled={!ready}
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl transition-all duration-300 ${
              ready
                ? 'bg-iris-500 text-white shadow-[0_0_28px_rgba(123,121,238,0.45)] hover:bg-iris-400'
                : 'bg-white/6 text-white/25'
            }`}
            aria-label="Enter the studio"
          >
            <ArrowRight size={18} strokeWidth={2.2} />
          </button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.8 }}
          className="mt-5 text-[12.5px] text-white/30"
        >
          Whatever you have — a sentence, a hunch — is enough to begin.
        </motion.p>
      </motion.div>
    </motion.div>
  )
}
