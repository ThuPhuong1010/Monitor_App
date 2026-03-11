const GEN_Z_MESSAGES = {
  morning: [
    'Ê dậy chưa mày 👀 Hôm nay mày định làm gì? Chọn 3 task focus đi không thì lại drift cả ngày đó',
    'Good morning! Chọn 3 task quan trọng nhất hôm nay đi, đừng để tự nhiên trôi nhé',
    'Ngày mới bắt đầu rồi. Focus vào 3 việc chính, đừng làm linh tinh',
    'DẬY! 🔥 Mày tưởng thành công tự tới à? Mở TaskFlow lên chọn 3 task đi, đừng có nằm đó mơ mộng',
    'Hôm qua mày nói "ngày mai sẽ khác" — hôm nay là ngày mai đó. CHỨNG MINH ĐI 💀',
    'Mày biết ai cũng có 24h/ngày không? Người ta dùng nó để build, mày dùng nó để scroll. Dậy đi! ⚡',
    'Ê, procrastinate tiếp đi, xem cuộc đời mày đi về đâu 🤡 Hay là mở TaskFlow lên làm việc?',
  ],
  midday: [
    'Checkpoint giữa ngày: mày đã xong task nào chưa hay vẫn đang lướt TikTok? 👀',
    '12 giờ trưa rồi nha! Nhìn lại 3 task focus xem tiến được chưa',
    'Nửa ngày qua rồi mày ơi. Làm được gì chưa hay không?',
    'NỬA NGÀY TRÔI MẤT RỒI! 💀 Mày done được bao nhiêu task? 0? Thật sự à? Tỉnh lại đi',
    'Mày đang ngồi đây lướt điện thoại trong khi deadline đang countdown. Sáng mắt ra chưa? ⏰',
    'Ê 12h rồi đó, dự án vẫn chưa nhúc nhích. Mày định delay tới bao giờ? Làm NGAY đi! 🔥',
    'Mày biết cái cảm giác stress vào cuối ngày vì chưa làm gì không? ĐÓ, nó đang tới đấy. Làm đi! 😤',
  ],
  evening: [
    'Gần hết giờ rồi nha. Update task status đi xem hôm nay làm được gì',
    '5 giờ chiều rồi. Wrap up những gì còn lại thôi, đừng để tồn sang ngày mai',
    'Review cuối ngày: 3 task focus hôm nay mày xong được mấy cái? Trả lời thật đi',
    'HẾT NGÀY RỒI 💀 Mày done được gì chưa? Nếu 0/3 task thì mày thua chính mình ngày hôm qua đó',
    'Nhìn lại ngày hôm nay đi. Mày tự hào về nó không? Nếu không thì NGÀY MAI PHẢI KHÁC! 🔥',
    'Cảm giác guilt vì chưa làm gì cả ngày? Tốt. Nhớ cảm giác đó và ĐỪNG LẶP LẠI ngày mai 😤',
    'Mày biết khoảng cách giữa "muốn" và "được" là gì không? Là LÀM. Ngày mai phải khác nhé!',
  ],
  overdue: [
    'Task này đã quá hạn rồi đó mày. Làm hay xóa? Quyết định đi đừng để đó',
    'Ê, task quá hạn kìa! Không xử lý thì backlog mày ngày càng nặng đó',
    '🚨 TASK QUÁ HẠN! Mày để nó thối ở đó bao lâu nữa? Làm NGAY hoặc xóa đi, đừng tự lừa mình!',
    'Backlog mày đang phình to như cái nợ vậy đó. Xử lý task quá hạn đi trước khi nó nuốt mày! 💀',
    'Mày hứa sẽ xong task này... bao lâu rồi nhỉ? THẤT HỨA VỚI CHÍNH MÌNH, buồn không? 😤',
  ],
}

function getRandomMessage(type) {
  const msgs = GEN_Z_MESSAGES[type] || GEN_Z_MESSAGES.morning
  return msgs[Math.floor(Math.random() * msgs.length)]
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false
  const perm = await Notification.requestPermission()
  return perm === 'granted'
}

export function scheduleNotifications() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  const now = new Date()
  const h = now.getHours()

  // Schedule based on current time
  const schedules = [
    { hour: 9, minute: 0, type: 'morning' },
    { hour: 12, minute: 0, type: 'midday' },
    { hour: 17, minute: 0, type: 'evening' },
  ]

  schedules.forEach(({ hour, minute, type }) => {
    const target = new Date()
    target.setHours(hour, minute, 0, 0)
    if (target <= now) target.setDate(target.getDate() + 1)

    const delay = target - now
    setTimeout(() => {
      showNotification(getRandomMessage(type), type)
      // Re-schedule for next day
      setInterval(() => showNotification(getRandomMessage(type), type), 24 * 60 * 60 * 1000)
    }, delay)
  })
}

export function showNotification(message, type = 'morning') {
  if (Notification.permission !== 'granted') return
  new Notification('TaskFlow', {
    body: message,
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    tag: type,
    renotify: true,
  })
}

export function notifyOverdue(taskTitle) {
  showNotification(
    `"${taskTitle}" — ${getRandomMessage('overdue')}`,
    'overdue'
  )
}

// Write overdue task info to localStorage so the browser extension can read it
export function syncOverdueToStorage(tasks) {
  const overdue = tasks.filter(t =>
    t.status !== 'done' &&
    t.deadline &&
    new Date(t.deadline) < new Date(new Date().toDateString())
  )
  localStorage.setItem('taskflow_overdue', JSON.stringify({
    count: overdue.length,
    tasks: overdue.slice(0, 5).map(t => ({ id: t.id, title: t.title, deadline: t.deadline })),
    updatedAt: Date.now(),
  }))
}

// Check overdue every 30 min, send notification if found (max once per hour)
export function scheduleOverdueCheck(getTasksFn) {
  const check = () => {
    const tasks = getTasksFn()
    syncOverdueToStorage(tasks)

    const overdue = tasks.filter(t =>
      t.status !== 'done' &&
      t.deadline &&
      new Date(t.deadline) < new Date(new Date().toDateString())
    )
    if (overdue.length === 0) return

    const lastNotif = parseInt(localStorage.getItem('taskflow_overdue_notif_at') || '0')
    if (Date.now() - lastNotif < 60 * 60 * 1000) return // max 1 notif/hour

    localStorage.setItem('taskflow_overdue_notif_at', String(Date.now()))
    showNotification(
      `${overdue.length} task quá hạn: ${overdue.slice(0, 2).map(t => t.title).join(', ')}`,
      'overdue'
    )
  }

  check() // run immediately
  setInterval(check, 30 * 60 * 1000)
}
