import { useState } from 'react'
import { Check, Trash2, Calendar, Target, RefreshCw, Clock, CheckSquare } from 'lucide-react'
import { format, isPast, parseISO, isToday } from 'date-fns'
import { vi } from 'date-fns/locale'
import CategoryChip from '../ui/CategoryChip'
import PriorityBadge from '../ui/PriorityBadge'
import { useTaskStore } from '../../store/taskStore'

export default function TaskCard({ task, onEdit }) {
  const markDone = useTaskStore(s => s.markDone)
  const deleteTask = useTaskStore(s => s.deleteTask)
  const focusTasks = useTaskStore(s => s.focusTasks)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const inFocus = focusTasks.includes(task.id)
  const isDone = task.status === 'done'

  const isOverdue = task.deadline && !isDone &&
    isPast(parseISO(task.deadline)) && !isToday(parseISO(task.deadline))

  const handleDone = () => {
    if (navigator.vibrate) navigator.vibrate(40)
    markDone(task.id)
  }

  return (
    <div
      className={`p-3.5 rounded-xl border transition-all
        ${isDone ? 'bg-surface border-edge opacity-50' : 'bg-surface border-edge'}
        ${isOverdue ? 'border-red-500/30 bg-red-500/5' : ''}
        ${inFocus ? 'border-accent-border' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Done button */}
        <button
          onClick={handleDone}
          disabled={isDone}
          className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
            ${isDone ? 'bg-green-500 border-green-500 text-white' : 'border-edge-3 hover:border-green-500 hover:bg-green-500/10'}`}
        >
          {isDone && <Check size={12} strokeWidth={3} />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0" onClick={() => onEdit?.(task)}>
          <p className={`text-sm font-medium ${isDone ? 'line-through text-secondary' : 'text-fg'}`}>
            {task.title}
          </p>
          {task.notes && <p className="text-xs text-secondary mt-0.5 truncate">{task.notes}</p>}
          <div className="flex flex-wrap gap-1.5 mt-1.5 items-center">
            <CategoryChip category={task.category} size="xs" />
            <PriorityBadge priority={task.priority} />
            {task.deadline && (
              <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue ? 'text-red-400' : 'text-secondary'}`}>
                <Calendar size={10} />
                {format(parseISO(task.deadline), 'd MMM', { locale: vi })}
                {isOverdue && ' (quá hạn)'}
              </span>
            )}
            {inFocus && (
              <span className="text-[10px] text-accent flex items-center gap-0.5">
                <Target size={10} /> Focus
              </span>
            )}
            {task.recurring && (
              <span className="text-[10px] text-secondary flex items-center gap-0.5">
                <RefreshCw size={10} /> {task.recurring === 'daily' ? 'Ngày' : task.recurring === 'weekly' ? 'Tuần' : 'Tháng'}
              </span>
            )}
            {task.estimatedMinutes > 0 && (
              <span className="text-[10px] text-secondary flex items-center gap-0.5">
                <Clock size={10} /> {task.estimatedMinutes < 60 ? `${task.estimatedMinutes}p` : `${task.estimatedMinutes / 60}h`}
              </span>
            )}
            {task.checklist?.length > 0 && (
              <span className="text-[10px] text-secondary flex items-center gap-0.5">
                <CheckSquare size={10} />
                {task.checklist.filter(i => i.done).length}/{task.checklist.length}
              </span>
            )}
          </div>
        </div>

        {/* Delete */}
        <div className="shrink-0">
          {confirmDelete ? (
            <div className="flex gap-1">
              <button onClick={() => deleteTask(task.id)} className="text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded-lg">Xóa</button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-secondary bg-input px-2 py-1 rounded-lg">Không</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="text-secondary/50 hover:text-red-400 p-1">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
