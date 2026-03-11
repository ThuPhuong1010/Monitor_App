import { useGoalStore } from '../../store/goalStore'
import { useNavigate } from 'react-router-dom'
import { Target, ChevronRight } from 'lucide-react'
import { GOAL_CATEGORIES } from '../../services/db'

export default function GoalsWidget() {
  const goals = useGoalStore(s => s.goals)
  const navigate = useNavigate()
  const active = goals.filter(g => g.status !== 'done').slice(0, 4)

  if (active.length === 0) return null

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-secondary">
          <Target size={14} />
          <span className="text-xs font-semibold uppercase tracking-wider">Goals</span>
        </div>
        <button onClick={() => navigate('/goals')} className="text-xs text-accent hover:text-accent-muted flex items-center gap-0.5">
          Xem thêm <ChevronRight size={12} />
        </button>
      </div>
      <div className="space-y-2">
        {active.map(goal => {
          const cat = GOAL_CATEGORIES[goal.category] || GOAL_CATEGORIES.career
          return (
            <button
              key={goal.id}
              onClick={() => navigate('/goals')}
              className="w-full bg-surface rounded-xl px-3 py-2.5 border border-edge text-left hover:border-edge-2 transition-colors"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-fg font-medium truncate flex-1 mr-2">{goal.title}</span>
                <span className="text-xs font-bold shrink-0" style={{ color: cat.color }}>{goal.progress}%</span>
              </div>
              <div className="h-1.5 bg-input rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${goal.progress}%`, background: cat.color }} />
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
