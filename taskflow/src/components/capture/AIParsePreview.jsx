import { useState } from 'react'
import { Trash2, Check } from 'lucide-react'
import { CATEGORIES, PRIORITIES } from '../../services/db'

export default function AIParsePreview({ tasks: initialTasks, onConfirm, onBack }) {
  const [tasks, setTasks] = useState(initialTasks)

  const update = (i, changes) => setTasks(ts => ts.map((t, idx) => idx === i ? { ...t, ...changes } : t))
  const remove = (i) => setTasks(ts => ts.filter((_, idx) => idx !== i))

  return (
    <div className="p-4 space-y-3">
      <p className="text-sm text-secondary">AI extract được <span className="text-fg font-semibold">{tasks.length} tasks</span>. Review và confirm:</p>

      <div className="space-y-2">
        {tasks.map((task, i) => (
          <div key={i} className="bg-input rounded-xl p-3 space-y-2">
            <div className="flex gap-2 items-start">
              <input
                value={task.title}
                onChange={e => update(i, { title: e.target.value })}
                className="flex-1 bg-transparent text-fg text-sm font-medium focus:outline-none border-b border-edge-2 pb-1"
              />
              <button onClick={() => remove(i)} className="text-secondary hover:text-red-400 shrink-0">
                <Trash2 size={14} />
              </button>
            </div>

            <div className="flex gap-2 flex-wrap">
              {/* Category */}
              <select
                value={task.category}
                onChange={e => update(i, { category: e.target.value })}
                className="bg-surface border border-edge-2 text-xs rounded-lg px-2 py-1 text-fg-2 focus:outline-none"
              >
                {Object.entries(CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>

              {/* Priority */}
              <select
                value={task.priority}
                onChange={e => update(i, { priority: e.target.value })}
                className="bg-surface border border-edge-2 text-xs rounded-lg px-2 py-1 text-fg-2 focus:outline-none"
              >
                {Object.entries(PRIORITIES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>

              {/* Deadline */}
              <input
                type="date"
                value={task.deadline || ''}
                onChange={e => update(i, { deadline: e.target.value || null })}
                className="bg-surface border border-edge-2 text-xs rounded-lg px-2 py-1 text-fg-2 focus:outline-none"
              />
              {/* Time */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-secondary">⏱</span>
                <input
                  type="number" min={1} max={480}
                  value={task.estimatedMinutes || ''}
                  onChange={e => update(i, { estimatedMinutes: e.target.value ? Number(e.target.value) : null })}
                  placeholder="phút"
                  className="w-16 bg-surface border border-edge-2 text-xs rounded-lg px-2 py-1 text-fg-2 focus:outline-none"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={onBack} className="flex-1 h-11 bg-input text-fg-2 rounded-xl text-sm font-medium">
          Quay lại
        </button>
        <button
          onClick={() => onConfirm(tasks)}
          disabled={tasks.length === 0}
          className="flex-1 h-11 bg-accent hover:bg-accent-muted disabled:opacity-40 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
        >
          <Check size={16} />
          Lưu {tasks.length} tasks
        </button>
      </div>
    </div>
  )
}
