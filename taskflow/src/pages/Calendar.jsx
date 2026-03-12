import { useState } from 'react'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import MonthView from '../components/calendar/MonthView'
import WeekView from '../components/calendar/WeekView'
import DayView from '../components/calendar/DayView'
import YearView from '../components/calendar/YearView'
import QuickAddModal from '../components/calendar/QuickAddModal'

const VIEWS = [
  { id: 'day', label: 'Ngày' },
  { id: 'week', label: 'Tuần' },
  { id: 'month', label: 'Tháng' },
  { id: 'year', label: 'Năm' },
]

export default function Calendar() {
  const [view, setView] = useState('month')
  const [current, setCurrent] = useState(new Date())
  const [quickAdd, setQuickAdd] = useState(null) // { date, hour? }

  // Navigate forward/backward based on current view
  const navigate = (dir) => {
    setCurrent(prev => {
      const d = new Date(prev)
      if (view === 'day') d.setDate(d.getDate() + dir)
      else if (view === 'week') d.setDate(d.getDate() + 7 * dir)
      else if (view === 'month') d.setMonth(d.getMonth() + dir)
      else if (view === 'year') d.setFullYear(d.getFullYear() + dir)
      return d
    })
  }

  const goToday = () => setCurrent(new Date())

  // Title based on view
  const getTitle = () => {
    if (view === 'day') return format(current, 'EEEE, d MMMM yyyy', { locale: vi })
    if (view === 'week') {
      const weekStart = new Date(current)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1) // Monday
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      if (weekStart.getMonth() === weekEnd.getMonth()) {
        return `${format(weekStart, 'd')} – ${format(weekEnd, 'd MMMM yyyy', { locale: vi })}`
      }
      return `${format(weekStart, 'd MMM', { locale: vi })} – ${format(weekEnd, 'd MMM yyyy', { locale: vi })}`
    }
    if (view === 'month') return format(current, 'MMMM yyyy', { locale: vi })
    return format(current, 'yyyy')
  }

  const handleDayClick = (date) => {
    if (view === 'year') {
      setCurrent(date)
      setView('month')
    } else if (view === 'month') {
      setCurrent(date)
      setView('day')
    }
  }

  const handleQuickAdd = (date, hour) => {
    setQuickAdd({ date: format(date, 'yyyy-MM-dd'), hour })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-2 space-y-3">
        {/* Top row: title + today button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="w-8 h-8 rounded-lg bg-input flex items-center justify-center text-secondary hover:text-fg hover:bg-hover transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => navigate(1)}
              className="w-8 h-8 rounded-lg bg-input flex items-center justify-center text-secondary hover:text-fg hover:bg-hover transition-colors"
            >
              <ChevronRight size={16} />
            </button>
            <h1 className="text-base font-bold text-fg capitalize ml-1">{getTitle()}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goToday}
              className="h-7 px-2.5 rounded-lg bg-input text-xs font-semibold text-secondary hover:text-fg hover:bg-hover transition-colors"
            >
              Hôm nay
            </button>
            <button
              onClick={() => handleQuickAdd(current)}
              className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white hover:bg-accent-muted transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* View switcher */}
        <div className="flex gap-1 bg-input rounded-xl p-1">
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`flex-1 h-8 rounded-lg text-xs font-semibold transition-all
                ${view === v.id ? 'bg-surface text-fg shadow-sm' : 'text-secondary hover:text-fg'}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {view === 'day' && <DayView date={current} onQuickAdd={handleQuickAdd} />}
        {view === 'week' && <WeekView date={current} onDayClick={d => { setCurrent(d); setView('day') }} onQuickAdd={handleQuickAdd} />}
        {view === 'month' && <MonthView date={current} onDayClick={handleDayClick} onQuickAdd={handleQuickAdd} />}
        {view === 'year' && <YearView date={current} onMonthClick={d => { setCurrent(d); setView('month') }} />}
      </div>

      {/* Quick Add Modal */}
      {quickAdd && (
        <QuickAddModal
          date={quickAdd.date}
          hour={quickAdd.hour}
          onClose={() => setQuickAdd(null)}
        />
      )}
    </div>
  )
}
