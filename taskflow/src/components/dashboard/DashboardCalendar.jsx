import { useState, useMemo } from 'react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isToday, isSameDay, parseISO,
  addMonths, subMonths,
} from 'date-fns'
import { vi } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { useTaskStore } from '../../store/taskStore'
import { CATEGORIES } from '../../services/db'
import { useNavigate } from 'react-router-dom'

export default function DashboardCalendar() {
  const [current, setCurrent] = useState(new Date())
  const [selected, setSelected] = useState(null)
  const tasks = useTaskStore(s => s.tasks)
  const navigate = useNavigate()

  const days = eachDayOfInterval({ start: startOfMonth(current), end: endOfMonth(current) })
  const startDay = startOfMonth(current).getDay() // 0 = Sun

  // Tasks per day: only pending tasks with deadline
  const tasksByDay = useMemo(() => {
    const map = {}
    tasks.forEach(t => {
      if (!t.deadline || t.status === 'done') return
      const key = t.deadline.slice(0, 10)
      if (!map[key]) map[key] = []
      map[key].push(t)
    })
    return map
  }, [tasks])

  // Done tasks per day (for green dot)
  const doneByDay = useMemo(() => {
    const map = {}
    tasks.forEach(t => {
      if (!t.doneAt) return
      const key = t.doneAt.slice(0, 10)
      if (!map[key]) map[key] = 0
      map[key]++
    })
    return map
  }, [tasks])

  const selectedDayKey = selected ? format(selected, 'yyyy-MM-dd') : null
  const selectedTasks = selectedDayKey ? (tasksByDay[selectedDayKey] || []) : []
  const selectedDone = selectedDayKey ? (doneByDay[selectedDayKey] || 0) : 0

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-secondary">
          <Calendar size={14} />
          <span className="text-xs font-semibold uppercase tracking-wider">Lịch tháng</span>
        </div>
        <button
          onClick={() => navigate('/calendar')}
          className="text-xs text-accent hover:text-accent-muted flex items-center gap-0.5"
        >
          Xem đầy đủ <ChevronRight size={12} />
        </button>
      </div>

      <div className="bg-surface border border-edge rounded-2xl p-3 space-y-2">
        {/* Month nav */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrent(c => subMonths(c, 1))}
            className="w-7 h-7 rounded-lg bg-input flex items-center justify-center text-secondary hover:text-fg"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-sm font-semibold text-fg capitalize">
            {format(current, 'MMMM yyyy', { locale: vi })}
          </span>
          <button
            onClick={() => setCurrent(c => addMonths(c, 1))}
            className="w-7 h-7 rounded-lg bg-input flex items-center justify-center text-secondary hover:text-fg"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 text-center">
          {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(d => (
            <div key={d} className="text-[10px] font-semibold text-secondary/60 py-0.5">{d}</div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {Array.from({ length: startDay }).map((_, i) => <div key={`e${i}`} />)}

          {days.map(day => {
            const key = format(day, 'yyyy-MM-dd')
            const pending = tasksByDay[key] || []
            const done = doneByDay[key] || 0
            const isSelected = selected && isSameDay(day, selected)
            const _isToday = isToday(day)
            const dimmed = !isSameMonth(day, current)

            // Category colors for dots (up to 3)
            const dotCats = pending.slice(0, 3).map(t => CATEGORIES[t.category]?.color || '#666')

            return (
              <button
                key={key}
                onClick={() => setSelected(s => (s && isSameDay(s, day)) ? null : day)}
                className={`relative flex flex-col items-center py-1 rounded-xl transition-all
                  ${isSelected ? 'bg-accent text-white' : _isToday ? 'bg-accent-soft text-accent' : 'text-fg-2 hover:bg-hover'}
                  ${dimmed ? 'opacity-25' : ''}`}
              >
                <span className={`text-xs font-medium leading-none ${isSelected ? 'text-white' : ''}`}>
                  {format(day, 'd')}
                </span>

                {/* Indicator row: task count badge OR color dots */}
                <div className="flex items-center justify-center gap-0.5 mt-0.5 h-2.5">
                  {pending.length > 0 && (
                    pending.length <= 3
                      ? dotCats.map((color, i) => (
                        <span
                          key={i}
                          className="w-1 h-1 rounded-full shrink-0"
                          style={{ background: isSelected ? 'rgba(255,255,255,0.8)' : color }}
                        />
                      ))
                      : (
                        <span className={`text-[9px] font-bold leading-none
                          ${isSelected ? 'text-white/80' : 'text-accent'}`}>
                          {pending.length}
                        </span>
                      )
                  )}
                  {done > 0 && pending.length === 0 && (
                    <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white/50' : 'bg-green-500'}`} />
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 pt-1 border-t border-edge">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-accent-soft border border-accent-border" />
            <span className="text-[10px] text-secondary">Hôm nay</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            <span className="text-[10px] text-secondary">Có task</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-[10px] text-secondary">Done</span>
          </div>
        </div>

        {/* Selected day task list */}
        {selected && (
          <div className="border-t border-edge pt-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-secondary uppercase tracking-wider">
                {isToday(selected) ? 'Hôm nay' : format(selected, 'EEE d/M', { locale: vi })}
              </p>
              {(selectedTasks.length > 0 || selectedDone > 0) && (
                <span className="text-[10px] text-secondary/60">
                  {selectedDone > 0 && <span className="text-green-500 font-medium">{selectedDone} done </span>}
                  {selectedTasks.length > 0 && `· ${selectedTasks.length} pending`}
                </span>
              )}
            </div>
            {selectedTasks.length === 0 && selectedDone === 0 && (
              <p className="text-[11px] text-secondary/50 py-1">Không có task nào</p>
            )}
            {selectedTasks.slice(0, 5).map(t => (
              <div key={t.id} className="flex items-center gap-2">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: CATEGORIES[t.category]?.color || '#888' }}
                />
                <span className="text-xs text-fg-2 truncate flex-1">{t.title}</span>
              </div>
            ))}
            {selectedTasks.length > 5 && (
              <button
                onClick={() => navigate('/calendar')}
                className="text-[11px] text-accent hover:underline"
              >
                +{selectedTasks.length - 5} task nữa →
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
