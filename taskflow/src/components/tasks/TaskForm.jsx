import { useState } from 'react'
import { Clock, RefreshCw, ListChecks } from 'lucide-react'
import { CATEGORIES, PRIORITIES } from '../../services/db'
import { IMPACT_SCOPE, detectImpactScope } from '../../services/priorityEngine'
import { useTaskStore } from '../../store/taskStore'
import Sheet from '../ui/Sheet'
import ChecklistEditor from './ChecklistEditor'

const RECURRING_OPTIONS = [
  { value: '', label: 'Không lặp' },
  { value: 'daily', label: '📅 Hàng ngày' },
  { value: 'weekly', label: '📅 Hàng tuần' },
  { value: 'monthly', label: '📅 Hàng tháng' },
]

export default function TaskForm({ task, onClose }) {
  const { addTask, updateTask } = useTaskStore()
  const isEdit = !!task?.id

  const [form, setForm] = useState({
    title: task?.title || '',
    category: task?.category || 'adhoc',
    priority: task?.priority || 'p2',
    deadline: task?.deadline || '',
    notes: task?.notes || '',
    progress: task?.progress || 0,
    estimatedMinutes: task?.estimatedMinutes || '',
    recurring: task?.recurring || '',
    checklist: task?.checklist || [],
    impactScope: task?.impactScope || '',
  })

  const [showChecklist, setShowChecklist] = useState((task?.checklist?.length || 0) > 0)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.title.trim()) return
    const data = {
      ...form,
      deadline: form.deadline || null,
      estimatedMinutes: form.estimatedMinutes || null,
      recurring: form.recurring || null,
      checklist: form.checklist.length > 0 ? form.checklist : null,
    }
    if (isEdit) {
      await updateTask(task.id, data)
    } else {
      await addTask(data)
    }
    onClose()
  }

  return (
    <Sheet open={true} onClose={onClose} title={isEdit ? 'Chỉnh sửa task' : 'Thêm task'}>
      <div className="p-4 space-y-4">

        {/* Title */}
        <input
          value={form.title}
          onChange={e => set('title', e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="Tên task..."
          autoFocus
          className="w-full bg-input border border-edge-2 rounded-xl px-4 py-3 text-fg placeholder-secondary text-[16px] focus:outline-none focus:border-accent"
        />

        {/* Category + Priority */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-secondary mb-1.5 block">Category</label>
            <select value={form.category} onChange={e => set('category', e.target.value)}
              className="w-full bg-input border border-edge-2 rounded-xl px-3 py-2.5 text-fg text-sm focus:outline-none focus:border-accent">
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-secondary mb-1.5 block">Priority</label>
            <select value={form.priority} onChange={e => set('priority', e.target.value)}
              className="w-full bg-input border border-edge-2 rounded-xl px-3 py-2.5 text-fg text-sm focus:outline-none focus:border-accent">
              {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>

        {/* Deadline + Recurring */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-secondary mb-1.5 block">Deadline</label>
            <input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)}
              className="w-full bg-input border border-edge-2 rounded-xl px-3 py-2.5 text-fg text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs text-secondary mb-1.5 flex items-center gap-1">
              <RefreshCw size={10} /> Lặp lại
            </label>
            <select value={form.recurring} onChange={e => set('recurring', e.target.value)}
              className="w-full bg-input border border-edge-2 rounded-xl px-3 py-2.5 text-fg text-sm focus:outline-none focus:border-accent">
              {RECURRING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* Progress (edit only) */}
        {isEdit && (
          <div>
            <label className="text-xs text-secondary mb-1.5 block">Tiến độ: {form.progress}%</label>
            <input type="range" min={0} max={100} step={10}
              value={form.progress} onChange={e => set('progress', Number(e.target.value))}
              className="w-full accent-orange-500"
            />
          </div>
        )}

        {/* Estimated time */}
        <div>
          <label className="text-xs text-secondary mb-1.5 flex items-center gap-1">
            <Clock size={11} /> Thời gian ước tính
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {[15, 30, 60, 90, 120].map(m => (
              <button key={m} type="button"
                onClick={() => set('estimatedMinutes', form.estimatedMinutes === m ? '' : m)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all
                  ${form.estimatedMinutes === m
                    ? 'bg-accent-soft text-accent border-accent-border'
                    : 'bg-input text-secondary border-transparent hover:border-edge-2'}`}>
                {m < 60 ? `${m}p` : `${m / 60}h`}
              </button>
            ))}
            <input type="number" min={1} max={480} value={form.estimatedMinutes}
              onChange={e => set('estimatedMinutes', e.target.value ? Number(e.target.value) : '')}
              placeholder="phút"
              className="w-20 bg-input border border-edge-2 rounded-xl px-3 py-1.5 text-fg text-sm focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Impact Scope */}
        <div>
          <label className="text-xs text-secondary mb-1.5 block">Phạm vi ảnh hưởng</label>
          <div className="grid grid-cols-4 gap-1.5">
            {Object.values(IMPACT_SCOPE).map(s => {
              const active = form.impactScope === s.id
              const autoDetected = !form.impactScope && detectImpactScope({ title: form.title, notes: form.notes, impactScope: null }) === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => set('impactScope', active ? '' : s.id)}
                  className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl border text-center transition-all
                    ${active
                      ? 'border-current text-white font-semibold'
                      : autoDetected
                        ? 'border-dashed border-edge-2 bg-input'
                        : 'border-transparent bg-input hover:border-edge-2'}`}
                  style={active ? { background: s.color, borderColor: s.color } : {}}
                >
                  <span className="text-base leading-none">{s.emoji}</span>
                  <span className={`text-[10px] font-medium leading-tight ${active ? 'text-white' : autoDetected ? s.text : 'text-secondary'}`}>
                    {s.label}
                  </span>
                  {autoDetected && !active && (
                    <span className="text-[9px] text-secondary/60 leading-none">auto</span>
                  )}
                </button>
              )
            })}
          </div>
          <p className="text-[10px] text-secondary/60 mt-1">Để trống → AI tự detect từ nội dung</p>
        </div>

        {/* Checklist toggle */}
        <div>
          <button type="button" onClick={() => setShowChecklist(s => !s)}
            className="flex items-center gap-1.5 text-xs text-secondary hover:text-fg transition-colors mb-2">
            <ListChecks size={13} />
            <span className="font-medium">
              {showChecklist ? 'Ẩn checklist' : `Thêm checklist${form.checklist.length > 0 ? ` (${form.checklist.length})` : ''}`}
            </span>
          </button>
          {showChecklist && (
            <ChecklistEditor items={form.checklist} onChange={v => set('checklist', v)} />
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs text-secondary mb-1.5 block">Ghi chú</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            placeholder="Ghi chú thêm..." rows={2}
            className="w-full bg-input border border-edge-2 rounded-xl px-4 py-2.5 text-fg placeholder-secondary text-sm focus:outline-none resize-none focus:border-accent"
          />
        </div>

        <button onClick={handleSave} disabled={!form.title.trim()}
          className="w-full h-11 bg-accent hover:bg-accent-muted disabled:opacity-40 text-white rounded-xl font-semibold text-sm">
          {isEdit ? 'Lưu thay đổi' : 'Thêm task'}
        </button>
      </div>
    </Sheet>
  )
}
