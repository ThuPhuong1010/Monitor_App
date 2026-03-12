import { useMemo } from 'react'
import { format, isToday, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Plus, Clock, CheckCircle2, Circle } from 'lucide-react'
import { useTaskStore } from '../../store/taskStore'
import { CATEGORIES, PRIORITIES } from '../../services/db'

const HOURS = Array.from({ length: 18 }, (_, i) => i + 5) // 5:00 → 22:00

export default function DayView({ date = new Date(), onQuickAdd }) {
    const tasks = useTaskStore(s => s.tasks)
    const focusTasks = useTaskStore(s => s.focusTasks)
    const markDone = useTaskStore(s => s.markDone)

    const key = format(date, 'yyyy-MM-dd')
    const _isToday = isToday(date)

    // Tasks for today
    const dayTasks = useMemo(() =>
        tasks.filter(t => t.deadline && t.deadline.slice(0, 10) === key),
        [tasks, key]
    )

    const pending = dayTasks.filter(t => t.status !== 'done')
    const done = dayTasks.filter(t => t.status === 'done')

    // Focus tasks (only for today)
    const focusTaskObjects = useMemo(() =>
        _isToday ? focusTasks.map(id => tasks.find(t => t.id === id)).filter(Boolean) : [],
        [_isToday, focusTasks, tasks]
    )

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Summary bar */}
            <div className="px-4 py-2 space-y-2 shrink-0 border-b border-edge">
                {/* Stats */}
                <div className="flex items-center gap-3">
                    <span className="text-xs text-secondary">
                        📋 <b className="text-fg">{pending.length}</b> pending
                    </span>
                    <span className="text-xs text-secondary">
                        ✅ <b className="text-green-400">{done.length}</b> done
                    </span>
                    {focusTaskObjects.length > 0 && (
                        <span className="text-xs text-secondary">
                            🎯 <b className="text-accent">{focusTaskObjects.length}</b> focus
                        </span>
                    )}
                </div>

                {/* Focus tasks strip (today only) */}
                {focusTaskObjects.length > 0 && (
                    <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                        {focusTaskObjects.map(t => (
                            <div
                                key={t.id}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-accent/10 border border-accent/20 shrink-0"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                                <span className={`text-[11px] font-medium ${t.status === 'done' ? 'line-through text-secondary' : 'text-accent'}`}>
                                    {t.title}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Pending tasks list (scrollable) */}
                {pending.length > 0 && (
                    <div className="space-y-1">
                        {pending.map(t => {
                            const cat = CATEGORIES[t.category]
                            const pri = PRIORITIES[t.priority]
                            return (
                                <div
                                    key={t.id}
                                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-surface border border-edge hover:bg-hover transition-colors"
                                >
                                    <button
                                        onClick={() => markDone(t.id)}
                                        className="text-secondary/40 hover:text-green-400 transition-colors shrink-0"
                                    >
                                        <Circle size={16} />
                                    </button>
                                    <span
                                        className="w-1.5 h-1.5 rounded-full shrink-0"
                                        style={{ background: cat?.color || '#666' }}
                                    />
                                    <span className="text-xs text-fg flex-1 truncate font-medium">{t.title}</span>
                                    {t.estimatedMinutes && (
                                        <span className="text-[10px] text-secondary flex items-center gap-0.5 shrink-0">
                                            <Clock size={10} /> {t.estimatedMinutes}m
                                        </span>
                                    )}
                                    {pri && (
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${pri.bg} ${pri.color} shrink-0`}>
                                            {t.priority?.toUpperCase()}
                                        </span>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Done tasks */}
                {done.length > 0 && (
                    <div className="space-y-1">
                        <p className="text-[10px] text-secondary font-semibold uppercase tracking-wider">Đã hoàn thành</p>
                        {done.map(t => (
                            <div key={t.id} className="flex items-center gap-2 px-2 py-1 rounded-lg">
                                <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                                <span className="text-xs text-secondary line-through truncate">{t.title}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Hour timeline */}
            <div className="flex-1 overflow-y-auto">
                <div className="px-4 relative">
                    {HOURS.map(hour => (
                        <div
                            key={hour}
                            onClick={() => onQuickAdd?.(date, hour)}
                            className="flex h-14 border-b border-edge/50 cursor-pointer hover:bg-hover/30 transition-colors group"
                        >
                            <div className="w-12 shrink-0 flex items-start justify-end pr-3 -mt-1.5">
                                <span className="text-[10px] text-secondary/50 font-medium">
                                    {hour.toString().padStart(2, '0')}:00
                                </span>
                            </div>
                            <div className="flex-1 border-l border-edge/50 pl-2 relative">
                                <div className="absolute inset-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity pl-2">
                                    <span className="text-[10px] text-secondary/40 flex items-center gap-1">
                                        <Plus size={10} /> Thêm task
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Current time indicator */}
                    {_isToday && (
                        <div
                            className="absolute left-12 right-0 flex items-center pointer-events-none z-10"
                            style={{
                                top: `${((new Date().getHours() - 5) + new Date().getMinutes() / 60) * 56}px`,
                            }}
                        >
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 shrink-0" />
                            <div className="flex-1 h-[1.5px] bg-red-500" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
