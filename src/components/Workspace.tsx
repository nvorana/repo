import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { DEFAULT_MODULES, LAUNCH_ITEMS } from '../data'
import type { LaunchItem } from '../data'
import { usePersistentState } from '../hooks'
import type { Module, StudioId } from '../types'
import AmbientBackground from './AmbientBackground'
import Companion from './Companion'
import CommandPalette from './CommandPalette'
import StudioRail from './StudioRail'
import TopBar from './TopBar'
import { Orb } from './ui'
import BlueprintStudio from './studios/BlueprintStudio'
import type { Scope } from './studios/BlueprintStudio'
import IdeaStudio from './studios/IdeaStudio'
import LaunchStudio from './studios/LaunchStudio'
import ResearchStudio from './studios/ResearchStudio'
import WritingStudio from './studios/WritingStudio'

export default function Workspace({ spark }: { spark: string }) {
  const [studio, setStudio] = usePersistentState<StudioId>('atelier.studio', 'idea')
  const [visitedArr, setVisitedArr] = usePersistentState<StudioId[]>('atelier.visited', ['idea'])
  const [oneLiner, setOneLiner] = usePersistentState('atelier.oneLiner', spark)
  const [answered, setAnswered] = usePersistentState<string[]>('atelier.answered', [])
  const [modules, setModules] = usePersistentState<Module[]>('atelier.modules', DEFAULT_MODULES)
  const [scope, setScope] = usePersistentState<Scope>('atelier.scope', {
    format: 'Written guide',
    size: 'Two-week sprint',
    price: '$49',
  })
  const [drafts, setDrafts] = usePersistentState<Record<string, string>>('atelier.drafts', {})
  const [launchItems, setLaunchItems] = usePersistentState<LaunchItem[]>('atelier.launch', LAUNCH_ITEMS)

  const [companionOpen, setCompanionOpen] = usePersistentState('atelier.companion', true)
  const [focusMode, setFocusMode] = usePersistentState('atelier.focus', false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  const visited = new Set(visitedArr)

  const go = useCallback(
    (id: StudioId) => {
      setStudio(id)
      setVisitedArr((v) => (v.includes(id) ? v : [...v, id]))
    },
    [setStudio, setVisitedArr],
  )

  /* Keyboard — the Cursor half of the soul */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
        return
      }
      const typing =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      if (typing) return
      if (e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setFocusMode((f) => !f)
      } else if (e.key === 'Escape') {
        setFocusMode(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setPaletteOpen, setFocusMode])

  const toggleQuestion = (q: string) =>
    setAnswered((a) => (a.includes(q) ? a.filter((x) => x !== q) : [...a, q]))

  const toggleLaunchItem = (id: string) =>
    setLaunchItems((items) => items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)))

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.9, ease: 'easeOut' }}
      className="flex h-full flex-col"
    >
      <AmbientBackground studio={studio} />
      <TopBar
        spark={spark}
        studio={studio}
        focusMode={focusMode}
        companionOpen={companionOpen}
        onOpenPalette={() => setPaletteOpen(true)}
        onToggleCompanion={() => setCompanionOpen((o) => !o)}
      />

      <div className="flex min-h-0 flex-1 gap-6">
        {!focusMode && (
          <StudioRail studio={studio} visited={visited} onSelect={go} onFocusMode={() => setFocusMode(true)} />
        )}

        {/* The room itself */}
        <main className="min-w-0 flex-1 overflow-y-auto px-6 pb-10 lg:px-2">
          <div className="mx-auto max-w-4xl pt-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={studio}
                initial={{ opacity: 0, y: 22, scale: 0.992, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -14, scale: 0.994, filter: 'blur(6px)' }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                {studio === 'idea' && <IdeaStudio oneLiner={oneLiner} onOneLiner={setOneLiner} onGo={go} />}
                {studio === 'research' && (
                  <ResearchStudio answered={answered} onToggleQuestion={toggleQuestion} onGo={go} />
                )}
                {studio === 'blueprint' && (
                  <BlueprintStudio
                    modules={modules}
                    onModules={setModules}
                    scope={scope}
                    onScope={setScope}
                    onGo={go}
                  />
                )}
                {studio === 'writing' && (
                  <WritingStudio
                    modules={modules}
                    drafts={drafts}
                    onDraft={(id, text) => setDrafts((d) => ({ ...d, [id]: text }))}
                    onGo={go}
                  />
                )}
                {studio === 'launch' && <LaunchStudio items={launchItems} onToggle={toggleLaunchItem} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {!focusMode && (
          <Companion open={companionOpen} studio={studio} onClose={() => setCompanionOpen(false)} />
        )}
      </div>

      {/* The companion never leaves — closed, it waits quietly in the corner */}
      <AnimatePresence>
        {!companionOpen && !focusMode && (
          <motion.button
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => setCompanionOpen(true)}
            aria-label="Open companion"
            className="glass fixed right-6 bottom-6 z-30 grid h-13 w-13 place-items-center rounded-full transition-transform duration-300 hover:scale-105"
          >
            <Orb size={24} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Focus mode's only chrome: the way back */}
      <AnimatePresence>
        {focusMode && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={() => setFocusMode(false)}
            className="glass fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-full px-5 py-2.5 text-[12.5px] text-white/55 transition-colors hover:text-white/90"
          >
            Leave focus mode <kbd className="key ml-2">esc</kbd>
          </motion.button>
        )}
      </AnimatePresence>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onGo={go}
        onToggleCompanion={() => setCompanionOpen((o) => !o)}
        onFocusMode={() => setFocusMode(true)}
      />
    </motion.div>
  )
}
