import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Check, Eye, EyeOff, Key, Star, StarOff, RefreshCw, AlertCircle, ExternalLink, Copy } from 'lucide-react'
import { getAllKeys, addKey, deleteKey, setActiveKey, getActiveKey, markKeyActive, getKeyStats } from '../../services/keyVault'
import { AI_PROVIDERS } from '../../services/ai'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'

const STATUS_BADGES = {
    active: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20', label: '● Active' },
    rate_limited: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', label: '⏳ Rate Limited' },
    expired: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', label: '✕ Expired' },
    error: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', label: '⚠ Error' },
}

export default function KeyVaultSection({ provider }) {
    const [keys, setKeys] = useState([])
    const [activeKeyData, setActiveKeyData] = useState(null)
    const [showAdd, setShowAdd] = useState(false)
    const [showKeys, setShowKeys] = useState({}) // { keyId: true/false }
    const [expandedKey, setExpandedKey] = useState(null)

    // Add form
    const [newKey, setNewKey] = useState('')
    const [newLabel, setNewLabel] = useState('')
    const [newEmail, setNewEmail] = useState('')

    const providerInfo = AI_PROVIDERS[provider]

    const reload = () => {
        setKeys(getAllKeys(provider))
        setActiveKeyData(getActiveKey(provider))
    }

    useEffect(() => { reload() }, [provider])

    const handleAdd = () => {
        if (!newKey.trim()) return
        addKey({
            provider,
            key: newKey.trim(),
            label: newLabel.trim() || `${providerInfo.name} Key`,
            accountEmail: newEmail.trim(),
            accountUrl: providerInfo.keyUrl,
        })
        setNewKey('')
        setNewLabel('')
        setNewEmail('')
        setShowAdd(false)
        reload()
    }

    const handleDelete = (id) => {
        if (!confirm('Xóa key này?')) return
        deleteKey(id)
        reload()
    }

    const handleSetActive = (id) => {
        setActiveKey(provider, id)
        reload()
    }

    const handleReactivate = (id) => {
        markKeyActive(id)
        reload()
    }

    const handleCopyKey = (key) => {
        navigator.clipboard.writeText(key).catch(() => { })
    }

    const stats = useMemo(() => getKeyStats(provider), [keys])

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Key size={13} className="text-accent" />
                    <p className="text-xs font-semibold text-fg">Key Vault — {providerInfo.name}</p>
                    <span className="text-[10px] text-secondary bg-input px-1.5 py-0.5 rounded">
                        {stats.total} key{stats.total !== 1 ? 's' : ''}
                    </span>
                    {stats.rateLimited > 0 && (
                        <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                            ⏳ {stats.rateLimited} limited
                        </span>
                    )}
                </div>
                <button
                    onClick={() => setShowAdd(!showAdd)}
                    className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors
            ${showAdd ? 'bg-red-500/10 text-red-400' : 'bg-accent/10 text-accent hover:bg-accent/20'}`}
                >
                    <Plus size={12} />
                    {showAdd ? 'Hủy' : 'Thêm key'}
                </button>
            </div>

            {/* Quick stats */}
            {keys.length > 0 && (
                <div className="flex gap-2 text-[10px]">
                    <span className="bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full border border-green-500/20 font-medium">
                        ● {stats.active} sẵn sàng
                    </span>
                    <span className="bg-input text-secondary px-2 py-0.5 rounded-full font-medium">
                        📊 {stats.totalCalls} calls tổng
                    </span>
                </div>
            )}

            {/* Add form */}
            {showAdd && (
                <div className="bg-input border border-edge rounded-xl p-3 space-y-2.5 animate-fade-in">
                    <div>
                        <label className="text-[10px] text-secondary mb-1 block">API Key *</label>
                        <input
                            type="password"
                            value={newKey}
                            onChange={e => setNewKey(e.target.value)}
                            placeholder={providerInfo.keyPlaceholder}
                            className="w-full bg-surface border border-edge rounded-lg px-3 py-2 text-sm text-fg font-mono placeholder-secondary/50 focus:outline-none focus:border-accent"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] text-secondary mb-1 block">Label / Ghi chú</label>
                            <input
                                value={newLabel}
                                onChange={e => setNewLabel(e.target.value)}
                                placeholder="vd: Gmail cá nhân, Work account"
                                className="w-full bg-surface border border-edge rounded-lg px-3 py-2 text-xs text-fg placeholder-secondary/50 focus:outline-none focus:border-accent"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-secondary mb-1 block">Account email</label>
                            <input
                                value={newEmail}
                                onChange={e => setNewEmail(e.target.value)}
                                placeholder="email@gmail.com"
                                className="w-full bg-surface border border-edge rounded-lg px-3 py-2 text-xs text-fg placeholder-secondary/50 focus:outline-none focus:border-accent"
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <a
                            href={providerInfo.keyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-accent hover:text-accent-muted flex items-center gap-1"
                        >
                            <ExternalLink size={10} /> Lấy key tại {provider === 'gemini' ? 'AI Studio' : provider === 'gpt' ? 'OpenAI Platform' : 'Anthropic Console'}
                        </a>
                        <button
                            onClick={handleAdd}
                            disabled={!newKey.trim()}
                            className="h-8 px-4 bg-accent hover:bg-accent-muted disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                            <Plus size={12} /> Thêm
                        </button>
                    </div>
                </div>
            )}

            {/* Key list */}
            {keys.length === 0 ? (
                <p className="text-xs text-secondary/50 text-center py-4">
                    Chưa có key nào. Thêm API key để sử dụng AI features.
                </p>
            ) : (
                <div className="bg-surface border border-edge rounded-xl overflow-hidden divide-y divide-edge">
                    {keys.map(k => {
                        const isActive = activeKeyData?.id === k.id
                        const badge = STATUS_BADGES[k.status] || STATUS_BADGES.active
                        const isExpanded = expandedKey === k.id
                        const isVisible = showKeys[k.id]
                        const maskedKey = k.key.slice(0, 6) + '••••••••' + k.key.slice(-4)

                        return (
                            <div key={k.id} className={isActive ? 'bg-accent/5' : ''}>
                                {/* ── Compact row (always visible) ── */}
                                <button
                                    onClick={() => setExpandedKey(isExpanded ? null : k.id)}
                                    className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-hover/50 transition-colors text-left"
                                >
                                    {isActive
                                        ? <Star size={12} className="text-accent shrink-0" fill="currentColor" />
                                        : <Star size={12} className="text-secondary/30 shrink-0" />
                                    }
                                    <span className="text-xs font-medium text-fg flex-1 truncate">{k.label}</span>
                                    <span className="text-[9px] text-secondary/60 font-mono shrink-0">{k.key.slice(0, 6)}…{k.key.slice(-3)}</span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${badge.bg} ${badge.text} ${badge.border}`}>
                                        {badge.label}
                                    </span>
                                    <RefreshCw size={11} className={`text-secondary/40 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                </button>

                                {/* ── Expanded detail ── */}
                                {isExpanded && (
                                    <div className="px-3 pb-3 space-y-2.5 border-t border-edge bg-input/30">
                                        {/* Key value */}
                                        <div className="flex items-center gap-1.5 bg-input rounded-lg px-2 py-1.5 mt-2.5">
                                            <span className="text-[11px] font-mono text-secondary flex-1 truncate">
                                                {isVisible ? k.key : maskedKey}
                                            </span>
                                            <button onClick={() => setShowKeys(s => ({ ...s, [k.id]: !s[k.id] }))} className="text-secondary/50 hover:text-secondary shrink-0">
                                                {isVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                                            </button>
                                            <button onClick={() => handleCopyKey(k.key)} className="text-secondary/50 hover:text-accent shrink-0" title="Copy key">
                                                <Copy size={12} />
                                            </button>
                                        </div>

                                        {/* Meta */}
                                        <div className="flex flex-wrap gap-1.5 text-[9px]">
                                            <span className="text-secondary bg-input px-1.5 py-0.5 rounded">📊 {k.callCount || 0} calls</span>
                                            {k.lastUsedAt && (
                                                <span className="text-secondary bg-input px-1.5 py-0.5 rounded">
                                                    🕐 {formatDistanceToNow(new Date(k.lastUsedAt), { addSuffix: true, locale: vi })}
                                                </span>
                                            )}
                                            {k.errorCount > 0 && (
                                                <span className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">⚠ {k.errorCount} errors</span>
                                            )}
                                            {k.accountEmail && (
                                                <span className="text-secondary bg-input px-1.5 py-0.5 rounded">📧 {k.accountEmail}</span>
                                            )}
                                        </div>

                                        {/* Error message */}
                                        {k.status !== 'active' && k.statusMessage && (
                                            <div className="flex items-start gap-1.5 bg-red-500/5 border border-red-500/15 rounded-lg px-2 py-1.5">
                                                <AlertCircle size={11} className="text-red-400 shrink-0 mt-0.5" />
                                                <p className="text-[10px] text-red-400 leading-relaxed truncate">{k.statusMessage.slice(0, 150)}</p>
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div className="flex items-center gap-1.5">
                                            {!isActive && (
                                                <button onClick={() => handleSetActive(k.id)}
                                                    className="h-7 px-2.5 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-colors">
                                                    <Star size={10} /> Dùng key này
                                                </button>
                                            )}
                                            {k.status === 'rate_limited' && (
                                                <button onClick={() => handleReactivate(k.id)}
                                                    className="h-7 px-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-colors">
                                                    <RefreshCw size={10} /> Kích hoạt lại
                                                </button>
                                            )}
                                            {k.status === 'error' && (
                                                <button onClick={() => handleReactivate(k.id)}
                                                    className="h-7 px-2.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-colors">
                                                    <RefreshCw size={10} /> Reset status
                                                </button>
                                            )}
                                            <a href={k.accountUrl || providerInfo.keyUrl} target="_blank" rel="noopener noreferrer"
                                                className="h-7 px-2.5 bg-input hover:bg-hover text-secondary rounded-lg text-[10px] font-medium flex items-center gap-1 transition-colors">
                                                <ExternalLink size={10} /> Console
                                            </a>
                                            <div className="flex-1" />
                                            <button onClick={() => handleDelete(k.id)}
                                                className="h-7 px-2 text-secondary/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Info box */}
            <div className="bg-input rounded-xl px-3 py-2.5 space-y-1">
                <p className="text-[10px] font-semibold text-fg">💡 Tips quản lý key:</p>
                <p className="text-[10px] text-secondary">• Thêm nhiều key → app tự switch khi bị rate limit</p>
                <p className="text-[10px] text-secondary">• Tạo nhiều Google AI Studio project → mỗi project 1 key riêng</p>
                <p className="text-[10px] text-secondary">• Key bị rate limit sẽ tự đánh dấu ⏳ → bấm "Kích hoạt lại" khi reset</p>
                <p className="text-[10px] text-secondary">• Gemini free: 15 req/min × key, nên 3-4 key là chạy thoải mái</p>
            </div>
        </div>
    )
}
