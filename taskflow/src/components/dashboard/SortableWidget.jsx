import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

export default function SortableWidget({ id, label, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 50 : 'auto',
      }}
      className="relative group overflow-visible"
    >
      {/* Drag handle — appears on hover, positioned inside */}
      <button
        {...attributes}
        {...listeners}
        className="absolute -left-1 md:-left-4 top-2 opacity-0 group-hover:opacity-60 hover:!opacity-100
          transition-opacity text-secondary cursor-grab active:cursor-grabbing touch-none p-0.5 z-10"
        aria-label={`Kéo để sắp xếp: ${label}`}
        title={`Kéo để di chuyển "${label}"`}
      >
        <GripVertical size={13} />
      </button>
      {children}
    </div>
  )
}
