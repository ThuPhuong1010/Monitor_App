import { useEffect, Component } from 'react'
import { useThemeStore } from './store/themeStore'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useTaskStore } from './store/taskStore'
import { useGoalStore } from './store/goalStore'
import { useLibraryStore } from './store/libraryStore'
import { useIdeaStore } from './store/ideaStore'
import BottomNav from './components/ui/BottomNav'
import QuickCapture from './components/capture/QuickCapture'
import AIChatPanel from './components/chat/AIChatPanel'
import NotificationSetup from './components/ui/NotificationSetup'
import Onboarding from './components/ui/Onboarding'
import OverdueBlocker from './components/ui/OverdueBlocker'
import GlobalToast from './components/ui/GlobalToast'
import Home from './pages/Home'
import Tasks from './pages/Tasks'
import Calendar from './pages/Calendar'
import Goals from './pages/Goals'
import Library from './pages/Library'
import Ideas from './pages/Ideas'
import Settings from './pages/Settings'
import WeeklyReview from './pages/WeeklyReview'
import { scheduleOverdueCheck, syncOverdueToStorage } from './services/notifications'

class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: '#ff6b6b', fontFamily: 'monospace', background: '#111', minHeight: '100vh' }}>
          <h2 style={{ color: '#ff6b6b' }}>Runtime Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{this.state.error?.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, color: '#888' }}>{this.state.error?.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

function AppContent() {
  const loadTasks = useTaskStore(s => s.load)
  const loadGoals = useGoalStore(s => s.load)
  const loadLibrary = useLibraryStore(s => s.load)
  const loadIdeas = useIdeaStore(s => s.load)
  const initTheme = useThemeStore(s => s.init)
  const tasks = useTaskStore(s => s.tasks)

  useEffect(() => {
    initTheme()
    loadTasks()
    loadGoals()
    loadLibrary()
    loadIdeas()
    scheduleOverdueCheck(() => useTaskStore.getState().tasks)
  }, [])

  // Sync overdue to localStorage whenever tasks change (for extension to read)
  useEffect(() => {
    syncOverdueToStorage(tasks)
  }, [tasks])

  return (
    <div className="min-h-full relative md:ml-[220px]">
      <main className="pb-24 md:pb-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/library" element={<Library />} />
          <Route path="/ideas" element={<Ideas />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/review" element={<WeeklyReview />} />
        </Routes>
      </main>
      <OverdueBlocker />
      <Onboarding />
      <NotificationSetup />
      <QuickCapture />
      <AIChatPanel />
      <GlobalToast />
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ErrorBoundary>
  )
}
