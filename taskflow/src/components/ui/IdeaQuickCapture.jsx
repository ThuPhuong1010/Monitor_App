import { useState, useRef, useEffect } from 'react'
import { Lightbulb } from 'lucide-react'
import Sheet from './Sheet'
import { useUIStore } from '../../store/uiStore'
import { useIdeaStore } from '../../store/ideaStore'
import { IDEA_CATEGORIES } from '../../services/db'

export default function IdeaQuickCapture() {
  const { ideaCaptureOpen, closeIdeaCapture } = useUIStore()
  const addIdea = useIdeaStore(s => s.addIdea)
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('idea')
  const inputRef = useRef(null)

  useEffect(() => {
    if (ideaCaptureOpen) {
      setContent('')
      setCategory('idea')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [ideaCaptureOpen])

  const handleSave = async () => {
    if (!content.trim()) return
    await addIdea({ content: content.trim(), category })
    closeIdeaCapture()
  }

  const handleKeyDown = (e) => {
    if ((e.key === 'Enter' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); handleSave() }
    if (e.key === 'Escape') closeIdeaCapture()
  }

  return (
    <Sheet open={ideaCaptureOpen} onClose={closeIdeaCapture} title="💡 Idea nhanh">
      <div className="p-4 space-y-4">
        <textarea
          ref={inputRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Idea gì vậy? Cứ ghi xuống đã..."
          rows={4}
          className="w-full bg-input border border-edge-2 rounded-xl px-4 py-3 text-fg placeholder-secondary text-[16px] focus:outline-none focus:border-accent resize-none"
        />

        {/* Category picker */}
        <div className="flex gap-2 flex-wrap">
          {Object.entries(IDEA_CATEGORIES).map(([key, cat]) => (
            <button
              key={key}
              onClick={() => setCategory(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                ${category === key
                  ? `${cat.bg} ${cat.text} ${cat.border}`
                  : 'bg-input text-secondary border-transparent hover:border-edge'}`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={!content.trim()}
          className="w-full h-11 bg-accent hover:bg-accent-muted disabled:opacity-40 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
        >
          <Lightbulb size={15} /> Lưu idea
        </button>

        <p className="text-[11px] text-secondary/50 text-center">⌘/Ctrl+Enter lưu · Esc đóng</p>
      </div>
    </Sheet>
  )
}
