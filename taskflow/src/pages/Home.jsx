import { useMemo, useState } from 'react'
import { format, isPast, isToday, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import { AlertTriangle, ChevronRight, ClipboardList, Target, BarChart2 } from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'

import { useTaskStore } from '../store/taskStore'
import { useWidgetOrder } from '../hooks/useWidgetOrder'
import { useNavigate } from 'react-router-dom'

import SortableWidget from '../components/dashboard/SortableWidget'
import PomodoroWidget from '../components/focus/PomodoroTimer'
import InlineCapture from '../components/capture/InlineCapture'
import AttentionTasks from '../components/dashboard/AttentionTasks'
import FocusBoard from '../components/focus/FocusBoard'
import QuickStatsWidget from '../components/dashboard/QuickStatsWidget'
import SystemMonitor from '../components/dashboard/SystemMonitor'
import WeeklyChart from '../components/dashboard/WeeklyChart'
import CategoryBreakdown from '../components/dashboard/CategoryBreakdown'
import FocusHeatmap from '../components/dashboard/FocusHeatmap'
import DashboardCalendar from '../components/dashboard/DashboardCalendar'
import GoalsWidget from '../components/dashboard/GoalsWidget'
import LibraryWidget from '../components/dashboard/LibraryWidget'
import RoastWidget from '../components/dashboard/RoastWidget'
import YearProgressWidget from '../components/dashboard/YearProgressWidget'
import ContributionGraph from '../components/dashboard/ContributionGraph'
import ImageCapture from '../components/capture/ImageCapture'

// ── Widget registry ───────────────────────────────────────────────
const WIDGETS = {
  roast: { label: 'Đại Ca Đánh Giá', Component: RoastWidget },
  pomodoro: { label: 'Pomodoro', Component: PomodoroWidget },
  quickCapture: { label: 'Quick Capture', Component: InlineCapture },
  imageCapture: { label: '📸 Scan Ảnh', Component: ImageCapture },
  attentionTasks: { label: 'Cần chú ý', Component: AttentionTasks },
  focusBoard: { label: "Today's Focus", Component: FocusBoard },
  quickStats: { label: 'Quick Stats', Component: QuickStatsWidget },
  systemMonitor: { label: 'System Monitor', Component: SystemMonitor },
  weeklyChart: { label: 'Completion 7 ngày', Component: WeeklyChart },
  categoryBreakdown: { label: 'Theo Category', Component: CategoryBreakdown },
  focusHeatmap: { label: 'Focus Heatmap', Component: FocusHeatmap },
  dashboardCalendar: { label: 'Calendar', Component: DashboardCalendar },
  goals: { label: 'Goals', Component: GoalsWidget },
  library: { label: 'Library', Component: LibraryWidget },
  yearProgress: { label: 'Year Progress', Component: YearProgressWidget },
  contributions: { label: 'Contribution Graph', Component: ContributionGraph },
}

const GREETINGS = {
  morning: [
    'Buổi sáng rồi. Hôm nay mày làm gì?',
    'New day — chọn 3 task và go!',
    'Good morning! Focus đi đừng drift nha',
    'DẬY! Mở TaskFlow, chọn task, LÀM 🔥',
    'Hôm qua nói "ngày mai sẽ khác" — CHỨNG MINH ĐI 💀',
  ],
  afternoon: [
    'Checkpoint giữa ngày. Tiến được chưa?',
    'Còn buổi chiều đây, đừng lãng phí',
    'Nửa ngày trôi rồi — update task đi',
    'Nửa ngày bay mất rồi. Done được gì chưa? 😤',
    'Deadline đang countdown. Mày thì lướt điện thoại 🤡',
  ],
  evening: [
    'Gần xong ngày rồi, wrap up thôi',
    'Review cuối ngày — done được gì?',
    'Tối rồi. Đánh giá ngày hôm nay đi',
    'Hết ngày rồi. Tự hào về nó không? 💀',
    'Guilt? Tốt. Nhớ cảm giác đó cho ngày mai 🔥',
  ],
}

function getGreeting() {
  const h = new Date().getHours()
  const list = h < 12 ? GREETINGS.morning : h < 18 ? GREETINGS.afternoon : GREETINGS.evening
  return list[Math.floor(Math.random() * list.length)]
}

const WORK_MODE_KEY = 'taskflow_home_mode'

export default function Home() {
  const tasks = useTaskStore(s => s.tasks)
  const focusTasks = useTaskStore(s => s.focusTasks)
  const navigate = useNavigate()
  const { left, right, updateLeft, updateRight } = useWidgetOrder()
  const [mode, setMode] = useState(() => localStorage.getItem(WORK_MODE_KEY) || 'work')

  const switchMode = (m) => {
    setMode(m)
    localStorage.setItem(WORK_MODE_KEY, m)
  }

  const overdue = useMemo(() =>
    tasks.filter(t => t.status !== 'done' && t.deadline &&
      isPast(parseISO(t.deadline)) && !isToday(parseISO(t.deadline))),
    [tasks]
  )

  const focusDone = focusTasks
    .map(id => tasks.find(t => t.id === id))
    .filter(t => t?.status === 'done').length

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  const handleDragEnd = (colId) => ({ active, over }) => {
    if (!over || active.id === over.id) return
    const list = colId === 'left' ? left : right
    const update = colId === 'left' ? updateLeft : updateRight
    const oldIdx = list.indexOf(active.id)
    const newIdx = list.indexOf(over.id)
    if (oldIdx !== -1 && newIdx !== -1) update(arrayMove(list, oldIdx, newIdx))
  }

  const renderWidgetList = (ids, colId) => (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd(colId)}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-4 overflow-hidden">
          {ids.map(id => {
            const w = WIDGETS[id]
            if (!w) return null
            const { Component } = w
            return (
              <SortableWidget key={id} id={id} label={w.label}>
                <Component />
              </SortableWidget>
            )
          })}
        </div>
      </SortableContext>
    </DndContext>
  )

  return (
    <div className="px-4 pt-5 pb-4 md:px-6 md:pt-6 md:pb-8 overflow-x-hidden">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[11px] text-secondary font-medium uppercase tracking-widest">
            {format(new Date(), 'EEEE, d MMMM yyyy', { locale: vi })}
          </p>
          <h1 className="text-lg font-bold text-fg mt-0.5 leading-snug">{getGreeting()}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <button onClick={() => navigate('/review')} className="p-2 rounded-xl bg-input hover:bg-hover text-secondary hover:text-fg transition-colors" title="Weekly Review">
            <ClipboardList size={17} />
          </button>
          <div className="bg-accent-soft border border-accent-border rounded-xl px-2.5 py-1.5 text-center">
            <p className="text-lg font-bold text-accent leading-none">
              {focusDone}<span className="text-secondary text-xs font-normal">/3</span>
            </p>
            <p className="text-[10px] text-secondary mt-0.5">focus</p>
          </div>
        </div>
      </div>

      {/* ── Mode toggle ── */}
      <div className="flex gap-1 bg-input p-1 rounded-xl mb-4">
        <button
          onClick={() => switchMode('work')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all
            ${mode === 'work' ? 'bg-surface shadow-sm text-fg' : 'text-secondary hover:text-fg'}`}
        >
          <Target size={12} /> Làm việc
        </button>
        <button
          onClick={() => switchMode('stats')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all
            ${mode === 'stats' ? 'bg-surface shadow-sm text-fg' : 'text-secondary hover:text-fg'}`}
        >
          <BarChart2 size={12} /> Tổng quan
        </button>
      </div>

      {/* ── Overdue alert (always visible) ── */}
      {overdue.length > 0 && (
        <button
          onClick={() => navigate('/tasks')}
          className="w-full mb-4 bg-surface border border-edge rounded-xl overflow-hidden flex text-left hover:border-edge-2 hover:shadow-sm transition-all"
        >
          <div className="w-1 bg-red-600 shrink-0 self-stretch" />
          <div className="flex items-center gap-3 px-3 py-2.5 flex-1 min-w-0">
            <AlertTriangle size={15} className="text-red-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-red-600">{overdue.length} task quá hạn — xử lý ngay!</p>
              <p className="text-xs text-secondary mt-0.5 truncate">
                {overdue.slice(0, 2).map(t => t.title).join(' · ')}
                {overdue.length > 2 ? ` +${overdue.length - 2} nữa` : ''}
              </p>
            </div>
            <ChevronRight size={14} className="text-secondary/50 shrink-0" />
          </div>
        </button>
      )}

      {/* ── WORK MODE: clean action view ── */}
      {mode === 'work' && (
        <div className="space-y-4 md:grid md:grid-cols-[1fr_360px] md:gap-8 md:items-start md:space-y-0">
          {/* Main work column */}
          <div className="space-y-4">
            <InlineCapture />
            <ImageCapture />
            <AttentionTasks />
            <FocusBoard />
          </div>
          {/* Side: goals + calendar (useful for planning) */}
          <div className="hidden md:flex flex-col gap-4">
            <GoalsWidget />
            <DashboardCalendar />
          </div>
        </div>
      )}

      {/* ── STATS MODE: full widget dashboard ── */}
      {mode === 'stats' && (
        <>
          <div className="md:grid md:grid-cols-[1fr_360px] md:gap-8 md:items-start overflow-hidden">
            <div className="min-w-0">
              {renderWidgetList(left, 'left')}
            </div>
            <div className="hidden md:block min-w-0">
              {renderWidgetList(right, 'right')}
            </div>
          </div>
          <div className="md:hidden mt-4 overflow-hidden">
            {renderWidgetList(right, 'right')}
          </div>
        </>
      )}
    </div>
  )
}
