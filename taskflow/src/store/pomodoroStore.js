import { create } from 'zustand'

export const usePomodoroStore = create((set, get) => ({
  taskId: null,
  startedAt: null,
  duration: 25 * 60, // seconds
  running: false,
  elapsed: 0,
  _interval: null,

  start: (taskId, durationMins = 25) => {
    const { _interval } = get()
    if (_interval) clearInterval(_interval)
    const interval = setInterval(() => {
      const { elapsed, duration, taskId } = get()
      const next = elapsed + 1
      if (next >= duration) {
        clearInterval(interval)
        set({ elapsed: duration, running: false, _interval: null })
        if (navigator.vibrate) navigator.vibrate([200, 100, 200])
        // Browser notification
        if (Notification.permission === 'granted') {
          new Notification('🍅 Pomodoro xong!', {
            body: 'Nghỉ 5 phút rồi tiếp tục.',
            icon: '/icon-192.png',
          })
        }
      } else {
        set({ elapsed: next })
      }
    }, 1000)
    set({ taskId, startedAt: Date.now(), duration: durationMins * 60, running: true, elapsed: 0, _interval: interval })
  },

  pause: () => {
    const { _interval } = get()
    if (_interval) clearInterval(_interval)
    set({ running: false, _interval: null })
  },

  resume: () => {
    const { elapsed, duration, taskId } = get()
    if (elapsed >= duration) return
    get().start(taskId, duration / 60)
  },

  stop: () => {
    const { _interval } = get()
    if (_interval) clearInterval(_interval)
    set({ taskId: null, startedAt: null, running: false, elapsed: 0, _interval: null })
  },

  get remaining() {
    const { duration, elapsed } = get()
    return duration - elapsed
  },
}))
