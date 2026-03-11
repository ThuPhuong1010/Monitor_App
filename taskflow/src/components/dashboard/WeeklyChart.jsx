import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { format, subDays, isToday } from 'date-fns'
import { vi } from 'date-fns/locale'
import { useTaskStore } from '../../store/taskStore'
import { BarChart3 } from 'lucide-react'

const DAY_LABELS = { 'Mon': 'T2', 'Tue': 'T3', 'Wed': 'T4', 'Thu': 'T5', 'Fri': 'T6', 'Sat': 'T7', 'Sun': 'CN' }

function getViDay(date) {
    const en = format(date, 'EEE')
    return DAY_LABELS[en] || en
}

const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const { fullDate, done } = payload[0].payload
    return (
        <div className="bg-surface border border-edge rounded-lg px-2.5 py-1.5 shadow-lg">
            <p className="text-[11px] text-secondary">{fullDate}</p>
            <p className="text-sm font-bold text-fg">{done} task{done !== 1 ? 's' : ''}</p>
        </div>
    )
}

const CustomBarLabel = ({ x, y, width, value }) => {
    if (!value) return null
    return (
        <text x={x + width / 2} y={y - 6} fill="var(--color-secondary)" textAnchor="middle" fontSize={11} fontWeight={600}>
            {value}
        </text>
    )
}

export default function WeeklyChart() {
    const tasks = useTaskStore(s => s.tasks)

    const data = useMemo(() => {
        const now = new Date()
        return Array.from({ length: 7 }, (_, i) => {
            const day = subDays(now, 6 - i)
            const dateStr = format(day, 'yyyy-MM-dd')
            const done = tasks.filter(t => t.doneAt?.slice(0, 10) === dateStr).length
            return {
                name: getViDay(day),
                done,
                isToday: isToday(day),
                fullDate: format(day, 'd MMMM', { locale: vi }),
            }
        })
    }, [tasks])

    const maxDone = Math.max(...data.map(d => d.done), 1)

    return (
        <section>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-secondary">
                    <BarChart3 size={14} />
                    <span className="text-xs font-semibold uppercase tracking-wider">Completion 7 ngày</span>
                </div>
                <span className="text-xs text-secondary/60">{data.reduce((s, d) => s + d.done, 0)} tasks</span>
            </div>
            <div className="bg-surface border border-edge rounded-2xl p-3">
                <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={data} barCategoryGap="20%">
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--color-secondary)', fontSize: 11 }}
                        />
                        <YAxis hide domain={[0, maxDone + 1]} />
                        <Tooltip content={<CustomTooltip />} cursor={false} />
                        <Bar dataKey="done" radius={[6, 6, 0, 0]} label={<CustomBarLabel />}>
                            {data.map((entry, i) => (
                                <Cell
                                    key={i}
                                    fill={entry.isToday ? '#4ade80' : '#6366f1'}
                                    fillOpacity={entry.isToday ? 1 : 0.8}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </section>
    )
}
