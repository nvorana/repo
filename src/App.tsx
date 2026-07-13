import { AnimatePresence, MotionConfig } from 'framer-motion'
import AmbientBackground from './components/AmbientBackground'
import Welcome from './components/Welcome'
import Workspace from './components/Workspace'
import { usePersistentState } from './hooks'

export default function App() {
  const [spark, setSpark] = usePersistentState<string | null>('atelier.spark', null)

  return (
    <MotionConfig reducedMotion="user">
      <div className="h-full font-sans text-white/90">
        {spark === null && <AmbientBackground studio={null} />}
        <AnimatePresence mode="wait">
          {spark === null ? (
            <Welcome key="welcome" onEnter={setSpark} />
          ) : (
            <Workspace key="workspace" spark={spark} />
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  )
}
