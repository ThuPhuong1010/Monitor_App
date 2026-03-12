import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '../../store/uiStore'

const SHORTCUTS = [
  { keys: ['N'], desc: 'Thêm task mới', section: 'Capture' },
  { keys: ['I'], desc: 'Thêm idea mới', section: 'Capture' },
  { keys: ['G', 'H'], desc: 'Home / Dashboard', section: 'Navigate' },
  { keys: ['G', 'T'], desc: 'Tasks', section: 'Navigate' },
  { keys: ['G', 'C'], desc: 'Calendar', section: 'Navigate' },
  { keys: ['G', 'L'], desc: 'Library', section: 'Navigate' },
  { keys: ['G', 'I'], desc: 'Ideas', section: 'Navigate' },
  { keys: ['G', 'R'], desc: 'Weekly Review', section: 'Navigate' },
  { keys: ['?'], desc: 'Hiện / ẩn shortcuts', section: 'General' },
  { keys: ['Esc'], desc: 'Đóng panel', section: 'General' },
]

function isInputFocused() {
  const el = document.activeElement
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

export function useKeyboardShortcuts() {
  const { openTaskCapture, openIdeaCapture, toggleShortcuts, closeShortcuts } = useUIStore()
  const navigate = useNavigate()

  useEffect(() => {
    let gPressed = false
    let gTimer = null

    const handler = (e) => {
      if (isInputFocused()) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const key = e.key.toLowerCase()

      if (key === 'escape') { closeShortcuts(); return }
      if (e.key === '?') { e.preventDefault(); toggleShortcuts(); return }

      // G-chord navigation
      if (gPressed) {
        gPressed = false
        clearTimeout(gTimer)
        switch (key) {
          case 'h': navigate('/'); break
          case 't': navigate('/tasks'); break
          case 'c': navigate('/calendar'); break
          case 'l': navigate('/library'); break
          case 'i': navigate('/ideas'); break
          case 'r': navigate('/review'); break
        }
        return
      }

      switch (key) {
        case 'n': e.preventDefault(); openTaskCapture(); break
        case 'i': e.preventDefault(); openIdeaCapture(); break
        case 'g':
          gPressed = true
          gTimer = setTimeout(() => { gPressed = false }, 600)
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, openTaskCapture, openIdeaCapture, toggleShortcuts, closeShortcuts])
}

export default function KeyboardShortcutsHelp() {
  const { shortcutsOpen, closeShortcuts } = useUIStore()
  if (!shortcutsOpen) return null

  const sections = [...new Set(SHORTCUTS.map(s => s.section))]

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={closeShortcuts}
    >
      <div
        className="bg-elevated border border-edge rounded-2xl shadow-2xl p-5 w-80 max-w-[90vw]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-fg flex items-center gap-2">
            ⌨️ Keyboard Shortcuts
          </h3>
          <kbd className="text-[10px] text-secondary/60 bg-input border border-edge rounded px-1.5 py-0.5 font-mono">?</kbd>
        </div>

        <div className="space-y-4">
          {sections.map(section => (
            <div key={section}>
              <p className="text-[10px] uppercase font-bold text-secondary/50 tracking-wider mb-2">{section}</p>
              <div className="space-y-1.5">
                {SHORTCUTS.filter(s => s.section === section).map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-secondary">{s.desc}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {s.keys.map((k, j) => (
                        <span key={j} className="flex items-center gap-1">
                          <kbd className="text-[10px] font-mono bg-input border border-edge rounded-md px-1.5 py-0.5 text-fg min-w-[20px] text-center">{k}</kbd>
                          {j < s.keys.length - 1 && <span className="text-secondary/40 text-[10px]">then</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={closeShortcuts}
          className="mt-4 w-full h-8 bg-input hover:bg-hover text-secondary rounded-xl text-xs transition-colors"
        >
          Đóng (Esc)
        </button>
      </div>
    </div>
  )
}
