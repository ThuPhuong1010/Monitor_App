import { useState, useMemo } from 'react'
import { isPast, isToday, parseISO, differenceInDays } from 'date-fns'
import { AlertTriangle, Check, Calendar, Trash2, Clock, ChevronRight } from 'lucide-react'
import { useTaskStore } from '../../store/taskStore'
import { CATEGORIES } from '../../services/db'

export default function OverdueBlocker() {
  const tasks = useTaskStore(s => s.tasks)
  const updateTask = useTaskStore(s => s.updateTask)
  const deleteTask = useTaskStore(s => s.deleteTask)
  const markDone = useTaskStore(s => s.markDone)

  const [dates, setDates] = useState({})
  const [actioned, setActioned] = useState({})

  const overdue = useMemo(() =>
    tasks
      .filter(t =>
        t.status !== 'done' &&
        t.deadline &&
        isPast(parseISO(t.deadline)) &&
        !isToday(parseISO(t.deadline))
      )
      .sort((a, b) => parseISO(a.deadline) - parseISO(b.deadline)), // oldest first
    [tasks]
  )

  if (overdue.length === 0) return null

  const handleDone = async (task) => {
    setActioned(a => ({ ...a, [task.id]: 'done' }))
    await markDone(task.id)
  }

  const handleReschedule = async (task) => {
    const newDate = dates[task.id]
    if (!newDate) return
    setActioned(a => ({ ...a, [task.id]: 'rescheduled' }))
    await updateTask(task.id, { deadline: newDate })
  }

  const handleDrop = async (task) => {
    setActioned(a => ({ ...a, [task.id]: 'dropped' }))
    await deleteTask(task.id)
  }

  // Quick reschedule: today / tomorrow / next week
  const quickDates = [
    { label: 'Hôm nay', value: new Date().toISOString().slice(0, 10) },
    { label: 'Ngày mai', value: new Date(Date.now() + 86400000).toISOString().slice(0, 10) },
    { label: 'Tuần sau', value: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) },
  ]

  const pendingCount = overdue.filter(t => !actioned[t.id]).length

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-edge animate-slide-up">

        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-red-500/15 to-orange-500/10 border-b border-red-500/20 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="text-red-500" size={20} />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-bold text-fg">
                {overdue.length} task quá hạn
              </h2>
              <p className="text-[11px] text-secondary mt-0.5">
                Xử lý từng task: <span className="text-green-500 font-medium">Done</span> · <span className="text-blue-400 font-medium">Dời</span> · <span className="text-red-400 font-medium">Xóa</span>
              </p>
            </div>
          </div>
        </div>

        {/* ── Task list ── */}
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-edge">
          {overdue.map(task => {
            const status = actioned[task.id]
            const daysOverdue = differenceInDays(new Date(), parseISO(task.deadline))
            const cat = CATEGORIES[task.category]
            const selectedDate = dates[task.id] || ''

            return (
              <div
                key={task.id}
                className={`px-5 py-4 transition-all duration-500 ${status ? 'opacity-20 scale-[0.98]' : ''}`}
              >
                {/* Task info row */}
                <div className="flex items-start gap-3 mb-3">
                  {/* Category dot */}
                  <span
                    className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                    style={{ background: cat?.color || '#888' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-fg leading-snug line-clamp-2">
                      {task.title}
                    </p>
                    {task.notes && (
                      <p className="text-[11px] text-secondary mt-0.5 truncate">{task.notes}</p>
                    )}
                  </div>
                  {/* Overdue badge */}
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0
                    ${daysOverdue > 7
                      ? 'bg-red-500/15 text-red-500 border border-red-500/25'
                      : 'bg-orange-500/15 text-orange-500 border border-orange-500/25'}`}
                  >
                    <Clock size={10} className="inline -mt-0.5 mr-0.5" />
                    {daysOverdue} ngày
                  </span>
                </div>

                {/* Actions */}
                {!status ? (
                  <div className="space-y-2">
                    {/* Primary actions row */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDone(task)}
                        className="flex-1 flex items-center justify-center gap-1.5 h-9 bg-green-500/15 hover:bg-green-500/25 border border-green-500/30 text-green-500 text-xs rounded-xl font-semibold transition-all active:scale-95"
                      >
                        <Check size={14} /> Đã xong
                      </button>
                      <button
                        onClick={() => handleDrop(task)}
                        className="h-9 px-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs rounded-xl font-semibold transition-all active:scale-95 flex items-center gap-1.5"
                      >
                        <Trash2 size={13} /> Xóa
                      </button>
                    </div>

                    {/* Reschedule section */}
                    <div className="bg-input/50 rounded-xl p-2.5 space-y-2">
                      <p className="text-[10px] text-secondary font-semibold uppercase tracking-wider flex items-center gap-1">
                        <Calendar size={10} /> Dời deadline
                      </p>
                      {/* Quick date buttons */}
                      <div className="flex gap-1.5">
                        {quickDates.map(qd => (
                          <button
                            key={qd.value}
                            onClick={() => {
                              setDates(d => ({ ...d, [task.id]: qd.value }))
                              // Auto reschedule on quick date
                              setActioned(a => ({ ...a, [task.id]: 'rescheduled' }))
                              updateTask(task.id, { deadline: qd.value })
                            }}
                            className="flex-1 h-7 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 text-[11px] rounded-lg font-medium transition-all active:scale-95"
                          >
                            {qd.label}
                          </button>
                        ))}
                      </div>
                      {/* Custom date */}
                      <div className="flex gap-1.5">
                        <input
                          type="date"
                          value={selectedDate}
                          onChange={e => setDates(d => ({ ...d, [task.id]: e.target.value }))}
                          min={new Date().toISOString().slice(0, 10)}
                          className="flex-1 text-xs bg-surface border border-edge rounded-lg px-2.5 py-1.5 text-fg focus:outline-none focus:border-accent transition-colors"
                        />
                        <button
                          onClick={() => handleReschedule(task)}
                          disabled={!selectedDate}
                          className="h-8 px-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs rounded-lg font-semibold transition-all active:scale-95 flex items-center gap-1"
                        >
                          <ChevronRight size={12} /> Dời
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-secondary italic flex items-center gap-1.5">
                    {status === 'done' && <><Check size={12} className="text-green-500" /> Đã hoàn thành</>}
                    {status === 'rescheduled' && <><Calendar size={12} className="text-blue-400" /> Đã dời deadline</>}
                    {status === 'dropped' && <><Trash2 size={12} className="text-red-400" /> Đã xóa</>}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3 border-t border-edge bg-input/30">
          <div className="flex items-center justify-between">
            <p className="text-xs text-secondary">
              {pendingCount > 0
                ? <>Còn <b className="text-fg">{pendingCount}</b> task chưa xử lý</>
                : <span className="text-green-500 font-medium">✅ Đã xử lý hết — đang đóng...</span>}
            </p>
            {pendingCount > 0 && (
              <div className="flex gap-1">
                {Array.from({ length: overdue.length }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${actioned[overdue[i]?.id] ? 'bg-green-500' : 'bg-red-500/40'
                      }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
