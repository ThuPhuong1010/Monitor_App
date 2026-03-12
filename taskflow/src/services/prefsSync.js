/**
 * prefsSync.js — Sync user preferences between Dexie/localStorage and Supabase.
 *
 * Covers: AI provider/model, notification prefs, auto reminder,
 *         widget layout (localStorage), priority rules (db.settings)
 */
import { getSetting, setSetting } from './db'
import { syncPreferences, fetchPreferences } from './supabase'

function readLS(key) {
  try { return JSON.parse(localStorage.getItem(key)) } catch { return null }
}

/**
 * Collect all local prefs and push to Supabase user_preferences table.
 * Fire-and-forget safe — call with .catch(() => {})
 */
export async function pushPrefsToCloud() {
  const [aiProvider, aiModel, notifyDone, notifyOverdue, autoReminder, priorityRules] = await Promise.all([
    getSetting('aiProvider', 'claude'),
    getSetting('aiModel'),
    getSetting('telegramNotifyDone', false),
    getSetting('telegramNotifyOverdue', true),
    getSetting('autoReminderEnabled', true),
    getSetting('priorityRules'),
  ])
  await syncPreferences({
    ai_provider: aiProvider || 'claude',
    ai_model: aiModel || null,
    notify_done: !!notifyDone,
    notify_overdue: notifyOverdue !== false,
    auto_reminder: autoReminder !== false,
    data: {
      widgetLeft: readLS('taskflow_widgets_left'),
      widgetRight: readLS('taskflow_widgets_right'),
      priorityRules: priorityRules || null,
    },
  })
}

/**
 * Fetch prefs from Supabase and restore to Dexie + localStorage.
 * Returns the raw cloud prefs object so caller can update React state.
 * Cloud wins (multi-device sync: newer device pulls latest).
 */
export async function pullPrefsFromCloud() {
  const prefs = await fetchPreferences()
  if (!prefs) return null

  // Restore to Dexie settings
  if (prefs.ai_provider) await setSetting('aiProvider', prefs.ai_provider)
  if (prefs.ai_model)    await setSetting('aiModel', prefs.ai_model)
  await setSetting('telegramNotifyDone',  !!prefs.notify_done)
  await setSetting('telegramNotifyOverdue', prefs.notify_overdue !== false)
  await setSetting('autoReminderEnabled',   prefs.auto_reminder !== false)

  // Restore widget layout to localStorage
  const data = prefs.data || {}
  if (data.widgetLeft)     localStorage.setItem('taskflow_widgets_left',  JSON.stringify(data.widgetLeft))
  if (data.widgetRight)    localStorage.setItem('taskflow_widgets_right', JSON.stringify(data.widgetRight))
  if (data.priorityRules)  await setSetting('priorityRules', data.priorityRules)

  return prefs
}
