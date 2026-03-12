import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Link2, Loader2, Share2, ChevronDown, ChevronUp } from 'lucide-react'
import { useLibraryStore } from '../store/libraryStore'
import ResourceCard from '../components/library/ResourceCard'

const STATUS_TABS = [
  { key: 'all', label: 'Tất cả', icon: '📚' },
  { key: 'toread', label: 'To Read', icon: '📖' },
  { key: 'reading', label: 'Reading', icon: '👀' },
  { key: 'done', label: 'Done', icon: '✅' },
]

export default function Library() {
  const { resources, loading, saveUrl } = useLibraryStore()
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [reason, setReason] = useState('')
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')
  const [sharedSaved, setSharedSaved] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const sharedUrl = params.get('url') || params.get('text') || ''
    if (sharedUrl && sharedUrl.startsWith('http')) {
      setSharedSaved(false)
      saveUrl(sharedUrl).then(() => setSharedSaved(true))
      window.history.replaceState({}, '', '/library')
    }
  }, [location.search])

  const filtered = filter === 'all' ? resources : resources.filter(r => r.status === filter)

  const handleSave = async () => {
    const trimmed = url.trim()
    if (!trimmed) return
    if (!trimmed.startsWith('http')) { setError('URL phải bắt đầu bằng http://'); return }
    setError('')
    const useAI = window.confirm('🤖 Dùng AI tóm tắt URL này?\n\nOK = AI tóm tắt (tốn ~1 API call)\nCancel = Lưu nhanh không AI')
    await saveUrl(trimmed, { title, reason, skipAI: !useAI })
    setUrl('')
    setTitle('')
    setReason('')
    setShowDetail(false)
  }

  return (
    <div className="px-4 pt-6 pb-4 space-y-3">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-fg">📚 Library</h1>
        <p className="text-[11px] text-secondary mt-0.5">Lưu link · AI tóm tắt · Convert → Task / Goal</p>
      </div>

      {/* Share toast */}
      {sharedSaved && (
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2">
          <Share2 size={13} className="text-green-400 shrink-0" />
          <p className="text-xs text-green-400">Đã lưu từ Share Sheet!</p>
        </div>
      )}

      {/* ─── URL input ─── */}
      <div className="bg-surface border border-edge rounded-xl p-3 space-y-2">
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-input border border-edge rounded-xl px-3 py-2.5 focus-within:border-accent transition-colors">
            <Link2 size={14} className="text-secondary/50 shrink-0" />
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !showDetail && handleSave()}
              placeholder="Paste link YouTube, bài viết, PDF..."
              className="flex-1 bg-transparent text-fg placeholder-secondary/50 text-sm focus:outline-none min-w-0"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={loading || !url.trim()}
            className="w-10 h-10 bg-accent hover:bg-accent-muted disabled:opacity-40 rounded-xl flex items-center justify-center text-white shrink-0"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
          </button>
        </div>

        {/* Detail toggle */}
        <button
          onClick={() => setShowDetail(!showDetail)}
          className="flex items-center gap-1 text-[10px] text-secondary/60 hover:text-fg transition-colors"
        >
          {showDetail ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          {showDetail ? 'Ẩn' : '+ Tiêu đề & lý do'}
        </button>

        {showDetail && (
          <div className="space-y-2 animate-fade-in">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Tiêu đề (trống = AI tạo)"
              className="w-full bg-input border border-edge rounded-lg px-3 py-2 text-xs text-fg placeholder-secondary/40 focus:outline-none focus:border-accent"
            />
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Lý do nên đọc/xem..."
              rows={2}
              className="w-full bg-input border border-edge rounded-lg px-3 py-2 text-xs text-fg placeholder-secondary/40 focus:outline-none focus:border-accent resize-none"
            />
          </div>
        )}

        {loading && <p className="text-[10px] text-accent">🤖 AI đang tóm tắt...</p>}
        {error && <p className="text-[10px] text-red-400">{error}</p>}
      </div>

      {/* ─── Filter tabs ─── */}
      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 no-scrollbar">
        {STATUS_TABS.map(t => {
          const count = t.key === 'all' ? resources.length : resources.filter(r => r.status === t.key).length
          return (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors
                ${filter === t.key
                  ? 'bg-accent/15 text-accent border border-accent/20'
                  : 'bg-input text-secondary border border-transparent hover:text-fg'}`}
            >
              <span className="text-[10px]">{t.icon}</span>
              {t.label}
              <span className={`text-[9px] ml-0.5 ${filter === t.key ? 'text-accent/60' : 'text-secondary/40'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ─── List ─── */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-2xl mb-2">📚</p>
          <p className="text-secondary/50 text-xs">
            {filter === 'all' ? 'Chưa có gì. Paste URL để bắt đầu!' : `Không có items "${filter}"`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => <ResourceCard key={r.id} resource={r} />)}
        </div>
      )}
    </div>
  )
}
