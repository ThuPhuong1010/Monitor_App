import { PRIORITIES } from '../../services/db'

export default function PriorityBadge({ priority }) {
  const p = PRIORITIES[priority] || PRIORITIES.p2
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${p.bg} ${p.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
      {p.label}
    </span>
  )
}
