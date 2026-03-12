import { useState } from 'react'
import { X, Calendar, Clock, Flag, Tag, Repeat, CalendarRange } from 'lucide-react'
import { useTaskStore } from '../../store/taskStore'
import { CATEGORIES, PRIORITIES } from '../../services/db'

const RECURRING_OPTIONS = [
    { value: null, label: 'Không lặp', icon: '—' },
    { value: 'daily', label: 'Hàng ngày', icon: '📅' },
    { value: 'weekly', label: 'Hàng tuần', icon: '📆' },
    { value: 'monthly', label: 'Hàng tháng', icon: '🗓️' },
]

export default function QuickAddModal({ date, hour, onClose }) {
    const addTask = useTaskStore(s => s.addTask)

    const [title, setTitle] = useState('')
    const [category, setCategory] = useState('work')
    const [priority, setPriority] = useState('p2')
    const [startDate, setStartDate] = useState(date || '')
    const [deadline, setDeadline] = useState('')
    const [recurring, setRecurring] = useState(null)
    const [estimatedMinutes, setEstimatedMinutes] = useState('')
    const [notes, setNotes] = useState('')
    const [showMore, setShowMore] = useState(false)
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        if (!title.trim()) return
        setSaving(true)
        await addTask({
            title: title.trim(),
            category,
            priority,
            startDate: startDate || null,
            deadline: deadline || startDate || null,
            recurring: recurring || null,
            estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) : null,
            notes: notes.trim() || null,
        })
        setSaving(false)
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Modal */}
            <div
                onClick={e => e.stopPropagation()}
                className="relative w-full max-w-md bg-surface border border-edge rounded-t-2xl sm:rounded-2xl p-4 space-y-3 shadow-2xl animate-slide-up"
            >
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-fg flex items-center gap-2">
                        <Calendar size={14} className="text-accent" />
                        Thêm task
                        {hour !== undefined && <span className="text-secondary font-normal">lúc {hour}:00</span>}
                    </h3>
                    <button onClick={onClose} className="w-7 h-7 rounded-lg bg-input flex items-center justify-center text-secondary hover:text-fg">
                        <X size={14} />
                    </button>
                </div>

                {/* Title input */}
                <input
                    autoFocus
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSave()}
                    placeholder="Tên task..."
                    className="w-full bg-input border border-edge rounded-xl px-3 py-2.5 text-sm text-fg placeholder-secondary/50 focus:outline-none focus:border-accent transition-colors"
                />

                {/* Date range row: Start → Deadline */}
                <div>
                    <label className="text-[10px] text-secondary font-semibold uppercase tracking-wider flex items-center gap-1 mb-1.5">
                        <CalendarRange size={10} /> Thời gian
                    </label>
                    <div className="flex items-center gap-2">
                        <div className="flex-1">
                            <span className="text-[9px] text-secondary block mb-0.5">Bắt đầu</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="w-full bg-input border border-edge rounded-lg px-2.5 py-1.5 text-xs text-fg focus:outline-none focus:border-accent transition-colors"
                            />
                        </div>
                        <span className="text-secondary mt-4">→</span>
                        <div className="flex-1">
                            <span className="text-[9px] text-secondary block mb-0.5">Deadline</span>
                            <input
                                type="date"
                                value={deadline}
                                onChange={e => setDeadline(e.target.value)}
                                min={startDate || undefined}
                                className="w-full bg-input border border-edge rounded-lg px-2.5 py-1.5 text-xs text-fg focus:outline-none focus:border-accent transition-colors"
                            />
                        </div>
                    </div>
                </div>

                {/* Quick chips: Category */}
                <div>
                    <label className="text-[10px] text-secondary font-semibold uppercase tracking-wider flex items-center gap-1 mb-1.5">
                        <Tag size={10} /> Category
                    </label>
                    <div className="flex gap-1.5 flex-wrap">
                        {Object.entries(CATEGORIES).map(([key, cat]) => (
                            <button
                                key={key}
                                onClick={() => setCategory(key)}
                                className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-all border
                  ${category === key
                                        ? `border-current ${cat.text} ${cat.bg}`
                                        : 'border-transparent bg-input text-secondary hover:bg-hover'}`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Quick chips: Priority */}
                <div>
                    <label className="text-[10px] text-secondary font-semibold uppercase tracking-wider flex items-center gap-1 mb-1.5">
                        <Flag size={10} /> Priority
                    </label>
                    <div className="flex gap-1.5">
                        {Object.entries(PRIORITIES).map(([key, pri]) => (
                            <button
                                key={key}
                                onClick={() => setPriority(key)}
                                className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-all border
                  ${priority === key
                                        ? `border-current ${pri.color} ${pri.bg}`
                                        : 'border-transparent bg-input text-secondary hover:bg-hover'}`}
                            >
                                {key.toUpperCase()} {pri.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Recurring */}
                <div>
                    <label className="text-[10px] text-secondary font-semibold uppercase tracking-wider flex items-center gap-1 mb-1.5">
                        <Repeat size={10} /> Lặp lại
                    </label>
                    <div className="flex gap-1.5">
                        {RECURRING_OPTIONS.map(opt => (
                            <button
                                key={opt.value || 'none'}
                                onClick={() => setRecurring(opt.value)}
                                className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-all border
                  ${recurring === opt.value
                                        ? 'border-accent/50 text-accent bg-accent/10'
                                        : 'border-transparent bg-input text-secondary hover:bg-hover'}`}
                            >
                                {opt.icon} {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* More options toggle */}
                <button
                    onClick={() => setShowMore(!showMore)}
                    className="text-[11px] text-accent hover:text-accent-muted font-medium"
                >
                    {showMore ? '▾ Ẩn chi tiết' : '▸ Thêm chi tiết'}
                </button>

                {showMore && (
                    <div className="space-y-2.5">
                        {/* Estimated time */}
                        <div>
                            <label className="text-[10px] text-secondary font-semibold uppercase tracking-wider flex items-center gap-1 mb-1">
                                <Clock size={10} /> Ước tính (phút)
                            </label>
                            <input
                                type="number"
                                value={estimatedMinutes}
                                onChange={e => setEstimatedMinutes(e.target.value)}
                                placeholder="30"
                                className="w-full bg-input border border-edge rounded-xl px-3 py-2 text-sm text-fg placeholder-secondary/50 focus:outline-none focus:border-accent"
                            />
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="text-[10px] text-secondary font-semibold uppercase tracking-wider mb-1 block">
                                Ghi chú
                            </label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Ghi chú thêm..."
                                rows={2}
                                className="w-full bg-input border border-edge rounded-xl px-3 py-2 text-sm text-fg placeholder-secondary/50 focus:outline-none focus:border-accent resize-none"
                            />
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                    <button
                        onClick={onClose}
                        className="flex-1 h-10 rounded-xl bg-input hover:bg-hover text-secondary text-sm font-medium transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!title.trim() || saving}
                        className="flex-1 h-10 rounded-xl bg-accent hover:bg-accent-muted disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                    >
                        {saving ? 'Đang lưu...' : 'Thêm task'}
                    </button>
                </div>
            </div>
        </div>
    )
}
