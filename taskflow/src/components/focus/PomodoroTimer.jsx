import { Play, Pause, Square, Timer } from 'lucide-react'
import { usePomodoroStore } from '../../store/pomodoroStore'

const DURATIONS = [5, 15, 25, 45, 60]

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

/** Inline mini timer shown inside a FocusBoard task slot */
export function InlinePomodoro({ taskId }) {
  const { taskId: activeId, running, elapsed, duration, start, pause, resume, stop } = usePomodoroStore()
  const isThis = activeId === taskId
  const remaining = duration - elapsed
  const progress = duration > 0 ? elapsed / duration : 0
  const isDone = isThis && elapsed >= duration

  if (isThis) {
    const circumference = 2 * Math.PI * 12
    return (
      <div className="flex items-center gap-2 shrink-0">
        {/* Ring progress */}
        <div className="relative w-8 h-8">
          <svg className="w-8 h-8 -rotate-90" viewBox="0 0 28 28">
            <circle cx="14" cy="14" r="12" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-edge" />
            <circle
              cx="14" cy="14" r="12" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              strokeLinecap="round"
              className={isDone ? 'text-green-500' : 'text-accent'}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-bold ${isDone ? 'text-green-500' : 'text-accent'}`}>
            {isDone ? '✓' : formatTime(remaining)}
          </span>
        </div>

        {isDone ? (
          <button onClick={stop} className="text-[10px] text-green-600 font-semibold hover:underline">
            Xong
          </button>
        ) : (
          <button
            onClick={running ? pause : resume}
            className="w-6 h-6 rounded-full bg-accent/10 text-accent flex items-center justify-center hover:bg-accent hover:text-white transition-colors"
          >
            {running ? <Pause size={10} strokeWidth={2.5} /> : <Play size={10} strokeWidth={2.5} />}
          </button>
        )}
        <button onClick={stop} className="text-secondary/40 hover:text-red-400 transition-colors">
          <Square size={11} />
        </button>
      </div>
    )
  }

  // Not active — show start button with duration picker on hover
  return (
    <div className="relative group shrink-0">
      <button
        onClick={() => start(taskId, 25)}
        className="w-7 h-7 rounded-full border border-edge-2 text-secondary/50 hover:border-accent hover:text-accent flex items-center justify-center transition-all"
        title="Bắt đầu Pomodoro"
      >
        <Timer size={13} />
      </button>
      {/* Duration picker tooltip */}
      <div className="absolute right-0 top-8 hidden group-hover:flex bg-surface border border-edge rounded-xl shadow-lg p-1.5 gap-1 z-20">
        {DURATIONS.map(d => (
          <button
            key={d}
            onClick={() => start(taskId, d)}
            className="px-2 py-1 text-[10px] font-semibold text-fg hover:bg-accent hover:text-white rounded-lg transition-colors whitespace-nowrap"
          >
            {d < 60 ? `${d}p` : `${d / 60}h`}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Full standalone timer widget for dashboard */
export default function PomodoroWidget() {
  const { taskId, running, elapsed, duration, stop } = usePomodoroStore()
  if (!taskId) return null

  const remaining = duration - elapsed
  const pct = duration > 0 ? Math.round((elapsed / duration) * 100) : 0
  const isDone = elapsed >= duration

  return (
    <div className={`rounded-xl border p-3 flex items-center gap-3 transition-all
      ${isDone ? 'bg-green-500/5 border-green-500/30' : 'bg-accent-soft border-accent-border'}`}>
      <div className="relative w-10 h-10 shrink-0">
        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-edge" />
          <circle
            cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3"
            strokeDasharray={2 * Math.PI * 15}
            strokeDashoffset={2 * Math.PI * 15 * (1 - elapsed / duration)}
            strokeLinecap="round"
            className={isDone ? 'text-green-500' : 'text-accent'}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold ${isDone ? 'text-green-600' : 'text-accent'}`}>
          {isDone ? '🎉' : formatTime(remaining)}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold ${isDone ? 'text-green-600' : 'text-accent'}`}>
          {isDone ? 'Pomodoro xong! Nghỉ 5p đi 🍅' : `🍅 ${pct}% — đang tập trung`}
        </p>
        <p className="text-[10px] text-secondary truncate">
          {isDone ? 'Bấm dừng khi sẵn sàng tiếp' : `Còn ${formatTime(remaining)}`}
        </p>
      </div>
      <button onClick={stop} className="text-secondary/50 hover:text-red-400 transition-colors shrink-0">
        <Square size={14} />
      </button>
    </div>
  )
}
