import { useState, useEffect, useCallback } from 'react'
import { onToast } from '../../services/globalToast'
import { X, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react'

const ICONS = {
    info: { Icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/25' },
    success: { Icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/25' },
    warn: { Icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25' },
    error: { Icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/25' },
}

export default function GlobalToast() {
    const [toasts, setToasts] = useState([])

    const addToast = useCallback((toast) => {
        setToasts(prev => [...prev, { ...toast, entering: true }])
        // Auto-remove after duration
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== toast.id))
        }, toast.duration || 5000)
        // Remove entering class after animation
        setTimeout(() => {
            setToasts(prev => prev.map(t => t.id === toast.id ? { ...t, entering: false } : t))
        }, 50)
    }, [])

    useEffect(() => {
        return onToast(addToast)
    }, [addToast])

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }

    if (toasts.length === 0) return null

    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-[90vw] max-w-md pointer-events-none">
            {toasts.map(toast => {
                const style = ICONS[toast.type] || ICONS.info
                const { Icon } = style
                return (
                    <div
                        key={toast.id}
                        className={`pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl
              transition-all duration-300 ${style.bg} ${style.border}
              ${toast.entering ? 'opacity-0 -translate-y-2' : 'opacity-100 translate-y-0'}`}
                    >
                        <Icon size={16} className={`${style.color} shrink-0 mt-0.5`} />
                        <p className="text-sm text-fg flex-1 leading-snug">{toast.message}</p>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="text-secondary/50 hover:text-fg shrink-0 -mr-1"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )
            })}
        </div>
    )
}
