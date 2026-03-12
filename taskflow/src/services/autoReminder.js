/**
 * autoReminder.js — Cơ chế auto gửi thông báo / reminder
 *
 * Chạy background interval kiểm tra:
 * 1. Scheduled reminders (9h sáng, 12h trưa, 17h chiều)
 * 2. Overdue task alerts (mỗi 2 tiếng)
 * 3. Focus check (nếu chưa chọn focus task → nhắc)
 *
 * Gửi qua 2 channel:
 * - Browser Notification (nếu granted)
 * - Telegram Bot (nếu configured)
 */

import { db, getSetting } from './db'
import { showNotification } from './notifications'
import { sendTelegram, getTelegramConfig } from './telegram'
import { synthesizeDailyPriorities } from './ai'
import { sortTasksByPrioritySync } from './priorityEngine'

// ─── State tracking ───────────────────────────────────────────────

let _intervalId = null
let _lastSentKey = '' // Prevent duplicate sends within same slot

// ─── Message templates ───────────────────────────────────────────

const REMINDER_MESSAGES = {
    morning: [
        '🌅 <b>Sáng rồi!</b> Mở TaskFlow chọn 3 task focus đi.\nĐừng để ngày trôi qua vô nghĩa nhé mày!',
        '🔥 <b>DẬY!</b> Hôm qua mày nói "ngày mai sẽ khác" — hôm nay là ngày mai đó.\nChọn 3 task và CHỨNG MINH ĐI!',
        '⚡ <b>Morning check!</b> Mày có 24h — giống mọi người.\nNgười ta dùng nó để build, mày dùng để scroll?\nMở TaskFlow lên đi!',
    ],
    midday: [
        '🕐 <b>12h trưa!</b> Checkpoint giữa ngày.\nMày done được task nào chưa hay vẫn đang lướt TikTok? 👀',
        '⏰ <b>Nửa ngày trôi mất rồi!</b>\nNhìn lại 3 task focus xem — lỡ 0/3 thì tối mày sẽ guilt đó!',
        '😤 <b>Midday check!</b> Deadline đang countdown.\nMày thì ngồi đây lướt điện thoại. Sáng mắt ra chưa?',
    ],
    evening: [
        '🌙 <b>Cuối ngày!</b> Wrap up đi.\nHôm nay mày done được gì? Update task status nhé!',
        '💀 <b>HẾT NGÀY RỒI!</b>\nNếu 0/3 focus task → mày thua chính mình ngày hôm qua.\nReview ngay đi!',
        '🔥 <b>Evening review!</b>\nCảm giác guilt vì chưa làm gì cả ngày?\nTốt. Nhớ cảm giác đó cho NGÀY MAI!',
    ],
    noFocus: [
        '⚠️ <b>Chưa chọn focus task!</b>\nMày chưa chọn 3 task focus từ sáng tới giờ.\nMở TaskFlow chọn NGAY đi, đừng drift!',
    ],
    overdue: [
        '🚨 <b>{count} task quá hạn!</b>\n{tasks}\nXử lý NGAY hoặc xóa đi, đừng tự lừa mình!',
    ],
}

function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
}

// ─── Check & Send logic ──────────────────────────────────────────

async function getTaskSummary() {
    const tasks = await db.tasks.toArray()
    const today = new Date().toISOString().slice(0, 10)
    const pending = tasks.filter(t => t.status !== 'done')
    const overdue = pending.filter(t => t.deadline && t.deadline < today)
    const focusHistory = await db.focusHistory.where('date').equals(today).first()
    const focusIds = focusHistory?.taskIds || []
    const focusDone = focusIds
        .map(id => tasks.find(t => t.id === id))
        .filter(t => t?.status === 'done').length

    return { tasks, pending, overdue, focusIds, focusDone, today }
}

function getTimeSlot() {
    const h = new Date().getHours()
    if (h >= 8 && h < 10) return 'morning'
    if (h >= 11 && h < 13) return 'midday'
    if (h >= 16 && h < 18) return 'evening'
    return null
}

async function sendViaTelegram(text) {
    try {
        const { token, chatId } = await getTelegramConfig()
        if (token && chatId) {
            await sendTelegram(token, chatId, text)
            return true
        }
    } catch (e) {
        console.warn('[AutoReminder] Telegram send failed:', e.message)
    }
    return false
}

function sendViaBrowser(text) {
    const clean = text.replace(/<[^>]*>/g, '').replace(/\\n/g, ' ')
    showNotification(clean, 'reminder')
}

// ─── Main tick — runs every minute ───────────────────────────────

async function tick() {
    try {
        const autoEnabled = await getSetting('autoReminderEnabled', true)
        if (!autoEnabled) return

        const now = new Date()
        const h = now.getHours()
        const m = now.getMinutes()
        const slot = getTimeSlot()
        const slotKey = `${now.toISOString().slice(0, 10)}-${slot}`

        // ── 1. Scheduled time-based reminders ──
        if (slot && slotKey !== _lastSentKey) {
            const triggerHours = { morning: 9, midday: 12, evening: 17 }

            if (h === triggerHours[slot] && m <= 2) {
                _lastSentKey = slotKey
                const { tasks, pending, focusIds, focusDone } = await getTaskSummary()
                const statsLine = `\n\n📊 Pending: ${pending.length} | Focus: ${focusDone}/${focusIds.length || 0}`

                // Morning: try AI synthesis (only if enabled in Settings)
                if (slot === 'morning') {
                    const aiDigestEnabled = await getSetting('aiMorningDigest', false)
                    if (aiDigestEnabled) {
                        try {
                            const sorted = sortTasksByPrioritySync(tasks)
                            const synthesis = await synthesizeDailyPriorities(sorted)
                            if (synthesis?.top3?.length > 0) {
                                const top3Lines = synthesis.top3
                                    .map((t, i) => `${i + 1}. <b>${t.title}</b>\n   → ${t.reason}`)
                                    .join('\n')
                                const aiMsg = `🔥 <b>AI đã đọc hết notes và xếp hạng cho mày:</b>\n\n${top3Lines}\n\n💀 ${synthesis.assessment}${statsLine}`
                                sendViaBrowser(aiMsg)
                                await sendViaTelegram(aiMsg)
                                return
                            }
                        } catch (_) {
                            // fall through to default message
                        }
                    }
                }

                const msg = pickRandom(REMINDER_MESSAGES[slot])
                const fullMsg = msg + statsLine
                sendViaBrowser(fullMsg)
                await sendViaTelegram(fullMsg)
            }
        }

        // ── 2. Focus check — 10:00 AM if no focus selected ──
        if (h === 10 && m <= 2) {
            const checkKey = `${now.toISOString().slice(0, 10)}-focuscheck`
            if (checkKey !== _lastSentKey) {
                const { focusIds } = await getTaskSummary()
                if (focusIds.length === 0) {
                    _lastSentKey = checkKey
                    const msg = pickRandom(REMINDER_MESSAGES.noFocus)
                    sendViaBrowser(msg)
                    await sendViaTelegram(msg)
                }
            }
        }

        // ── 3. Overdue check — every 2 hours between 9-20h ──
        if (h >= 9 && h <= 20 && m <= 2 && h % 2 === 0) {
            const overdueKey = `${now.toISOString().slice(0, 10)}-overdue-${h}`
            if (overdueKey !== _lastSentKey) {
                const overdueEnabled = await getSetting('autoOverdueAlert', true)
                if (overdueEnabled) {
                    const { overdue } = await getTaskSummary()
                    if (overdue.length > 0) {
                        _lastSentKey = overdueKey
                        const taskList = overdue.slice(0, 5)
                            .map(t => `  • ${t.title} (${t.deadline})`)
                            .join('\n')
                        const msg = pickRandom(REMINDER_MESSAGES.overdue)
                            .replace('{count}', overdue.length)
                            .replace('{tasks}', taskList)
                        sendViaBrowser(msg)
                        await sendViaTelegram(msg)
                    }
                }
            }
        }
    } catch (e) {
        console.warn('[AutoReminder] tick error:', e)
    }
}

// ─── Public API ──────────────────────────────────────────────────

export function startAutoReminder() {
    if (_intervalId) return
    console.log('[AutoReminder] Started — checking every 60s')
    tick()
    _intervalId = setInterval(tick, 60 * 1000)
}

export function stopAutoReminder() {
    if (_intervalId) {
        clearInterval(_intervalId)
        _intervalId = null
        console.log('[AutoReminder] Stopped')
    }
}

export function isAutoReminderRunning() {
    return _intervalId !== null
}
