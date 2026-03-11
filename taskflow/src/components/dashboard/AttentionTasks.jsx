import { useMemo, useState } from 'react'
import { isPast, isToday, isTomorrow, parseISO } from 'date-fns'
import { AlertCircle, Clock, Zap, ChevronRight, Sparkles, Loader2, Info } from 'lucide-react'
import { useTaskStore } from '../../store/taskStore'
import { CATEGORIES } from '../../services/db'
import { IMPACT_SCOPE, sortTasksByPrioritySync, loadCustomRules } from '../../services/priorityEngine'
import { rankTasksWithAI } from '../../services/ai'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

function getUrgencyTag(task) {
  if (task.deadline) {
    const dl = parseISO(task.deadline)
    if (isPast(dl) && !isToday(dl)) return { label: 'Quá hạn',  color: '#dc2626', icon: AlertCircle }
    if (isToday(dl))               return { label: 'Hôm nay',  color: '#ea580c', icon: Clock }
    if (isTomorrow(dl))            return { label: 'Ngày mai', color: '#d97706', icon: Clock }
  }
  if (task.priority === 'p0') return { label: 'Ưu tiên cao', color: '#dc2626', icon: Zap }
  if (task.priority === 'p1') return { label: 'Quan trọng',  color: '#ea580c', icon: Zap }
  return { label: 'Cần xem',  color: '#ca8a04', icon: Clock }
}

function ScoreBreakdown({ b }) {
  const rows = [
    { label: 'Priority base', val: b.base },
    b.deadlineBonus && { label: 'Deadline urgency', val: `+${b.deadlineBonus}` },
    b.urgencyBonus  && { label: 'Keyword gấp',      val: `+${b.urgencyBonus}` },
    b.deferPenalty  && { label: 'Defer keyword',     val: b.deferPenalty },
    b.agePenalty    && { label: 'Task cũ',           val: b.agePenalty },
    b.ruleBoost     && { label: 'Custom rule',        val: b.ruleBoost > 0 ? `+${b.ruleBoost}` : b.ruleBoost },
    { label: `Impact ×${b.multiplier}`,  val: '', bold: true },
  ].filter(Boolean)
  return (
    <div className="absolute z-20 right-0 top-8 w-44 bg-elevated border border-edge rounded-xl p-2.5 shadow-xl text-[10px] space-y-1">
      {rows.map(r => (
        <div key={r.label} className={`flex justify-between gap-2 ${r.bold ? 'font-bold text-accent border-t border-edge pt-1 mt-1' : ''}`}>
          <span className="text-secondary">{r.label}</span>
          {r.val !== '' && <span className="text-fg font-mono">{r.val}</span>}
        </div>
      ))}
    </div>
  )
}

export default function AttentionTasks() {
  const tasks = useTaskStore(s => s.tasks)
  const markDone = useTaskStore(s => s.markDone)
  const navigate = useNavigate()
  const [rules, setRules] = useState([])
  const [aiRanked, setAiRanked] = useState(null)   // null = not ranked yet
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [showBreakdown, setShowBreakdown] = useState(null)
  const [aiReason, setAiReason] = useState({})      // taskIndex → reason

  useEffect(() => {
    loadCustomRules().then(setRules)
  }, [])

  // Score all pending tasks using engine
  const scored = useMemo(() =>
    sortTasksByPrioritySync(tasks, rules)
      .filter(t => t._score >= 25)
      .slice(0, 8),
    [tasks, rules]
  )

  // Apply AI ranking order if available
  const attentionTasks = useMemo(() => {
    if (!aiRanked || aiRanked.length === 0) return scored.slice(0, 5)
    // Re-order scored tasks per AI rank
    const ordered = []
    for (const r of aiRanked) {
      const t = scored[r.taskIndex - 1]
      if (t) ordered.push(t)
    }
    // Add any scored tasks not in AI result
    for (const t of scored) {
      if (!ordered.find(o => o.id === t.id)) ordered.push(t)
    }
    return ordered.slice(0, 5)
  }, [scored, aiRanked])

  if (scored.length === 0) return null

  const handleDone = (e, taskId) => {
    e.stopPropagation()
    if (navigator.vibrate) navigator.vibrate(40)
    markDone(taskId)
  }

  const handleAiRank = async () => {
    setAiLoading(true)
    setAiError('')
    setAiRanked(null)
    try {
      const result = await rankTasksWithAI(scored)
      setAiRanked(result)
      // Build reason map from AI result
      const reasonMap = {}
      for (const r of result) {
        const t = scored[r.taskIndex - 1]
        if (t) reasonMap[t.id] = r.reason
      }
      setAiReason(reasonMap)
    } catch (e) {
      setAiError(e.message === 'NO_API_KEY' ? 'Chưa có API key' : 'AI lỗi: ' + e.message)
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <section className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-red-600">Cần chú ý</span>
          {aiRanked && (
            <span className="text-[10px] text-accent bg-accent-soft px-1.5 py-0.5 rounded-full font-medium">AI ranked</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAiRank}
            disabled={aiLoading}
            className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg transition-colors
              ${aiLoading ? 'opacity-50' : 'bg-accent-soft text-accent hover:bg-accent-border'}`}
          >
            {aiLoading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
            AI Rank
          </button>
          <button onClick={() => navigate('/tasks')} className="text-xs text-accent hover:text-accent-muted flex items-center gap-0.5 font-medium">
            Xem tất cả <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {aiError && <p className="text-[11px] text-red-400 mb-2">{aiError}</p>}

      <div className="space-y-1.5">
        {attentionTasks.map((task, idx) => {
          const tag = getUrgencyTag(task)
          const TagIcon = tag.icon
          const cat = CATEGORIES[task.category]
          const scope = IMPACT_SCOPE[task._scope || 'self']
          const reason = aiReason[task.id]

          return (
            <button
              key={task.id}
              onClick={() => navigate('/tasks')}
              className="w-full text-left bg-surface rounded-xl border border-edge overflow-hidden flex transition-all hover:border-edge-2 hover:shadow-sm active:scale-[0.99]"
            >
              {/* Colored left accent bar */}
              <div className="w-1 shrink-0 self-stretch" style={{ background: tag.color }} />

              <div className="flex items-start gap-2.5 px-3 py-2.5 flex-1 min-w-0">
                {/* AI rank number or done button */}
                {aiRanked ? (
                  <span className="w-5 h-5 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                ) : (
                  <button
                    onClick={(e) => handleDone(e, task.id)}
                    className="w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center hover:opacity-70 mt-0.5"
                    style={{ borderColor: tag.color }}
                  />
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-fg truncate">{task.title}</p>

                  {/* AI reason */}
                  {reason && (
                    <p className="text-[11px] text-accent mt-0.5 leading-snug">{reason}</p>
                  )}

                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold" style={{ color: tag.color }}>
                      <TagIcon size={10} /> {tag.label}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-edge-3 shrink-0" />
                    <span className="text-[10px] text-secondary">{cat?.label || 'Ad-hoc'}</span>

                    {/* Impact scope badge */}
                    <span className={`inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded ${scope.bg} ${scope.text} font-medium`}>
                      {scope.emoji} {scope.label}
                    </span>
                  </div>
                </div>

                {/* Score + breakdown toggle */}
                <div className="relative shrink-0 flex flex-col items-end gap-1">
                  <button
                    onClick={e => { e.stopPropagation(); setShowBreakdown(showBreakdown === task.id ? null : task.id) }}
                    className="flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-md text-white hover:opacity-80"
                    style={{ background: tag.color }}
                  >
                    {task._score}
                    <Info size={9} className="opacity-70" />
                  </button>

                  {showBreakdown === task.id && task._breakdown && (
                    <ScoreBreakdown b={task._breakdown} />
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
