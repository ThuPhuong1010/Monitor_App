import { useState, useMemo } from 'react'
import { isPast, isToday, parseISO, format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { AlertTriangle, Check, Calendar, Trash2 } from 'lucide-react'
import { useTaskStore } from '../../store/taskStore'

export default function OverdueBlocker() {
  const tasks = useTaskStore(s => s.tasks)
  const updateTask = useTaskStore(s => s.updateTask)
  const deleteTask = useTaskStore(s => s.deleteTask)

  const [dates, setDates] = useState({})   // id → new date string
  const [actioned, setActioned] = useState({}) // id → true (for visual feedback while store updates)

  const overdue = useMemo(() =>
    tasks.filter(t =>
      t.status !== 'done' &&
      t.deadline &&
      isPast(parseISO(t.deadline)) &&
      !isToday(parseISO(t.deadline))
    ),
    [tasks]
  )

  // All tasks handled = modal auto-closes (overdue list empties)
  if (overdue.length === 0) return null

  const handleDone = async (task) => {
    setActioned(a => ({ ...a, [task.id]: true }))
    await updateTask(task.id, { status: 'done', doneAt: new Date().toISOString(), progress: 100 })
  }

  const handleReschedule = async (task) => {
    const newDate = dates[task.id]
    if (!newDate) return
    setActioned(a => ({ ...a, [task.id]: true }))
    await updateTask(task.id, { deadline: newDate })
  }

  const handleDrop = async (task) => {
    setActioned(a => ({ ...a, [task.id]: true }))
    await deleteTask(task.id)
  }

  const pendingCount = overdue.filter(t => !actioned[t.id]).length

  return (
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-edge rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-red-950/40 border-b border-red-900/30 px-5 py-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-red-500 shrink-0" size={20} />
            <div>
              <h2 className="text-base font-bold text-red-400">
                {overdue.length} task quá hạn — xử lý trước đã
              </h2>
              <p className="text-xs text-secondary mt-0.5">
                Done · Dời deadline · Drop — chọn 1 trong 3 cho mỗi task
              </p>
            </div>
          </div>
        </div>

        {/* Task list */}
        <div className="divide-y divide-edge max-h-[55vh] overflow-y-auto">
          {overdue.map(task => {
            const done = actioned[task.id]
            const daysOverdue = Math.floor(
              (Date.now() - parseISO(task.deadline).getTime()) / 86400000
            )
            return (
              <div
                key={task.id}
                className={`px-5 py-4 transition-opacity duration-300 ${done ? 'opacity-30' : ''}`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <p className="text-sm font-medium text-fg line-clamp-2">{task.title}</p>
                  <span className="text-[11px] text-red-500 font-medium shrink-0 bg-red-950/40 px-2 py-0.5 rounded-full">
                    +{daysOverdue}d
                  </span>
                </div>

                {!done ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Done */}
                    <button
                      onClick={() => handleDone(task)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-900/30 hover:bg-green-900/50 border border-green-800/40 text-green-400 text-xs rounded-lg font-medium transition-colors"
                    >
                      <Check size={13} /> Done
                    </button>

                    {/* Reschedule */}
                    <input
                      type="date"
                      value={dates[task.id] || ''}
                      onChange={e => setDates(d => ({ ...d, [task.id]: e.target.value }))}
                      min={new Date().toISOString().slice(0, 10)}
                      className="text-xs bg-input border border-edge rounded-lg px-2 py-1.5 text-fg focus:outline-none focus:border-accent"
                    />
                    <button
                      onClick={() => handleReschedule(task)}
                      disabled={!dates[task.id]}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-800/40 text-blue-400 text-xs rounded-lg font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Calendar size={13} /> Dời
                    </button>

                    {/* Drop */}
                    <button
                      onClick={() => handleDrop(task)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/20 hover:bg-red-900/40 border border-red-900/30 text-red-500 text-xs rounded-lg font-medium transition-colors"
                    >
                      <Trash2 size={13} /> Drop
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-secondary italic">Đang xử lý...</p>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-edge bg-surface/50">
          <p className="text-xs text-center text-secondary">
            {pendingCount > 0
              ? `Còn ${pendingCount} task chưa xử lý`
              : 'Đang đóng...'}
          </p>
        </div>
      </div>
    </div>
  )
}
