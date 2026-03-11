import { useState, useCallback } from 'react'

export const DEFAULT_LEFT = ['roast', 'pomodoro', 'quickCapture', 'attentionTasks', 'focusBoard', 'quickStats', 'systemMonitor']
export const DEFAULT_RIGHT = ['weeklyChart', 'categoryBreakdown', 'focusHeatmap', 'dashboardCalendar', 'goals', 'library']
export const DEFAULT_ORDER = [...DEFAULT_LEFT, ...DEFAULT_RIGHT]

const KEY_LEFT = 'taskflow_widgets_left'
const KEY_RIGHT = 'taskflow_widgets_right'

function loadSaved(key, defaults) {
  try {
    const s = localStorage.getItem(key)
    if (!s) return defaults
    const parsed = JSON.parse(s)
    const extras = defaults.filter(id => !parsed.includes(id))
    return [...parsed.filter(id => defaults.includes(id)), ...extras]
  } catch {
    return defaults
  }
}

export function useWidgetOrder() {
  const [left, setLeft] = useState(() => loadSaved(KEY_LEFT, DEFAULT_LEFT))
  const [right, setRight] = useState(() => loadSaved(KEY_RIGHT, DEFAULT_RIGHT))

  const updateLeft = useCallback((order) => {
    setLeft(order)
    localStorage.setItem(KEY_LEFT, JSON.stringify(order))
  }, [])

  const updateRight = useCallback((order) => {
    setRight(order)
    localStorage.setItem(KEY_RIGHT, JSON.stringify(order))
  }, [])

  const reset = useCallback(() => {
    setLeft(DEFAULT_LEFT)
    setRight(DEFAULT_RIGHT)
    localStorage.removeItem(KEY_LEFT)
    localStorage.removeItem(KEY_RIGHT)
  }, [])

  return { left, right, updateLeft, updateRight, reset }
}
