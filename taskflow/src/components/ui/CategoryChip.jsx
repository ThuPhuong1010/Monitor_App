import { CATEGORIES } from '../../services/db'

export default function CategoryChip({ category, size = 'sm', onClick, selected }) {
  const cat = CATEGORIES[category] || CATEGORIES.adhoc
  const sizes = { xs: 'text-[10px] px-1.5 py-0.5', sm: 'text-xs px-2 py-0.5', md: 'text-sm px-3 py-1' }
  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center rounded-full font-medium border cursor-default
        ${cat.bg} ${cat.text} ${cat.border} ${sizes[size]}
        ${onClick ? 'cursor-pointer hover:opacity-80' : ''}
        ${selected ? 'ring-2 ring-offset-1 ring-offset-[#1c1c1e]' : ''}`}
      style={selected ? { ringColor: cat.color } : {}}
    >
      {cat.label}
    </span>
  )
}
