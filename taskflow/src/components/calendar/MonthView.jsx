import { useMemo } from 'react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isToday, startOfWeek, endOfWeek,
} from 'date-fns'
import { Plus } from 'lucide-react'
import { useTaskStore } from '../../store/taskStore'
import { CATEGORIES } from '../../services/db'

export default function MonthView({ date = new Date(), onDayClick, onQuickAdd }) {
  const tasks = useTaskStore(s => s.tasks)

  // Get 6-week grid (always 42 cells like Google Calendar)
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 }) // Monday
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  // Index tasks by deadline date
  const tasksByDay = useMemo(() => {
    const map = {}
    tasks.forEach(t => {
      if (!t.deadline) return
      const key = t.deadline.slice(0, 10)
      if (!map[key]) map[key] = []
      map[key].push(t)
    })
    return map
  }, [tasks])

  return (
    <div className="flex flex-col h-full px-4 pb-2">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-edge">
        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => (
          <div key={d} className="text-[10px] font-semibold text-secondary/60 text-center py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 flex-1 auto-rows-fr">
        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd')
          const dayTasks = tasksByDay[key] || []
          const pending = dayTasks.filter(t => t.status !== 'done')
          const done = dayTasks.filter(t => t.status === 'done')
          const _isToday = isToday(day)
          const inMonth = isSameMonth(day, date)

          return (
            <div
              key={key}
              onClick={() => onDayClick?.(day)}
              className={`border-b border-r border-edge p-1 cursor-pointer hover:bg-hover/50 transition-colors min-h-[60px] group relative
                ${!inMonth ? 'opacity-35 bg-input/30' : ''}`}
            >
              {/* Day number */}
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full
                  ${_isToday ? 'bg-accent text-white' : 'text-fg-2'}`}
                >
                  {format(day, 'd')}
                </span>
                {/* Quick add button (on hover) */}
                {inMonth && (
                  <button
                    onClick={e => { e.stopPropagation(); onQuickAdd?.(day) }}
                    className="w-5 h-5 rounded flex items-center justify-center text-secondary/0 group-hover:text-secondary hover:text-accent hover:bg-accent/10 transition-all"
                  >
                    <Plus size={12} />
                  </button>
                )}
              </div>

              {/* Task chips */}
              <div className="mt-0.5 space-y-0.5 overflow-hidden">
                {pending.slice(0, 2).map(t => (
                  <div
                    key={t.id}
                    className="text-[10px] leading-tight px-1 py-0.5 rounded truncate font-medium"
                    style={{
                      background: (CATEGORIES[t.category]?.color || '#666') + '20',
                      color: CATEGORIES[t.category]?.color || '#666',
                    }}
                  >
                    {t.title}
                  </div>
                ))}
                {done.length > 0 && pending.length < 2 && (
                  <div className="text-[10px] leading-tight px-1 py-0.5 rounded truncate text-green-500 bg-green-500/10">
                    ✓ {done.length} done
                  </div>
                )}
                {pending.length > 2 && (
                  <span className="text-[9px] text-secondary font-medium pl-1">
                    +{pending.length - 2} nữa
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
