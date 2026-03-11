import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Link2, Loader2, Share2 } from 'lucide-react'
import { useLibraryStore } from '../store/libraryStore'
import ResourceCard from '../components/library/ResourceCard'

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'toread', label: 'To Read' },
  { key: 'reading', label: 'Reading' },
  { key: 'done', label: 'Done' },
]

export default function Library() {
  const { resources, loading, saveUrl } = useLibraryStore()
  const [url, setUrl] = useState('')
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')
  const [sharedSaved, setSharedSaved] = useState(false)
  const location = useLocation()

  // Handle PWA share_target — auto-save URL shared from other apps
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const sharedUrl = params.get('url') || params.get('text') || ''
    if (sharedUrl && sharedUrl.startsWith('http')) {
      setSharedSaved(false)
      saveUrl(sharedUrl).then(() => setSharedSaved(true))
      // Clear query params from URL without reload
      window.history.replaceState({}, '', '/library')
    }
  }, [location.search])

  const filtered = filter === 'all' ? resources : resources.filter(r => r.status === filter)

  const handleSave = async () => {
    const trimmed = url.trim()
    if (!trimmed) return
    if (!trimmed.startsWith('http')) { setError('URL phải bắt đầu bằng http://'); return }
    setError('')
    await saveUrl(trimmed)
    setUrl('')
  }

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <h1 className="text-xl font-bold text-fg">Read Later</h1>

      {/* Share toast */}
      {sharedSaved && (
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2.5">
          <Share2 size={14} className="text-green-400 shrink-0" />
          <p className="text-sm text-green-400">Đã lưu link từ Share Sheet!</p>
        </div>
      )}

      {/* URL input */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-surface border border-edge rounded-xl px-3 py-2.5 focus-within:border-accent">
            <Link2 size={16} className="text-secondary shrink-0" />
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Paste URL để lưu..."
              className="flex-1 bg-transparent text-fg placeholder-secondary/60 text-sm focus:outline-none"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={loading || !url.trim()}
            className="w-11 h-11 bg-accent hover:bg-accent-muted disabled:opacity-40 rounded-xl flex items-center justify-center text-white shrink-0"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Link2 size={18} />}
          </button>
        </div>
        {loading && <p className="text-xs text-accent">AI đang tóm tắt nội dung...</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {STATUS_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors
              ${filter === t.key ? 'bg-fg text-base' : 'bg-input text-secondary'}`}
          >
            {t.label}
            {t.key !== 'all' && (
              <span className="ml-1 text-[10px] opacity-60">
                {resources.filter(r => r.status === t.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-secondary/50 text-sm">Chưa có tài liệu nào</p>
          <p className="text-secondary/40 text-xs mt-1">Paste URL để lưu và AI sẽ tóm tắt cho mày</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(r => <ResourceCard key={r.id} resource={r} />)}
      </div>
    </div>
  )
}
