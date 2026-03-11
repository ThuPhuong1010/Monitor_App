/**
 * telegramBot.js — 2-way Telegram bot interaction
 *
 * Polling mechanism: check for new messages from user on Telegram,
 * process commands, and reply with the same "đại ca" personality.
 *
 * Commands:
 *   /status   — Tình trạng tasks hôm nay
 *   /focus    — Focus tasks hiện tại
 *   /overdue  — Danh sách task quá hạn
 *   /roast    — Chửi cho tỉnh
 *   /digest   — Daily digest
 *   /help     — Danh sách commands
 *   (any text) — Chat AI với đại ca
 */

import { db, getSetting } from './db'
import { sendTelegram, getTelegramConfig } from './telegram'
import { callAI } from './ai'

let _pollInterval = null
let _lastUpdateId = 0

// ─── Fetch new messages ──────────────────────────────────────────

async function getUpdates(token) {
    const res = await fetch(
        `https://api.telegram.org/bot${token}/getUpdates?offset=${_lastUpdateId + 1}&timeout=0&limit=10`
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.result || []
}

// ─── Build task context ──────────────────────────────────────────

async function getContext() {
    const tasks = await db.tasks.toArray()
    const today = new Date().toISOString().slice(0, 10)
    const pending = tasks.filter(t => t.status !== 'done')
    const overdue = pending.filter(t => t.deadline && t.deadline < today)
    const doneToday = tasks.filter(t => t.doneAt?.slice(0, 10) === today)
    const focusHistory = await db.focusHistory.where('date').equals(today).first()
    const focusIds = focusHistory?.taskIds || []
    const focusTasks = focusIds.map(id => tasks.find(t => t.id === id)).filter(Boolean)
    const goals = await db.goals.toArray()
    const activeGoals = goals.filter(g => g.status !== 'done')

    return { tasks, pending, overdue, doneToday, focusTasks, focusIds, activeGoals, today }
}

// ─── Command handlers ────────────────────────────────────────────

async function handleCommand(cmd, text, token, chatId) {
    const ctx = await getContext()

    switch (cmd) {
        case '/start':
        case '/help':
            return sendTelegram(token, chatId, [
                '🔥 <b>TaskFlow Đại Ca Bot</b>',
                '',
                'Commands:',
                '/status — Tình trạng tasks hôm nay',
                '/focus — Focus tasks hiện tại',
                '/overdue — Danh sách task quá hạn',
                '/roast — Chửi cho tỉnh 💀',
                '/digest — Daily digest',
                '/help — Danh sách lệnh',
                '',
                'Hoặc gõ bất kỳ tin nhắn nào để chat với Đại Ca AI 🤖',
            ].join('\n'))

        case '/status': {
            const lines = [
                `📊 <b>Status — ${new Date().toLocaleDateString('vi-VN')}</b>`,
                '',
                `📋 Pending: ${ctx.pending.length} tasks`,
                `✅ Done hôm nay: ${ctx.doneToday.length}`,
                `⚠️ Quá hạn: ${ctx.overdue.length}`,
                `🎯 Focus: ${ctx.focusTasks.length}/3`,
                '',
            ]
            if (ctx.focusTasks.length > 0) {
                lines.push('<b>Focus hôm nay:</b>')
                ctx.focusTasks.forEach(t => {
                    lines.push(`  ${t.status === 'done' ? '✅' : '⬜'} ${t.title}`)
                })
            } else {
                lines.push('❌ <b>Chưa chọn focus!</b> Mở TaskFlow chọn đi mày ơi!')
            }
            return sendTelegram(token, chatId, lines.join('\n'))
        }

        case '/focus': {
            if (ctx.focusTasks.length === 0) {
                return sendTelegram(token, chatId,
                    '💀 Chưa có focus task nào! Mày định drift cả ngày à?\nMở TaskFlow chọn 3 task NGAY!')
            }
            const lines = ['🎯 <b>Focus Tasks:</b>', '']
            ctx.focusTasks.forEach((t, i) => {
                const status = t.status === 'done' ? '✅' : '⬜'
                lines.push(`${i + 1}. ${status} ${t.title}`)
            })
            const done = ctx.focusTasks.filter(t => t.status === 'done').length
            lines.push('', `Tiến độ: ${done}/${ctx.focusTasks.length} ${done === 0 ? '💀' : done === 3 ? '🔥' : '😤'}`)
            return sendTelegram(token, chatId, lines.join('\n'))
        }

        case '/overdue': {
            if (ctx.overdue.length === 0) {
                return sendTelegram(token, chatId, '✅ Không có task quá hạn! Giỏi lắm... nhưng đừng tự mãn 😤')
            }
            const lines = [`🚨 <b>${ctx.overdue.length} task quá hạn!</b>`, '']
            ctx.overdue.slice(0, 10).forEach(t => {
                lines.push(`  • ${t.title} <i>(${t.deadline})</i>`)
            })
            if (ctx.overdue.length > 10) lines.push(`  ... +${ctx.overdue.length - 10} nữa`)
            lines.push('', '💀 Xử lý NGAY hoặc xóa đi, đừng tự lừa mình!')
            return sendTelegram(token, chatId, lines.join('\n'))
        }

        case '/roast': {
            // Use AI to roast based on actual data
            const contextStr = [
                `Tasks pending: ${ctx.pending.length} (overdue: ${ctx.overdue.length})`,
                ctx.overdue.length ? `Overdue: ${ctx.overdue.slice(0, 3).map(t => t.title).join(', ')}` : '',
                `Hoàn thành hôm nay: ${ctx.doneToday.length}`,
                ctx.focusTasks.length ? `Focus: ${ctx.focusTasks.map(t => t.title).join(', ')}` : 'Chưa chọn focus',
            ].filter(Boolean).join('\n')

            try {
                const roast = await callAI(
                    `Mày là TaskFlow AI — "đại ca" quản lý công việc. Xưng "tao" gọi "mày". Chửi thẳng mặt user dựa trên data THỰC TẾ sau:
${contextStr}

Chửi cho nó tỉnh ngộ 💀 Tối đa 4-5 câu, ngắn gọn đanh thép, toxic motivational. Dùng emoji 🔥💀😤🤡⚡`,
                    256
                )
                return sendTelegram(token, chatId, roast)
            } catch {
                return sendTelegram(token, chatId,
                    `💀 Tao nhìn data mày mà muốn khóc: ${ctx.overdue.length} task quá hạn, done hôm nay ${ctx.doneToday.length}. Mày tưởng mày bận lắm à? LÀM ĐI! 🔥`)
            }
        }

        case '/digest': {
            const dateStr = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' })
            const totalMins = ctx.pending
                .filter(t => t.estimatedMinutes)
                .reduce((s, t) => s + t.estimatedMinutes, 0)

            const lines = [
                `📋 <b>TaskFlow Daily — ${dateStr}</b>`,
                '',
                `🎯 <b>Focus (${ctx.focusTasks.length}/3):</b>`,
                ...ctx.focusTasks.map(t => `  ${t.status === 'done' ? '✅' : '⬜'} ${t.title}`),
                ctx.focusTasks.length === 0 ? '  ❌ chưa chọn!' : '',
                '',
                `📊 Pending: ${ctx.pending.length} | Done hôm nay: ${ctx.doneToday.length} | Quá hạn: ${ctx.overdue.length}`,
            ]
            if (ctx.overdue.length > 0) {
                lines.push('', `⚠️ <b>Quá hạn:</b>`)
                ctx.overdue.slice(0, 3).forEach(t => lines.push(`  • ${t.title}`))
            }
            if (ctx.activeGoals.length > 0) {
                lines.push('', `🏆 <b>Goals:</b>`)
                ctx.activeGoals.slice(0, 3).forEach(g => lines.push(`  • ${g.title} — ${g.progress || 0}%`))
            }
            if (totalMins > 0) {
                lines.push('', `⏱ Ước tính: ${Math.round(totalMins / 60 * 10) / 10}h`)
            }
            return sendTelegram(token, chatId, lines.filter(l => l !== undefined).join('\n'))
        }

        default:
            // Free text → AI chat
            return handleFreeChat(text, token, chatId)
    }
}

async function handleFreeChat(text, token, chatId) {
    const ctx = await getContext()
    const contextStr = [
        `Tasks pending: ${ctx.pending.length} (overdue: ${ctx.overdue.length})`,
        ctx.overdue.length ? `Overdue: ${ctx.overdue.slice(0, 3).map(t => t.title).join(', ')}` : '',
        `Hoàn thành hôm nay: ${ctx.doneToday.length}`,
        ctx.focusTasks.length ? `Focus: ${ctx.focusTasks.map(t => t.title).join(', ')}` : 'Chưa chọn focus',
        ctx.activeGoals.length ? `Goals: ${ctx.activeGoals.map(g => `${g.title}(${g.progress}%)`).join(', ')}` : '',
    ].filter(Boolean).join('\n')

    try {
        const reply = await callAI(
            `Mày là TaskFlow AI — "đại ca" quản lý công việc, chat qua Telegram. Tính cách:
- Chửi thẳng mặt, không nể nang, toxic motivational
- Xưng "tao", gọi user là "mày"
- Nói thẳng sự thật brutal dựa trên DATA bên dưới
- Dùng emoji 🔥💀😤🤡⚡

Dữ liệu user hôm nay (${ctx.today}):
${contextStr}

User nói trên Telegram: "${text}"

Trả lời tối đa 4-5 câu, ngắn gọn đanh thép.`,
            512
        )
        return sendTelegram(token, chatId, reply)
    } catch (e) {
        return sendTelegram(token, chatId,
            '⚠️ AI đang bận (hoặc chưa có API key). Vào Settings trên TaskFlow để check nhé!')
    }
}

// ─── Polling tick ────────────────────────────────────────────────

async function pollTick() {
    try {
        const botEnabled = await getSetting('telegramBotEnabled', true)
        if (!botEnabled) return

        const { token, chatId } = await getTelegramConfig()
        if (!token) return

        const updates = await getUpdates(token)
        for (const update of updates) {
            _lastUpdateId = update.update_id
            const msg = update.message
            if (!msg || !msg.text) continue

            // Only respond to the configured chat
            const msgChatId = String(msg.chat.id)
            if (chatId && msgChatId !== String(chatId)) continue

            const text = msg.text.trim()
            const cmd = text.split(' ')[0].toLowerCase().split('@')[0] // Handle /cmd@botname

            if (cmd.startsWith('/')) {
                await handleCommand(cmd, text, token, msgChatId)
            } else {
                await handleFreeChat(text, token, msgChatId)
            }
        }
    } catch (e) {
        console.warn('[TelegramBot] poll error:', e.message)
    }
}

// ─── Public API ──────────────────────────────────────────────────

export function startTelegramBot() {
    if (_pollInterval) return
    console.log('[TelegramBot] Started — polling every 5s')
    pollTick()
    _pollInterval = setInterval(pollTick, 5000) // Poll every 5 seconds
}

export function stopTelegramBot() {
    if (_pollInterval) {
        clearInterval(_pollInterval)
        _pollInterval = null
        console.log('[TelegramBot] Stopped')
    }
}

export function isTelegramBotRunning() {
    return _pollInterval !== null
}
