import { useState } from 'react'
import { ExternalLink, Trash2, Clock } from 'lucide-react'
import { useLibraryStore } from '../../store/libraryStore'

const STATUS_CONFIG = {
  toread: { label: 'To Read', color: 'text-secondary', bg: 'bg-input' },
  reading: { label: 'Reading', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  done: { label: 'Done', color: 'text-green-400', bg: 'bg-green-500/20' },
  archived: { label: 'Archived', color: 'text-secondary/50', bg: 'bg-input' },
}

export default function ResourceCard({ resource }) {
  const { updateStatus, deleteResource } = useLibraryStore()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const config = STATUS_CONFIG[resource.status] || STATUS_CONFIG.toread

  const nextStatus = { toread: 'reading', reading: 'done', done: 'archived', archived: 'toread' }

  return (
    <div className={`bg-surface rounded-xl border border-edge p-4 space-y-2 ${resource.status === 'done' ? 'opacity-60' : ''}`}>
      {/* Title + link */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg leading-snug flex-1">{resource.title}</h3>
        <a href={resource.url} target="_blank" rel="noopener noreferrer"
          className="text-secondary hover:text-accent shrink-0">
          <ExternalLink size={15} />
        </a>
      </div>

      {/* Summary */}
      {resource.summary && (
        <p className="text-xs text-secondary leading-relaxed">{resource.summary}</p>
      )}

      {/* Tags */}
      {resource.tags?.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {resource.tags.map(tag => (
            <span key={tag} className="text-[10px] bg-input text-secondary px-1.5 py-0.5 rounded">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => updateStatus(resource.id, nextStatus[resource.status])}
            className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}
          >
            {config.label}
          </button>
          {resource.readingMinutes && (
            <span className="text-[10px] text-secondary/50 flex items-center gap-0.5">
              <Clock size={10} /> {resource.readingMinutes} phút
            </span>
          )}
        </div>

        {confirmDelete ? (
          <div className="flex gap-1">
            <button onClick={() => deleteResource(resource.id)} className="text-xs text-red-400">Xóa</button>
            <button onClick={() => setConfirmDelete(false)} className="text-xs text-secondary">Không</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="text-secondary/50 hover:text-red-400">
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  )
}
