import { useState, useEffect } from 'react'
import { Eye, EyeOff, Check, Download, Upload, Sun, Moon, ChevronDown, Sparkles, Send, Bell, Zap, Loader2, Clock, Power, Cloud, LogIn, LogOut, UserCheck } from 'lucide-react'
import { getSetting, setSetting, db } from '../services/db'
import { useThemeStore } from '../store/themeStore'
import { AI_PROVIDERS, testApiKey } from '../services/ai'
import { sendTelegram, sendDailyDigest, sendOverdueAlert } from '../services/telegram'
import { startAutoReminder, stopAutoReminder, isAutoReminderRunning } from '../services/autoReminder'
import { startTelegramBot, stopTelegramBot, isTelegramBotRunning } from '../services/telegramBot'
import { useTaskStore } from '../store/taskStore'
import { useGoalStore } from '../store/goalStore'
import { useAuth } from '../hooks/useAuth'
import { signInWithEmail, signOut, isSupabaseReady } from '../services/supabase'

export default function Settings() {
  const [provider, setProvider] = useState('claude')
  const [model, setModel] = useState('')
  const [keys, setKeys] = useState({ claude: '', gemini: '' })
  const [show, setShow] = useState(false)
  const [saved, setSaved] = useState(false)
  const [apiTestStatus, setApiTestStatus] = useState('') // '' | 'testing' | 'ok' | 'error'
  const [apiTestMsg, setApiTestMsg] = useState('')
  const { theme, setTheme } = useThemeStore()
  const tasks = useTaskStore(s => s.tasks)
  const goals = useGoalStore(s => s.goals)
  const focusTasks = useTaskStore(s => s.focusTasks)

  // Cloud sync state
  const { user, loading: authLoading } = useAuth()
  const [loginEmail, setLoginEmail] = useState('')
  const [loginStatus, setLoginStatus] = useState('') // ''|'sending'|'sent'|'error'
  const [loginMsg, setLoginMsg] = useState('')
  const [uploadStatus, setUploadStatus] = useState('') // ''|'uploading'|'done'|'error'

  // Telegram state
  const [tgToken, setTgToken] = useState('')
  const [tgChatId, setTgChatId] = useState('')
  const [tgNotifyDone, setTgNotifyDone] = useState(false)
  const [tgNotifyOverdue, setTgNotifyOverdue] = useState(true)
  const [tgStatus, setTgStatus] = useState('') // '', 'testing', 'ok', 'error'
  const [tgMsg, setTgMsg] = useState('')

  // Auto Reminder state
  const [autoReminderEnabled, setAutoReminderEnabled] = useState(true)
  const [autoOverdueAlert, setAutoOverdueAlert] = useState(true)
  const [reminderRunning, setReminderRunning] = useState(false)

  // Telegram Bot 2-way state
  const [tgBotEnabled, setTgBotEnabled] = useState(false)
  const [tgBotRunning, setTgBotRunning] = useState(false)

  useEffect(() => {
    Promise.all([
      getSetting('aiProvider'),
      getSetting('aiModel'),
      getSetting('claudeApiKey'),
      getSetting('geminiApiKey'),
      getSetting('telegramToken'),
      getSetting('telegramChatId'),
      getSetting('telegramNotifyDone', false),
      getSetting('telegramNotifyOverdue', true),
    ]).then(([p, m, ck, gk, tt, tc, nd, no]) => {
      const prov = p || 'claude'
      setProvider(prov)
      // Auto-fix deprecated models
      const deprecatedModels = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro']
      const savedModel = m || AI_PROVIDERS[prov].defaultModel
      setModel(deprecatedModels.includes(savedModel) ? AI_PROVIDERS[prov].defaultModel : savedModel)
      setKeys({ claude: ck || '', gemini: gk || '' })
      setTgToken(tt || '')
      setTgChatId(tc || '')
      setTgNotifyDone(nd || false)
      setTgNotifyOverdue(no !== false)
    })
    // Load auto reminder settings
    Promise.all([
      getSetting('autoReminderEnabled', true),
      getSetting('autoOverdueAlert', true),
    ]).then(([are, aoa]) => {
      setAutoReminderEnabled(are !== false)
      setAutoOverdueAlert(aoa !== false)
    })
    setReminderRunning(isAutoReminderRunning())
    // Load telegram bot setting
    getSetting('telegramBotEnabled', false).then(v => {
      setTgBotEnabled(!!v)
      setTgBotRunning(isTelegramBotRunning())
    })
  }, [])

  const currentProvider = AI_PROVIDERS[provider]

  const handleProviderChange = (p) => {
    setProvider(p)
    setModel(AI_PROVIDERS[p].defaultModel)
  }

  const handleSave = async () => {
    await setSetting('aiProvider', provider)
    await setSetting('aiModel', model)
    await setSetting('claudeApiKey', keys.claude.trim())
    await setSetting('geminiApiKey', keys.gemini.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleTestApiKey = async () => {
    const currentKey = keys[provider]?.trim()
    if (!currentKey) {
      setApiTestStatus('error')
      setApiTestMsg('Chưa nhập API key!')
      return
    }
    setApiTestStatus('testing')
    setApiTestMsg('')
    const result = await testApiKey(provider, currentKey, model)
    setApiTestStatus(result.ok ? 'ok' : 'error')
    setApiTestMsg(result.message)
    // Auto-save if test succeeds
    if (result.ok) {
      // If test returned a different (fallback) model, switch to it
      const finalModel = result.model || model
      if (result.model && result.model !== model) {
        setModel(finalModel)
      }
      await setSetting('aiProvider', provider)
      await setSetting('aiModel', finalModel)
      await setSetting('claudeApiKey', keys.claude.trim())
      await setSetting('geminiApiKey', keys.gemini.trim())
    }
  }

  const handleSaveTelegram = async () => {
    await setSetting('telegramToken', tgToken.trim())
    await setSetting('telegramChatId', tgChatId.trim())
    await setSetting('telegramNotifyDone', tgNotifyDone)
    await setSetting('telegramNotifyOverdue', tgNotifyOverdue)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleTestTelegram = async () => {
    setTgStatus('testing')
    setTgMsg('')
    try {
      await sendTelegram(tgToken.trim(), tgChatId.trim(), '✅ <b>TaskFlow</b> — kết nối Telegram thành công!')
      setTgStatus('ok')
      setTgMsg('Gửi thành công! Kiểm tra Telegram của bạn.')
    } catch (e) {
      setTgStatus('error')
      setTgMsg(e.message)
    }
  }

  const handleDigest = async () => {
    setTgStatus('testing')
    setTgMsg('')
    try {
      await sendDailyDigest(tasks, focusTasks, goals)
      setTgStatus('ok')
      setTgMsg('Đã gửi daily digest!')
    } catch (e) {
      setTgStatus('error')
      setTgMsg(e.message)
    }
  }

  const handleOverdueAlert = async () => {
    setTgStatus('testing')
    setTgMsg('')
    try {
      await sendOverdueAlert(tasks)
      setTgStatus('ok')
      setTgMsg('Đã gửi overdue alert!')
    } catch (e) {
      setTgStatus('error')
      setTgMsg(e.message)
    }
  }

  const handleLogin = async () => {
    if (!loginEmail.trim()) return
    setLoginStatus('sending')
    setLoginMsg('')
    try {
      await signInWithEmail(loginEmail.trim())
      setLoginStatus('sent')
      setLoginMsg('Magic link đã gửi! Kiểm tra email và click vào link.')
    } catch (e) {
      setLoginStatus('error')
      setLoginMsg(e.message)
    }
  }

  const handleLogout = async () => {
    await signOut()
    setLoginStatus('')
    setLoginMsg('')
  }

  const handleUploadToCloud = async () => {
    if (!user) return
    setUploadStatus('uploading')
    try {
      const { upsertRecord } = await import('../services/supabase')
      const [allTasks, allGoals, allMilestones, allResources, allIdeas] = await Promise.all([
        db.tasks.toArray(),
        db.goals.toArray(),
        db.milestones.toArray(),
        db.resources.toArray(),
        db.ideas.toArray(),
      ])
      // Upload tuần tự để tránh rate limit
      for (const t of allTasks) await upsertRecord('tasks', t)
      for (const g of allGoals) await upsertRecord('goals', g)
      for (const m of allMilestones) await upsertRecord('milestones', m)
      for (const r of allResources) await upsertRecord('resources', r)
      for (const i of allIdeas) await upsertRecord('ideas', i)
      setUploadStatus('done')
    } catch (e) {
      setUploadStatus('error')
      console.error('Upload failed:', e)
    }
  }

  const handleExport = async () => {
    const [tasks, goals, milestones, resources, ideas] = await Promise.all([
      db.tasks.toArray(),
      db.goals.toArray(),
      db.milestones.toArray(),
      db.resources.toArray(),
      db.ideas.toArray(),
    ])
    const blob = new Blob(
      [JSON.stringify({ tasks, goals, milestones, resources, ideas, exportedAt: new Date().toISOString() }, null, 2)],
      { type: 'application/json' }
    )
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `taskflow-backup-${new Date().toISOString().slice(0, 10)}.json`,
    })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const data = JSON.parse(await file.text())
    if (data.tasks) await db.tasks.bulkPut(data.tasks)
    if (data.goals) await db.goals.bulkPut(data.goals)
    if (data.milestones) await db.milestones.bulkPut(data.milestones)
    if (data.resources) await db.resources.bulkPut(data.resources)
    if (data.ideas) await db.ideas.bulkPut(data.ideas)
    alert('Import thành công! Reload lại app.')
  }

  return (
    <div className="px-4 pt-6 pb-4 max-w-xl space-y-6">
      <h1 className="text-xl font-bold text-fg">Settings</h1>

      {/* ── Theme toggle ── */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold text-secondary uppercase tracking-wider">Giao diện</h2>
        <div className="flex gap-2">
          {['light', 'dark'].map(t => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`flex-1 h-11 flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors
                ${theme === t ? 'bg-accent text-white' : 'bg-input text-secondary hover:bg-hover'}`}
            >
              {t === 'light' ? <Sun size={16} /> : <Moon size={16} />}
              {t === 'light' ? 'Sáng' : 'Tối'}
            </button>
          ))}
        </div>
      </section>

      {/* ── AI Provider ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-accent" />
          <h2 className="text-xs font-bold text-secondary uppercase tracking-wider">AI Provider</h2>
        </div>

        {/* Provider toggle */}
        <div className="flex gap-2">
          {Object.values(AI_PROVIDERS).map(p => (
            <button
              key={p.id}
              onClick={() => handleProviderChange(p.id)}
              className={`flex-1 h-11 rounded-xl text-sm font-semibold transition-colors border
                ${provider === p.id
                  ? 'bg-accent text-white border-accent'
                  : 'bg-input text-secondary border-transparent hover:bg-hover'}`}
            >
              {p.id === 'claude' ? '🤖 Claude' : '✨ Gemini'}
            </button>
          ))}
        </div>

        {/* Model selector */}
        <div>
          <label className="text-xs text-secondary mb-1.5 block">Model</label>
          <div className="relative">
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full appearance-none bg-input border border-edge rounded-xl px-3 py-2.5 text-sm text-fg focus:outline-none focus:border-accent pr-8"
            >
              {currentProvider.models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" />
          </div>
        </div>

        {/* API Key for current provider */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-secondary">{currentProvider.keyLabel}</label>
            <a
              href={currentProvider.keyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent hover:text-accent-muted"
            >
              Lấy key →
            </a>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-surface border border-edge rounded-xl px-3 py-2.5 focus-within:border-accent transition-colors">
              <input
                type={show ? 'text' : 'password'}
                value={keys[provider]}
                onChange={e => setKeys(k => ({ ...k, [provider]: e.target.value }))}
                placeholder={currentProvider.keyPlaceholder}
                className="flex-1 bg-transparent text-fg placeholder-secondary/60 text-sm focus:outline-none font-mono"
              />
              <button onClick={() => setShow(s => !s)} className="text-secondary hover:text-fg shrink-0">
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <button
              onClick={handleTestApiKey}
              disabled={apiTestStatus === 'testing'}
              className={`h-11 px-3 rounded-xl flex items-center justify-center gap-1.5 shrink-0 transition-all text-xs font-semibold border
                ${apiTestStatus === 'testing' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                  apiTestStatus === 'ok' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                    apiTestStatus === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                      'bg-input border-edge hover:bg-hover text-secondary hover:text-fg'}`}
              title="Test API key trước khi lưu"
            >
              {apiTestStatus === 'testing'
                ? <><Loader2 size={14} className="animate-spin" /> Testing...</>
                : <><Zap size={14} /> Test</>}
            </button>
            <button
              onClick={handleSave}
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors
                ${saved ? 'bg-green-500 text-white' : 'bg-accent hover:bg-accent-muted text-white'}`}
            >
              <Check size={18} />
            </button>
          </div>
          {/* API Test result */}
          {apiTestMsg && (
            <p className={`text-xs mt-1.5 px-3 py-2 rounded-xl border font-medium ${apiTestStatus === 'ok'
              ? 'text-green-400 bg-green-500/5 border-green-500/20'
              : 'text-red-400 bg-red-500/5 border-red-500/20'
              }`}>
              {apiTestMsg}
            </p>
          )}
          {saved && !apiTestMsg && <p className="text-xs text-green-600 mt-1.5 font-medium">Đã lưu ✓</p>}
        </div>

        {/* AI capabilities summary */}
        <div className="bg-surface border border-edge rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-fg">AI hỗ trợ những gì:</p>
          <ul className="space-y-1.5">
            {[
              { icon: '📋', label: 'Parse text → tasks', desc: 'Dán đoạn text, AI extract ra list task tự động' },
              { icon: '🔗', label: 'Tóm tắt URL', desc: 'Save link vào Library, AI tóm tắt nội dung + tags' },
              { icon: '🎯', label: 'Goal Breakdown', desc: 'AI tự chia goal thành sub-tasks + milestones' },
              { icon: '💡', label: 'Idea Enrichment', desc: 'AI mở rộng idea thành kế hoạch chi tiết + action items' },
              { icon: '⚡', label: 'Smart Daily Plan', desc: 'AI chọn top 3 tasks nên focus hôm nay' },
              { icon: '🔥', label: 'Đại Ca Roast', desc: 'AI đánh giá hiệu suất và chửi cho tỉnh' },
              { icon: '📊', label: 'Weekly AI Review', desc: 'Tóm tắt tuần + gợi ý cải thiện' },
            ].map(f => (
              <li key={f.label} className="flex items-start gap-2">
                <span className="text-sm shrink-0 mt-0.5">{f.icon}</span>
                <div>
                  <span className="text-xs font-semibold text-fg">{f.label}</span>
                  <span className="text-xs text-secondary"> — {f.desc}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Telegram ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Send size={14} className="text-[#229ED9]" />
          <h2 className="text-xs font-bold text-secondary uppercase tracking-wider">Telegram Bot</h2>
        </div>

        <div className="bg-surface border border-edge rounded-xl p-3 text-xs text-secondary space-y-1 leading-relaxed">
          <p className="font-semibold text-fg text-[11px]">Cách setup:</p>
          <p>1. Chat với <span className="text-[#229ED9] font-mono">@BotFather</span> → <span className="font-mono">/newbot</span> → lấy token</p>
          <p>2. Nhắn tin cho bot của bạn, sau đó mở <span className="font-mono break-all">api.telegram.org/bot&#123;TOKEN&#125;/getUpdates</span> lấy chat_id</p>
          <p>3. Nhập vào bên dưới và Test</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-secondary mb-1.5 block">Bot Token</label>
            <input
              type="password"
              value={tgToken}
              onChange={e => setTgToken(e.target.value)}
              placeholder="123456789:ABC-..."
              className="w-full bg-input border border-edge-2 rounded-xl px-3 py-2.5 text-fg placeholder-secondary/60 text-sm font-mono focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs text-secondary mb-1.5 block">Chat ID</label>
            <input
              type="text"
              value={tgChatId}
              onChange={e => setTgChatId(e.target.value)}
              placeholder="-100123456789 hoặc 123456789"
              className="w-full bg-input border border-edge-2 rounded-xl px-3 py-2.5 text-fg placeholder-secondary/60 text-sm font-mono focus:outline-none focus:border-accent"
            />
          </div>

          {/* Toggles */}
          <div className="space-y-2">
            <Toggle
              label="Thông báo khi hoàn thành task"
              value={tgNotifyDone}
              onChange={setTgNotifyDone}
            />
            <Toggle
              label="Cảnh báo task quá hạn"
              value={tgNotifyOverdue}
              onChange={setTgNotifyOverdue}
            />
          </div>

          {/* Status */}
          {tgMsg && (
            <p className={`text-xs px-3 py-2 rounded-xl border ${tgStatus === 'ok'
              ? 'text-green-600 bg-green-500/5 border-green-500/20'
              : 'text-red-500 bg-red-500/5 border-red-500/20'}`}>
              {tgMsg}
            </p>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleTestTelegram}
              disabled={!tgToken || !tgChatId || tgStatus === 'testing'}
              className="h-10 bg-[#229ED9] hover:bg-[#1a8bc2] disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Send size={13} /> Test kết nối
            </button>
            <button
              onClick={handleSaveTelegram}
              className={`h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors
                ${saved ? 'bg-green-500 text-white' : 'bg-accent hover:bg-accent-muted text-white'}`}
            >
              <Check size={13} /> Lưu
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleDigest}
              disabled={!tgToken || !tgChatId || tgStatus === 'testing'}
              className="h-10 bg-input hover:bg-hover text-fg disabled:opacity-40 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <Bell size={13} /> Gửi Daily Digest
            </button>
            <button
              onClick={handleOverdueAlert}
              disabled={!tgToken || !tgChatId || tgStatus === 'testing'}
              className="h-10 bg-input hover:bg-hover text-fg disabled:opacity-40 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              ⚠️ Overdue Alert
            </button>
          </div>
        </div>

        {/* 2-way Bot interaction */}
        <div className="bg-surface border border-edge rounded-xl p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-fg">🤖 Bot 2 chiều (Telegram → TaskFlow)</p>
              <p className="text-[10px] text-secondary mt-0.5">Gửi tin nhắn cho bot trên Telegram, bot trả lời như Đại Ca</p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tgBotRunning
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
              {tgBotRunning ? '● Live' : '○ Off'}
            </span>
          </div>

          <div className="text-[10px] text-secondary bg-input rounded-lg p-2 space-y-0.5 font-mono">
            <p className="font-bold text-fg text-[11px] font-sans">Commands trên Telegram:</p>
            <p>/status — Tình trạng tasks</p>
            <p>/focus — Focus tasks hiện tại</p>
            <p>/overdue — Task quá hạn</p>
            <p>/roast — Chửi cho tỉnh 💀</p>
            <p>/digest — Daily digest</p>
            <p className="text-accent">+ gõ bất kỳ → Chat AI Đại Ca</p>
          </div>

          <Toggle
            label="Bật Bot 2 chiều"
            value={tgBotEnabled}
            onChange={async (v) => {
              setTgBotEnabled(v)
              await setSetting('telegramBotEnabled', v)
              if (v && tgToken && tgChatId) {
                startTelegramBot()
                setTgBotRunning(true)
              } else {
                stopTelegramBot()
                setTgBotRunning(false)
              }
            }}
          />

          <div className="flex gap-2">
            <button
              onClick={() => {
                if (tgToken) { startTelegramBot(); setTgBotRunning(true) }
              }}
              disabled={tgBotRunning || !tgToken}
              className="flex-1 h-9 bg-[#229ED9] hover:bg-[#1a8bc2] disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Power size={12} /> Start Bot
            </button>
            <button
              onClick={() => { stopTelegramBot(); setTgBotRunning(false) }}
              disabled={!tgBotRunning}
              className="flex-1 h-9 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Power size={12} /> Stop Bot
            </button>
          </div>
        </div>
      </section>

      {/* ── Auto Reminder ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-amber-400" />
          <h2 className="text-xs font-bold text-secondary uppercase tracking-wider">Auto Reminder</h2>
          <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${reminderRunning
            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
            {reminderRunning ? '● Running' : '○ Stopped'}
          </span>
        </div>

        <div className="bg-surface border border-edge rounded-xl p-3 text-xs text-secondary space-y-1 leading-relaxed">
          <p className="font-semibold text-fg text-[11px]">Cơ chế auto gửi:</p>
          <p>• <b>9:00 AM</b> — Nhắc chọn focus task</p>
          <p>• <b>10:00 AM</b> — Cảnh báo nếu chưa chọn focus</p>
          <p>• <b>12:00 PM</b> — Checkpoint giữa ngày</p>
          <p>• <b>5:00 PM</b> — Review cuối ngày</p>
          <p>• <b>Mỗi 2h</b> — Check task quá hạn</p>
          <p className="text-accent mt-1">→ Gửi qua Browser Notification + Telegram (nếu đã setup)</p>
        </div>

        <div className="space-y-2">
          <Toggle
            label="Auto Reminder (sáng/trưa/chiều)"
            value={autoReminderEnabled}
            onChange={async (v) => {
              setAutoReminderEnabled(v)
              await setSetting('autoReminderEnabled', v)
              if (v) { startAutoReminder(); setReminderRunning(true) }
              else { stopAutoReminder(); setReminderRunning(false) }
            }}
          />
          <Toggle
            label="Auto cảnh báo task quá hạn (mỗi 2h)"
            value={autoOverdueAlert}
            onChange={async (v) => {
              setAutoOverdueAlert(v)
              await setSetting('autoOverdueAlert', v)
            }}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => { startAutoReminder(); setReminderRunning(true) }}
            disabled={reminderRunning}
            className="flex-1 h-10 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Power size={13} /> Start Engine
          </button>
          <button
            onClick={() => { stopAutoReminder(); setReminderRunning(false) }}
            disabled={!reminderRunning}
            className="flex-1 h-10 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Power size={13} /> Stop Engine
          </button>
        </div>
      </section>

      {/* ── Cloud Sync ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Cloud size={14} className="text-blue-400" />
          <h2 className="text-xs font-bold text-secondary uppercase tracking-wider">Cloud Sync</h2>
          {user && (
            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
              ● Đã kết nối
            </span>
          )}
        </div>

        {!isSupabaseReady() ? (
          <div className="bg-surface border border-edge rounded-xl p-3 text-xs text-secondary">
            Chưa cấu hình Supabase. Thêm <span className="font-mono text-fg">VITE_SUPABASE_URL</span> và <span className="font-mono text-fg">VITE_SUPABASE_ANON_KEY</span> vào <span className="font-mono text-fg">.env</span>.
          </div>
        ) : !authLoading && !user ? (
          <div className="space-y-3">
            <p className="text-xs text-secondary">Đăng nhập để sync dữ liệu giữa các thiết bị (PC, Android, ...).</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="email@example.com"
                className="flex-1 bg-input border border-edge rounded-xl px-3 py-2.5 text-sm text-fg placeholder-secondary/60 focus:outline-none focus:border-accent"
              />
              <button
                onClick={handleLogin}
                disabled={loginStatus === 'sending' || !loginEmail.trim()}
                className="h-11 px-4 bg-accent hover:bg-accent-muted disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                {loginStatus === 'sending'
                  ? <><Loader2 size={13} className="animate-spin" /> Gửi...</>
                  : <><LogIn size={13} /> Magic Link</>}
              </button>
            </div>
            {loginMsg && (
              <p className={`text-xs px-3 py-2 rounded-xl border ${loginStatus === 'sent'
                ? 'text-green-400 bg-green-500/5 border-green-500/20'
                : 'text-red-400 bg-red-500/5 border-red-500/20'}`}>
                {loginMsg}
              </p>
            )}
          </div>
        ) : user ? (
          <div className="space-y-3">
            <div className="bg-surface border border-edge rounded-xl px-3 py-2.5 flex items-center gap-2">
              <UserCheck size={14} className="text-green-400 shrink-0" />
              <span className="text-sm text-fg flex-1 truncate">{user.email}</span>
              <button
                onClick={handleLogout}
                className="text-xs text-secondary hover:text-red-400 flex items-center gap-1 transition-colors"
              >
                <LogOut size={12} /> Logout
              </button>
            </div>

            {/* Upload dữ liệu cũ lên cloud */}
            <div className="bg-surface border border-edge rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-fg">Upload data local lên cloud</p>
              <p className="text-[11px] text-secondary">Chỉ cần làm 1 lần khi mới kết nối. Dữ liệu tiếp theo sẽ tự sync.</p>
              <button
                onClick={handleUploadToCloud}
                disabled={uploadStatus === 'uploading'}
                className={`w-full h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors
                  ${uploadStatus === 'done' ? 'bg-green-600 text-white'
                    : uploadStatus === 'error' ? 'bg-red-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white'}`}
              >
                {uploadStatus === 'uploading' && <><Loader2 size={13} className="animate-spin" /> Đang upload...</>}
                {uploadStatus === 'done' && <><Check size={13} /> Đã upload xong!</>}
                {uploadStatus === 'error' && '❌ Lỗi, thử lại'}
                {!uploadStatus && <><Cloud size={13} /> Upload lên Supabase</>}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {/* ── Backup ── */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold text-secondary uppercase tracking-wider">Backup dữ liệu</h2>
        <p className="text-xs text-secondary/70">
          Dữ liệu lưu trong browser. Export JSON để backup tránh mất khi clear browser.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex-1 h-11 bg-input hover:bg-hover text-fg rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <Download size={16} /> Export JSON
          </button>
          <label className="flex-1 h-11 bg-input hover:bg-hover text-fg rounded-xl text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors">
            <Upload size={16} /> Import JSON
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>
      </section>

      {/* ── PWA ── */}
      <section className="bg-accent-soft border border-accent-border rounded-xl p-4 space-y-1.5">
        <h2 className="text-sm font-semibold text-accent">Cài app lên homescreen</h2>
        <p className="text-xs text-secondary leading-relaxed">
          <strong className="text-fg">iOS:</strong> Safari → Share → Add to Home Screen<br />
          <strong className="text-fg">Android:</strong> Chrome → Menu → Install app
        </p>
      </section>
    </div>
  )
}

function Toggle({ label, value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="w-full flex items-center justify-between px-3 py-2.5 bg-surface border border-edge rounded-xl hover:border-edge-2 transition-colors"
    >
      <span className="text-sm text-fg">{label}</span>
      <div className={`w-10 h-5 rounded-full transition-colors relative ${value ? 'bg-accent' : 'bg-edge-3'}`}>
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? 'left-5' : 'left-0.5'}`} />
      </div>
    </button>
  )
}
