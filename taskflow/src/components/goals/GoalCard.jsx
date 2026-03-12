import { useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Check, Sparkles, Loader2, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useGoalStore } from '../../store/goalStore'
import { useTaskStore } from '../../store/taskStore'
import { GOAL_CATEGORIES } from '../../services/db'
import { breakdownGoal } from '../../services/ai'

export default function GoalCard({ goal }) {
  const [expanded, setExpanded] = useState(false)
  const [newMilestone, setNewMilestone] = useState('')
  const { getMilestonesForGoal, addMilestone, toggleMilestone } = useGoalStore()
  const addTask = useTaskStore(s => s.addTask)
  const addTasks = useTaskStore(s => s.addTasks)
  const milestones = getMilestonesForGoal(goal.id)
  const cat = GOAL_CATEGORIES[goal.category] || GOAL_CATEGORIES.career

  // AI Breakdown state
  const [aiLoading, setAiLoading] = useState(false)
  const [aiTasks, setAiTasks] = useState(null)
  const [aiError, setAiError] = useState('')

  const handleAddMilestone = async () => {
    if (!newMilestone.trim()) return
    await addMilestone(goal.id, newMilestone.trim())
    setNewMilestone('')
  }

  const handleAIBreakdown = async () => {
    if (!window.confirm('🤖 Dùng AI chia nhỏ goal này? (tốn ~1 API call)')) return
    setAiLoading(true)
    setAiError('')
    setAiTasks(null)
    try {
      const result = await breakdownGoal(goal.title, goal.category, goal.deadline)
      setAiTasks(result)
    } catch (e) {
      setAiError(e.message === 'NO_API_KEY' ? 'Chưa có API key — vào Settings để thêm.' : `Lỗi: ${e.message}`)
    } finally {
      setAiLoading(false)
    }
  }

  const handleApplyBreakdown = async () => {
    if (!aiTasks?.length) return

    // Group by milestone
    const milestoneGroups = {}
    for (const t of aiTasks) {
      const ms = t.milestone || 'Chung'
      if (!milestoneGroups[ms]) milestoneGroups[ms] = []
      milestoneGroups[ms].push(t)
    }

    // Create milestones
    for (const msName of Object.keys(milestoneGroups)) {
      await addMilestone(goal.id, msName)
    }

    // Create tasks linked to goal
    const tasksToAdd = aiTasks.map(t => ({
      title: t.title,
      category: t.category || 'adhoc',
      priority: t.priority || 'p2',
      deadline: t.deadline || null,
      estimatedMinutes: t.estimatedMinutes || null,
      goalId: goal.id,
      notes: t.milestone ? `Milestone: ${t.milestone}` : '',
    }))

    await addTasks(tasksToAdd)
    setAiTasks(null)
  }

  const handleRemoveAiTask = (index) => {
    setAiTasks(prev => prev.filter((_, i) => i !== index))
  }

  const PRIORITY_LABELS = { p0: '🔴 Gấp', p1: '🟠 Cao', p2: '🟡 Vừa', p3: '⚪ Thấp' }

  return (
    <div className="bg-surface rounded-xl border border-edge overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full p-4 text-left flex items-start gap-3"
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg"
          style={{ background: cat.color + '20' }}>
          <span style={{ color: cat.color }}>◎</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-fg text-sm">{goal.title}</h3>
            {expanded ? <ChevronUp size={16} className="text-secondary shrink-0 mt-0.5" /> : <ChevronDown size={16} className="text-secondary shrink-0 mt-0.5" />}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: cat.color + '20', color: cat.color }}>
              {cat.label}
            </span>
            {goal.deadline && (
              <span className="text-[10px] text-secondary">đến {format(parseISO(goal.deadline), 'dd/MM/yyyy')}</span>
            )}
          </div>
          {/* Progress bar */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-input rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${goal.progress}%`, background: cat.color }}
              />
            </div>
            <span className="text-[10px] text-secondary font-medium shrink-0">{goal.progress}%</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Milestones section */}
          <div className="space-y-2">
            <p className="text-xs text-secondary font-semibold uppercase tracking-wider">Milestones</p>

            {milestones.length === 0 && (
              <p className="text-xs text-secondary/50">Chưa có milestone nào</p>
            )}

            {milestones.map(m => (
              <button
                key={m.id}
                onClick={() => toggleMilestone(m.id)}
                className="w-full flex items-center gap-2.5 py-1.5 text-left"
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all
                ${m.status === 'done' ? 'border-transparent text-white' : 'border-edge-3'}`}
                  style={m.status === 'done' ? { background: cat.color } : {}}>
                  {m.status === 'done' && <Check size={11} strokeWidth={3} />}
                </div>
                <span className={`text-sm ${m.status === 'done' ? 'line-through text-secondary' : 'text-fg-2'}`}>
                  {m.title}
                </span>
              </button>
            ))}

            {/* Add milestone */}
            <div className="flex gap-2">
              <input
                value={newMilestone}
                onChange={e => setNewMilestone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddMilestone()}
                placeholder="Thêm milestone..."
                className="flex-1 bg-input border border-edge-2 rounded-lg px-3 py-1.5 text-fg placeholder-secondary/60 text-sm focus:outline-none focus:border-accent"
              />
              <button
                onClick={handleAddMilestone}
                className="w-8 h-8 bg-accent-soft text-accent rounded-lg flex items-center justify-center hover:bg-accent-soft"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* AI Breakdown section */}
          <div className="border-t border-edge pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-secondary font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={12} className="text-accent" />
                AI Breakdown
              </p>
              <button
                onClick={handleAIBreakdown}
                disabled={aiLoading}
                className="h-7 px-3 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40"
              >
                {aiLoading ? <><Loader2 size={11} className="animate-spin" /> Đang phân tích...</> : <><Sparkles size={11} /> Chia nhỏ Goal</>}
              </button>
            </div>

            <p className="text-[10px] text-secondary/60">AI sẽ tự động chia goal thành tasks + milestones cụ thể</p>

            {aiError && (
              <p className="text-xs text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">{aiError}</p>
            )}

            {/* AI suggested tasks preview */}
            {aiTasks && aiTasks.length > 0 && (
              <div className="space-y-2 bg-accent/[0.03] border border-accent/20 rounded-xl p-3">
                <p className="text-[11px] font-semibold text-accent">🤖 AI gợi ý {aiTasks.length} tasks:</p>

                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {aiTasks.map((t, i) => (
                    <div key={i} className="flex items-start gap-2 bg-surface rounded-lg px-2.5 py-2 border border-edge">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-fg truncate">{t.title}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="text-[9px] text-secondary bg-input px-1.5 py-0.5 rounded">
                            {PRIORITY_LABELS[t.priority] || t.priority}
                          </span>
                          {t.deadline && (
                            <span className="text-[9px] text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                              📅 {t.deadline}
                            </span>
                          )}
                          {t.estimatedMinutes && (
                            <span className="text-[9px] text-secondary bg-input px-1.5 py-0.5 rounded">
                              ⏱️ {t.estimatedMinutes}m
                            </span>
                          )}
                          {t.milestone && (
                            <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                              🏁 {t.milestone}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveAiTask(i)}
                        className="text-secondary/40 hover:text-red-400 shrink-0 mt-0.5"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleApplyBreakdown}
                    className="flex-1 h-9 bg-accent hover:bg-accent-muted text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Check size={13} /> Áp dụng tất cả
                  </button>
                  <button
                    onClick={() => setAiTasks(null)}
                    className="h-9 px-4 bg-input hover:bg-hover text-secondary rounded-xl text-xs font-medium transition-colors"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
