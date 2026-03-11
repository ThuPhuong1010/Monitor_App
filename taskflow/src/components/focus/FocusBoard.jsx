import { useState, useEffect, useMemo } from 'react'
import { Check, Plus, X, ChevronRight, RotateCcw, Sparkles, Loader2 } from 'lucide-react'
import { InlinePomodoro } from './PomodoroTimer'
import { useTaskStore } from '../../store/taskStore'
import { db } from '../../services/db'
import { suggestDailyPlan } from '../../services/ai'
import { scoreTask } from '../../services/priorityEngine'
import CategoryChip from '../ui/CategoryChip'
import PriorityBadge from '../ui/PriorityBadge'
import Sheet from '../ui/Sheet'

export default function FocusBoard() {
  const tasks = useTaskStore(s => s.tasks)
  const focusTasks = useTaskStore(s => s.focusTasks)
  const addToFocus = useTaskStore(s => s.addToFocus)
  const removeFromFocus = useTaskStore(s => s.removeFromFocus)
  const markDone = useTaskStore(s => s.markDone)
  const setFocus = useTaskStore(s => s.setFocus)
  const [showPicker, setShowPicker] = useState(false)
  const [search, setSearch] = useState('')
  const [carryOver, setCarryOver] = useState([]) // tasks from yesterday not done

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
            return (
              <div
                key={task.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all
                  ${task.status === 'done'
                    ? 'bg-surface border-edge opacity-50'
                    : 'bg-surface border-edge hover:border-edge-2'}`}
              >
                <button
                  onClick={() => handleDone(task)}
                  disabled={task.status === 'done'}
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
                    ${task.status === 'done'
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-accent hover:bg-accent-soft'}`}
                >
                  {task.status === 'done' && <Check size={14} strokeWidth={3} />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${task.status === 'done' ? 'line-through text-secondary' : 'text-fg'}`}>
                    {task.title}
                  </p>
                  <div className="flex gap-1.5 mt-0.5">
                    <CategoryChip category={task.category} size="xs" />
                    <PriorityBadge priority={task.priority} />
                  </div>
                </div>
                {task.status !== 'done' && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <InlinePomodoro taskId={task.id} />
                    <button onClick={() => removeFromFocus(task.id)} className="text-secondary/50 hover:text-secondary">
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
            )
          }
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
