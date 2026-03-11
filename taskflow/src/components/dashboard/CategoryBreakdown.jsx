import { useMemo } from 'react'
import { useTaskStore } from '../../store/taskStore'
import { CATEGORIES } from '../../services/db'
import { Layers } from 'lucide-react'

export default function CategoryBreakdown() {
    const tasks = useTaskStore(s => s.tasks)

    const breakdown = useMemo(() => {
        return Object.entries(CATEGORIES).map(([key, cat]) => {
            const catTasks = tasks.filter(t => t.category === key)
            const done = catTasks.filter(t => t.status === 'done').length
            const pending = catTasks.filter(t => t.status !== 'done').length
            const total = done + pending
            return { key, ...cat, done, pending, total }
        })
    }, [tasks])

    const maxTotal = Math.max(...breakdown.map(b => b.total), 1)

    return (
        <section>
            <div className="flex items-center gap-1.5 text-secondary mb-2">
                <Layers size={14} />
                <span className="text-xs font-semibold uppercase tracking-wider">Theo category</span>
            </div>
            <div className="bg-surface border border-edge rounded-2xl p-3 space-y-3">
                {breakdown.map(cat => {
                    const donePct = cat.total > 0 ? (cat.done / maxTotal) * 100 : 0
                    const pendingPct = cat.total > 0 ? (cat.pending / maxTotal) * 100 : 0
                    return (
                        <div key={cat.key}>
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color }} />
                                    <span className="text-xs font-medium text-fg">{cat.label}</span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px]">
                                    <span className="text-green-500 font-medium">{cat.done} ✓</span>
                                    <span className="text-secondary">{cat.pending} pending</span>
                                </div>
                            </div>
                            {/* Stacked horizontal bar */}
                            <div className="flex h-2 rounded-full overflow-hidden bg-input">
                                {cat.done > 0 && (
                                    <div
                                        className="h-full rounded-l-full transition-all duration-500"
                                        style={{
                                            width: `${donePct}%`,
                                            background: cat.color,
                                            opacity: 1,
                                        }}
                                    />
                                )}
                                {cat.pending > 0 && (
                                    <div
                                        className="h-full transition-all duration-500"
                                        style={{
                                            width: `${pendingPct}%`,
                                            background: cat.color,
                                            opacity: 0.25,
                                            borderRadius: cat.done === 0 ? '9999px 0 0 9999px' : '0',
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </section>
    )
}
