import { useMemo, useState } from 'react'
import { isPast, isToday, isTomorrow, parseISO } from 'date-fns'
import { AlertCircle, Clock, Zap, ChevronRight, Sparkles, Loader2, Info, Pencil, Check, ChevronDown } from 'lucide-react'
import { useTaskStore } from '../../store/taskStore'
import { CATEGORIES } from '../../services/db'
import { IMPACT_SCOPE, sortTasksByPrioritySync, loadCustomRules } from '../../services/priorityEngine'
import { rankTasksWithAI } from '../../services/ai'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

function getUrgencyTag(task) {
  if (task.deadline) {
    const dl = parseISO(task.deadline)
    if (isPast(dl) && !isToday(dl)) return { label: 'Quá hạn', color: '#dc2626', icon: AlertCircle }
    if (isToday(dl)) return { label: 'Hôm nay', color: '#ea580c', icon: Clock }
    if (isTomorrow(dl)) return { label: 'Ngày mai', color: '#d97706', icon: Clock }
  }
  if (task.priority === 'p0') return { label: 'Ưu tiên cao', color: '#dc2626', icon: Zap }
  if (task.priority === 'p1') return { label: 'Quan trọng', color: '#ea580c', icon: Zap }
  return { label: 'Cần xem', color: '#ca8a04', icon: Clock }
}

function ScoreBreakdown({ b }) {
  const rows = [
    { label: 'Priority base', val: b.base },
    b.deadlineBonus && { label: 'Deadline urgency', val: `+${b.deadlineBonus}` },
    b.urgencyBonus && { label: 'Keyword gấp', val: `+${b.urgencyBonus}` },
    b.deferPenalty && { label: 'Defer keyword', val: b.deferPenalty },
    b.agePenalty && { label: 'Task cũ', val: b.agePenalty },
    b.ruleBoost && { label: 'Custom rule', val: b.ruleBoost > 0 ? `+${b.ruleBoost}` : b.ruleBoost },
    { label: `Impact ×${b.multiplier}`, val: '', bold: true },
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

const SCOPE_DESC = {
  self:     'Chỉ ảnh hưởng bạn — có thể điều chỉnh lịch linh hoạt.',
  team:     'Người khác đang chờ kết quả — delay = block cả team.',
  client:   'Khách hàng / sếp đang theo dõi — trễ = mất điểm ngay.',
  critical: 'Không làm = mọi thứ dừng lại — ưu tiên tuyệt đối.',
}

const SCOPE_MULTIPLIERS = [1.0, 1.4, 1.8, 2.5]

export default function AttentionTasks() {
  const tasks = useTaskStore(s => s.tasks)
  const markDone = useTaskStore(s => s.markDone)
  const updateTask = useTaskStore(s => s.updateTask)
  const navigate = useNavigate()
  const [rules, setRules] = useState([])
  const [aiRanked, setAiRanked] = useState(null)   // null = not ranked yet
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [showBreakdown, setShowBreakdown] = useState(null)
  const [aiReason, setAiReason] = useState({})      // taskIndex → reason
  const [expandedId, setExpandedId] = useState(null)
  const [noteInput, setNoteInput] = useState('')

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
    if (!window.confirm('🤖 Dùng AI xếp hạng tasks? (tốn ~1 API call)')) return
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
          const isExpanded = expandedId === task.id
          const progress = task.progress ?? 0

          const scopeLevel = { self: 0, team: 1, client: 2, critical: 3 }[scope.id] ?? 0
          const barWidth = ['w-1', 'w-1', 'w-1.5', 'w-2'][scopeLevel]

          return (
            <div key={task.id} className="rounded-xl border overflow-hidden transition-all"
              style={{
                borderColor: isExpanded
                  ? tag.color + '66'
                  : scopeLevel >= 1 ? scope.color + '40' : undefined,
              }}
            >
              {/* ── Critical/Client banner ── */}
              {scopeLevel >= 2 && (
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold ${scope.text}`}
                  style={{ background: `linear-gradient(90deg, ${scope.color}22, transparent)` }}
                >
                  {scope.emoji} {scope.id === 'critical' ? 'CRITICAL — Ưu tiên tuyệt đối' : 'Client / Sếp đang theo dõi'}
                  <span className="ml-auto font-mono opacity-70">×{scope.multiplier}</span>
                </div>
              )}

              {/* ── Compact row ── */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : task.id)}
                role="button" tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setExpandedId(isExpanded ? null : task.id)}
                className="w-full text-left bg-surface flex transition-all hover:bg-hover active:scale-[0.99] cursor-pointer"
              >
                <div className={`${barWidth} shrink-0 self-stretch`} style={{ background: tag.color }} />

                <div className="flex items-start gap-2.5 px-3 py-2.5 flex-1 min-w-0">
                  {aiRanked ? (
                    <span className="w-5 h-5 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                  ) : (
                    <button
                      onClick={e => handleDone(e, task.id)}
                      className="w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center hover:opacity-70 mt-0.5"
                      style={{ borderColor: tag.color }}
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-fg truncate">{task.title}</p>
                    {reason && <p className="text-[11px] text-accent mt-0.5 leading-snug">{reason}</p>}
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold" style={{ color: tag.color }}>
                        <TagIcon size={10} /> {tag.label}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-edge-3 shrink-0" />
                      <span className="text-[10px] text-secondary">{cat?.label || 'Ad-hoc'}</span>
                      <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border ${scope.bg} ${scope.text} font-semibold`}
                        style={{ borderColor: scope.color + '30' }}>
                        {scope.emoji} {scope.label}
                        {scopeLevel >= 1 && <span className="font-mono opacity-80 ml-0.5">×{scope.multiplier}</span>}
                      </span>
                    </div>
                    {/* Mini progress bar (only when has progress) */}
                    {progress > 0 && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <div className="flex-1 h-1 bg-edge rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: tag.color }} />
                        </div>
                        <span className="text-[9px] text-secondary font-mono">{progress}%</span>
                      </div>
                    )}
                  </div>

                  <div className="relative shrink-0 flex flex-col items-end gap-1">
                    <button
                      onClick={e => { e.stopPropagation(); setShowBreakdown(showBreakdown === task.id ? null : task.id) }}
                      className="flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-md text-white hover:opacity-80"
                      style={{ background: tag.color }}
                    >
                      {task._score}
                      <Info size={9} className="opacity-70" />
                    </button>
                    <ChevronDown size={13} className={`text-secondary/40 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    {showBreakdown === task.id && task._breakdown && <ScoreBreakdown b={task._breakdown} />}
                  </div>
                </div>
              </div>

              {/* ── Quick panel (expanded) ── */}
              {isExpanded && (
                <div className="bg-input border-t px-3 py-3 space-y-3" style={{ borderColor: tag.color + '33' }}
                  onClick={e => e.stopPropagation()}
                >
                  {/* ── Impact scope block ── */}
                  <div className={`flex items-center gap-2.5 rounded-xl px-3 py-2 ${scope.bg}`}
                    style={{ border: `1px solid ${scope.color}25` }}>
                    <span className="text-lg shrink-0 leading-none">{scope.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[11px] font-bold ${scope.text}`}>{scope.label}</span>
                        <span className={`text-[10px] font-mono font-bold ${scope.text} opacity-70`}>×{scope.multiplier}</span>
                      </div>
                      <p className="text-[10px] text-secondary leading-snug">{SCOPE_DESC[scope.id]}</p>
                    </div>
                    {/* Multiplier bar chart */}
                    <div className="flex items-end gap-0.5 shrink-0">
                      {SCOPE_MULTIPLIERS.map((m, i) => (
                        <div key={i} className="w-1.5 rounded-sm"
                          style={{
                            height: `${8 + i * 4}px`,
                            background: m <= scope.multiplier ? scope.color : scope.color + '20',
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Meta: notes + deadline */}
                  {(task.notes || task.deadline) && (
                    <div className="space-y-1">
                      {task.notes && (
                        <p className="text-xs text-secondary leading-relaxed line-clamp-3">{task.notes}</p>
                      )}
                      {task.deadline && (
                        <p className="text-[11px] text-secondary">
                          📅 {task.deadline}
                          {isPast(parseISO(task.deadline)) && !isToday(parseISO(task.deadline)) &&
                            <span className="text-red-400 ml-1 font-medium">— quá hạn</span>}
                        </p>
                      )}
                    </div>
                  )}

                  {/* ── Progress track ── */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] text-secondary font-medium">Tiến độ</span>
                      <span className="text-[11px] font-bold text-fg">{progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-edge rounded-full overflow-hidden mb-2">
                      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: tag.color }} />
                    </div>
                    <div className="flex gap-1">
                      {[0, 25, 50, 75, 100].map(p => (
                        <button
                          key={p}
                          onClick={e => { e.stopPropagation(); updateTask(task.id, { progress: p }) }}
                          className={`flex-1 h-8 rounded-lg text-[10px] font-semibold transition-colors
                            ${progress === p ? 'text-white' : 'bg-surface text-secondary hover:bg-hover'}`}
                          style={progress === p ? { background: tag.color } : {}}
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── Note log ── */}
                  <div>
                    <p className="text-[11px] text-secondary font-medium mb-1.5">Ghi chú tiến độ</p>
                    <div className="flex gap-1.5">
                      <input
                        value={noteInput}
                        onChange={e => setNoteInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && noteInput.trim()) {
                            const entry = { at: new Date().toISOString(), note: noteInput.trim(), progress }
                            updateTask(task.id, { progressLog: [...(task.progressLog || []), entry] })
                            setNoteInput('')
                          }
                        }}
                        placeholder="Ghi nhanh... (Enter để lưu)"
                        className="flex-1 bg-surface border border-edge rounded-lg px-2.5 py-1.5 text-xs text-fg placeholder-secondary/50 focus:outline-none focus:border-accent"
                      />
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          if (!noteInput.trim()) return
                          const entry = { at: new Date().toISOString(), note: noteInput.trim(), progress }
                          updateTask(task.id, { progressLog: [...(task.progressLog || []), entry] })
                          setNoteInput('')
                        }}
                        className="h-8 px-2.5 bg-accent hover:bg-accent-muted text-white rounded-lg text-xs font-semibold transition-colors shrink-0"
                      >
                        +
                      </button>
                    </div>

                    {/* Log entries */}
                    {(task.progressLog?.length > 0) && (
                      <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                        {[...(task.progressLog)].reverse().map((entry, i) => (
                          <div key={i} className="flex items-start gap-2 text-[10px]">
                            <span className="text-secondary/50 shrink-0 mt-0.5 font-mono">
                              {new Date(entry.at).toLocaleDateString('vi', { month: 'numeric', day: 'numeric' })}
                              {' '}
                              {new Date(entry.at).toLocaleTimeString('vi', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-secondary flex-1 leading-snug">{entry.note}</span>
                            <span className="text-secondary/40 shrink-0 font-mono">{entry.progress}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── Actions (separated clearly) ── */}
                  <div className="flex gap-2 pt-1 border-t border-edge">
                    <button
                      onClick={e => { e.stopPropagation(); handleDone(e, task.id) }}
                      className="flex-1 h-9 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Check size={13} /> Hoàn thành
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); navigate('/tasks', { state: { openTaskId: task.id } }) }}
                      className="flex-1 h-9 bg-surface border border-edge hover:bg-hover text-fg rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Pencil size={13} /> Chỉnh sửa
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
