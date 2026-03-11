import { useState, useRef } from 'react'
import { Plus, Mic, MicOff, Check, Calendar, Flag } from 'lucide-react'
import { CATEGORIES, PRIORITIES } from '../../services/db'
import { useTaskStore } from '../../store/taskStore'

const PRIORITY_COLORS = {
  p0: 'bg-red-500/20 text-red-400 border-red-500/40',
  p1: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
  p2: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/40',
  p3: 'bg-input text-secondary border-edge',
}

// Smart local parser — detects priority/deadline/category keywords
function parseQuickText(raw) {
  let title = raw
  let priority = 'p2'
  let deadline = null
  let category = 'adhoc'

  const today = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  // Priority: "gấp"/"!!" → p0, "cao"/"!" → p1, "thấp" → p3
  if (/gấp|urgent|!!/i.test(title)) {
    priority = 'p0'; title = title.replace(/gấp|urgent|!!/gi, '').trim()
  } else if (/\bcao\b|high|\b!\b/i.test(title)) {
    priority = 'p1'; title = title.replace(/\bcao\b|high|\b!\b/gi, '').trim()
  } else if (/\bthấp\b|low/i.test(title)) {
    priority = 'p3'; title = title.replace(/\bthấp\b|low/gi, '').trim()
  }

  // Deadline: "hôm nay", "ngày mai", "T2-T7/CN"
  if (/hôm nay|today/i.test(title)) {
    deadline = toISO(today)
    title = title.replace(/hôm nay|today/gi, '').trim()
  } else if (/ngày mai|tomorrow/i.test(title)) {
    const d = new Date(today); d.setDate(d.getDate() + 1)
    deadline = toISO(d)
    title = title.replace(/ngày mai|tomorrow/gi, '').trim()
  } else {
    const dayMap = { T2: 1, T3: 2, T4: 3, T5: 4, T6: 5, T7: 6, CN: 0 }
    const m = title.match(/\b(T2|T3|T4|T5|T6|T7|CN)\b/i)
    if (m) {
      const target = dayMap[m[1].toUpperCase()]
      const d = new Date(today)
      const diff = (target - d.getDay() + 7) % 7 || 7
      d.setDate(d.getDate() + diff)
      deadline = toISO(d)
      title = title.replace(m[0], '').trim()
    }
  }

  // Category keywords
  if (/\bwork\b/i.test(title)) {
    category = 'work'; title = title.replace(/\bwork\b/gi, '').trim()
  } else if (/\bpersonal\b/i.test(title)) {
    category = 'personal'; title = title.replace(/\bpersonal\b/gi, '').trim()
  } else if (/\bfinance\b|\btiền\b/i.test(title)) {
    category = 'finance'; title = title.replace(/\bfinance\b|\btiền\b/gi, '').trim()
  }

  title = title.replace(/\s{2,}/g, ' ').replace(/^[,\-\s]+|[,\-\s]+$/g, '').trim()
  return { title: title || raw.trim(), priority, deadline, category }
}

export default function InlineCapture() {
  const [text, setText] = useState('')
  const [priority, setPriority] = useState('p2')
  const [deadline, setDeadline] = useState('')
  const [category, setCategory] = useState('adhoc')
  const [recording, setRecording] = useState(false)
  const [saved, setSaved] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const addTask = useTaskStore(s => s.addTask)
  const inputRef = useRef(null)
  const recognitionRef = useRef(null)

  const todayStr = new Date().toISOString().slice(0, 10)
  const tomorrowStr = (() => {
    const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10)
  })()

  const handleSave = async () => {
    if (!text.trim()) return
    const parsed = parseQuickText(text)
    await addTask({
      title: parsed.title,
      category: expanded ? category : parsed.category,
      priority: expanded ? priority : parsed.priority,
      deadline: (expanded && deadline) ? deadline : (parsed.deadline || null),
      notes: '',
    })
    setText(''); setPriority('p2'); setDeadline(''); setCategory('adhoc')
    setExpanded(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1200)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave() }
    if (e.key === 'Escape') { setText(''); setExpanded(false); inputRef.current?.blur() }
  }

  const handleVoice = () => {
    if (recording) { recognitionRef.current?.stop(); setRecording(false); return }
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const r = new SR()
    r.lang = 'vi-VN'; r.continuous = false; r.interimResults = false
    r.onresult = (e) => {
      const t = e.results[0][0].transcript
      setText(t); setRecording(false)
      const p = parseQuickText(t)
      if (p.priority !== 'p2') setPriority(p.priority)
      if (p.deadline) setDeadline(p.deadline)
      if (p.category !== 'adhoc') setCategory(p.category)
    }
    r.onerror = () => setRecording(false)
    r.onend = () => setRecording(false)
    recognitionRef.current = r; r.start(); setRecording(true)
  }

  // Smart parse preview
  const preview = text.trim() ? parseQuickText(text) : null
  const hasAutoDetect = preview && (preview.priority !== 'p2' || preview.deadline || preview.category !== 'adhoc')

  return (
    <div className={`bg-surface border rounded-2xl transition-all duration-200
      ${expanded ? 'border-accent-border shadow-sm shadow-indigo-500/10' : 'border-edge'}`}
    >
      {/* ── Main input row ── */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300
          ${saved ? 'bg-green-500 text-white scale-110' : 'bg-input text-secondary/40'}`}
        >
          {saved ? <Check size={14} strokeWidth={3} /> : <Plus size={14} />}
        </div>

        <input
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setExpanded(true)}
          placeholder='Nhập task... Enter lưu  |  "gấp", "ngày mai", "work" tự nhận'
          className="flex-1 bg-transparent text-fg placeholder-secondary/40 text-sm focus:outline-none min-w-0"
        />

        {/* Mic */}
        <button
          onClick={handleVoice}
          className={`relative w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all
            ${recording ? 'bg-red-500/20 text-red-400' : 'text-secondary/40 hover:text-secondary hover:bg-input'}`}
        >
          {recording && (
            <span className="absolute inset-0 rounded-xl animate-ping bg-red-400/20 pointer-events-none" />
          )}
          {recording ? <MicOff size={15} /> : <Mic size={15} />}
        </button>

        <button
          onClick={handleSave}
          disabled={!text.trim()}
          className="h-8 px-3 bg-accent disabled:opacity-30 hover:bg-accent-muted text-white rounded-xl text-xs font-semibold shrink-0 transition-all"
        >
          Lưu
        </button>
      </div>

      {/* ── Auto-detect preview ── */}
      {text.trim() && !expanded && hasAutoDetect && (
        <div className="px-3 pb-2 flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-secondary/50">Nhận ra:</span>
          {preview.priority !== 'p2' && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-lg border ${PRIORITY_COLORS[preview.priority]}`}>
              {PRIORITIES[preview.priority]?.label}
            </span>
          )}
          {preview.deadline && (
            <span className="text-[10px] text-accent font-medium">📅 {preview.deadline}</span>
          )}
          {preview.category !== 'adhoc' && (
            <span className="text-[10px] font-medium" style={{ color: CATEGORIES[preview.category]?.color }}>
              {CATEGORIES[preview.category]?.label}
            </span>
          )}
        </div>
      )}

      {/* ── Expanded: deadline + priority + category ── */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-edge pt-2.5 space-y-2">
          {/* Deadline row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Calendar size={11} className="text-secondary/60 shrink-0" />
            {[
              { label: 'Hôm nay', val: todayStr, cls: 'bg-red-500/20 text-red-400 border-red-500/40' },
              { label: 'Ngày mai', val: tomorrowStr, cls: 'bg-orange-500/20 text-orange-400 border-orange-500/40' },
            ].map(({ label, val, cls }) => (
              <button
                key={val}
                onClick={() => setDeadline(d => d === val ? '' : val)}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-medium border transition-all
                  ${deadline === val ? cls : 'bg-input text-secondary border-transparent'}`}
              >
                {label}
              </button>
            ))}
            <input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="bg-input border border-edge-2 rounded-lg px-2 py-0.5 text-fg text-[11px] focus:outline-none focus:border-accent"
            />
            {deadline && (
              <button onClick={() => setDeadline('')} className="text-[11px] text-secondary/40 hover:text-secondary leading-none">✕</button>
            )}
          </div>

          {/* Priority + Category row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Flag size={11} className="text-secondary/60 shrink-0" />
            {Object.entries(PRIORITIES).map(([key, p]) => (
              <button
                key={key}
                onClick={() => setPriority(key)}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border transition-all
                  ${priority === key ? PRIORITY_COLORS[key] : 'bg-input text-secondary border-transparent'}`}
              >
                {p.label}
              </button>
            ))}
            <span className="w-px h-3 bg-edge-2 mx-0.5" />
            {Object.entries(CATEGORIES).map(([key, cat]) => (
              <button
                key={key}
                onClick={() => setCategory(key)}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-medium border transition-all
                  ${category === key ? `${cat.bg} ${cat.text} ${cat.border}` : 'bg-input text-secondary border-transparent'}`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
