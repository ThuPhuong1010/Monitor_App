import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Loader2, Bot, User, RefreshCw } from 'lucide-react'
import { chatWithAI } from '../../services/ai'
import { useTaskStore } from '../../store/taskStore'
import { useGoalStore } from '../../store/goalStore'
import { isPast, isToday, parseISO } from 'date-fns'

const PRESET_QUESTIONS = [
  'Chửi tao đi cho tỉnh',
  'Hôm nay nên làm gì đây?',
  'Task nào đang bị trễ?',
  'Đánh giá ngày hôm nay',
  'Tao lười quá, motivate tao',
  'Phân tích năng suất tao đi',
]

export default function AIChatPanel() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const tasks = useTaskStore(s => s.tasks)
  const focusTasks = useTaskStore(s => s.focusTasks)
  const goals = useGoalStore(s => s.goals)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const buildContext = () => {
    const today = new Date().toISOString().slice(0, 10)
    const pending = tasks.filter(t => t.status !== 'done')
    const overdue = pending.filter(t => t.deadline && isPast(parseISO(t.deadline)) && !isToday(parseISO(t.deadline)))
    const doneToday = tasks.filter(t => t.doneAt?.slice(0, 10) === today)
    const focusTitles = focusTasks.map(id => tasks.find(t => t.id === id)?.title).filter(Boolean)
    const activeGoals = goals.filter(g => g.status !== 'done')
    const totalMins = pending.filter(t => t.estimatedMinutes).reduce((s, t) => s + t.estimatedMinutes, 0)

    return [
      `Tasks pending: ${pending.length} (overdue: ${overdue.length})`,
      overdue.length ? `Overdue: ${overdue.slice(0, 3).map(t => t.title).join(', ')}` : '',
      `Hoàn thành hôm nay: ${doneToday.length}`,
      focusTitles.length ? `Focus hôm nay: ${focusTitles.join(', ')}` : 'Chưa chọn focus',
      activeGoals.length ? `Goals active: ${activeGoals.map(g => `${g.title} (${g.progress}%)`).join(', ')}` : '',
      totalMins > 0 ? `Tổng thời gian ước tính: ${Math.round(totalMins / 60 * 10) / 10}h` : '',
    ].filter(Boolean).join('\n')
  }

  const sendMessage = async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')
    setError('')
    setMessages(prev => [...prev, { role: 'user', text: msg }])
    setLoading(true)
    try {
      const reply = await chatWithAI(msg, buildContext())
      setMessages(prev => [...prev, { role: 'ai', text: reply }])
    } catch (e) {
      setError(e.message === 'NO_API_KEY'
        ? 'Chưa có API key — vào Settings để thêm.'
        : 'Lỗi: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-36 right-4 w-12 h-12 bg-red-600 hover:bg-red-500
          text-white rounded-full shadow-xl flex items-center justify-center z-30
          transition-all active:scale-95 md:bottom-6"
        aria-label="AI Chat"
      >
        <MessageCircle size={21} />
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-end">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative bg-surface w-full md:w-[400px] md:h-[600px] md:mr-6 md:mb-6
            h-[72vh] rounded-t-2xl md:rounded-2xl flex flex-col shadow-2xl animate-slide-up md:animate-fade-in"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-edge shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-500/15 flex items-center justify-center">
                  <Bot size={16} className="text-red-500" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-fg">Đại Ca 🔥</h2>
                  <p className="text-[10px] text-secondary">Chửi cho mày tỉnh ngộ</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={() => { setMessages([]); setError('') }}
                    className="text-secondary hover:text-fg w-8 h-8 flex items-center justify-center rounded-full hover:bg-hover transition-colors"
                    title="Xóa lịch sử"
                  >
                    <RefreshCw size={13} />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="text-secondary hover:text-fg w-8 h-8 flex items-center justify-center rounded-full hover:bg-hover transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Preset chips */}
            {messages.length === 0 && (
              <div className="px-4 pt-4 pb-2 shrink-0">
                <p className="text-xs text-secondary mb-2.5 font-medium">Câu hỏi gợi ý:</p>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_QUESTIONS.map(q => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="px-3 py-2 bg-red-500/10 text-red-500 border border-red-500/20
                        rounded-xl text-xs font-medium text-left hover:bg-red-500/15 transition-colors leading-snug"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Thread */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 overscroll-contain">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-6 h-6 rounded-full shrink-0 mt-0.5 flex items-center justify-center
                    {msg.role === 'user' ? 'bg-accent' : 'bg-red-500/15'}`}>
                    {msg.role === 'user'
                      ? <User size={11} className="text-white" />
                      : <Bot size={11} className="text-red-500" />}
                  </div>
                  <div className={`max-w-[82%] px-3 py-2 rounded-2xl text-sm leading-relaxed
                    ${msg.role === 'user'
                      ? 'bg-accent text-white rounded-tr-none'
                      : 'bg-input text-fg rounded-tl-none'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-2 items-center">
                  <div className="w-6 h-6 rounded-full bg-red-500/15 flex items-center justify-center">
                    <Bot size={11} className="text-red-500" />
                  </div>
                  <div className="bg-input px-3 py-2.5 rounded-2xl rounded-tl-none">
                    <Loader2 size={13} className="animate-spin text-secondary" />
                  </div>
                </div>
              )}
              {error && (
                <p className="text-xs text-red-500 text-center bg-red-500/5 border border-red-500/20 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Quick chips when thread has messages */}
            {messages.length > 0 && !loading && (
              <div className="px-4 py-2 border-t border-edge shrink-0 flex gap-1.5 overflow-x-auto no-scrollbar">
                {PRESET_QUESTIONS.map(q => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="px-2.5 py-1 bg-input text-secondary border border-edge rounded-full
                      text-[11px] whitespace-nowrap hover:text-fg hover:border-edge-2 transition-colors shrink-0"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="px-4 pb-4 pt-2 shrink-0 safe-bottom">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Nói gì đi, tao nghe..."
                  disabled={loading}
                  className="flex-1 bg-input border border-edge-2 rounded-xl px-3 py-2.5 text-fg
                    placeholder-secondary text-sm focus:outline-none focus:border-accent"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                  className="w-10 h-10 bg-red-600 hover:bg-red-500 disabled:opacity-40
                    text-white rounded-xl flex items-center justify-center transition-colors shrink-0"
                >
                  <Send size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
