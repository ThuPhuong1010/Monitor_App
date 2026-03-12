import { useState, useEffect, useMemo } from 'react'
import { Check, Plus, X, ChevronRight, RotateCcw, Sparkles, Loader2, ChevronDown, Pencil } from 'lucide-react'
import { isPast, isToday, parseISO } from 'date-fns'
import { InlinePomodoro } from './PomodoroTimer'
import { useTaskStore } from '../../store/taskStore'
import { db } from '../../services/db'
import { suggestDailyPlan } from '../../services/ai'
import { detectImpactScope, IMPACT_SCOPE } from '../../services/priorityEngine'
import CategoryChip from '../ui/CategoryChip'
import PriorityBadge from '../ui/PriorityBadge'
import Sheet from '../ui/Sheet'
import { useNavigate } from 'react-router-dom'

const SCOPE_DESC = {
  self:     'Chỉ ảnh hưởng bạn — có thể điều chỉnh lịch linh hoạt.',
  team:     'Người khác đang chờ kết quả — delay = block cả team.',
  client:   'Khách hàng / sếp đang theo dõi — trễ = mất điểm ngay.',
  critical: 'Không làm = mọi thứ dừng lại — ưu tiên tuyệt đối.',
}
const SCOPE_MULTIPLIERS = [1.0, 1.4, 1.8, 2.5]

export default function FocusBoard() {
  const tasks = useTaskStore(s => s.tasks)
  const focusTasks = useTaskStore(s => s.focusTasks)
  const addToFocus = useTaskStore(s => s.addToFocus)
  const removeFromFocus = useTaskStore(s => s.removeFromFocus)
  const markDone = useTaskStore(s => s.markDone)
  const updateTask = useTaskStore(s => s.updateTask)
  const setFocus = useTaskStore(s => s.setFocus)
  const navigate = useNavigate()
  const [showPicker, setShowPicker] = useState(false)
  const [search, setSearch] = useState('')
  const [carryOver, setCarryOver] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [noteInput, setNoteInput] = useState('')

  // AI suggest state
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState(null)

  const focusItems = focusTasks.map(id => tasks.find(t => t.id === id)).filter(Boolean)
  const slots = [0, 1, 2]

  // Load yesterday's unfinished focus tasks
  useEffect(() => {
    if (focusTasks.length > 0) return // already has focus today, skip
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yStr = yesterday.toISOString().slice(0, 10)
    db.focusHistory.where('date').equals(yStr).first().then(hist => {
      if (!hist?.taskIds?.length) return
      const unfinished = hist.taskIds
        .map(id => tasks.find(t => t.id === id))
        .filter(t => t && t.status !== 'done')
      setCarryOver(unfinished)
    })
  }, [tasks, focusTasks])

  const available = useMemo(() => tasks.filter(t =>
    t.status !== 'done' &&
    !focusTasks.includes(t.id) &&
    (!search || t.title.toLowerCase().includes(search.toLowerCase()))
  ), [tasks, focusTasks, search])

  const handleDone = (task) => {
    if (navigator.vibrate) navigator.vibrate(40)
    markDone(task.id)
  }

  const handleCarryOver = async (task) => {
    await addToFocus(task.id)
    setCarryOver(prev => prev.filter(t => t.id !== task.id))
  }

  const handleAISuggest = async () => {
    if (!window.confirm('🤖 Dùng AI gợi ý focus hôm nay? (tốn ~1 API call)')) return
    setAiLoading(true)
    setAiSuggestion(null)
    try {
      const pending = tasks.filter(t => t.status !== 'done')
      if (pending.length === 0) {
        setAiSuggestion({ reasoning: 'Mày hết task rồi, đi tạo task mới đi! 🔥', suggestedIds: [] })
        return
      }

      // Build summary with scores
      const summary = pending.map(t => {
        const result = scoreTask(t)
        const overdue = t.deadline && new Date(t.deadline) < new Date() ? ' ⚠️QUÁHẠN' : ''
        return `- ID:${t.id} | "${t.title}" | ${t.priority} | deadline:${t.deadline || 'none'}${overdue} | score:${result.score} | scope:${result.scope} | est:${t.estimatedMinutes || '?'}m | cat:${t.category}`
      }).join('\n')

      const result = await suggestDailyPlan(summary)
      setAiSuggestion(result)
    } catch (e) {
      setAiSuggestion({ reasoning: e.message === 'NO_API_KEY' ? 'Chưa có API key — vào Settings thêm key đi mày 😤' : `Lỗi: ${e.message}`, suggestedIds: [] })
    } finally {
      setAiLoading(false)
    }
  }

  const handleApplyAISuggest = async () => {
    if (!aiSuggestion?.suggestedIds?.length) return
    // Filter to only valid, pending tasks
    const validIds = aiSuggestion.suggestedIds
      .filter(id => tasks.find(t => t.id === id && t.status !== 'done'))
      .slice(0, 3)
    if (validIds.length > 0) {
      await setFocus(validIds)
    }
    setAiSuggestion(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider">Today's Focus</h2>
        <div className="flex items-center gap-2">
          {/* AI Suggest button */}
          {focusTasks.length === 0 && (
            <button
              onClick={handleAISuggest}
              disabled={aiLoading}
              className="h-6 px-2.5 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-colors disabled:opacity-40"
            >
              {aiLoading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
              AI Suggest
            </button>
          )}
          <span className="text-xs text-secondary/60">
            {focusItems.filter(t => t.status === 'done').length}/{focusTasks.length} done
          </span>
        </div>
      </div>

      {/* AI Suggestion panel */}
      {aiSuggestion && (
        <div className="bg-accent/[0.04] border border-accent/20 rounded-xl p-3 space-y-2 animate-fade-in">
          <div className="flex items-center gap-1.5">
            <Sparkles size={12} className="text-accent" />
            <p className="text-[11px] font-bold text-accent">🤖 Đại Ca gợi ý:</p>
          </div>
          <p className="text-xs text-fg leading-relaxed">{aiSuggestion.reasoning}</p>

          {aiSuggestion.suggestedIds?.length > 0 && (
            <>
              <div className="space-y-1">
                {aiSuggestion.suggestedIds.map((id, i) => {
                  const task = tasks.find(t => t.id === id)
                  if (!task) return null
                  return (
                    <div key={id} className="flex items-center gap-2 bg-surface rounded-lg px-2.5 py-1.5 border border-edge">
                      <span className="text-[10px] font-bold text-accent/60 shrink-0">{i + 1}.</span>
                      <span className="text-xs text-fg flex-1 truncate">{task.title}</span>
                      <CategoryChip category={task.category} size="xs" />
                      <PriorityBadge priority={task.priority} />
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleApplyAISuggest}
                  className="flex-1 h-8 bg-accent hover:bg-accent-muted text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Check size={12} /> Áp dụng
                </button>
                <button
                  onClick={() => setAiSuggestion(null)}
                  className="h-8 px-3 bg-input hover:bg-hover text-secondary rounded-lg text-xs font-medium transition-colors"
                >
                  Bỏ qua
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Carry-over suggestion */}
      {carryOver.length > 0 && focusTasks.length < 3 && (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <RotateCcw size={12} className="text-amber-400" />
            <p className="text-xs font-semibold text-amber-400">Hôm qua chưa xong — thêm vào focus hôm nay?</p>
          </div>
          <div className="space-y-1.5">
            {carryOver.slice(0, 3 - focusTasks.length).map(task => (
              <button
                key={task.id}
                onClick={() => handleCarryOver(task)}
                className="w-full flex items-center gap-2 text-left bg-amber-500/10 rounded-lg px-2.5 py-1.5 hover:bg-amber-500/15"
              >
                <Plus size={12} className="text-amber-400 shrink-0" />
                <span className="text-xs text-fg-2 flex-1 truncate">{task.title}</span>
                <CategoryChip category={task.category} size="xs" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Focus slots */}
      <div className="space-y-2">
        {slots.map((_, i) => {
          const task = focusItems[i]
          if (task) {
            const scopeId = detectImpactScope(task)
            const scope = IMPACT_SCOPE[scopeId]
            const scopeLevel = { self: 0, team: 1, client: 2, critical: 3 }[scopeId] ?? 0

            const progress = task.progress ?? 0
            const isExpanded = expandedId === task.id
            const isDone = task.status === 'done'

            return (
              <div key={task.id}
                className={`rounded-xl border transition-all ${isDone ? 'opacity-50' : ''}`}
                style={{ borderColor: isExpanded && !isDone ? scope.color + '55' : scopeLevel >= 1 && !isDone ? scope.color + '35' : undefined }}
              >
                {/* Critical/Client banner */}
                {scopeLevel >= 2 && !isDone && (
                  <div className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold ${scope.text}`}
                    style={{ background: `linear-gradient(90deg, ${scope.color}22, transparent)` }}>
                    {scope.emoji} {scopeId === 'critical' ? 'CRITICAL — Ưu tiên tuyệt đối' : 'Client / Sếp đang theo dõi'}
                    <span className="ml-auto font-mono opacity-70">×{scope.multiplier}</span>
                  </div>
                )}

                {/* Compact row */}
                <div
                  onClick={() => !isDone && setExpandedId(isExpanded ? null : task.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 bg-surface transition-all
                    ${isDone ? '' : 'hover:bg-hover cursor-pointer'}`}
                >
                  <button
                    onClick={e => { e.stopPropagation(); handleDone(task) }}
                    disabled={isDone}
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
                      ${isDone ? 'bg-green-500 border-green-500 text-white' : 'border-accent hover:bg-accent-soft'}`}
                  >
                    {isDone && <Check size={14} strokeWidth={3} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isDone ? 'line-through text-secondary' : 'text-fg'}`}>
                      {task.title}
                    </p>
                    <div className="flex gap-1.5 mt-0.5 flex-wrap">
                      <CategoryChip category={task.category} size="xs" />
                      <PriorityBadge priority={task.priority} />
                      {!isDone && scopeLevel >= 1 && (
                        <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border ${scope.bg} ${scope.text} font-semibold`}
                          style={{ borderColor: scope.color + '30' }}>
                          {scope.emoji} {scope.label} <span className="font-mono opacity-80">×{scope.multiplier}</span>
                        </span>
                      )}
                    </div>
                    {progress > 0 && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <div className="flex-1 h-1 bg-edge rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: isDone ? '#6b7280' : scope.color }} />
                        </div>
                        <span className="text-[9px] text-secondary font-mono">{progress}%</span>
                      </div>
                    )}
                  </div>
                  {!isDone && (
                    <div className="flex items-center gap-1 shrink-0">
                      <InlinePomodoro taskId={task.id} />
                      <button onClick={e => { e.stopPropagation(); removeFromFocus(task.id) }} className="w-6 h-6 flex items-center justify-center text-secondary/40 hover:text-secondary rounded-lg hover:bg-hover transition-colors">
                        <X size={13} />
                      </button>
                      <ChevronDown size={13} className={`text-secondary/30 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  )}
                </div>

                {/* Expanded quick panel */}
                {isExpanded && !isDone && (
                  <div className="bg-input border-t px-3 py-3 space-y-3"
                    style={{ borderColor: scope.color + '25' }}
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Scope block */}
                    <div className={`flex items-center gap-2.5 rounded-xl px-3 py-2 ${scope.bg}`}
                      style={{ border: `1px solid ${scope.color}25` }}>
                      <span className="text-lg shrink-0 leading-none">{scope.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[11px] font-bold ${scope.text}`}>{scope.label}</span>
                          <span className={`text-[10px] font-mono font-bold ${scope.text} opacity-70`}>×{scope.multiplier}</span>
                        </div>
                        <p className="text-[10px] text-secondary leading-snug">{SCOPE_DESC[scopeId]}</p>
                      </div>
                      <div className="flex items-end gap-0.5 shrink-0">
                        {SCOPE_MULTIPLIERS.map((m, j) => (
                          <div key={j} className="w-1.5 rounded-sm"
                            style={{ height: `${8 + j * 4}px`, background: m <= scope.multiplier ? scope.color : scope.color + '20' }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Notes + deadline */}
                    {(task.notes || task.deadline) && (
                      <div className="space-y-1">
                        {task.notes && <p className="text-xs text-secondary leading-relaxed line-clamp-3">{task.notes}</p>}
                        {task.deadline && (
                          <p className="text-[11px] text-secondary">
                            📅 {task.deadline}
                            {isPast(parseISO(task.deadline)) && !isToday(parseISO(task.deadline)) &&
                              <span className="text-red-400 ml-1 font-medium">— quá hạn</span>}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Progress track */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] text-secondary font-medium">Tiến độ</span>
                        <span className="text-[11px] font-bold text-fg">{progress}%</span>
                      </div>
                      <div className="w-full h-2 bg-edge rounded-full overflow-hidden mb-2">
                        <div className="h-full rounded-full transition-all duration-300 bg-accent" style={{ width: `${progress}%` }} />
                      </div>
                      <div className="flex gap-1">
                        {[0, 25, 50, 75, 100].map(p => (
                          <button key={p}
                            onClick={e => { e.stopPropagation(); updateTask(task.id, { progress: p }) }}
                            className={`flex-1 h-8 rounded-lg text-[10px] font-semibold transition-colors
                              ${progress === p ? 'bg-accent text-white' : 'bg-surface text-secondary hover:bg-hover'}`}
                          >
                            {p}%
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Note log */}
                    <div>
                      <p className="text-[11px] text-secondary font-medium mb-1.5">Ghi chú tiến độ</p>
                      <div className="flex gap-1.5">
                        <input
                          value={noteInput}
                          onChange={e => setNoteInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && noteInput.trim()) {
                              updateTask(task.id, { progressLog: [...(task.progressLog || []), { at: new Date().toISOString(), note: noteInput.trim(), progress }] })
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
                            updateTask(task.id, { progressLog: [...(task.progressLog || []), { at: new Date().toISOString(), note: noteInput.trim(), progress }] })
                            setNoteInput('')
                          }}
                          className="h-8 px-2.5 bg-accent hover:bg-accent-muted text-white rounded-lg text-xs font-semibold transition-colors shrink-0"
                        >+</button>
                      </div>
                      {task.progressLog?.length > 0 && (
                        <div className="mt-2 space-y-1 max-h-28 overflow-y-auto">
                          {[...task.progressLog].reverse().map((entry, j) => (
                            <div key={j} className="flex items-start gap-2 text-[10px]">
                              <span className="text-secondary/50 shrink-0 font-mono">
                                {new Date(entry.at).toLocaleDateString('vi', { month: 'numeric', day: 'numeric' })}
                                {' '}{new Date(entry.at).toLocaleTimeString('vi', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-secondary flex-1 leading-snug">{entry.note}</span>
                              <span className="text-secondary/40 shrink-0 font-mono">{entry.progress}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1 border-t border-edge">
                      <button
                        onClick={e => { e.stopPropagation(); handleDone(task) }}
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
          }
          // Only show the first unfilled slot (i === focusTasks.length)
          if (i !== focusTasks.length) return null
          return (
            <button
              key={i}
              onClick={() => setShowPicker(true)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-edge-2 text-secondary/50 hover:text-secondary hover:border-edge-3 transition-colors"
            >
              <div className="w-7 h-7 rounded-full border-2 border-current flex items-center justify-center shrink-0">
                <Plus size={14} />
              </div>
              <span className="text-sm">Thêm task focus {i + 1}</span>
            </button>
          )
        })}
      </div>

      {focusTasks.length < 3 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setShowPicker(true)}
            className="text-xs text-accent hover:text-accent-muted flex items-center gap-1 py-1"
          >
            Pick từ backlog <ChevronRight size={12} />
          </button>
          {focusTasks.length === 0 && !aiSuggestion && (
            <button
              onClick={handleAISuggest}
              disabled={aiLoading}
              className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 py-1"
            >
              {aiLoading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              AI chọn giúp
            </button>
          )}
        </div>
      )}

      {/* Task Picker Sheet */}
      <Sheet open={showPicker} onClose={() => { setShowPicker(false); setSearch('') }} title="Chọn task focus">
        <div className="p-4 space-y-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm task..."
            className="w-full bg-input border border-edge-2 rounded-xl px-4 py-2.5 text-fg placeholder-secondary text-sm focus:outline-none focus:border-accent"
          />
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {available.length === 0 && (
              <p className="text-secondary text-sm text-center py-8">Không còn task nào</p>
            )}
            {available.map(task => (
              <button
                key={task.id}
                onClick={async () => {
                  const ok = await addToFocus(task.id)
                  if (ok && focusTasks.length >= 2) setShowPicker(false)
                }}
                disabled={focusTasks.length >= 3}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-input hover:bg-hover text-left transition-colors disabled:opacity-40"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-fg truncate">{task.title}</p>
                  <div className="flex gap-1.5 mt-0.5">
                    <CategoryChip category={task.category} size="xs" />
                    <PriorityBadge priority={task.priority} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </Sheet>
    </div>
  )
}
