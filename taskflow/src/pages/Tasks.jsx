import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { useTaskStore } from '../store/taskStore'
import TaskCard from '../components/tasks/TaskCard'
import TaskForm from '../components/tasks/TaskForm'
import { CATEGORIES } from '../services/db'
import { useLocation } from 'react-router-dom'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'work', label: 'Work' },
  { key: 'personal', label: 'Personal' },
  { key: 'finance', label: 'Finance' },
  { key: 'adhoc', label: 'Ad-hoc' },
]

export default function Tasks() {
  const tasks = useTaskStore(s => s.tasks)
  const [filter, setFilter] = useState('all')
  const [editTask, setEditTask] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const location = useLocation()

  // Auto-open task when navigated from dashboard with openTaskId
  useEffect(() => {
    const id = location.state?.openTaskId
    if (!id || tasks.length === 0) return
    const task = tasks.find(t => t.id === id)
    if (task) setEditTask(task)
    // Clear state so back-navigation doesn't re-open
    window.history.replaceState({}, '')
  }, [location.state?.openTaskId, tasks])

  const filtered = tasks.filter(t => {
    if (filter !== 'all' && t.category !== filter) return false
    return true
  }).sort((a, b) => {
    // Sort: todo before done, then by priority
    if (a.status === 'done' && b.status !== 'done') return 1
    if (a.status !== 'done' && b.status === 'done') return -1
    const pOrder = { p0: 0, p1: 1, p2: 2, p3: 3 }
    return (pOrder[a.priority] || 2) - (pOrder[b.priority] || 2)
  })

  const pending = filtered.filter(t => t.status !== 'done')
  const done = filtered.filter(t => t.status === 'done')

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-fg">Tasks</h1>
        <button
          onClick={() => setShowForm(true)}
          className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center text-white hover:bg-accent-muted"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors
              ${filter === f.key
                ? f.key !== 'all'
                  ? `${CATEGORIES[f.key]?.bg} ${CATEGORIES[f.key]?.text} ${CATEGORIES[f.key]?.border} border`
                  : 'bg-fg text-base'
                : 'bg-input text-secondary'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Pending tasks */}
      {pending.length === 0 && done.length === 0 && (
        <div className="text-center py-16">
          <p className="text-secondary/60 text-sm">Chưa có task nào</p>
          <p className="text-secondary/40 text-xs mt-1">Tap + hoặc dùng FAB để thêm</p>
        </div>
      )}

      <div className="space-y-2">
        {pending.map(task => (
          <TaskCard key={task.id} task={task} onEdit={t => setEditTask(t)} />
        ))}
      </div>

      {/* Done tasks */}
      {done.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-secondary/50 font-semibold uppercase tracking-wider">Đã xong ({done.length})</p>
          {done.map(task => (
            <TaskCard key={task.id} task={task} onEdit={t => setEditTask(t)} />
          ))}
        </div>
      )}

      {/* Forms */}
      {showForm && <TaskForm onClose={() => setShowForm(false)} />}
      {editTask && <TaskForm task={editTask} onClose={() => setEditTask(null)} />}
    </div>
  )
}
