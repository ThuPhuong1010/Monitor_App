import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles, Loader2, CheckCircle2, XCircle, Calendar, Target, RefreshCw } from 'lucide-react'
import { startOfWeek, endOfWeek, format, subWeeks, parseISO, isWithinInterval } from 'date-fns'
import { vi } from 'date-fns/locale'
import { useTaskStore } from '../store/taskStore'
import { useGoalStore } from '../store/goalStore'
import { db } from '../services/db'
import { generateWeeklySummary } from '../services/ai'
import { CATEGORIES } from '../services/db'

function getWeekRange(offset = 0) {
  const base = subWeeks(new Date(), offset)
  const start = startOfWeek(base, { weekStartsOn: 1 })
  const end = endOfWeek(base, { weekStartsOn: 1 })
  return { start, end }
}

export default function WeeklyReview() {
  const navigate = useNavigate()
  const tasks = useTaskStore(s => s.tasks)
  const goals = useGoalStore(s => s.goals)
  const [weekOffset, setWeekOffset] = useState(0)
  const [aiSummary, setAiSummary] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [saved, setSaved] = useState(false)
  const [pastReviews, setPastReviews] = useState([])

  const { start, end } = getWeekRange(weekOffset)
  const weekStart = format(start, 'yyyy-MM-dd')
  const weekEnd = format(end, 'yyyy-MM-dd')
  const weekLabel = `${format(start, 'd/M', { locale: vi })} – ${format(end, 'd/M/yyyy', { locale: vi })}`

  // Filter tasks for this week
  const weekTasks = useMemo(() => tasks.filter(t => {
    const doneDate = t.doneAt ? t.doneAt.slice(0, 10) : null
    if (doneDate && doneDate >= weekStart && doneDate <= weekEnd) return true
    if (t.deadline && t.deadline >= weekStart && t.deadline <= weekEnd) return true
    return false
  }), [tasks, weekStart, weekEnd])

  const doneTasks = weekTasks.filter(t => t.status === 'done' && t.doneAt?.slice(0, 10) >= weekStart && t.doneAt?.slice(0, 10) <= weekEnd)
  const overdueTasks = weekTasks.filter(t => t.status !== 'done' && t.deadline && t.deadline < format(new Date(), 'yyyy-MM-dd'))

  // Category breakdown
  const catBreakdown = useMemo(() => {
    return Object.entries(CATEGORIES).map(([key, cat]) => ({
      key, label: cat.label, color: cat.color,
      done: doneTasks.filter(t => t.category === key).length,
      total: weekTasks.filter(t => t.category === key).length,
    })).filter(c => c.total > 0)
  }, [doneTasks, weekTasks])

  // Focus days count (from focusHistory)
  const [focusDays, setFocusDays] = useState(0)
  useEffect(() => {
    db.focusHistory.where('date').between(weekStart, weekEnd, true, true).count().then(setFocusDays)
  }, [weekStart, weekEnd])

  // Load saved review for this week
  useEffect(() => {
    db.weeklyReviews.where('weekStart').equals(weekStart).first().then(r => {
      if (r) { setAiSummary(r.summary || ''); setSaved(true) }
      else { setAiSummary(''); setSaved(false) }
    })
    db.weeklyReviews.orderBy('weekStart').reverse().limit(5).toArray().then(setPastReviews)
  }, [weekStart])

  const goalsProgress = useMemo(() =>
    goals.filter(g => g.status !== 'done').map(g => `${g.title} ${g.progress || 0}%`).join(', ') || 'Không có goal active'
  , [goals])

  const handleGenerateAI = async () => {
    setAiLoading(true)
    setAiError('')
    try {
      const weekData = {
        weekStart, weekEnd,
        done: doneTasks.length,
        total: weekTasks.length,
        overdue: overdueTasks.length,
        focusDays,
        categoryBreakdown: catBreakdown.map(c => `${c.label}: ${c.done}/${c.total}`).join(', ') || 'N/A',
        goalsProgress,
      }
      const summary = await generateWeeklySummary(weekData)
      setAiSummary(summary)
      setSaved(false)
    } catch (e) {
      setAiError(e.message === 'NO_API_KEY' ? 'Chưa có API key — vào Settings để thêm.' : 'Lỗi: ' + e.message)
    } finally {
      setAiLoading(false)
    }
  }

  const handleSave = async () => {
    const { syncToCloud } = await import('../services/supabase')
    const existing = await db.weeklyReviews.where('weekStart').equals(weekStart).first()
    let cloudId
    if (existing) {
      cloudId = existing.cloudId
      if (!cloudId) {
        cloudId = crypto.randomUUID()
      }
      await db.weeklyReviews.update(existing.id, { summary: aiSummary, cloudId, updatedAt: new Date().toISOString() })
    } else {
      cloudId = crypto.randomUUID()
      await db.weeklyReviews.add({ weekStart, weekEnd, summary: aiSummary, cloudId, createdAt: new Date().toISOString() })
    }
    // weekly_reviews schema: week_start, ai_summary, data — no created_at column
    syncToCloud('weekly_reviews', { cloudId }, { week_start: weekStart, ai_summary: aiSummary }).catch(() => {})
    setSaved(true)
  }

  const completionRate = weekTasks.length > 0 ? Math.round(doneTasks.length / weekTasks.length * 100) : 0

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-secondary hover:text-fg p-1">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-fg">Weekly Review</h1>
          <p className="text-xs text-secondary">{weekLabel}</p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setWeekOffset(o => o + 1)} className="px-2 py-1 rounded-lg bg-input text-secondary text-xs hover:text-fg">← Trước</button>
          {weekOffset > 0 && (
            <button onClick={() => setWeekOffset(0)} className="px-2 py-1 rounded-lg bg-input text-secondary text-xs hover:text-fg">Tuần này</button>
          )}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Hoàn thành', value: doneTasks.length, color: 'text-green-400', sub: `/${weekTasks.length} tasks` },
          { label: 'Tỉ lệ', value: `${completionRate}%`, color: completionRate >= 70 ? 'text-green-400' : completionRate >= 40 ? 'text-yellow-400' : 'text-red-400' },
          { label: 'Quá hạn', value: overdueTasks.length, color: overdueTasks.length > 0 ? 'text-red-400' : 'text-secondary' },
          { label: 'Focus days', value: focusDays, color: 'text-accent', sub: '/7' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-surface border border-edge rounded-xl p-3 text-center">
            <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}<span className="text-xs text-secondary font-normal">{kpi.sub}</span></p>
            <p className="text-[10px] text-secondary mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-secondary mb-1.5">
          <span>Tiến độ hoàn thành</span>
          <span>{completionRate}%</span>
        </div>
        <div className="h-2 bg-input rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </div>

      {/* Category breakdown */}
      {catBreakdown.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">Theo Category</h3>
          <div className="space-y-2">
            {catBreakdown.map(c => (
              <div key={c.key}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-fg-2">{c.label}</span>
                  <span className="text-secondary">{c.done}/{c.total}</span>
                </div>
                <div className="h-1.5 bg-input rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${c.total > 0 ? c.done / c.total * 100 : 0}%`, background: c.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Done tasks list */}
      {doneTasks.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
            <CheckCircle2 size={11} className="inline mr-1 text-green-400" />
            Đã hoàn thành ({doneTasks.length})
          </h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {doneTasks.map(t => (
              <div key={t.id} className="flex items-center gap-2 px-3 py-1.5 bg-input rounded-lg">
                <CheckCircle2 size={12} className="text-green-400 shrink-0" />
                <span className="text-xs text-fg-2 truncate">{t.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overdue tasks */}
      {overdueTasks.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
            <XCircle size={11} className="inline mr-1 text-red-400" />
            Chưa xong / Quá hạn ({overdueTasks.length})
          </h3>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {overdueTasks.map(t => (
              <div key={t.id} className="flex items-center gap-2 px-3 py-1.5 bg-red-500/5 border border-red-500/15 rounded-lg">
                <XCircle size={12} className="text-red-400 shrink-0" />
                <span className="text-xs text-fg-2 truncate">{t.title}</span>
                {t.deadline && <span className="text-[10px] text-red-400 ml-auto shrink-0">{t.deadline}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Summary */}
      <div className="bg-surface border border-edge rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-fg flex items-center gap-1.5">
            <Sparkles size={14} className="text-accent" /> AI Review
          </h3>
          {saved && <span className="text-[10px] text-green-400">Đã lưu</span>}
        </div>

        {aiSummary ? (
          <div className="text-sm text-fg-2 leading-relaxed whitespace-pre-wrap">{aiSummary}</div>
        ) : (
          <p className="text-xs text-secondary">Nhấn nút bên dưới để AI tóm tắt tuần này.</p>
        )}

        {aiError && <p className="text-xs text-red-400">{aiError}</p>}

        <div className="flex gap-2">
          <button
            onClick={handleGenerateAI}
            disabled={aiLoading}
            className="flex-1 h-9 bg-accent hover:bg-accent-muted disabled:opacity-40 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1.5"
          >
            {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {aiSummary ? 'Tạo lại' : 'Tạo AI Summary'}
          </button>
          {aiSummary && !saved && (
            <button onClick={handleSave} className="px-4 h-9 bg-green-500/15 text-green-400 border border-green-500/25 rounded-xl text-sm font-medium hover:bg-green-500/20">
              Lưu
            </button>
          )}
        </div>
      </div>

      {/* Past reviews */}
      {pastReviews.filter(r => r.weekStart !== weekStart).length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
            <Calendar size={11} className="inline mr-1" />Các tuần trước
          </h3>
          <div className="space-y-2">
            {pastReviews.filter(r => r.weekStart !== weekStart).slice(0, 3).map(r => (
              <button
                key={r.id}
                onClick={() => {
                  const diff = Math.round((new Date(weekStart) - new Date(r.weekStart)) / (7 * 24 * 3600 * 1000))
                  setWeekOffset(o => o + diff)
                }}
                className="w-full text-left px-3 py-2 bg-input rounded-xl hover:bg-hover transition-colors"
              >
                <p className="text-xs font-medium text-fg">{r.weekStart} → {r.weekEnd}</p>
                {r.summary && <p className="text-[11px] text-secondary mt-0.5 truncate">{r.summary.slice(0, 80)}...</p>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
