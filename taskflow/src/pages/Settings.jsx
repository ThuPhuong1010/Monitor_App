import { useState, useEffect } from 'react'
import { Eye, EyeOff, Check, Download, Upload, Sun, Moon, ChevronDown, Sparkles, Send, Bell, Zap, Loader2, Clock, Power, Cloud, LogIn, LogOut, UserCheck } from 'lucide-react'
import { getSetting, setSetting, db } from '../services/db'
import { useThemeStore } from '../store/themeStore'
import { AI_PROVIDERS, testApiKey, getAIUsageStats, resetAIUsageStats } from '../services/ai'
import { getCacheStats, clearCache, getCacheSize, getRateLimitStatus } from '../services/aiCache'
import { sendTelegram, sendDailyDigest, sendOverdueAlert } from '../services/telegram'
import { startAutoReminder, stopAutoReminder, isAutoReminderRunning } from '../services/autoReminder'
import { startTelegramBot, stopTelegramBot, isTelegramBotRunning } from '../services/telegramBot'
import { useTaskStore } from '../store/taskStore'
import { useGoalStore } from '../store/goalStore'
import { useAuth } from '../hooks/useAuth'
import { signInWithEmail, signOut, isSupabaseReady } from '../services/supabase'
import { pushPrefsToCloud, pullPrefsFromCloud } from '../services/prefsSync'
import KeyVaultSection from '../components/settings/KeyVaultSection'

const TABS = [
  { id: 'ui', label: 'Giao diện', icon: Sun },
  { id: 'ai', label: 'AI', icon: Sparkles },
  { id: 'notify', label: 'Thông báo', icon: Bell },
  { id: 'data', label: 'Dữ liệu', icon: Cloud },
]

export default function Settings() {
  const [tab, setTab] = useState('ui')

  const [provider, setProvider] = useState('claude')
  const [model, setModel] = useState('')
  const [keys, setKeys] = useState({ claude: '', gemini: '', gpt: '' })
  const [show, setShow] = useState(false)
  const [saved, setSaved] = useState(false)
  const [apiTestStatus, setApiTestStatus] = useState('')
  const [apiTestMsg, setApiTestMsg] = useState('')
  const { theme, setTheme } = useThemeStore()
  const tasks = useTaskStore(s => s.tasks)
  const goals = useGoalStore(s => s.goals)
  const focusTasks = useTaskStore(s => s.focusTasks)

  const { user, loading: authLoading } = useAuth()

  useEffect(() => {
    if (!user) return
    pullPrefsFromCloud().then(prefs => {
      if (!prefs) return
      if (prefs.ai_provider) setProvider(prefs.ai_provider)
      if (prefs.ai_model) setModel(prefs.ai_model)
      if (prefs.notify_done !== undefined) setTgNotifyDone(!!prefs.notify_done)
      if (prefs.notify_overdue !== undefined) setTgNotifyOverdue(prefs.notify_overdue !== false)
      if (prefs.auto_reminder !== undefined) setAutoReminderEnabled(prefs.auto_reminder !== false)
    }).catch(() => { })
  }, [user])

  const [loginEmail, setLoginEmail] = useState('')
  const [loginStatus, setLoginStatus] = useState('')
  const [loginMsg, setLoginMsg] = useState('')
  const [uploadStatus, setUploadStatus] = useState('')

  const [tgToken, setTgToken] = useState('')
  const [tgChatId, setTgChatId] = useState('')
  const [tgNotifyDone, setTgNotifyDone] = useState(false)
  const [tgNotifyOverdue, setTgNotifyOverdue] = useState(true)
  const [tgStatus, setTgStatus] = useState('')
  const [tgMsg, setTgMsg] = useState('')

  const [autoReminderEnabled, setAutoReminderEnabled] = useState(true)
  const [autoOverdueAlert, setAutoOverdueAlert] = useState(true)
  const [reminderRunning, setReminderRunning] = useState(false)

  const [tgBotEnabled, setTgBotEnabled] = useState(false)
  const [tgBotRunning, setTgBotRunning] = useState(false)

  useEffect(() => {
    Promise.all([
      getSetting('aiProvider'),
      getSetting('aiModel'),
      getSetting('claudeApiKey'),
      getSetting('geminiApiKey'),
      getSetting('gptApiKey'),
      getSetting('telegramToken'),
      getSetting('telegramChatId'),
      getSetting('telegramNotifyDone', false),
      getSetting('telegramNotifyOverdue', true),
    ]).then(([p, m, ck, gk, ok, tt, tc, nd, no]) => {
      const prov = p || 'claude'
      setProvider(prov)
      const deprecatedModels = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro']
      const savedModel = m || AI_PROVIDERS[prov].defaultModel
      setModel(deprecatedModels.includes(savedModel) ? AI_PROVIDERS[prov].defaultModel : savedModel)
      setKeys({ claude: ck || '', gemini: gk || '', gpt: ok || '' })
      setTgToken(tt || '')
      setTgChatId(tc || '')
      setTgNotifyDone(nd || false)
      setTgNotifyOverdue(no !== false)
    })
    Promise.all([
      getSetting('autoReminderEnabled', true),
      getSetting('autoOverdueAlert', true),
    ]).then(([are, aoa]) => {
      setAutoReminderEnabled(are !== false)
      setAutoOverdueAlert(aoa !== false)
    })
    setReminderRunning(isAutoReminderRunning())
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
    await setSetting('gptApiKey', keys.gpt.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    pushPrefsToCloud().catch(() => { })
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
    if (result.ok) {
      const finalModel = result.model || model
      if (result.model && result.model !== model) setModel(finalModel)
      await setSetting('aiProvider', provider)
      await setSetting('aiModel', finalModel)
      await setSetting('claudeApiKey', keys.claude.trim())
      await setSetting('geminiApiKey', keys.gemini.trim())
      await setSetting('gptApiKey', keys.gpt.trim())
    }
  }

  const handleSaveTelegram = async () => {
    await setSetting('telegramToken', tgToken.trim())
    await setSetting('telegramChatId', tgChatId.trim())
    await setSetting('telegramNotifyDone', tgNotifyDone)
    await setSetting('telegramNotifyOverdue', tgNotifyOverdue)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    pushPrefsToCloud().catch(() => { })
  }

  const handleTestTelegram = async () => {
    setTgStatus('testing'); setTgMsg('')
    try {
      await sendTelegram(tgToken.trim(), tgChatId.trim(), '✅ <b>TaskFlow</b> — kết nối Telegram thành công!')
      setTgStatus('ok'); setTgMsg('Gửi thành công! Kiểm tra Telegram của bạn.')
    } catch (e) { setTgStatus('error'); setTgMsg(e.message) }
  }

  const handleDigest = async () => {
    setTgStatus('testing'); setTgMsg('')
    try {
      await sendDailyDigest(tasks, focusTasks, goals)
      setTgStatus('ok'); setTgMsg('Đã gửi daily digest!')
    } catch (e) { setTgStatus('error'); setTgMsg(e.message) }
  }

  const handleOverdueAlert = async () => {
    setTgStatus('testing'); setTgMsg('')
    try {
      await sendOverdueAlert(tasks)
      setTgStatus('ok'); setTgMsg('Đã gửi overdue alert!')
    } catch (e) { setTgStatus('error'); setTgMsg(e.message) }
  }

  const handleLogin = async () => {
    if (!loginEmail.trim()) return
    setLoginStatus('sending'); setLoginMsg('')
    try {
      await signInWithEmail(loginEmail.trim())
      setLoginStatus('sent'); setLoginMsg('Magic link đã gửi! Kiểm tra email và click vào link.')
    } catch (e) { setLoginStatus('error'); setLoginMsg(e.message) }
  }

  const handleLogout = async () => {
    await signOut(); setLoginStatus(''); setLoginMsg('')
  }

  const handleUploadToCloud = async () => {
    if (!user) return
    setUploadStatus('uploading')
    try {
      const { syncToCloud } = await import('../services/supabase')
      const [allTasks, allGoals, allMilestones, allResources, allIdeas] = await Promise.all([
        db.tasks.toArray(), db.goals.toArray(), db.milestones.toArray(),
        db.resources.toArray(), db.ideas.toArray(),
      ])
      const goalCloudMap = {}
      for (const g of allGoals) {
        if (!g.cloudId) g.cloudId = crypto.randomUUID()
        goalCloudMap[g.id] = g.cloudId
        await db.goals.update(g.id, { cloudId: g.cloudId })
      }
      for (const t of allTasks) {
        if (!t.cloudId) { t.cloudId = crypto.randomUUID(); await db.tasks.update(t.id, { cloudId: t.cloudId }) }
      }
      for (const m of allMilestones) {
        if (!m.cloudId) { m.cloudId = crypto.randomUUID(); await db.milestones.update(m.id, { cloudId: m.cloudId }) }
      }
      for (const r of allResources) {
        if (!r.cloudId) { r.cloudId = crypto.randomUUID(); await db.resources.update(r.id, { cloudId: r.cloudId }) }
      }
      for (const i of allIdeas) {
        if (!i.cloudId) { i.cloudId = crypto.randomUUID(); await db.ideas.update(i.id, { cloudId: i.cloudId }) }
      }
      const allReviews = await db.weeklyReviews.toArray()
      for (const r of allReviews) {
        if (!r.cloudId) { r.cloudId = crypto.randomUUID(); await db.weeklyReviews.update(r.id, { cloudId: r.cloudId }) }
      }
      for (const g of allGoals) await syncToCloud('goals', g)
      for (const t of allTasks) {
        const goalCloudId = t.goalId ? goalCloudMap[t.goalId] : null
        await syncToCloud('tasks', t, goalCloudId ? { goal_id: goalCloudId } : {})
      }
      for (const m of allMilestones) {
        const goalCloudId = m.goalId ? goalCloudMap[m.goalId] : null
        await syncToCloud('milestones', m, goalCloudId ? { goal_id: goalCloudId } : {})
      }
      for (const r of allResources) await syncToCloud('resources', r)
      for (const i of allIdeas) await syncToCloud('ideas', i, { pinned: !!i.pinned })
      for (const r of allReviews) {
        await syncToCloud('weekly_reviews', { cloudId: r.cloudId }, { week_start: r.weekStart, ai_summary: r.summary })
      }
      await pushPrefsToCloud()
      setUploadStatus('done')
    } catch (e) { setUploadStatus('error'); console.error('Upload failed:', e) }
  }

  const handleExport = async () => {
    const [tasks, goals, milestones, resources, ideas] = await Promise.all([
      db.tasks.toArray(), db.goals.toArray(), db.milestones.toArray(),
      db.resources.toArray(), db.ideas.toArray(),
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-lg font-bold text-fg">Settings</h1>
      </div>

      {/* Tab bar */}
      <div className="px-4 pb-3">
        <div className="flex gap-1 bg-input rounded-xl p-1">
          {TABS.map(t => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold transition-all
                  ${active ? 'bg-surface text-fg shadow-sm' : 'text-secondary hover:text-fg'}`}
              >
                <Icon size={13} />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-5">

        {/* ── TAB: GIAO DIỆN ── */}
        {tab === 'ui' && (
          <>
            <Section label="Theme">
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
            </Section>

            <Section label="Cài app">
              <div className="bg-accent-soft border border-accent-border rounded-xl p-3.5 space-y-1">
                <p className="text-xs font-semibold text-accent">Add to Homescreen</p>
                <p className="text-xs text-secondary leading-relaxed">
                  <strong className="text-fg">iOS:</strong> Safari → Share → Add to Home Screen<br />
                  <strong className="text-fg">Android:</strong> Chrome → Menu → Install app
                </p>
              </div>
            </Section>
          </>
        )}

        {/* ── TAB: AI ── */}
        {tab === 'ai' && (
          <>
            <Section label="Provider">
              <div className="flex gap-2">
                {Object.values(AI_PROVIDERS).map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleProviderChange(p.id)}
                    className={`flex-1 h-10 rounded-xl text-sm font-semibold transition-colors border
                      ${provider === p.id
                        ? 'bg-accent text-white border-accent'
                        : 'bg-input text-secondary border-transparent hover:bg-hover'}`}
                  >
                    {p.id === 'claude' ? '🤖 Claude' : p.id === 'gemini' ? '✨ Gemini' : '🧠 GPT'}
                  </button>
                ))}
              </div>
            </Section>

            <Section label="Model">
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
            </Section>

            <Section label={currentProvider.keyLabel}>
              <div className="flex items-center justify-end mb-1.5">
                <a href={currentProvider.keyUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-accent hover:text-accent-muted">
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
              {apiTestMsg && (
                <p className={`text-xs mt-2 px-3 py-2 rounded-xl border font-medium ${apiTestStatus === 'ok'
                  ? 'text-green-400 bg-green-500/5 border-green-500/20'
                  : 'text-red-400 bg-red-500/5 border-red-500/20'}`}>
                  {apiTestMsg}
                </p>
              )}
              {saved && !apiTestMsg && <p className="text-xs text-green-600 mt-1.5 font-medium">Đã lưu ✓</p>}
            </Section>

            <KeyVaultSection provider={provider} />

            <Section label="AI hỗ trợ những gì">
              <div className="bg-surface border border-edge rounded-xl p-3 space-y-1.5">
                {[
                  { icon: '📋', label: 'Parse text → tasks', desc: 'Dán đoạn text, AI extract ra list task tự động' },
                  { icon: '🔗', label: 'Tóm tắt URL', desc: 'Save link vào Library, AI tóm tắt nội dung + tags' },
                  { icon: '📸', label: 'Scan ảnh → Tasks', desc: 'Chụp/paste ảnh whiteboard, notes → AI extract tasks + ideas' },
                  { icon: '🎯', label: 'Goal Breakdown', desc: 'AI tự chia goal thành sub-tasks + milestones' },
                  { icon: '💡', label: 'Idea Enrichment', desc: 'AI mở rộng idea thành kế hoạch chi tiết + action items' },
                  { icon: '⚡', label: 'Smart Daily Plan', desc: 'AI chọn top 3 tasks nên focus hôm nay' },
                  { icon: '🔥', label: 'Đại Ca Roast', desc: 'AI đánh giá hiệu suất và chửi cho tỉnh' },
                  { icon: '📊', label: 'Weekly AI Review', desc: 'Tóm tắt tuần + gợi ý cải thiện' },
                ].map(f => (
                  <div key={f.label} className="flex items-start gap-2">
                    <span className="text-sm shrink-0 mt-0.5">{f.icon}</span>
                    <div>
                      <span className="text-xs font-semibold text-fg">{f.label}</span>
                      <span className="text-xs text-secondary"> — {f.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section label="Cache thông minh" action={
              <button
                onClick={() => { clearCache(); setSaved(true); setTimeout(() => setSaved(false), 1500) }}
                className="text-[10px] text-secondary hover:text-red-400 transition-colors"
              >
                Xóa cache
              </button>
            }>
              <CacheStatsPanel />
            </Section>

            <Section label="Usage Monitor" action={
              <button
                onClick={() => { resetAIUsageStats(); setSaved(true); setTimeout(() => setSaved(false), 1500) }}
                className="text-[10px] text-secondary hover:text-red-400 transition-colors"
              >
                Reset
              </button>
            }>
              <AIUsagePanel />
            </Section>
          </>
        )}

        {/* ── TAB: THÔNG BÁO ── */}
        {tab === 'notify' && (
          <>
            {/* Telegram setup */}
            <Section label="Telegram Bot" icon={<Send size={13} className="text-[#229ED9]" />}>
              <div className="bg-surface border border-edge rounded-xl p-3 text-xs text-secondary space-y-1 leading-relaxed mb-3">
                <p className="font-semibold text-fg text-[11px]">Cách setup:</p>
                <p>1. Chat với <span className="text-[#229ED9] font-mono">@BotFather</span> → <span className="font-mono">/newbot</span> → lấy token</p>
                <p>2. Nhắn tin cho bot, mở <span className="font-mono break-all">api.telegram.org/bot&#123;TOKEN&#125;/getUpdates</span> lấy chat_id</p>
                <p>3. Nhập bên dưới và Test</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-secondary mb-1.5 block">Bot Token</label>
                  <input type="password" value={tgToken} onChange={e => setTgToken(e.target.value)}
                    placeholder="123456789:ABC-..."
                    className="w-full bg-input border border-edge-2 rounded-xl px-3 py-2.5 text-fg placeholder-secondary/60 text-sm font-mono focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="text-xs text-secondary mb-1.5 block">Chat ID</label>
                  <input type="text" value={tgChatId} onChange={e => setTgChatId(e.target.value)}
                    placeholder="-100123456789 hoặc 123456789"
                    className="w-full bg-input border border-edge-2 rounded-xl px-3 py-2.5 text-fg placeholder-secondary/60 text-sm font-mono focus:outline-none focus:border-accent" />
                </div>

                <div className="space-y-2">
                  <Toggle label="Thông báo khi hoàn thành task" value={tgNotifyDone} onChange={setTgNotifyDone} />
                  <Toggle label="Cảnh báo task quá hạn" value={tgNotifyOverdue} onChange={setTgNotifyOverdue} />
                </div>

                {tgMsg && (
                  <p className={`text-xs px-3 py-2 rounded-xl border ${tgStatus === 'ok'
                    ? 'text-green-600 bg-green-500/5 border-green-500/20'
                    : 'text-red-500 bg-red-500/5 border-red-500/20'}`}>
                    {tgMsg}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleTestTelegram} disabled={!tgToken || !tgChatId || tgStatus === 'testing'}
                    className="h-10 bg-[#229ED9] hover:bg-[#1a8bc2] disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors">
                    <Send size={13} /> Test kết nối
                  </button>
                  <button onClick={handleSaveTelegram}
                    className={`h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors
                      ${saved ? 'bg-green-500 text-white' : 'bg-accent hover:bg-accent-muted text-white'}`}>
                    <Check size={13} /> Lưu
                  </button>
                  <button onClick={handleDigest} disabled={!tgToken || !tgChatId || tgStatus === 'testing'}
                    className="h-10 bg-input hover:bg-hover text-fg disabled:opacity-40 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors">
                    <Bell size={13} /> Daily Digest
                  </button>
                  <button onClick={handleOverdueAlert} disabled={!tgToken || !tgChatId || tgStatus === 'testing'}
                    className="h-10 bg-input hover:bg-hover text-fg disabled:opacity-40 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors">
                    ⚠️ Overdue Alert
                  </button>
                </div>
              </div>
            </Section>

            {/* 2-way bot */}
            <Section label="Bot 2 chiều" badge={
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tgBotRunning
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                {tgBotRunning ? '● Live' : '○ Off'}
              </span>
            }>
              <p className="text-[11px] text-secondary mb-2">Gửi tin nhắn cho bot trên Telegram, bot trả lời như Đại Ca.</p>
              <div className="text-[10px] text-secondary bg-input rounded-lg p-2 space-y-0.5 font-mono mb-3">
                <p className="font-bold text-fg text-[11px] font-sans mb-1">Commands:</p>
                {['/status', '/focus', '/overdue', '/roast', '/digest'].map(cmd => (
                  <p key={cmd}>{cmd}</p>
                ))}
                <p className="text-accent">+ gõ bất kỳ → Chat AI Đại Ca</p>
              </div>
              <Toggle label="Bật Bot 2 chiều" value={tgBotEnabled} onChange={async (v) => {
                setTgBotEnabled(v)
                await setSetting('telegramBotEnabled', v)
                if (v && tgToken && tgChatId) { startTelegramBot(); setTgBotRunning(true) }
                else { stopTelegramBot(); setTgBotRunning(false) }
              }} />
              <div className="flex gap-2 mt-2">
                <button onClick={() => { if (tgToken) { startTelegramBot(); setTgBotRunning(true) } }}
                  disabled={tgBotRunning || !tgToken}
                  className="flex-1 h-9 bg-[#229ED9] hover:bg-[#1a8bc2] disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors">
                  <Power size={12} /> Start
                </button>
                <button onClick={() => { stopTelegramBot(); setTgBotRunning(false) }}
                  disabled={!tgBotRunning}
                  className="flex-1 h-9 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors">
                  <Power size={12} /> Stop
                </button>
              </div>
            </Section>

            {/* Auto Reminder */}
            <Section label="Auto Reminder" icon={<Clock size={13} className="text-amber-400" />} badge={
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${reminderRunning
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                {reminderRunning ? '● Running' : '○ Stopped'}
              </span>
            }>
              <div className="bg-surface border border-edge rounded-xl p-3 text-xs text-secondary space-y-1 leading-relaxed mb-3">
                <p className="font-semibold text-fg text-[11px]">Lịch gửi:</p>
                {['9:00 AM — Nhắc chọn focus task', '10:00 AM — Cảnh báo nếu chưa chọn focus',
                  '12:00 PM — Checkpoint giữa ngày', '5:00 PM — Review cuối ngày', 'Mỗi 2h — Check task quá hạn'].map(s => (
                    <p key={s}>• {s}</p>
                  ))}
                <p className="text-accent mt-1">→ Browser Notification + Telegram (nếu setup)</p>
              </div>
              <div className="space-y-2 mb-3">
                <Toggle label="Auto Reminder (sáng/trưa/chiều)" value={autoReminderEnabled} onChange={async (v) => {
                  setAutoReminderEnabled(v)
                  await setSetting('autoReminderEnabled', v)
                  if (v) { startAutoReminder(); setReminderRunning(true) }
                  else { stopAutoReminder(); setReminderRunning(false) }
                  pushPrefsToCloud().catch(() => { })
                }} />
                <Toggle label="Auto cảnh báo task quá hạn (mỗi 2h)" value={autoOverdueAlert} onChange={async (v) => {
                  setAutoOverdueAlert(v)
                  await setSetting('autoOverdueAlert', v)
                }} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => { startAutoReminder(); setReminderRunning(true) }} disabled={reminderRunning}
                  className="flex-1 h-10 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors">
                  <Power size={13} /> Start Engine
                </button>
                <button onClick={() => { stopAutoReminder(); setReminderRunning(false) }} disabled={!reminderRunning}
                  className="flex-1 h-10 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors">
                  <Power size={13} /> Stop Engine
                </button>
              </div>
            </Section>
          </>
        )}

        {/* ── TAB: DỮ LIỆU ── */}
        {tab === 'data' && (
          <>
            <Section label="Cloud Sync" icon={<Cloud size={13} className="text-blue-400" />} badge={
              user ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                  ● Đã kết nối
                </span>
              ) : null
            }>
              {!isSupabaseReady() ? (
                <div className="bg-surface border border-edge rounded-xl p-3 text-xs text-secondary">
                  Chưa cấu hình Supabase. Thêm <span className="font-mono text-fg">VITE_SUPABASE_URL</span> và <span className="font-mono text-fg">VITE_SUPABASE_ANON_KEY</span> vào <span className="font-mono text-fg">.env</span>.
                </div>
              ) : !authLoading && !user ? (
                <div className="space-y-3">
                  <p className="text-xs text-secondary">Đăng nhập để sync dữ liệu giữa các thiết bị.</p>
                  <div className="flex gap-2">
                    <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleLogin()}
                      placeholder="email@example.com"
                      className="flex-1 bg-input border border-edge rounded-xl px-3 py-2.5 text-sm text-fg placeholder-secondary/60 focus:outline-none focus:border-accent" />
                    <button onClick={handleLogin} disabled={loginStatus === 'sending' || !loginEmail.trim()}
                      className="h-11 px-4 bg-accent hover:bg-accent-muted disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors">
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
                    <button onClick={handleLogout} className="text-xs text-secondary hover:text-red-400 flex items-center gap-1 transition-colors">
                      <LogOut size={12} /> Logout
                    </button>
                  </div>
                  <div className="bg-surface border border-edge rounded-xl p-3 space-y-2">
                    <p className="text-xs font-semibold text-fg">Upload data local lên cloud</p>
                    <p className="text-[11px] text-secondary">Chỉ cần làm 1 lần khi mới kết nối. Dữ liệu tiếp theo tự sync.</p>
                    <button onClick={handleUploadToCloud} disabled={uploadStatus === 'uploading'}
                      className={`w-full h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors
                        ${uploadStatus === 'done' ? 'bg-green-600 text-white'
                          : uploadStatus === 'error' ? 'bg-red-600 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white'}`}>
                      {uploadStatus === 'uploading' && <><Loader2 size={13} className="animate-spin" /> Đang upload...</>}
                      {uploadStatus === 'done' && <><Check size={13} /> Đã upload xong!</>}
                      {uploadStatus === 'error' && '❌ Lỗi, thử lại'}
                      {!uploadStatus && <><Cloud size={13} /> Upload lên Supabase</>}
                    </button>
                  </div>
                </div>
              ) : null}
            </Section>

            <Section label="Backup dữ liệu">
              <p className="text-xs text-secondary/70 mb-3">
                Dữ liệu lưu trong browser. Export JSON để backup tránh mất khi clear browser.
              </p>
              <div className="flex gap-2">
                <button onClick={handleExport}
                  className="flex-1 h-11 bg-input hover:bg-hover text-fg rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                  <Download size={16} /> Export JSON
                </button>
                <label className="flex-1 h-11 bg-input hover:bg-hover text-fg rounded-xl text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors">
                  <Upload size={16} /> Import JSON
                  <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                </label>
              </div>
            </Section>
          </>
        )}

      </div>
    </div>
  )
}

// ── Shared components ──

function Section({ label, icon, badge, action, children }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-xs font-bold text-secondary uppercase tracking-wider">{label}</h2>
        {badge && <span className="ml-auto">{badge}</span>}
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {children}
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

function AIUsagePanel() {
  const stats = getAIUsageStats()
  const maxHour = Math.max(...Object.values(stats.today.byHour || {}), 1)
  return (
    <div className="bg-surface border border-edge rounded-xl p-3 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[
          { value: stats.today.calls, label: 'Calls hôm nay', color: 'text-fg' },
          { value: stats.today.tokens > 1000 ? `${(stats.today.tokens / 1000).toFixed(1)}k` : stats.today.tokens, label: 'Est. tokens', color: 'text-fg' },
          { value: stats.today.errors, label: 'Errors', color: stats.today.errors > 0 ? 'text-red-400' : 'text-green-400' },
        ].map(s => (
          <div key={s.label} className="bg-input rounded-lg px-2.5 py-2 text-center">
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-secondary">{s.label}</p>
          </div>
        ))}
      </div>

      {Object.keys(stats.today.byHour || {}).length > 0 && (
        <div>
          <p className="text-[10px] text-secondary mb-1.5">Calls theo giờ hôm nay</p>
          <div className="flex items-end gap-0.5 h-10">
            {Array.from({ length: 24 }, (_, h) => {
              const count = stats.today.byHour?.[h] || 0
              const pct = count > 0 ? Math.max((count / maxHour) * 100, 8) : 0
              const now = new Date().getHours()
              return (
                <div key={h} className="flex-1 rounded-t transition-all"
                  style={{
                    height: pct > 0 ? `${pct}%` : '2px',
                    background: count > 15 ? '#ef4444' : count > 5 ? '#f59e0b' : count > 0 ? '#6366f1' : 'var(--edge)',
                    opacity: h === now ? 1 : 0.7,
                  }}
                  title={`${h}:00 — ${count} calls`}
                />
              )
            })}
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[8px] text-secondary/40">0h</span>
            <span className="text-[8px] text-secondary/40">12h</span>
            <span className="text-[8px] text-secondary/40">23h</span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 pt-1 border-t border-edge text-[10px] text-secondary">
        <span>📊 Tổng {stats.total.days} ngày: <b className="text-fg">{stats.total.calls}</b> calls</span>
        <span>💰 ~<b className="text-fg">{stats.total.tokens > 1000 ? `${(stats.total.tokens / 1000).toFixed(0)}k` : stats.total.tokens}</b> tokens</span>
        {stats.total.errors > 0 && <span className="text-red-400">❌ {stats.total.errors} errors</span>}
      </div>

      <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg px-2.5 py-2">
        <p className="text-[10px] text-amber-400 font-medium">⚠️ Gemini free tier: 15 RPM | 1M tokens/ngày</p>
        <p className="text-[10px] text-secondary mt-0.5">App tự auto-retry khi bị rate limit (đợi + retry 2 lần)</p>
      </div>
    </div>
  )
}

function CacheStatsPanel() {
  const stats = getCacheStats()
  const rateLimit = getRateLimitStatus()
  const cacheSize = getCacheSize()

  return (
    <div className="bg-surface border border-edge rounded-xl p-3 space-y-3">
      {/* Cache stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { value: stats.hitRate + '%', label: 'Hit rate', color: stats.hitRate > 50 ? 'text-green-400' : stats.hitRate > 20 ? 'text-amber-400' : 'text-fg' },
          { value: stats.hits, label: 'Cache hits', color: 'text-green-400' },
          { value: stats.misses, label: 'Misses', color: 'text-fg' },
          { value: stats.totalEntries, label: 'Cached', color: 'text-fg' },
        ].map(s => (
          <div key={s.label} className="bg-input rounded-lg px-2 py-2 text-center">
            <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[9px] text-secondary">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Rate limiter */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] text-secondary">Rate Limiter</p>
          <span className={`text-[10px] font-bold ${rateLimit.isNearLimit ? 'text-red-400' : 'text-green-400'}`}>
            {rateLimit.currentRPM}/{rateLimit.maxRPM} RPM
          </span>
        </div>
        <div className="w-full h-2 bg-input rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${rateLimit.percentage > 80 ? 'bg-red-500' :
              rateLimit.percentage > 50 ? 'bg-amber-500' : 'bg-green-500'
              }`}
            style={{ width: `${Math.min(rateLimit.percentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Savings summary */}
      <div className="bg-green-500/5 border border-green-500/15 rounded-lg px-2.5 py-2">
        <p className="text-[10px] text-green-400 font-medium">
          💰 Đã tiết kiệm: {stats.estimatedSavings} ({stats.hits} lần không cần gọi API)
        </p>
        <p className="text-[10px] text-secondary mt-0.5">
          📦 Cache size: {cacheSize.toFixed(1)}KB • Tự xóa entries cũ khi hết TTL
        </p>
      </div>

      {/* Per-feature breakdown */}
      {Object.keys(stats.byFeature || {}).length > 0 && (
        <div>
          <p className="text-[10px] text-secondary mb-1.5">Cache theo feature</p>
          <div className="space-y-1">
            {Object.entries(stats.byFeature).map(([feature, data]) => {
              const total = data.hits + data.misses
              const rate = total > 0 ? Math.round((data.hits / total) * 100) : 0
              return (
                <div key={feature} className="flex items-center gap-2 text-[10px]">
                  <span className="text-secondary truncate flex-1">{feature}</span>
                  <span className="text-fg font-mono">{data.hits}h/{data.misses}m</span>
                  <div className="w-12 h-1.5 bg-input rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${rate}%` }} />
                  </div>
                  <span className={`font-bold w-8 text-right ${rate > 50 ? 'text-green-400' : 'text-secondary'}`}>{rate}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
