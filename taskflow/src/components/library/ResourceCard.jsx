import { useState } from 'react'
import { ExternalLink, Trash2, Clock, Target, ClipboardList, Edit3, MessageSquare, MoreHorizontal, ChevronDown } from 'lucide-react'
import { useLibraryStore } from '../../store/libraryStore'
import { useTaskStore } from '../../store/taskStore'
import { useGoalStore } from '../../store/goalStore'

const STATUS_CONFIG = {
  toread: { label: 'To Read', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', next: 'reading' },
  reading: { label: 'Reading', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', next: 'done' },
  done: { label: 'Done', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', next: 'archived' },
  archived: { label: 'Archived', color: 'text-secondary/50', bg: 'bg-input', border: 'border-edge', next: 'toread' },
}

function detectType(url) {
  if (!url) return 'link'
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.match(/\.(pdf|doc|docx|ppt|pptx|xls|xlsx)$/i)) return 'document'
  return 'link'
}

function getYouTubeId(url) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/)
  return match?.[1] || null
}

function getDomain(url) {
  try { return new URL(url).hostname.replace('www.', '') } catch { return '' }
}

const TYPE_EMOJI = { youtube: '🎬', document: '📄', link: '🔗' }

export default function ResourceCard({ resource }) {
  const { updateStatus, updateResource, deleteResource, convertToTask, convertToGoal } = useLibraryStore()
  const addTask = useTaskStore(s => s.addTask)
  const addGoal = useGoalStore(s => s.addGoal)

  const [expanded, setExpanded] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [editingReason, setEditingReason] = useState(false)
  const [reasonDraft, setReasonDraft] = useState(resource.reason || '')
  const [converted, setConverted] = useState('')

  const config = STATUS_CONFIG[resource.status] || STATUS_CONFIG.toread
  const urlType = detectType(resource.url)
  const ytId = urlType === 'youtube' ? getYouTubeId(resource.url) : null
  const domain = getDomain(resource.url)

  const handleConvertToTask = async () => {
    const taskData = convertToTask(resource)
    await addTask(taskData)
    setConverted('task')
    setShowActions(false)
    setTimeout(() => setConverted(''), 2500)
  }

  const handleConvertToGoal = async () => {
    const goalData = convertToGoal(resource)
    await addGoal(goalData)
    setConverted('goal')
    setShowActions(false)
    setTimeout(() => setConverted(''), 2500)
  }

  const handleSaveReason = () => {
    updateResource(resource.id, { reason: reasonDraft.trim() })
    setEditingReason(false)
  }

  return (
    <div className={`bg-surface rounded-xl border border-edge transition-all
      ${resource.status === 'done' ? 'opacity-50' : ''}`}
    >
      {/* ─── Main row: always visible ─── */}
      <div className="flex gap-3 p-3 items-start">
        {/* Thumbnail or type icon */}
        {ytId ? (
          <a href={resource.url} target="_blank" rel="noopener noreferrer"
            className="shrink-0 relative group rounded-lg overflow-hidden w-20 h-14"
          >
            <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
              alt="" className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 flex items-center justify-center">
              <span className="text-white text-[10px] bg-red-600 rounded-full w-5 h-5 flex items-center justify-center">▶</span>
            </div>
          </a>
        ) : (
          <div className="shrink-0 w-10 h-10 rounded-lg bg-input flex items-center justify-center text-sm">
            {TYPE_EMOJI[urlType]}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="text-[13px] font-semibold text-fg leading-snug line-clamp-2">{resource.title}</h3>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${config.bg} ${config.color} ${config.border}`}>
              {config.label}
            </span>
            <span className="text-[9px] text-secondary/40 truncate max-w-[120px]">{domain}</span>
            {resource.readingMinutes && (
              <span className="text-[9px] text-secondary/40 flex items-center gap-0.5">
                <Clock size={8} /> {resource.readingMinutes}m
              </span>
            )}
          </div>

          {/* Reason preview (1 line) */}
          {resource.reason && !expanded && (
            <p className="text-[10px] text-amber-300/60 mt-1 truncate">
              💡 {resource.reason}
            </p>
          )}
        </div>

        {/* Right actions */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          <a href={resource.url} target="_blank" rel="noopener noreferrer"
            className="text-secondary/40 hover:text-accent">
            <ExternalLink size={13} />
          </a>
          <button onClick={() => setExpanded(!expanded)}
            className={`text-secondary/40 hover:text-fg transition-transform ${expanded ? 'rotate-180' : ''}`}>
            <ChevronDown size={13} />
          </button>
        </div>
      </div>

      {/* ─── Expanded detail ─── */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-edge/50 pt-2 animate-fade-in">
          {/* Summary */}
          {resource.summary && (
            <p className="text-xs text-secondary leading-relaxed">{resource.summary}</p>
          )}

          {/* Reason (editable) */}
          {editingReason ? (
            <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg p-2 space-y-1.5">
              <textarea
                value={reasonDraft}
                onChange={e => setReasonDraft(e.target.value)}
                rows={2}
                className="w-full bg-transparent text-xs text-fg focus:outline-none resize-none leading-relaxed"
                placeholder="Lý do nên đọc/xem..."
                autoFocus
              />
              <div className="flex gap-1.5 justify-end">
                <button onClick={() => setEditingReason(false)} className="text-[10px] text-secondary">Hủy</button>
                <button onClick={handleSaveReason} className="text-[10px] text-accent font-semibold">Lưu</button>
              </div>
            </div>
          ) : resource.reason ? (
            <div className="flex items-start gap-1.5 bg-amber-500/5 border border-amber-500/15 rounded-lg px-2.5 py-2">
              <span className="text-[10px] shrink-0">💡</span>
              <p className="text-[11px] text-amber-200/70 flex-1 leading-relaxed">{resource.reason}</p>
              <button onClick={() => { setReasonDraft(resource.reason); setEditingReason(true) }}
                className="text-secondary/30 hover:text-amber-400 shrink-0">
                <Edit3 size={10} />
              </button>
            </div>
          ) : null}

          {/* Tags */}
          {resource.tags?.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {resource.tags.map(tag => (
                <span key={tag} className="text-[9px] bg-input text-secondary px-1.5 py-0.5 rounded">#{tag}</span>
              ))}
            </div>
          )}

          {/* Actions bar */}
          <div className="flex items-center gap-1.5 pt-1 flex-wrap">
            {/* Status cycle */}
            <button onClick={() => updateStatus(resource.id, config.next)}
              className={`text-[10px] font-medium px-2.5 py-1 rounded-lg ${config.bg} ${config.color} border ${config.border} hover:brightness-110 transition`}>
              → {STATUS_CONFIG[config.next]?.label}
            </button>

            {/* Add reason */}
            {!resource.reason && (
              <button onClick={() => { setReasonDraft(''); setEditingReason(true) }}
                className="text-[10px] text-secondary/50 hover:text-amber-400 px-2 py-1 rounded-lg bg-input flex items-center gap-1">
                <MessageSquare size={9} /> Lý do
              </button>
            )}

            <div className="flex-1" />

            {/* Convert feedback */}
            {converted ? (
              <span className="text-[10px] text-green-400 font-medium">
                ✓ Đã tạo {converted === 'task' ? 'task' : 'goal'}!
              </span>
            ) : (
              <>
                <button onClick={handleConvertToTask}
                  className="text-[10px] text-accent/60 hover:text-accent px-2 py-1 rounded-lg bg-input flex items-center gap-1 transition-colors">
                  <ClipboardList size={9} /> → Task
                </button>
                <button onClick={handleConvertToGoal}
                  className="text-[10px] text-violet-400/60 hover:text-violet-400 px-2 py-1 rounded-lg bg-input flex items-center gap-1 transition-colors">
                  <Target size={9} /> → Goal
                </button>
              </>
            )}

            {/* Delete */}
            <button
              onClick={() => {
                if (window.confirm('Xóa resource này?')) deleteResource(resource.id)
              }}
              className="text-secondary/30 hover:text-red-400 px-1.5 py-1 rounded-lg transition-colors"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
