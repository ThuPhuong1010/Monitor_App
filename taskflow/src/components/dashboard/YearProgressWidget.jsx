import { useMemo } from 'react'
import { getDayOfYear, getDaysInYear, getDaysInMonth } from 'date-fns'
import { useThemeStore } from '../../store/themeStore'

const MONTH_LABELS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12']

export default function YearProgressWidget() {
    const now = new Date()
    const year = now.getFullYear()
    const dayOfYear = getDayOfYear(now)
    const totalDays = getDaysInYear(now)
    const percentage = ((dayOfYear / totalDays) * 100).toFixed(2)
    const remaining = totalDays - dayOfYear
    const currentMonth = now.getMonth()
    const isDark = useThemeStore(s => s.theme) === 'dark'

    const months = useMemo(() => {
        let cumulative = 0
        return MONTH_LABELS.map((label, i) => {
            const days = getDaysInMonth(new Date(year, i))
            const start = cumulative
            cumulative += days
            return { label, days, start, index: i }
        })
    }, [year])

    // Theme-aware color classes
    const t = isDark
        ? {
            bg: 'bg-[#0a0f0a] border-green-900/30',
            dotPassed: 'bg-green-500/70',
            dotToday: 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]',
            dotEmpty: 'bg-green-900/30',
            year: 'text-green-400',
            pct: 'text-green-500/80',
            stat: 'text-green-700',
            statB: 'text-green-500',
            labelCurrent: 'text-green-400',
            labelPast: 'text-green-600/60',
            labelFuture: 'text-green-900/60',
            bar: 'bg-green-900/30',
            barFill: 'bg-gradient-to-r from-green-600 to-green-400',
            footer: 'text-green-600',
        }
        : {
            bg: 'bg-gradient-to-br from-emerald-50 to-green-50 border-green-200/60',
            dotPassed: 'bg-green-500/80',
            dotToday: 'bg-green-600 shadow-[0_0_6px_rgba(22,163,74,0.5)]',
            dotEmpty: 'bg-green-200/50',
            year: 'text-green-700',
            pct: 'text-green-600',
            stat: 'text-green-500',
            statB: 'text-green-700',
            labelCurrent: 'text-green-700 font-bold',
            labelPast: 'text-green-500/60',
            labelFuture: 'text-green-300/70',
            bar: 'bg-green-200/60',
            barFill: 'bg-gradient-to-r from-green-500 to-green-400',
            footer: 'text-green-600/80',
        }

    return (
        <section>
            <div className={`rounded-2xl p-4 overflow-hidden border ${t.bg}`}>
                {/* Top: year + stats */}
                <div className="flex items-baseline justify-between mb-3">
                    <div className="flex items-baseline gap-2">
                        <span className={`text-2xl font-black tracking-tight ${t.year}`}>{year}</span>
                        <span className={`text-sm font-bold ${t.pct}`}>{percentage}%</span>
                    </div>
                    <div className={`text-right text-[10px] flex items-center gap-3 ${t.stat}`}>
                        <span><b className={t.statB}>{dayOfYear}</b>/{totalDays}</span>
                        <span>còn <b className={t.statB}>{remaining}</b> ngày</span>
                    </div>
                </div>

                {/* Month grid */}
                <div className="space-y-[2px]">
                    {months.map(month => {
                        const isCurrent = month.index === currentMonth
                        const isPast = month.index < currentMonth

                        return (
                            <div key={month.index} className="flex items-center gap-1.5">
                                <span className={`text-[9px] font-bold w-6 text-right shrink-0 leading-none
                  ${isCurrent ? t.labelCurrent : isPast ? t.labelPast : t.labelFuture}`}
                                >
                                    {month.label}
                                </span>

                                <div className="flex-1 grid grid-cols-[repeat(31,1fr)] gap-[2px]">
                                    {Array.from({ length: 31 }).map((_, d) => {
                                        if (d >= month.days) return <div key={d} />

                                        const globalDay = month.start + d
                                        const passed = globalDay < dayOfYear
                                        const isToday = globalDay === dayOfYear - 1

                                        return (
                                            <div
                                                key={d}
                                                className={`aspect-square rounded-full
                          ${isToday ? t.dotToday : passed ? t.dotPassed : t.dotEmpty}`}
                                            />
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Progress bar */}
                <div className={`mt-3 w-full h-1.5 rounded-full overflow-hidden ${t.bar}`}>
                    <div
                        className={`h-full rounded-full transition-all ${t.barFill}`}
                        style={{ width: `${percentage}%` }}
                    />
                </div>

                {/* Footer */}
                <p className={`text-[10px] mt-2 text-center ${t.footer}`}>
                    Tháng {currentMonth + 1} · Ngày {now.getDate()} · Tuần {Math.ceil(dayOfYear / 7)}
                </p>
            </div>
        </section>
    )
}
