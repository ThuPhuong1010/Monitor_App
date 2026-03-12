import { useMemo } from 'react'
import {
    format, subDays, startOfWeek, eachDayOfInterval,
    isSameDay, parseISO,
} from 'date-fns'
import { vi } from 'date-fns/locale'
import { useTaskStore } from '../../store/taskStore'
import { useThemeStore } from '../../store/themeStore'
import { Flame } from 'lucide-react'

const DOW_LABELS = ['', 'T2', '', 'T4', '', 'T6', '']

// Color intensity levels
const DARK_LEVELS = [
    'bg-[#161b22]',           // 0: empty
    'bg-green-900/60',        // 1
    'bg-green-700/80',        // 2
    'bg-green-500',           // 3
    'bg-green-400',           // 4+
]
const LIGHT_LEVELS = [
    'bg-green-100/60',        // 0
    'bg-green-200',           // 1
    'bg-green-400',           // 2
    'bg-green-500',           // 3
    'bg-green-600',           // 4+
]

function getLevel(count) {
    if (count === 0) return 0
    if (count === 1) return 1
    if (count === 2) return 2
    if (count <= 4) return 3
    return 4
}

export default function ContributionGraph() {
    const tasks = useTaskStore(s => s.tasks)
    const isDark = useThemeStore(s => s.theme) === 'dark'
    const levels = isDark ? DARK_LEVELS : LIGHT_LEVELS

    const today = new Date()

    // Build 52 weeks of data (364 days)
    const { weeks, monthLabels, doneByDay, totalDone, currentStreak, longestStreak } = useMemo(() => {
        // Count done tasks per day
        const map = {}
        tasks.forEach(t => {
            if (!t.doneAt) return
            const key = t.doneAt.slice(0, 10)
            map[key] = (map[key] || 0) + 1
        })

        // Build grid: 52 weeks × 7 days
        const totalWeeks = 52
        const gridEnd = today
        const gridStartWeek = startOfWeek(subDays(gridEnd, (totalWeeks - 1) * 7), { weekStartsOn: 1 })
        const allDays = eachDayOfInterval({ start: gridStartWeek, end: gridEnd })

        // Group into weeks (columns)
        const weeksList = []
        for (let i = 0; i < allDays.length; i += 7) {
            weeksList.push(allDays.slice(i, i + 7))
        }

        // Month labels for top axis
        const labels = []
        let lastMonth = -1
        weeksList.forEach((week, wi) => {
            const firstDay = week[0]
            const m = firstDay.getMonth()
            if (m !== lastMonth) {
                labels.push({ index: wi, label: format(firstDay, 'MMM', { locale: vi }) })
                lastMonth = m
            }
        })

        // Total done in period
        let total = 0
        allDays.forEach(d => {
            const key = format(d, 'yyyy-MM-dd')
            total += map[key] || 0
        })

        // Current streak
        let streak = 0
        for (let i = 0; i <= 365; i++) {
            const d = subDays(today, i)
            const key = format(d, 'yyyy-MM-dd')
            if ((map[key] || 0) > 0) streak++
            else break
        }

        // Longest streak
        let longest = 0
        let current = 0
        for (let i = allDays.length - 1; i >= 0; i--) {
            const key = format(allDays[i], 'yyyy-MM-dd')
            if ((map[key] || 0) > 0) {
                current++
                longest = Math.max(longest, current)
            } else {
                current = 0
            }
        }

        return {
            weeks: weeksList,
            monthLabels: labels,
            doneByDay: map,
            totalDone: total,
            currentStreak: streak,
            longestStreak: longest,
        }
    }, [tasks, today.toDateString()])

    return (
        <section>
            <div className={`rounded-2xl p-4 overflow-hidden border
        ${isDark ? 'bg-[#0d1117] border-[#30363d]' : 'bg-surface border-edge'}`}>

                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                    <p className={`text-xs font-semibold ${isDark ? 'text-[#e6edf3]' : 'text-fg'}`}>
                        <b className={isDark ? 'text-green-400' : 'text-green-600'}>{totalDone}</b> tasks done trong 1 năm qua
                    </p>
                    <div className="flex items-center gap-3">
                        {currentStreak > 0 && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-orange-400">
                                <Flame size={12} /> {currentStreak}d streak
                            </span>
                        )}
                        {longestStreak > currentStreak && (
                            <span className="text-[10px] text-secondary">
                                best: {longestStreak}d
                            </span>
                        )}
                    </div>
                </div>

                {/* Graph */}
                <div className="overflow-x-auto no-scrollbar">
                    <div className="min-w-[680px]">
                        {/* Month labels */}
                        <div className="flex ml-8 mb-1">
                            {weeks.map((_, wi) => {
                                const label = monthLabels.find(l => l.index === wi)
                                return (
                                    <div key={wi} className="flex-1 min-w-0">
                                        {label && (
                                            <span className={`text-[10px] font-medium capitalize
                        ${isDark ? 'text-[#8b949e]' : 'text-secondary'}`}>
                                                {label.label}
                                            </span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Grid: 7 rows × N columns */}
                        <div className="flex gap-0">
                            {/* Day-of-week labels */}
                            <div className="flex flex-col gap-[3px] mr-1 shrink-0 w-7">
                                {DOW_LABELS.map((label, i) => (
                                    <div key={i} className="h-[13px] flex items-center justify-end">
                                        <span className={`text-[9px] font-medium pr-1
                      ${isDark ? 'text-[#8b949e]' : 'text-secondary'}`}>
                                            {label}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Week columns */}
                            {weeks.map((week, wi) => (
                                <div key={wi} className="flex flex-col gap-[3px] flex-1 min-w-0">
                                    {Array.from({ length: 7 }).map((_, di) => {
                                        const day = week[di]
                                        if (!day || day > today) {
                                            return <div key={di} className="aspect-square rounded-sm" />
                                        }
                                        const key = format(day, 'yyyy-MM-dd')
                                        const count = doneByDay[key] || 0
                                        const level = getLevel(count)

                                        return (
                                            <div
                                                key={di}
                                                className={`aspect-square rounded-sm ${levels[level]} transition-colors
                          hover:ring-1 hover:ring-green-400/50 cursor-default`}
                                                title={`${format(day, 'EEEE d/M/yyyy', { locale: vi })}: ${count} task${count !== 1 ? 's' : ''} done`}
                                            />
                                        )
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-between mt-3">
                    <p className={`text-[10px] ${isDark ? 'text-[#8b949e]' : 'text-secondary'}`}>
                        Mỗi ô = 1 ngày · Màu càng đậm = càng nhiều task done
                    </p>
                    <div className="flex items-center gap-1">
                        <span className={`text-[9px] ${isDark ? 'text-[#8b949e]' : 'text-secondary'}`}>Ít</span>
                        {levels.map((cls, i) => (
                            <div key={i} className={`w-[10px] h-[10px] rounded-sm ${cls}`} />
                        ))}
                        <span className={`text-[9px] ${isDark ? 'text-[#8b949e]' : 'text-secondary'}`}>Nhiều</span>
                    </div>
                </div>
            </div>
        </section>
    )
}
