/**
 * telegram.js — Gửi thông báo về Telegram Bot
 *
 * Setup:
 *  1. Chat với @BotFather trên Telegram → /newbot → lấy token
 *  2. Gửi 1 tin nhắn bất kỳ cho bot → mở
 *     https://api.telegram.org/bot{TOKEN}/getUpdates → lấy chat_id
 *  3. Nhập vào Settings
 */

import { getSetting } from './db'

export async function getTelegramConfig() {
  const [token, chatId, notifyDone, notifyOverdue] = await Promise.all([
    getSetting('telegramToken'),
    getSetting('telegramChatId'),
    getSetting('telegramNotifyDone', false),
    getSetting('telegramNotifyOverdue', true),
  ])
  return { token, chatId, notifyDone, notifyOverdue }
}

export async function sendTelegram(token, chatId, text) {
  if (!token || !chatId) throw new Error('Thiếu Telegram token hoặc chat ID')
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.description || `Telegram error ${res.status}`)
  }
  return res.json()
}

// ─── Notification templates ──────────────────────────────────────

export async function notifyTaskDone(task) {
  const { token, chatId, notifyDone } = await getTelegramConfig()
  if (!notifyDone || !token || !chatId) return
  const cat = { work: '💼', personal: '👤', finance: '💰', adhoc: '📌' }[task.category] || '📌'
  const time = task.estimatedMinutes
    ? ` (${task.estimatedMinutes < 60 ? `${task.estimatedMinutes}p` : `${task.estimatedMinutes / 60}h`})`
    : ''
  await sendTelegram(token, chatId,
    `✅ <b>Xong!</b> ${cat} ${task.title}${time}`
  )
}

export async function sendDailyDigest(tasks, focusTasks, goals) {
  const { token, chatId } = await getTelegramConfig()
  if (!token || !chatId) throw new Error('Chưa cấu hình Telegram')

  const today = new Date().toISOString().slice(0, 10)
  const pending = tasks.filter(t => t.status !== 'done')
  const doneToday = tasks.filter(t => t.doneAt?.slice(0, 10) === today)
  const overdue = pending.filter(t => {
    if (!t.deadline) return false
    const d = new Date(t.deadline)
    const now = new Date()
    return d < now && d.toISOString().slice(0, 10) !== today
  })
  const focusList = focusTasks
    .map(id => tasks.find(t => t.id === id))
    .filter(Boolean)
  const activeGoals = goals.filter(g => g.status !== 'done').slice(0, 3)

  const dateStr = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' })

  const lines = [
    `📋 <b>TaskFlow Daily — ${dateStr}</b>`,
    '',
    `🎯 <b>Focus hôm nay (${focusList.length}/3):</b>`,
    ...focusList.map(t => `  • ${t.status === 'done' ? '✅' : '⬜'} ${t.title}`),
    focusList.length === 0 ? '  (chưa chọn)' : '',
    '',
    `📊 <b>Tổng quan:</b>`,
    `  • Pending: ${pending.length} tasks`,
    `  • Xong hôm nay: ${doneToday.length}`,
    overdue.length > 0 ? `  • ⚠️ Quá hạn: ${overdue.length}` : '',
  ]

  if (overdue.length > 0) {
    lines.push('', `⚠️ <b>Cần xử lý ngay:</b>`)
    overdue.slice(0, 3).forEach(t => lines.push(`  • ${t.title}`))
  }

  if (activeGoals.length > 0) {
    lines.push('', `🏆 <b>Goals:</b>`)
    activeGoals.forEach(g => lines.push(`  • ${g.title} — ${g.progress}%`))
  }

  const totalMins = pending
    .filter(t => t.estimatedMinutes)
    .reduce((s, t) => s + t.estimatedMinutes, 0)
  if (totalMins > 0) {
    lines.push('', `⏱ Tổng thời gian ước tính: ${Math.round(totalMins / 60 * 10) / 10}h`)
  }

  await sendTelegram(token, chatId, lines.filter(l => l !== undefined).join('\n'))
}

export async function sendOverdueAlert(tasks) {
  const { token, chatId, notifyOverdue } = await getTelegramConfig()
  if (!notifyOverdue || !token || !chatId) return

  const today = new Date().toISOString().slice(0, 10)
  const overdue = tasks.filter(t => {
    if (t.status === 'done' || !t.deadline) return false
    return t.deadline < today
  })
  if (overdue.length === 0) return

  const lines = [
    `⚠️ <b>${overdue.length} task quá hạn!</b>`,
    ...overdue.slice(0, 5).map(t => `  • ${t.title} (${t.deadline})`),
    overdue.length > 5 ? `  ... và ${overdue.length - 5} task khác` : '',
  ]
  await sendTelegram(token, chatId, lines.filter(Boolean).join('\n'))
}
