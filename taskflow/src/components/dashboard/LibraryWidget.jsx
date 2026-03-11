import { useLibraryStore } from '../../store/libraryStore'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ChevronRight } from 'lucide-react'

export default function LibraryWidget() {
  const resources = useLibraryStore(s => s.resources)
  const navigate = useNavigate()
  const toRead = resources.filter(r => r.status === 'toread').length

  if (toRead === 0) return null

  return (
    <button
      onClick={() => navigate('/library')}
      className="w-full flex items-center gap-3 bg-surface border border-edge rounded-xl px-3 py-3 text-left hover:border-edge-2 transition-colors"
    >
      <BookOpen size={16} className="text-violet-500 shrink-0" />
      <div className="flex-1">
        <p className="text-sm text-fg font-medium">{toRead} tài liệu chờ đọc</p>
        <p className="text-xs text-secondary">Tap để xem Read Later</p>
      </div>
      <ChevronRight size={14} className="text-secondary/50 shrink-0" />
    </button>
  )
}
