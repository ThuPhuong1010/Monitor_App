import { useState, useRef } from 'react'
import { Plus, Mic, MicOff, FileText, Loader2, Zap, Calendar, Flag } from 'lucide-react'
import Sheet from '../ui/Sheet'
import AIParsePreview from './AIParsePreview'
import { CATEGORIES, PRIORITIES } from '../../services/db'
import { useTaskStore } from '../../store/taskStore'
import { parseTasksFromText } from '../../services/ai'

const PRIORITY_COLORS = {
  p0: 'bg-red-500/20 text-red-400 border-red-500/40',
  p1: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
  p2: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  p3: 'bg-input text-secondary border-transparent',
}

export default function QuickCapture() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [category, setCategory] = useState('adhoc')
  const [priority, setPriority] = useState('p2')
  const [deadline, setDeadline] = useState('')
  const [aiParsed, setAiParsed] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('single') // single | paste
  const [recording, setRecording] = useState(false)
  const addTask = useTaskStore(s => s.addTask)
  const addTasks = useTaskStore(s => s.addTasks)
  const inputRef = useRef(null)
  const recognitionRef = useRef(null)

  const reset = () => {
    setText(''); setCategory('adhoc'); setPriority('p2'); setDeadline('')
    setAiParsed(null); setError(''); setMode('single'); setParsing(false)
    setRecording(false)
  }

  const handleClose = () => { setOpen(false); reset() }

  const handleSingleSave = async () => {
    if (!text.trim()) return
    await addTask({
      title: text.trim(), category, priority,
      deadline: deadline || null, notes: ''
    })
    handleClose()
  }

  const handleAIParse = async () => {
    if (!text.trim()) return
    if (!window.confirm('🤖 Dùng AI phân tích text này? (tốn ~1 API call)')) return
    setParsing(true); setError('')
    try {
      const tasks = await parseTasksFromText(text)
      setAiParsed(tasks)
    } catch (e) {
      if (e.message === 'NO_API_KEY') setError('Chưa có API key. Vào Settings để thêm.')
      else setError('AI parse thất bại: ' + e.message)
    } finally {
      setParsing(false)
    }
  }

  const handleConfirmParsed = async (tasks) => { await addTasks(tasks); handleClose() }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && mode === 'single') {
      e.preventDefault(); handleSingleSave()
    }
    if (e.key === 'Escape') handleClose()
  }

  // Quick deadline helpers
  const todayStr = new Date().toISOString().slice(0, 10)
  const tomorrowStr = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) })()

  // Voice input with recording state
  const handleVoice = () => {
    // Stop if already recording
    if (recording) {
      recognitionRef.current?.stop()
      setRecording(false)
      return
    }
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      setError('Trình duyệt không hỗ trợ voice input')
      return
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SR()
    recognition.lang = 'vi-VN'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = (e) => {
      const t = e.results[0][0].transcript
      setText(prev => prev + (prev ? ' ' : '') + t)
      setRecording(false)
    }
    recognition.onerror = () => { setError('Không nhận được giọng nói'); setRecording(false) }
    recognition.onend = () => setRecording(false)
    recognitionRef.current = recognition
    recognition.start()
    setRecording(true)
  }

  if (aiParsed) {
    return (
      <Sheet open={true} onClose={handleClose} title="AI đã extract được tasks">
        <AIParsePreview tasks={aiParsed} onConfirm={handleConfirmParsed} onBack={() => setAiParsed(null)} />
      </Sheet>
    )
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 100) }}
        className="fixed bottom-20 right-4 w-14 h-14 bg-accent hover:bg-accent-muted text-white rounded-full shadow-xl flex items-center justify-center z-30 transition-transform active:scale-95"
        aria-label="Quick capture"
      >
        <Plus size={28} strokeWidth={2.5} />
      </button>

      <Sheet open={open} onClose={handleClose} title="Quick Capture">
        <div className="p-4 space-y-4">

          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode('single')}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors
                ${mode === 'single' ? 'bg-accent-soft text-accent border border-accent-border' : 'bg-input text-secondary'}`}
            >
              1 Task nhanh
            </button>
            <button
              onClick={() => setMode('paste')}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors
                ${mode === 'paste' ? 'bg-accent-soft text-accent border border-accent-border' : 'bg-input text-secondary'}`}
            >
              <FileText size={14} className="inline mr-1" />
              Paste text
            </button>
          </div>

          {/* Input */}
          {mode === 'single' ? (
            <input
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhập task, Enter để lưu..."
              className="w-full bg-input border border-edge-2 rounded-xl px-4 py-3 text-fg placeholder-secondary text-[16px] focus:outline-none focus:border-accent"
            />
          ) : (
            <textarea
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste email, tin nhắn, ghi chú... AI sẽ extract ra các tasks"
              rows={5}
              className="w-full bg-input border border-edge-2 rounded-xl px-4 py-3 text-fg placeholder-secondary text-[16px] focus:outline-none focus:border-accent resize-none"
            />
          )}

          {/* Single-mode extras: category + deadline + priority */}
          {mode === 'single' && (
            <>
              {/* Category */}
              <div>
                <p className="text-xs text-secondary mb-2">Category</p>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(CATEGORIES).map(([key, cat]) => (
                    <button
                      key={key}
                      onClick={() => setCategory(key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                        ${category === key ? `${cat.bg} ${cat.text} ${cat.border}` : 'bg-input text-secondary border-transparent'}`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Deadline + Priority row */}
              <div className="grid grid-cols-2 gap-3">
                {/* Deadline */}
                <div>
                  <p className="text-xs text-secondary mb-1.5 flex items-center gap-1">
                    <Calendar size={11} /> Deadline
                  </p>
                  <div className="flex gap-1.5 mb-1.5">
                    <button
                      onClick={() => setDeadline(d => d === todayStr ? '' : todayStr)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-all
                        ${deadline === todayStr ? 'bg-red-500/20 text-red-400 border-red-500/40' : 'bg-input text-secondary border-transparent'}`}
                    >
                      Hôm nay
                    </button>
                    <button
                      onClick={() => setDeadline(d => d === tomorrowStr ? '' : tomorrowStr)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-all
                        ${deadline === tomorrowStr ? 'bg-orange-500/20 text-orange-400 border-orange-500/40' : 'bg-input text-secondary border-transparent'}`}
                    >
                      Ngày mai
                    </button>
                  </div>
                  <input
                    type="date"
                    value={deadline}
                    onChange={e => setDeadline(e.target.value)}
                    className="w-full bg-input border border-edge-2 rounded-xl px-3 py-2 text-fg text-sm focus:outline-none focus:border-accent"
                  />
                </div>

                {/* Priority */}
                <div>
                  <p className="text-xs text-secondary mb-1.5 flex items-center gap-1">
                    <Flag size={11} /> Ưu tiên
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(PRIORITIES).map(([key, p]) => (
                      <button
                        key={key}
                        onClick={() => setPriority(key)}
                        className={`py-1.5 rounded-xl text-[11px] font-semibold border transition-all
                          ${priority === key ? PRIORITY_COLORS[key] + ' border' : 'bg-input text-secondary border-transparent'}`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Error */}
          {error && <p className="text-red-400 text-sm">{error}</p>}

          {/* Actions */}
          <div className="flex gap-2">
            {/* Mic button with recording animation */}
            <button
              onClick={handleVoice}
              className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition-all shrink-0
                ${recording
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                  : 'bg-input text-secondary hover:text-fg'}`}
            >
              {recording && (
                <span className="absolute inset-0 rounded-xl animate-ping bg-red-400/20 pointer-events-none" />
              )}
              {recording ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            {mode === 'single' ? (
              <button
                onClick={handleSingleSave}
                disabled={!text.trim()}
                className="flex-1 h-11 bg-accent hover:bg-accent-muted disabled:opacity-40 text-white rounded-xl font-semibold text-sm transition-colors"
              >
                {recording ? '🎙 Đang nghe...' : 'Lưu task'}
              </button>
            ) : (
              <button
                onClick={handleAIParse}
                disabled={!text.trim() || parsing}
                className="flex-1 h-11 bg-accent hover:bg-accent-muted disabled:opacity-40 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                {parsing ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                {parsing ? 'AI đang phân tích...' : 'AI Parse'}
              </button>
            )}
          </div>

          {/* Keyboard hint */}
          <p className="text-[11px] text-secondary/50 text-center">
            Enter lưu · Esc đóng
          </p>
        </div>
      </Sheet>
    </>
  )
}
