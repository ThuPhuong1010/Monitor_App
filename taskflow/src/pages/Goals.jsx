import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useGoalStore } from '../store/goalStore'
import GoalCard from '../components/goals/GoalCard'
import Sheet from '../components/ui/Sheet'
import { GOAL_CATEGORIES } from '../services/db'

function GoalForm({ onClose }) {
  const { addGoal } = useGoalStore()
  const [form, setForm] = useState({ title: '', category: 'career', deadline: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.title.trim()) return
    await addGoal({ ...form, deadline: form.deadline || null })
    onClose()
  }

  return (
    <Sheet open={true} onClose={onClose} title="Tạo Goal mới">
      <div className="p-4 space-y-4">
        <input
          value={form.title}
          onChange={e => set('title', e.target.value)}
          placeholder="Tên goal (ví dụ: Freelance $1000/tháng)"
          autoFocus
          className="w-full bg-input border border-edge-2 rounded-xl px-4 py-3 text-fg placeholder-secondary text-[16px] focus:outline-none focus:border-accent"
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-secondary mb-1.5 block">Category</label>
            <select
              value={form.category}
              onChange={e => set('category', e.target.value)}
              className="w-full bg-input border border-edge-2 rounded-xl px-3 py-2.5 text-fg text-sm focus:outline-none"
            >
              {Object.entries(GOAL_CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-secondary mb-1.5 block">Deadline</label>
            <input
              type="date"
              value={form.deadline}
              onChange={e => set('deadline', e.target.value)}
              className="w-full bg-input border border-edge-2 rounded-xl px-3 py-2.5 text-fg text-sm focus:outline-none"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!form.title.trim()}
          className="w-full h-11 bg-accent hover:bg-accent-muted disabled:opacity-40 text-white rounded-xl font-semibold text-sm"
        >
          Tạo Goal
        </button>
      </div>
    </Sheet>
  )
}

export default function Goals() {
  const goals = useGoalStore(s => s.goals)
  const [showForm, setShowForm] = useState(false)

  const active = goals.filter(g => g.status !== 'done')
  const completed = goals.filter(g => g.status === 'done')

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-fg">Goals</h1>
        <button
          onClick={() => setShowForm(true)}
          className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center text-white hover:bg-accent-muted"
        >
          <Plus size={20} />
        </button>
      </div>

      {active.length === 0 && (
        <div className="text-center py-16">
          <p className="text-secondary/50 text-sm">Chưa có goal nào</p>
          <p className="text-secondary/40 text-xs mt-1">Đặt mục tiêu dài hạn và track từng ngày</p>
        </div>
      )}

      <div className="space-y-3">
        {active.map(goal => <GoalCard key={goal.id} goal={goal} />)}
      </div>

      {completed.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-secondary/50 font-semibold uppercase tracking-wider">Đã hoàn thành</p>
          {completed.map(goal => <GoalCard key={goal.id} goal={goal} />)}
        </div>
      )}

      {showForm && <GoalForm onClose={() => setShowForm(false)} />}
    </div>
  )
}
