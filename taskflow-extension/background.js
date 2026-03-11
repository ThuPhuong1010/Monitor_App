// background.js — service worker
// Reads overdue data from chrome.storage, triggers overlay on active tab

const TASKFLOW_ORIGIN = 'http://localhost:5173' // change to production URL when deployed

// Setup alarm on install/startup
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('checkOverdue', { periodInMinutes: 30 })
})

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('checkOverdue', { periodInMinutes: 30 })
})

// Alarm fires → tell content scripts to show overlay if overdue
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'checkOverdue') return
  await checkAndNotify()
})

async function checkAndNotify() {
  const data = await chrome.storage.local.get('taskflow_overdue')
  const overdue = data.taskflow_overdue

  if (!overdue || overdue.count === 0) return

  // Don't re-notify within 1 hour
  const lastShown = (await chrome.storage.local.get('overlay_last_shown')).overlay_last_shown || 0
  if (Date.now() - lastShown < 60 * 60 * 1000) return

  await chrome.storage.local.set({ overlay_last_shown: Date.now() })

  // Send message to all tabs (content script will decide to show or not)
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  for (const tab of tabs) {
    if (!tab.id || tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) continue
    chrome.tabs.sendMessage(tab.id, { type: 'SHOW_OVERLAY', overdue }).catch(() => {})
  }
}

// Listen for PWA syncing overdue data
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SYNC_OVERDUE') {
    chrome.storage.local.set({ taskflow_overdue: msg.data })
    sendResponse({ ok: true })
  }
  if (msg.type === 'TASKS_UPDATED') {
    // Clear overlay on all tabs when tasks are updated
    chrome.tabs.query({}).then(tabs => {
      for (const tab of tabs) {
        if (!tab.id) continue
        chrome.tabs.sendMessage(tab.id, { type: 'HIDE_OVERLAY' }).catch(() => {})
      }
    })
  }
})
