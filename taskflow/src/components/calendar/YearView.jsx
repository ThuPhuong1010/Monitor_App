import { useMemo } from 'react'
import {
    format, startOfMonth, endOfMonth, eachDayOfInterval,
    startOfWeek, endOfWeek, isSameMonth, isToday,
    eachMonthOfInterval, startOfYear, endOfYear,
} from 'date-fns'
import { vi } from 'date-fns/locale'
import { useTaskStore } from '../../store/taskStore'

const TODAY = new Date()
const TODAY_STR = format(TODAY, 'yyyy-MM-dd')

const DOW = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

export default function YearView({ date = new Date(), onMonthClick }) {
    const tasks = useTaskStore(s => s.tasks)
    const year = date.getFullYear()
    const currentMonthStr = format(TODAY, 'yyyy-MM')

    const months = eachMonthOfInterval({
        start: startOfYear(date),
        end: endOfYear(date),
    })

    // Build per-day data: pending count + overdue flag
    const dayMap = useMemo(() => {
        const map = {}
        tasks.forEach(t => {
            if (!t.deadline) return
            const key = t.deadline.slice(0, 10)
            if (!key.startsWith(String(year))) return
            if (!map[key]) map[key] = { pending: 0, done: 0, overdue: false }
            if (t.status !== 'done') {
                map[key].pending++
                if (key < TODAY_STR) map[key].overdue = true
            } else {
                map[key].done++
            }
        })
        return map
    }, [tasks, year])

    // Per-month summary for header badge
    const monthSummary = useMemo(() => {
        const map = {}
        Object.entries(dayMap).forEach(([key, val]) => {
            const m = key.slice(0, 7) // 'yyyy-MM'
            if (!map[m]) map[m] = { pending: 0, overdue: 0 }
            map[m].pending += val.pending
            if (val.overdue) map[m].overdue += val.pending
        })
        return map
    }, [dayMap])

    return (
        <div className="flex-1 overflow-y-auto px-3 pb-6 pt-1">
            <div className="grid grid-cols-3 gap-3">
                {months.map(month => {
                    const monthStart = startOfMonth(month)
                    const monthEnd = endOfMonth(month)
                    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
                    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
                    const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
                    const mStr = format(month, 'yyyy-MM')
                    const isCurrentMonth = mStr === currentMonthStr
                    const summary = monthSummary[mStr] || { pending: 0, overdue: 0 }
                    const isPastMonth = month < startOfMonth(TODAY) && !isCurrentMonth

                    return (
                        <button
                            key={mStr}
                            onClick={() => onMonthClick?.(month)}
                            className={`text-left rounded-2xl p-3 transition-all hover:scale-[1.02] active:scale-[0.98]
                                ${isCurrentMonth
                                    ? 'bg-accent/8 border-2 border-accent/40 shadow-sm'
                                    : 'bg-surface border border-edge hover:border-accent/30 hover:bg-hover/40'
                                }`}
                        >
                            {/* Month header */}
                            <div className="flex items-center justify-between mb-2">
                                <span className={`text-xs font-bold capitalize
                                    ${isCurrentMonth ? 'text-accent' : isPastMonth ? 'text-secondary/60' : 'text-fg'}`}>
                                    {format(month, 'MMMM', { locale: vi })}
                                </span>
                                {summary.pending > 0 && (
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none
                                        ${summary.overdue > 0
                                            ? 'bg-red-500/15 text-red-500'
                                            : 'bg-accent/15 text-accent'
                                        }`}>
                                        {summary.pending}
                                    </span>
                                )}
                            </div>

                            {/* Weekday headers */}
                            <div className="grid grid-cols-7 mb-1">
                                {DOW.map((d, i) => (
                                    <div key={i} className={`text-[7px] text-center font-medium
                                        ${i >= 5 ? 'text-red-400/50' : 'text-secondary/35'}`}>
                                        {d}
                                    </div>
                                ))}
                            </div>

                            {/* Day grid */}
                            <div className="grid grid-cols-7 gap-y-0.5">
                                {days.map(day => {
                                    const key = format(day, 'yyyy-MM-dd')
                                    const inMonth = isSameMonth(day, month)
                                    const todayDay = isToday(day)
                                    const data = dayMap[key]
                                    const hasPending = data?.pending > 0
                                    const hasOverdue = data?.overdue
                                    const hasDone = data?.done > 0 && !hasPending
                                    const dow = day.getDay() // 0=Sun, 6=Sat
                                    const isWeekend = dow === 0 || dow === 6

                                    if (!inMonth) return (
                                        <div key={key} className="w-full aspect-square" />
                                    )

                                    return (
                                        <div key={key} className="flex flex-col items-center justify-center w-full aspect-square">
                                            {/* Day number */}
                                            <div className={`w-full h-full flex flex-col items-center justify-center rounded-md relative
                                                ${todayDay
                                                    ? 'bg-accent text-white'
                                                    : hasPending
                                                        ? hasOverdue
                                                            ? 'text-red-500'
                                                            : 'text-accent font-semibold'
                                                        : isWeekend
                                                            ? 'text-red-400/60'
                                                            : 'text-fg/70'
                                                }`}
                                            >
                                                <span className={`text-[8px] leading-none ${todayDay ? 'font-bold' : ''}`}>
                                                    {format(day, 'd')}
                                                </span>

                                                {/* Dot indicator */}
                                                {!todayDay && (hasPending || hasDone) && (
                                                    <div className={`w-1 h-1 rounded-full mt-0.5
                                                        ${hasOverdue
                                                            ? 'bg-red-500'
                                                            : hasPending
                                                                ? 'bg-accent'
                                                                : 'bg-secondary/30'
                                                        }`}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Month footer: mini heatmap or summary */}
                            {summary.pending > 0 && (
                                <div className="mt-2 pt-1.5 border-t border-edge flex items-center gap-1">
                                    {summary.overdue > 0 && (
                                        <span className="text-[8px] text-red-500 font-medium flex items-center gap-0.5">
                                            ⚠ {summary.overdue} quá hạn
                                        </span>
                                    )}
                                    {summary.pending - summary.overdue > 0 && (
                                        <span className="text-[8px] text-secondary font-medium ml-auto">
                                            {summary.pending - summary.overdue} sắp tới
                                        </span>
                                    )}
                                </div>
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
