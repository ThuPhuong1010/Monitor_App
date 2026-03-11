import { useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTaskStore } from '../../store/taskStore'
import { CATEGORIES } from '../../services/db'

export default function MonthView() {
  const [current, setCurrent] = useState(new Date())
  const [selected, setSelected] = useState(new Date())
  const tasks = useTaskStore(s => s.tasks)
  const focusTasks = useTaskStore(s => s.focusTasks)

  const days = eachDayOfInterval({ start: startOfMonth(current), end: endOfMonth(current) })
  const startDay = startOfMonth(current).getDay() // 0=Sun

  // Get tasks for a day
  const getTasksForDay = (day) =>
    tasks.filter(t => t.deadline && isSameDay(parseISO(t.deadline), day) && t.status !== 'done')

  const selectedTasks = getTasksForDay(selected)
  const focusTaskObjects = focusTasks.map(id => tasks.find(t => t.id === id)).filter(Boolean)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => setCurrent(d => new Date(d.getFullYear(), d.getMonth() - 1))}
          className="w-9 h-9 rounded-xl bg-input flex items-center justify-center text-secondary hover:text-fg">
          <ChevronLeft size={18} />
        </button>
        <h2 className="font-semibold text-fg">{format(current, 'MMMM yyyy', { locale: vi })}</h2>
        <button onClick={() => setCurrent(d => new Date(d.getFullYear(), d.getMonth() + 1))}
          className="w-9 h-9 rounded-xl bg-input flex items-center justify-center text-secondary hover:text-fg">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center">
        {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(d => (
          <div key={d} className="text-[10px] font-medium text-secondary py-1">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {/* Empty cells for first row */}
        {Array.from({ length: startDay }).map((_, i) => <div key={`e${i}`} />)}

        {days.map(day => {
          const dayTasks = getTasksForDay(day)
          const _isToday = isToday(day)
          const _isSelected = isSameDay(day, selected)

          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelected(day)}
              className={`relative flex flex-col items-center py-1.5 rounded-xl transition-all
                ${_isSelected ? 'bg-accent text-white' : _isToday ? 'bg-accent-soft text-accent' : 'text-fg-2 hover:bg-hover'}
                ${!isSameMonth(day, current) ? 'opacity-30' : ''}`}
            >
              <span className="text-sm font-medium">{format(day, 'd')}</span>
              {/* Dot indicators */}
              {dayTasks.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {dayTasks.slice(0, 3).map((t, i) => (
                    <span key={i} className="w-1 h-1 rounded-full" style={{ background: CATEGORIES[t.category]?.color || '#666' }} />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected day detail */}
      <div className="bg-surface rounded-xl p-3 space-y-2 border border-edge">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-fg">
            {isToday(selected) ? 'Hôm nay' : format(selected, 'EEEE, d MMMM', { locale: vi })}
          </h3>
          <span className="text-xs text-secondary">{selectedTasks.length} tasks</span>
        </div>

        {isToday(selected) && focusTaskObjects.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] text-accent font-semibold uppercase tracking-wider">Today's Focus</p>
            {focusTaskObjects.map(t => (
              <div key={t.id} className="flex items-center gap-2 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                <span className={t.status === 'done' ? 'line-through text-secondary' : 'text-fg'}>{t.title}</span>
              </div>
            ))}
          </div>
        )}

        {selectedTasks.length > 0 ? (
          <div className="space-y-1.5">
            {isToday(selected) && focusTaskObjects.length > 0 && (
              <p className="text-[10px] text-secondary font-semibold uppercase tracking-wider">Deadline hôm nay</p>
            )}
            {selectedTasks.map(t => (
              <div key={t.id} className="flex items-center gap-2 text-sm">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CATEGORIES[t.category]?.color }} />
                <span className="text-fg-2 truncate">{t.title}</span>
              </div>
            ))}
          </div>
        ) : (
          !isToday(selected) && <p className="text-xs text-secondary/50">Không có task nào deadline ngày này</p>
        )}
      </div>
    </div>
  )
}
