import { useMemo } from 'react'
import { isPast, isToday, parseISO } from 'date-fns'
import { useTaskStore } from '../../store/taskStore'
import { useNavigate } from 'react-router-dom'

export default function QuickStatsWidget() {
  const tasks = useTaskStore(s => s.tasks)
  const navigate = useNavigate()
  const today = new Date().toISOString().slice(0, 10)

  const todayDone = useMemo(() => tasks.filter(t => t.doneAt?.slice(0, 10) === today).length, [tasks, today])
  const pending = useMemo(() => tasks.filter(t => t.status !== 'done').length, [tasks])
  const overdue = useMemo(() => tasks.filter(t =>
    t.status !== 'done' && t.deadline &&
    isPast(parseISO(t.deadline)) && !isToday(parseISO(t.deadline))
  ).length, [tasks])

  const totalEst = useMemo(() => {
    const mins = tasks
      .filter(t => t.status !== 'done' && t.estimatedMinutes)
      .reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0)
    return mins >= 60 ? `${(mins / 60).toFixed(1)}h` : mins > 0 ? `${mins}p` : null
  }, [tasks])

  return (
    <div className="grid grid-cols-2 gap-2">
      <StatCard value={todayDone} label="Xong hôm nay" color="text-green-600" onClick={() => navigate('/tasks')} />
      <StatCard value={pending} label="Pending" color="text-accent" onClick={() => navigate('/tasks')} />
      <StatCard value={overdue} label="Quá hạn" color={overdue > 0 ? 'text-red-600' : 'text-secondary'} onClick={() => navigate('/tasks')} />
      <StatCard value={totalEst || '—'} label="Thời gian còn lại" color="text-secondary" />
    </div>
  )
}

function StatCard({ value, label, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-surface rounded-xl p-3 border border-edge text-center hover:border-edge-2 transition-colors"
    >
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-secondary mt-0.5 leading-tight">{label}</p>
    </button>
  )
}
