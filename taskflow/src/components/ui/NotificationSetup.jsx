import { useState, useEffect } from 'react'
import { Bell, X } from 'lucide-react'
import { requestNotificationPermission, scheduleNotifications } from '../../services/notifications'
import { startAutoReminder } from '../../services/autoReminder'
import { startTelegramBot } from '../../services/telegramBot'
import { getSetting } from '../../services/db'

export default function NotificationSetup() {
  const [show, setShow] = useState(false)
  const [granted, setGranted] = useState(false)

  useEffect(() => {
    if (!('Notification' in window)) return
    const perm = Notification.permission
    if (perm === 'granted') {
      setGranted(true)
      scheduleNotifications()
      startAutoReminder()
    } else if (perm === 'default') {
      // Show prompt after 3 seconds
      setTimeout(() => setShow(true), 3000)
    }
    // Also start auto reminder for Telegram (even without browser notif permission)
    startAutoReminder()
    // Auto-start Telegram bot if was previously enabled
    getSetting('telegramBotEnabled', false).then(v => {
      if (v) startTelegramBot()
    })
  }, [])

  const handleEnable = async () => {
    const ok = await requestNotificationPermission()
    setGranted(ok)
    setShow(false)
    if (ok) scheduleNotifications()
  }

  if (!show || granted) return null

  return (
    <div className="fixed top-4 left-4 right-4 max-w-lg mx-auto z-50 animate-fade-in">
      <div className="bg-elevated border border-accent-border rounded-2xl p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-accent-soft rounded-xl flex items-center justify-center shrink-0">
            <Bell size={20} className="text-accent" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-fg text-sm">Bật notification để không drift</h3>
            <p className="text-xs text-secondary mt-0.5 leading-relaxed">
              TaskFlow sẽ nhắc mày chọn focus task sáng, check progress trưa, review tối.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleEnable}
                className="flex-1 h-9 bg-accent hover:bg-accent-muted text-white rounded-xl text-xs font-semibold"
              >
                Bật thôi
              </button>
              <button
                onClick={() => setShow(false)}
                className="h-9 px-3 bg-input text-secondary rounded-xl text-xs"
              >
                Để sau
              </button>
            </div>
          </div>
          <button onClick={() => setShow(false)} className="text-secondary/50 hover:text-secondary">
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
