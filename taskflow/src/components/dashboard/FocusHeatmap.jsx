import { useState, useEffect, useMemo } from 'react'
import { format, subDays, isToday } from 'date-fns'
import { vi } from 'date-fns/locale'
import { db } from '../../services/db'
import { useTaskStore } from '../../store/taskStore'
import { Flame } from 'lucide-react'

const DAY_LABELS = { 'Mon': 'T2', 'Tue': 'T3', 'Wed': 'T4', 'Thu': 'T5', 'Fri': 'T6', 'Sat': 'T7', 'Sun': 'CN' }

function getViDay(date) {
    const en = format(date, 'EEE')
    return DAY_LABELS[en] || en
}

export default function FocusHeatmap() {
    const tasks = useTaskStore(s => s.tasks)
    const [focusHistory, setFocusHistory] = useState([])

    // Load focus history for last 7 days
    useEffect(() => {
        const loadHistory = async () => {
            const now = new Date()
            const dates = Array.from({ length: 7 }, (_, i) => format(subDays(now, 6 - i), 'yyyy-MM-dd'))
            const entries = await db.focusHistory
                .where('date')
                .anyOf(dates)
                .toArray()
            setFocusHistory(entries)
        }
        loadHistory()
    }, [tasks]) // re-load when tasks change (marks done etc.)

    const grid = useMemo(() => {
        const now = new Date()
        return Array.from({ length: 7 }, (_, i) => {
            const day = subDays(now, 6 - i)
            const dateStr = format(day, 'yyyy-MM-dd')
            const history = focusHistory.find(h => h.date === dateStr)
            const taskIds = history?.taskIds || []
            // Count how many of the focus tasks were completed
            const doneCount = taskIds.reduce((acc, id) => {
                const task = tasks.find(t => t.id === id)
                return acc + (task?.status === 'done' ? 1 : 0)
            }, 0)
            const totalSlots = 3
            return {
                day: getViDay(day),
                dateStr,
                isToday: isToday(day),
                hasFocus: taskIds.length > 0,
                doneCount: Math.min(doneCount, totalSlots),
                totalSlots,
                taskIds,
            }
        })
    }, [tasks, focusHistory])

    // Calculate streak
    const streak = useMemo(() => {
        let count = 0
        for (let i = grid.length - 1; i >= 0; i--) {
            if (grid[i].doneCount >= 1) count++
            else break
        }
        return count
    }, [grid])

    return (
        <section>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-secondary">
                    <Flame size={14} />
                    <span className="text-xs font-semibold uppercase tracking-wider">Focus consistency</span>
                </div>
                {streak > 1 && (
                    <span className="text-xs font-bold text-orange-400 flex items-center gap-1">
                        🔥 {streak} ngày liên tiếp
                    </span>
                )}
            </div>
            <div className="bg-surface border border-edge rounded-2xl p-3">
                <div className="grid grid-cols-7 gap-2">
                    {grid.map((col, ci) => (
                        <div key={ci} className="flex flex-col items-center gap-1.5">
                            {/* 3 dots per day */}
                            <div className="flex flex-col gap-1">
                                {Array.from({ length: col.totalSlots }, (_, si) => {
                                    const slotIndex = col.totalSlots - 1 - si // top = slot 3, bottom = slot 1
                                    const isFilled = slotIndex < col.doneCount
                                    const hasTask = slotIndex < col.taskIds.length
                                    return (
                                        <div
                                            key={si}
                                            className={`w-4 h-4 rounded-full transition-all duration-300
                        ${isFilled
                                                    ? 'bg-green-500 shadow-[0_0_6px_rgba(74,222,128,0.4)]'
                                                    : hasTask
                                                        ? 'bg-orange-500/30 border border-orange-500/40'
                                                        : 'bg-input border border-edge-2'}`}
                                        />
                                    )
                                })}
                            </div>
                            {/* Day label */}
                            <span className={`text-[10px] font-medium
                ${col.isToday ? 'text-accent' : 'text-secondary/60'}`}>
                                {col.day}
                            </span>
                        </div>
                    ))}
                </div>
                {/* Legend */}
                <div className="flex items-center justify-center gap-4 mt-3 pt-2 border-t border-edge">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        <span className="text-[10px] text-secondary">Done</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-orange-500/30 border border-orange-500/40" />
                        <span className="text-[10px] text-secondary">Chưa xong</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-input border border-edge-2" />
                        <span className="text-[10px] text-secondary">Trống</span>
                    </div>
                </div>
            </div>
        </section>
    )
}
