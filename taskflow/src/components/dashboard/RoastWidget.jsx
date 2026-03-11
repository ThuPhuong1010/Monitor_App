import { useState, useEffect, useMemo } from 'react'
import { Flame, RefreshCw, Loader2, Skull, Trophy, AlertTriangle } from 'lucide-react'
import { useTaskStore } from '../../store/taskStore'
import { useGoalStore } from '../../store/goalStore'
import { isPast, isToday, parseISO, differenceInDays } from 'date-fns'
import { callAI } from '../../services/ai'

// ─── Static roasts (fallback khi không có API key) ───────────

const STATIC_ROASTS = {
    terrible: [
        '💀 Tao nhìn data mày mà muốn khóc. {overdue} task quá hạn, hôm nay done {done}. Mày đang sống hay đang tồn tại?',
        '🤡 {overdue} task quá hạn + {done}/3 focus done = mày đang tự lừa mình. Tỉnh lại đi!',
        '😤 {pending} task pending mà hôm nay mới done {done}? Mày đang chơi game à? LÀM ĐI!',
    ],
    bad: [
        '💀 {overdue} task quá hạn. Mày hứa gì với chính mình rồi? Thất hứa hoài vậy?',
        '😤 Done {done} hôm nay nhưng vẫn còn {overdue} quá hạn. Đừng tự khen sớm!',
        '🔥 Mày có {pending} task pending. Tốc độ này thì Tết sang năm chưa xong đâu.',
    ],
    okay: [
        '⚡ Done {done} hôm nay, không tệ. Nhưng vẫn còn {pending} pending. Đừng dừng lại!',
        '😤 Ừ được rồi, {done} task xong. Nhưng tao thấy mày có thể hơn thế. Push thêm đi!',
        '🔥 {done} done — acceptable. Nhưng nhìn {pending} task kia kìa, mày còn lười được bao lâu?',
    ],
    good: [
        '⚡ {done} task done, 0 quá hạn. Giỏi lắm... nhưng đừng tưởng thế là xong. Ngày mai phải hơn!',
        '🔥 Impressive — {done} done, sạch quá hạn. Nhưng tao biết mày có thể push thêm. GO!',
        '💪 Ừ hôm nay mày OK. {done} done, không nợ. Nhưng consistency mới là key. Ngày mai nhé!',
    ],
}

function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
}

function getScoreEmoji(score) {
    if (score >= 80) return { icon: Trophy, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20', label: 'GOOD JOB' }
    if (score >= 50) return { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'TẠM ĐƯỢC' }
    if (score >= 25) return { icon: Flame, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20', label: 'CẦN CỐ' }
    return { icon: Skull, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'THẢM HỌA' }
}

export default function RoastWidget() {
    const tasks = useTaskStore(s => s.tasks)
    const focusTasks = useTaskStore(s => s.focusTasks)
    const goals = useGoalStore(s => s.goals)
    const [roast, setRoast] = useState('')
    const [loading, setLoading] = useState(false)
    const [aiAvailable, setAiAvailable] = useState(true)

    const today = new Date().toISOString().slice(0, 10)

    const stats = useMemo(() => {
        const pending = tasks.filter(t => t.status !== 'done')
        const overdue = pending.filter(t => t.deadline && isPast(parseISO(t.deadline)) && !isToday(parseISO(t.deadline)))
        const doneToday = tasks.filter(t => t.doneAt?.slice(0, 10) === today)
        const focusDone = focusTasks
            .map(id => tasks.find(t => t.id === id))
            .filter(t => t?.status === 'done').length
        const focusTotal = focusTasks.length

        // Oldest overdue
        const oldestOverdue = overdue
            .filter(t => t.deadline)
            .sort((a, b) => a.deadline.localeCompare(b.deadline))[0]
        const oldestDays = oldestOverdue ? differenceInDays(new Date(), parseISO(oldestOverdue.deadline)) : 0

        // Score: 0-100
        let score = 50
        score += doneToday.length * 10        // +10 per done today
        score += focusDone * 8                 // +8 per focus done
        score -= overdue.length * 12           // -12 per overdue
        score -= (pending.length > 10 ? 10 : 0) // -10 if too many pending
        if (focusTotal > 0 && focusDone === 0) score -= 15 // -15 if 0 focus done
        if (focusTotal === 0) score -= 10      // -10 if no focus selected
        score = Math.max(0, Math.min(100, score))

        return {
            pending: pending.length,
            overdue: overdue.length,
            done: doneToday.length,
            focusDone,
            focusTotal,
            oldestOverdue,
            oldestDays,
            score,
            overdueList: overdue.slice(0, 3).map(t => t.title),
            activeGoals: goals.filter(g => g.status !== 'done').length,
        }
    }, [tasks, focusTasks, goals, today])

    const generateStaticRoast = () => {
        let tier = 'okay'
        if (stats.score >= 80) tier = 'good'
        else if (stats.score >= 50) tier = 'okay'
        else if (stats.score >= 25) tier = 'bad'
        else tier = 'terrible'

        return pickRandom(STATIC_ROASTS[tier])
            .replace('{overdue}', stats.overdue)
            .replace('{done}', stats.done)
            .replace('{pending}', stats.pending)
            .replace('{focusDone}', stats.focusDone)
            .replace('{focusTotal}', stats.focusTotal)
    }

    const generateAIRoast = async () => {
        setLoading(true)
        try {
            const context = [
                `Hôm nay: ${today}`,
                `Tasks pending: ${stats.pending}`,
                `Tasks quá hạn: ${stats.overdue}${stats.overdueList.length ? ' (' + stats.overdueList.join(', ') + ')' : ''}`,
                stats.oldestOverdue ? `Task quá hạn lâu nhất: "${stats.oldestOverdue.title}" — ${stats.oldestDays} ngày rồi` : '',
                `Done hôm nay: ${stats.done}`,
                `Focus: ${stats.focusDone}/${stats.focusTotal}`,
                stats.focusTotal === 0 ? 'CHƯA CHỌN FOCUS TASK!' : '',
                `Goals active: ${stats.activeGoals}`,
                `Điểm đánh giá: ${stats.score}/100`,
            ].filter(Boolean).join('\n')

            const result = await callAI(
                `Mày là "Đại Ca" TaskFlow — đánh giá và chửi user dựa trên data THỰC TẾ bên dưới. Quy tắc:
- Xưng "tao", gọi "mày"
- Phân tích DATA cụ thể (mention task quá hạn bao nhiêu ngày, số liệu thực)
- Nếu score thấp (<30): CHỬI THẲNG MẶT, toxic, không thương tiếc
- Nếu score trung bình (30-60): Chê nhưng cho gợi ý cụ thể
- Nếu score cao (>60): Khen nhẹ rồi push thêm, kiểu "ừ được nhưng đừng tự mãn"
- Tối đa 4-5 câu, ngắn gọn đanh thép
- Dùng emoji 🔥💀😤🤡⚡💪
- Phải mention CỤ THỂ task nào quá hạn (nếu có), không nói chung chung
- Kết thúc bằng 1 câu action cụ thể

Dữ liệu THỰC TẾ:
${context}`,
                300
            )
            setRoast(result)
            setAiAvailable(true)
        } catch (e) {
            // Fallback to static
            setRoast(generateStaticRoast())
            setAiAvailable(false)
        } finally {
            setLoading(false)
        }
    }

    // Auto-generate on mount
    useEffect(() => {
        if (tasks.length > 0 && !roast) {
            generateAIRoast()
        }
    }, [tasks.length > 0])

    const scoreInfo = getScoreEmoji(stats.score)
    const ScoreIcon = scoreInfo.icon

    if (tasks.length === 0) return null

    return (
        <div className={`rounded-xl border p-4 space-y-3 ${scoreInfo.bg} ${scoreInfo.border}`}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ScoreIcon size={16} className={scoreInfo.color} />
                    <span className={`text-xs font-bold uppercase tracking-wider ${scoreInfo.color}`}>
                        Đại Ca đánh giá: {scoreInfo.label}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {/* Score badge */}
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreInfo.bg} ${scoreInfo.color} border ${scoreInfo.border}`}>
                        {stats.score}/100
                    </span>
                    <button
                        onClick={generateAIRoast}
                        disabled={loading}
                        className="p-1.5 rounded-lg text-secondary hover:text-fg hover:bg-hover transition-colors disabled:opacity-40"
                        title="Đánh giá lại"
                    >
                        {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    </button>
                </div>
            </div>

            {/* Roast text */}
            {roast ? (
                <p className="text-sm text-fg leading-relaxed whitespace-pre-wrap">
                    {roast}
                </p>
            ) : loading ? (
                <div className="flex items-center gap-2 py-2">
                    <Loader2 size={14} className="animate-spin text-secondary" />
                    <span className="text-xs text-secondary">Đại Ca đang ngắm data mày...</span>
                </div>
            ) : null}

            {/* Quick stats bar */}
            <div className="flex gap-3 text-[10px] font-medium text-secondary pt-1 border-t border-current/10">
                <span>📋 {stats.pending} pending</span>
                <span className={stats.overdue > 0 ? 'text-red-500 font-bold' : ''}>
                    ⚠️ {stats.overdue} quá hạn
                </span>
                <span>✅ {stats.done} done hôm nay</span>
                <span>🎯 {stats.focusDone}/{stats.focusTotal} focus</span>
            </div>

            {/* Overdue task names */}
            {stats.overdueList.length > 0 && (
                <div className="text-[10px] text-red-500/80 space-y-0.5">
                    {stats.overdueList.map((title, i) => (
                        <p key={i} className="truncate">💀 {title}</p>
                    ))}
                </div>
            )}

            {!aiAvailable && (
                <p className="text-[9px] text-secondary/50 italic">
                    (AI chưa có key — đang dùng đánh giá tĩnh. Vào Settings thêm API key để Đại Ca chửi chi tiết hơn 🔥)
                </p>
            )}
        </div>
    )
}
