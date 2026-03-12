import { useMemo } from 'react'
import {
    format, startOfWeek, endOfWeek, eachDayOfInterval,
    isToday,
} from 'date-fns'
import { vi } from 'date-fns/locale'
import { Plus } from 'lucide-react'
import { useTaskStore } from '../../store/taskStore'
import { CATEGORIES } from '../../services/db'

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6) // 6:00 → 21:00

export default function WeekView({ date = new Date(), onDayClick, onQuickAdd }) {
    const tasks = useTaskStore(s => s.tasks)

    const weekStart = startOfWeek(date, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 })
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

    // Index tasks by deadline
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
        <div className="flex flex-col h-full overflow-hidden">
            {/* Day headers */}
            <div className="flex border-b border-edge px-4 shrink-0">
                <div className="w-12 shrink-0" /> {/* time column spacer */}
                {days.map(day => {
                    const _isToday = isToday(day)
                    return (
                        <button
                            key={day.toISOString()}
                            onClick={() => onDayClick?.(day)}
                            className={`flex-1 text-center py-2 transition-colors hover:bg-hover/50
                ${_isToday ? '' : ''}`}
                        >
                            <span className="text-[10px] font-semibold text-secondary uppercase block">
                                {format(day, 'EEE', { locale: vi })}
                            </span>
                            <span className={`text-lg font-bold w-9 h-9 inline-flex items-center justify-center rounded-full
                ${_isToday ? 'bg-accent text-white' : 'text-fg'}`}
                            >
                                {format(day, 'd')}
                            </span>
                        </button>
                    )
                })}
            </div>

            {/* Time grid */}
            <div className="flex-1 overflow-y-auto">
                <div className="flex px-4 relative">
                    {/* Time labels */}
                    <div className="w-12 shrink-0">
                        {HOURS.map(hour => (
                            <div key={hour} className="h-14 flex items-start justify-end pr-2 pt-0">
                                <span className="text-[10px] text-secondary/60 font-medium -mt-1.5">
                                    {hour.toString().padStart(2, '0')}:00
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Day columns */}
                    {days.map(day => {
                        const key = format(day, 'yyyy-MM-dd')
                        const dayTasks = tasksByDay[key] || []
                        const pending = dayTasks.filter(t => t.status !== 'done')
                        const _isToday = isToday(day)

                        return (
                            <div
                                key={key}
                                className={`flex-1 border-l border-edge relative ${_isToday ? 'bg-accent/[0.03]' : ''}`}
                            >
                                {/* Hour slots */}
                                {HOURS.map(hour => (
                                    <div
                                        key={hour}
                                        onClick={() => onQuickAdd?.(day, hour)}
                                        className="h-14 border-b border-edge/50 cursor-pointer hover:bg-hover/30 transition-colors group relative"
                                    >
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Plus size={12} className="text-secondary/40" />
                                        </div>
                                    </div>
                                ))}

                                {/* Task overlays (stacked at top of each day column) */}
                                {pending.length > 0 && (
                                    <div className="absolute top-0 left-0 right-0 p-0.5 space-y-0.5 pointer-events-none">
                                        {pending.slice(0, 4).map(t => (
                                            <div
                                                key={t.id}
                                                className="text-[9px] leading-tight px-1 py-0.5 rounded truncate font-medium pointer-events-auto cursor-pointer hover:opacity-80"
                                                style={{
                                                    background: (CATEGORIES[t.category]?.color || '#666') + '25',
                                                    color: CATEGORIES[t.category]?.color || '#666',
                                                    borderLeft: `2px solid ${CATEGORIES[t.category]?.color || '#666'}`,
                                                }}
                                                title={t.title}
                                            >
                                                {t.title}
                                            </div>
                                        ))}
                                        {pending.length > 4 && (
                                            <span className="text-[9px] text-secondary pl-1">+{pending.length - 4}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
