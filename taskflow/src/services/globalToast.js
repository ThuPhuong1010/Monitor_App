/**
 * globalToast.js — Global toast notification system
 * Event-based, works from any service (không cần React context)
 */

const TOAST_EVENT = 'taskflow:toast'

/**
 * Show a toast notification from anywhere in the app
 * @param {{ type: 'info'|'warn'|'error'|'success', message: string, duration?: number }} options
 */
export function showToast({ type = 'info', message, duration = 5000 }) {
    window.dispatchEvent(new CustomEvent(TOAST_EVENT, {
        detail: { id: Date.now(), type, message, duration },
    }))
}

/**
 * Subscribe to toast events (used by the React component)
 * @returns {() => void} unsubscribe function
 */
export function onToast(callback) {
    const handler = (e) => callback(e.detail)
    window.addEventListener(TOAST_EVENT, handler)
    return () => window.removeEventListener(TOAST_EVENT, handler)
}
