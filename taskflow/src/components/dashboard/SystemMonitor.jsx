import { useMemo } from 'react'
import { isPast, isToday, parseISO } from 'date-fns'
import { useTaskStore } from '../../store/taskStore'
import { useGoalStore } from '../../store/goalStore'
import { useLibraryStore } from '../../store/libraryStore'
import { Activity } from 'lucide-react'

export default function SystemMonitor() {
  const tasks = useTaskStore(s => s.tasks)
  const goals = useGoalStore(s => s.goals)
  const resources = useLibraryStore(s => s.resources)

  const stats = useMemo(() => {
    const pending = tasks.filter(t => t.status !== 'done')
    const done = tasks.filter(t => t.status === 'done')
    const overdue = pending.filter(t => t.deadline && isPast(parseISO(t.deadline)) && !isToday(parseISO(t.deadline)))
    const today = new Date().toISOString().slice(0, 10)
    const doneToday = done.filter(t => t.doneAt?.slice(0, 10) === today)
    const withTime = pending.filter(t => t.estimatedMinutes)
    const totalMins = withTime.reduce((s, t) => s + t.estimatedMinutes, 0)

    const byCategory = {}
    pending.forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + 1 })
    const byPriority = { p0: 0, p1: 0, p2: 0, p3: 0 }
    pending.forEach(t => { if (t.priority in byPriority) byPriority[t.priority]++ })

    return {
      tasks: { total: tasks.length, pending: pending.length, done: done.length, overdue: overdue.length, doneToday: doneToday.length },
      goals: { total: goals.length, active: goals.filter(g => g.status !== 'done').length, done: goals.filter(g => g.status === 'done').length },
      library: { total: resources.length, toRead: resources.filter(r => r.status === 'toread').length, done: resources.filter(r => r.status === 'done').length },
      time: { totalMins, withTime: withTime.length },
      byPriority,
      byCategory,
    }
  }, [tasks, goals, resources])

  const PRIORITY_LABELS = { p0: 'Gấp', p1: 'Cao', p2: 'Vừa', p3: 'Thấp' }
  const PRIORITY_COLORS = { p0: 'bg-red-500', p1: 'bg-orange-500', p2: 'bg-yellow-400', p3: 'bg-slate-400' }
  const CAT_LABELS = { work: 'Work', personal: 'Personal', finance: 'Finance', adhoc: 'Ad-hoc' }
  const CAT_COLORS = { work: '#6366f1', personal: '#10b981', finance: '#f59e0b', adhoc: '#8b5cf6' }

  return (
    <section>
      <div className="flex items-center gap-1.5 mb-3">
        <Activity size={14} className="text-secondary" />
        <span className="text-xs font-bold uppercase tracking-wider text-secondary">System Monitor</span>
      </div>

      <div className="space-y-3">
        {/* Summary row */}
        <div className="grid grid-cols-3 gap-2">
          <MonitorCard label="Tasks" value={stats.tasks.pending} sub={`${stats.tasks.done} done`} accent={stats.tasks.overdue > 0 ? 'text-red-600' : 'text-accent'} />
          <MonitorCard label="Goals" value={stats.goals.active} sub={`${stats.goals.done} done`} accent="text-violet-600" />
          <MonitorCard label="Library" value={stats.library.toRead} sub={`${stats.library.done} đã đọc`} accent="text-violet-500" />
        </div>

        {/* Time estimate */}
        {stats.time.totalMins > 0 && (
          <div className="bg-surface border border-edge rounded-xl px-3 py-2.5 flex items-center justify-between">
            <span className="text-xs text-secondary">⏱ Tổng thời gian ước tính ({stats.time.withTime} tasks)</span>
            <span className="text-sm font-bold text-fg">
              {stats.time.totalMins >= 60
                ? `${Math.floor(stats.time.totalMins / 60)}h${stats.time.totalMins % 60 > 0 ? ` ${stats.time.totalMins % 60}p` : ''}`
                : `${stats.time.totalMins}p`}
            </span>
          </div>
        )}

        {/* Priority breakdown */}
        <div className="bg-surface border border-edge rounded-xl p-3">
          <p className="text-[11px] text-secondary font-semibold uppercase tracking-wider mb-2">Theo độ ưu tiên</p>
          <div className="space-y-1.5">
            {Object.entries(stats.byPriority).map(([p, count]) => (
              count > 0 && (
                <div key={p} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_COLORS[p]}`} />
                  <span className="text-xs text-secondary w-10">{PRIORITY_LABELS[p]}</span>
                  <div className="flex-1 h-1.5 bg-input rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${PRIORITY_COLORS[p]}`}
                      style={{ width: `${stats.tasks.pending > 0 ? (count / stats.tasks.pending) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-fg w-5 text-right">{count}</span>
                </div>
              )
            ))}
          </div>
        </div>

        {/* Category breakdown */}
        {Object.keys(stats.byCategory).length > 0 && (
          <div className="bg-surface border border-edge rounded-xl p-3">
            <p className="text-[11px] text-secondary font-semibold uppercase tracking-wider mb-2">Theo category</p>
            <div className="space-y-1.5">
              {Object.entries(stats.byCategory).map(([cat, count]) => (
                <div key={cat} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CAT_COLORS[cat] || '#888' }} />
                  <span className="text-xs text-secondary flex-1">{CAT_LABELS[cat] || cat}</span>
                  <div className="w-20 h-1.5 bg-input rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${stats.tasks.pending > 0 ? (count / stats.tasks.pending) * 100 : 0}%`,
                        background: CAT_COLORS[cat] || '#888'
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-fg w-5 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function MonitorCard({ label, value, sub, accent }) {
  return (
    <div className="bg-surface border border-edge rounded-xl p-3 text-center">
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
      <p className="text-[10px] font-semibold text-secondary mt-0.5">{label}</p>
      <p className="text-[9px] text-secondary/60 mt-0.5">{sub}</p>
    </div>
  )
}
