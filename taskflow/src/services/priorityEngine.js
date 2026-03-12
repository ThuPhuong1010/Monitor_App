/**
 * priorityEngine.js — Smart task priority scoring
 *
 * Score = (base + deadlineBonus + urgencyBonus + deferPenalty + agePenalty) × impactMultiplier × ruleBoost
 *
 * Impact Scope (phạm vi ảnh hưởng):
 *   self     → ×1.0  — Chỉ ảnh hưởng bản thân
 *   team     → ×1.4  — Người khác đang chờ mày
 *   client   → ×1.8  — Khách hàng / sếp nhìn thấy
 *   critical → ×2.5  — Không làm = mọi thứ dừng lại
 */

import { getSetting, setSetting } from './db'

// ─── Impact Scope config ─────────────────────────────────────────

export const IMPACT_SCOPE = {
  self:     { id: 'self',     label: 'Cá nhân',  emoji: '👤', multiplier: 1.0, color: '#6b7280', bg: 'bg-gray-500/10',   text: 'text-gray-400' },
  team:     { id: 'team',     label: 'Team',      emoji: '👥', multiplier: 1.4, color: '#3b82f6', bg: 'bg-blue-500/10',   text: 'text-blue-400' },
  client:   { id: 'client',   label: 'Client',    emoji: '🤝', multiplier: 1.8, color: '#f59e0b', bg: 'bg-amber-500/10',  text: 'text-amber-400' },
  critical: { id: 'critical', label: 'Critical',  emoji: '🔥', multiplier: 2.5, color: '#ef4444', bg: 'bg-red-500/10',    text: 'text-red-400' },
}

// ─── Keyword maps ────────────────────────────────────────────────

const SCOPE_KEYWORDS = {
  critical: ['deploy', 'nộp', 'thanh toán', 'payment', 'hợp đồng', 'hđ', 'submit', 'release',
             'khẩn cấp', 'crit', 'production', 'outage', 'fix ngay', 'lỗi nghiêm trọng',
             'nộp thuế', 'đóng tiền', 'invoice', 'contract'],
  client:   ['client', 'khách hàng', 'sếp', 'boss', 'report', 'báo cáo', 'demo', 'trình bày',
             'presentation', 'khách', 'ceo', 'cto', 'stakeholder', 'review với', 'gửi cho'],
  team:     ['họp', 'meeting', 'team', 'nhóm', 'review code', 'sync', 'standup', 'daily',
             'pr', 'merge', 'pull request', 'pair', 'retro', 'sprint', 'check in'],
}

const URGENCY_KEYWORDS = ['gấp', 'urgent', 'asap', 'ngay bây giờ', 'ngay hôm nay',
                          'khẩn', 'hết hạn', 'overdue', 'deadline hôm nay', 'cần làm ngay']

const DEFER_KEYWORDS   = ['maybe', 'someday', 'để sau', 'xem xét', 'tìm hiểu thêm',
                          'nghiên cứu', 'có thể', 'khi rảnh', 'later', 'backlog']

const PRIORITY_WEIGHTS = { p0: 100, p1: 70, p2: 40, p3: 15 }

// ─── Impact auto-detect ──────────────────────────────────────────

export function detectImpactScope(task) {
  if (task.impactScope && IMPACT_SCOPE[task.impactScope]) return task.impactScope
  const text = `${task.title} ${task.notes || ''}`.toLowerCase()
  for (const [scope, keywords] of Object.entries(SCOPE_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) return scope
  }
  return 'self'
}

// ─── Single task scoring ─────────────────────────────────────────

export function scoreTask(task, customRules = []) {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  // 1. Base from priority
  const base = PRIORITY_WEIGHTS[task.priority] || 40

  // 2. Deadline urgency
  let deadlineBonus = 0
  if (task.deadline) {
    const daysLeft = Math.ceil((new Date(task.deadline) - now) / (1000 * 60 * 60 * 24))
    if (daysLeft < 0)       deadlineBonus = 60
    else if (daysLeft === 0) deadlineBonus = 45
    else if (daysLeft === 1) deadlineBonus = 28
    else if (daysLeft <= 3)  deadlineBonus = 16
    else if (daysLeft <= 7)  deadlineBonus = 8
  }

  // 3. Keyword bonuses
  const text = `${task.title} ${task.notes || ''}`.toLowerCase()
  const urgencyBonus = URGENCY_KEYWORDS.some(kw => text.includes(kw)) ? 20 : 0
  const deferPenalty = DEFER_KEYWORDS.some(kw => text.includes(kw)) ? -18 : 0

  // 4. Age penalty — old untouched tasks drift down slightly
  let agePenalty = 0
  if (task.createdAt) {
    const ageDays = (now - new Date(task.createdAt)) / (1000 * 60 * 60 * 24)
    if (ageDays > 14 && task.progress === 0) agePenalty = -8
    if (ageDays > 30 && task.progress === 0) agePenalty = -15
  }

  // 5. Impact scope multiplier (auto-detect if not set)
  const scope = detectImpactScope(task)
  const multiplier = IMPACT_SCOPE[scope].multiplier

  // 6. Custom rules boost
  let ruleBoost = 0
  for (const rule of customRules) {
    if (!rule.enabled) continue
    const matched = matchRule(task, rule)
    if (matched) ruleBoost += rule.action.value || 0
  }

  const raw = (base + deadlineBonus + urgencyBonus + deferPenalty + agePenalty + ruleBoost) * multiplier
  return {
    score: Math.round(Math.max(0, raw)),
    scope,
    breakdown: {
      base,
      deadlineBonus,
      urgencyBonus,
      deferPenalty,
      agePenalty,
      ruleBoost,
      multiplier,
    },
  }
}

// ─── Rule matching ───────────────────────────────────────────────

function matchRule(task, rule) {
  const results = (rule.conditions || []).map(cond => {
    const { field, op, value } = cond
    const taskVal = getField(task, field)
    switch (op) {
      case 'eq':       return taskVal === value
      case 'neq':      return taskVal !== value
      case 'contains': return String(taskVal || '').toLowerCase().includes(String(value).toLowerCase())
      case 'lt':       return Number(taskVal) < Number(value)
      case 'gt':       return Number(taskVal) > Number(value)
      case 'deadline_within': {
        if (!task.deadline) return false
        const days = Math.ceil((new Date(task.deadline) - new Date()) / (1000 * 60 * 60 * 24))
        return days >= 0 && days <= Number(value)
      }
      default: return false
    }
  })
  return rule.logic === 'OR' ? results.some(Boolean) : results.every(Boolean)
}

function getField(task, field) {
  if (field === 'title_or_notes') return `${task.title} ${task.notes || ''}`
  return task[field]
}

// ─── Sort tasks ──────────────────────────────────────────────────

export async function sortTasksByPriority(tasks) {
  const rules = await loadCustomRules()
  return [...tasks]
    .filter(t => t.status !== 'done')
    .map(t => {
      const result = scoreTask(t, rules)
      return { ...t, _score: result.score, _scope: result.scope, _breakdown: result.breakdown }
    })
    .sort((a, b) => b._score - a._score)
}

export function sortTasksByPrioritySync(tasks, rules = []) {
  return [...tasks]
    .filter(t => t.status !== 'done')
    .map(t => {
      const result = scoreTask(t, rules)
      return { ...t, _score: result.score, _scope: result.scope, _breakdown: result.breakdown }
    })
    .sort((a, b) => b._score - a._score)
}

// ─── Custom rules persistence ─────────────────────────────────────

export const DEFAULT_RULES = [
  {
    id: 'rule-finance-urgent',
    name: 'Tài chính + deadline gần → boost mạnh',
    enabled: true,
    conditions: [
      { field: 'category', op: 'eq', value: 'finance' },
      { field: 'deadline', op: 'deadline_within', value: 3 },
    ],
    logic: 'AND',
    action: { type: 'boost', value: 40 },
  },
  {
    id: 'rule-p0-no-deadline',
    name: 'P0 không có deadline vẫn urgent',
    enabled: true,
    conditions: [
      { field: 'priority', op: 'eq', value: 'p0' },
    ],
    logic: 'AND',
    action: { type: 'boost', value: 25 },
  },
  {
    id: 'rule-personal-defer',
    name: 'Personal + không deadline → giảm ưu tiên',
    enabled: true,
    conditions: [
      { field: 'category', op: 'eq', value: 'personal' },
    ],
    logic: 'AND',
    action: { type: 'boost', value: -10 },
  },
]

export async function loadCustomRules() {
  const saved = await getSetting('priorityRules')
  if (!saved) return DEFAULT_RULES
  return saved
}

export async function saveCustomRules(rules) {
  await setSetting('priorityRules', rules)
  import('./prefsSync').then(({ pushPrefsToCloud }) => pushPrefsToCloud().catch(() => {}))
}
