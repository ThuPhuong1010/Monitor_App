import { useState } from 'react'
import { Plus, X, Check } from 'lucide-react'

/** Standalone checklist editor — used in TaskForm and TaskCard detail view */
export default function ChecklistEditor({ items = [], onChange, readOnly = false }) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const text = draft.trim()
    if (!text) return
    onChange([...items, { id: Date.now().toString(), text, done: false }])
    setDraft('')
  }

  const toggle = (id) =>
    onChange(items.map(it => it.id === id ? { ...it, done: !it.done } : it))

  const remove = (id) => onChange(items.filter(it => it.id !== id))

  const doneCount = items.filter(i => i.done).length

  return (
    <div className="space-y-1.5">
      {items.length > 0 && (
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[10px] text-secondary font-medium">
            {doneCount}/{items.length} hoàn thành
          </span>
          <div className="flex-1 h-1 bg-input rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${items.length > 0 ? (doneCount / items.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {items.map(item => (
        <div key={item.id} className="flex items-center gap-2 group">
          <button
            type="button"
            onClick={() => !readOnly && toggle(item.id)}
            className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all
              ${item.done ? 'bg-green-500 border-green-500 text-white' : 'border-edge-3 hover:border-green-500'}`}
          >
            {item.done && <Check size={9} strokeWidth={3} />}
          </button>
          <span className={`text-sm flex-1 ${item.done ? 'line-through text-secondary' : 'text-fg'}`}>
            {item.text}
          </span>
          {!readOnly && (
            <button
              type="button"
              onClick={() => remove(item.id)}
              className="opacity-0 group-hover:opacity-100 text-secondary/50 hover:text-red-400 transition-opacity shrink-0"
            >
              <X size={12} />
            </button>
          )}
        </div>
      ))}

      {!readOnly && (
        <div className="flex gap-2 mt-1">
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
            placeholder="Thêm bước..."
            className="flex-1 bg-input border border-edge-2 rounded-xl px-3 py-1.5 text-sm text-fg placeholder-secondary/60 focus:outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={add}
            disabled={!draft.trim()}
            className="w-8 h-8 bg-accent-soft border border-accent-border text-accent rounded-xl flex items-center justify-center disabled:opacity-30 hover:bg-accent hover:text-white transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
