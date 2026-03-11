// content.js — injected into every page
// 1. On TaskFlow tab: bridges localStorage → chrome.storage
// 2. On other tabs: shows/hides overlay

const TASKFLOW_ORIGINS = ['http://localhost:5173', 'https://taskflow.app'] // add your prod URL

const isTaskFlowTab = TASKFLOW_ORIGINS.some(o => location.origin === o)

// ── Bridge: TaskFlow tab → chrome.storage ──────────────────────────────────
if (isTaskFlowTab) {
  // Sync immediately on load
  syncFromLocalStorage()

  // Watch for changes (PWA writes to localStorage after every task update)
  window.addEventListener('storage', (e) => {
    if (e.key === 'taskflow_overdue') syncFromLocalStorage()
  })

  // Also poll every 30s as fallback (localStorage events don't fire in same tab)
  setInterval(syncFromLocalStorage, 30_000)
}

function syncFromLocalStorage() {
  try {
    const raw = localStorage.getItem('taskflow_overdue')
    if (!raw) return
    const data = JSON.parse(raw)
    chrome.runtime.sendMessage({ type: 'SYNC_OVERDUE', data })
  } catch (e) {}
}

// ── Overlay: non-TaskFlow tabs ─────────────────────────────────────────────
let overlayEl = null

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SHOW_OVERLAY' && !isTaskFlowTab) showOverlay(msg.overdue)
  if (msg.type === 'HIDE_OVERLAY') hideOverlay()
})

// Check on page load too (in case alarm already fired)
if (!isTaskFlowTab) {
  chrome.storage.local.get(['taskflow_overdue', 'overlay_last_shown'], (data) => {
    const overdue = data.taskflow_overdue
    const lastShown = data.overlay_last_shown || 0
    if (!overdue || overdue.count === 0) return
    if (Date.now() - lastShown < 60 * 60 * 1000) return
    showOverlay(overdue)
  })
}

function showOverlay(overdue) {
  if (overlayEl || !overdue?.count) return

  const taskListHTML = (overdue.tasks || []).map(t => `
    <li class="tf-task-item">
      <span class="tf-task-dot"></span>
      <span class="tf-task-title">${escapeHtml(t.title)}</span>
    </li>
  `).join('')

  const moreCount = overdue.count - (overdue.tasks?.length || 0)

  overlayEl = document.createElement('div')
  overlayEl.id = 'taskflow-overlay'
  overlayEl.innerHTML = `
    <div class="tf-card">
      <div class="tf-header">
        <span class="tf-icon">⚠️</span>
        <div>
          <div class="tf-title">${overdue.count} task quá hạn</div>
          <div class="tf-subtitle">Mày đang lướt trong khi task đang chờ</div>
        </div>
      </div>
      <ul class="tf-task-list">${taskListHTML}</ul>
      ${moreCount > 0 ? `<p class="tf-more">+${moreCount} task nữa</p>` : ''}
      <div class="tf-actions">
        <a href="http://localhost:5173" target="_blank" class="tf-btn-primary">Xử lý ngay →</a>
        <button class="tf-btn-snooze" id="tf-snooze">Nhắc lại sau 1h</button>
      </div>
    </div>
  `

  document.body.appendChild(overlayEl)

  document.getElementById('tf-snooze').addEventListener('click', () => {
    chrome.storage.local.set({ overlay_last_shown: Date.now() })
    hideOverlay()
  })
}

function hideOverlay() {
  if (overlayEl) {
    overlayEl.remove()
    overlayEl = null
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
