import { useMemo } from 'react'
import {
    format, eachDayOfInterval, subDays,
} from 'date-fns'
import { vi } from 'date-fns/locale'
import { useTaskStore } from '../../store/taskStore'
import { useThemeStore } from '../../store/themeStore'
import { Flame } from 'lucide-react'

const DOW_LABELS = ['', 'T2', '', 'T4', '', 'T6', '']

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
    const today = new Date()

    // Start from first Monday of March 2026 (not startOfWeek which pulls back to Feb)
    const startFrom = useMemo(() => {
        const march1 = new Date(2026, 2, 1) // March 1, 2026
        // Find first Monday on or after March 1
        const dayOfWeek = march1.getDay() // 0=Sun
        const daysUntilMon = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek
        return new Date(2026, 2, 1 + daysUntilMon) // March 2, 2026 (Monday)
    }, [])

    const { weeks, monthLabels, doneByDay, totalDone, currentStreak, longestStreak } = useMemo(() => {
        // Count done tasks per day
        const map = {}
        tasks.forEach(t => {
            if (!t.doneAt) return
            const key = t.doneAt.slice(0, 10)
            map[key] = (map[key] || 0) + 1
        })

        // Build grid from startFrom → today
        const allDays = eachDayOfInterval({ start: startFrom, end: today })

        // Group into weeks
        const weeksList = []
        for (let i = 0; i < allDays.length; i += 7) {
            weeksList.push(allDays.slice(i, i + 7))
        }
        // Pad last week to 7 days if needed
        const lastWeek = weeksList[weeksList.length - 1]
        if (lastWeek && lastWeek.length < 7) {
            // Just leave it short — grid handles it
        }

        // Month labels
        const labels = []
        let lastMonth = -1
        weeksList.forEach((week, wi) => {
            const firstDay = week[0]
            const m = firstDay.getMonth()
            if (m !== lastMonth) {
                labels.push({ index: wi, label: format(firstDay, 'LLL yyyy', { locale: vi }) })
                lastMonth = m
            }
        })

        // Total
        let total = 0
        allDays.forEach(d => {
            total += map[format(d, 'yyyy-MM-dd')] || 0
        })

        // Current streak (from today backwards)
        let streak = 0
        for (let i = 0; i <= 365; i++) {
            const key = format(subDays(today, i), 'yyyy-MM-dd')
            if ((map[key] || 0) > 0) streak++
            else break
        }

        // Longest streak
        let longest = 0
        let cur = 0
        for (let i = 0; i < allDays.length; i++) {
            const key = format(allDays[i], 'yyyy-MM-dd')
            if ((map[key] || 0) > 0) {
                cur++
                longest = Math.max(longest, cur)
            } else {
                cur = 0
            }
        }

        return { weeks: weeksList, monthLabels: labels, doneByDay: map, totalDone: total, currentStreak: streak, longestStreak: longest }
    }, [tasks, startFrom, today.toDateString()])

    // High-contrast color levels
    const levels = isDark
        ? ['bg-[#161b22]', 'bg-[#0e4429]', 'bg-[#006d32]', 'bg-[#26a641]', 'bg-[#39d353]']
        : ['bg-[#ebedf0]', 'bg-[#9be9a8]', 'bg-[#40c463]', 'bg-[#30a14e]', 'bg-[#216e39]']

    return (
        <section>
            <div className={`rounded-2xl p-4 overflow-hidden border
        ${isDark ? 'bg-[#0d1117] border-[#30363d]' : 'bg-white border-edge'}`}>

                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                    <p className={`text-xs font-semibold ${isDark ? 'text-[#e6edf3]' : 'text-fg'}`}>
                        <b className={isDark ? 'text-green-400' : 'text-green-600'}>{totalDone}</b> tasks done
                    </p>
                    <div className="flex items-center gap-3">
                        {currentStreak > 0 && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-orange-500">
                                <Flame size={12} /> {currentStreak}d streak
                            </span>
                        )}
                        {longestStreak > currentStreak && (
                            <span className={`text-[10px] ${isDark ? 'text-[#8b949e]' : 'text-secondary'}`}>
                                best: {longestStreak}d
                            </span>
                        )}
                    </div>
                </div>

                {/* Graph */}
                <div className="overflow-x-auto no-scrollbar">
                    <div>
                        {/* Month labels */}
                        <div className="flex ml-8 mb-1">
                            {weeks.map((_, wi) => {
                                const label = monthLabels.find(l => l.index === wi)
                                return (
                                    <div key={wi} className="shrink-0 overflow-visible" style={{ width: 16 }}>
                                        {label && (
                                            <span className={`text-[10px] font-semibold capitalize whitespace-nowrap
                        ${isDark ? 'text-[#8b949e]' : 'text-secondary'}`}>
                                                {label.label}
                                            </span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Grid */}
                        <div className="flex gap-0">
                            {/* Day labels */}
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
                                <div key={wi} className="flex flex-col gap-[3px] shrink-0" style={{ width: 16 }}>
                                    {Array.from({ length: 7 }).map((_, di) => {
                                        const day = week[di]
                                        if (!day || day > today) {
                                            return <div key={di} style={{ width: 13, height: 13 }} />
                                        }
                                        const key = format(day, 'yyyy-MM-dd')
                                        const count = doneByDay[key] || 0
                                        const level = getLevel(count)

                                        return (
                                            <div
                                                key={di}
                                                style={{ width: 13, height: 13 }}
                                                className={`rounded-sm ${levels[level]}
                          hover:ring-1 ${isDark ? 'hover:ring-[#8b949e]' : 'hover:ring-gray-400'} cursor-default transition-all`}
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
                        Từ tháng 3/2026
                    </p>
                    <div className="flex items-center gap-[3px]">
                        <span className={`text-[9px] mr-1 ${isDark ? 'text-[#8b949e]' : 'text-secondary'}`}>Ít</span>
                        {levels.map((cls, i) => (
                            <div key={i} className={`w-[11px] h-[11px] rounded-sm ${cls}`} />
                        ))}
                        <span className={`text-[9px] ml-1 ${isDark ? 'text-[#8b949e]' : 'text-secondary'}`}>Nhiều</span>
                    </div>
                </div>
            </div>
        </section>
    )
}
