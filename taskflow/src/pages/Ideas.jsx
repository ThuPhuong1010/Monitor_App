import { useState, useEffect, useMemo } from 'react'
import { Plus, Pin, PinOff, Trash2, Archive, ArrowRightCircle, Lightbulb, Search, X, Filter, Target, Sparkles, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { useIdeaStore } from '../store/ideaStore'
import { useTaskStore } from '../store/taskStore'
import { useGoalStore } from '../store/goalStore'
import { IDEA_CATEGORIES, GOAL_CATEGORIES } from '../services/db'
import { enrichIdea } from '../services/ai'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'
import Sheet from '../components/ui/Sheet'

const STATUS_TABS = [
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
]

const EFFORT_COLORS = {
    low: { bg: 'bg-green-500/10', text: 'text-green-400', label: '⚡ Thấp' },
    medium: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: '⏱️ Vừa' },
    high: { bg: 'bg-red-500/10', text: 'text-red-400', label: '🔥 Cao' },
}

export default function Ideas() {
    const ideas = useIdeaStore(s => s.ideas)
    const load = useIdeaStore(s => s.load)
    const addIdea = useIdeaStore(s => s.addIdea)
    const updateIdea = useIdeaStore(s => s.updateIdea)
    const deleteIdea = useIdeaStore(s => s.deleteIdea)
    const togglePin = useIdeaStore(s => s.togglePin)
    const archiveIdea = useIdeaStore(s => s.archiveIdea)
    const convertToTask = useIdeaStore(s => s.convertToTask)
    const convertToGoal = useIdeaStore(s => s.convertToGoal)
    const updateIdeaEnrichment = useIdeaStore(s => s.updateIdeaEnrichment)
    const addTask = useTaskStore(s => s.addTask)
    const addGoal = useGoalStore(s => s.addGoal)

    // Form state
    const [content, setContent] = useState('')
    const [category, setCategory] = useState('idea')
    const [showForm, setShowForm] = useState(false)

    // Filter state
    const [statusFilter, setStatusFilter] = useState('active')
    const [catFilter, setCatFilter] = useState('all')
    const [search, setSearch] = useState('')

    // Edit state
    const [editId, setEditId] = useState(null)
    const [editContent, setEditContent] = useState('')

    // Goal form state
    const [showGoalForm, setShowGoalForm] = useState(false)
    const [goalFormData, setGoalFormData] = useState({ title: '', category: 'career', deadline: '', ideaId: null })

    // AI enrich state
    const [enrichingId, setEnrichingId] = useState(null)

    // Expanded enrichment state
    const [expandedEnrichId, setExpandedEnrichId] = useState(null)

    useEffect(() => { load() }, [])

    const filtered = useMemo(() => {
        let list = ideas.filter(i => i.status === statusFilter)
        if (catFilter !== 'all') list = list.filter(i => i.category === catFilter)
        if (search.trim()) {
            const q = search.toLowerCase()
            list = list.filter(i => i.content.toLowerCase().includes(q))
        }
        // Sort: pinned first, then by createdAt desc
        return list.sort((a, b) => {
            if (a.pinned !== b.pinned) return (b.pinned || 0) - (a.pinned || 0)
            return new Date(b.createdAt) - new Date(a.createdAt)
        })
    }, [ideas, statusFilter, catFilter, search])

    const handleAdd = async () => {
        if (!content.trim()) return
        await addIdea({ content: content.trim(), category })
        setContent('')
        setShowForm(false)
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd()
    }

    const handleConvert = async (id) => {
        const taskData = await convertToTask(id)
        if (!taskData) return
        await addTask(taskData)
        await archiveIdea(id)
    }

    const handleConvertToGoal = async (id) => {
        const goalData = await convertToGoal(id)
        if (!goalData) return
        setGoalFormData({ ...goalData, deadline: '', ideaId: id })
        setShowGoalForm(true)
    }

    const handleGoalSave = async () => {
        if (!goalFormData.title.trim()) return
        await addGoal({
            title: goalFormData.title,
            category: goalFormData.category,
            deadline: goalFormData.deadline || null,
        })
        if (goalFormData.ideaId) {
            await archiveIdea(goalFormData.ideaId)
        }
        setShowGoalForm(false)
        setGoalFormData({ title: '', category: 'career', deadline: '', ideaId: null })
    }

    const handleEditSave = async (id) => {
        if (!editContent.trim()) return
        await updateIdea(id, { content: editContent.trim() })
        setEditId(null)
        setEditContent('')
    }

    const handleEnrich = async (id) => {
        const idea = ideas.find(i => i.id === id)
        if (!idea) return
        if (!window.confirm('🤖 Dùng AI phân tích ý tưởng này? (tốn ~1 API call)')) return
        setEnrichingId(id)
        try {
            const result = await enrichIdea(idea.content)
            await updateIdeaEnrichment(id, result)
            setExpandedEnrichId(id)
        } catch (e) {
            console.error('Enrich failed:', e)
        } finally {
            setEnrichingId(null)
        }
    }

    const catCounts = useMemo(() => {
        const active = ideas.filter(i => i.status === statusFilter)
        const counts = { all: active.length }
        Object.keys(IDEA_CATEGORIES).forEach(k => {
            counts[k] = active.filter(i => i.category === k).length
        })
        return counts
    }, [ideas, statusFilter])

    return (
        <div className="px-4 pt-6 pb-4 max-w-3xl space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-fg flex items-center gap-2">
                        <Lightbulb size={20} className="text-amber-400" />
                        Draft Ideas
                    </h1>
                    <p className="text-xs text-secondary mt-0.5">
                        Brain dump — ghi lại mọi ý tưởng, AI enrich & convert thành Goal/Task
                    </p>
                </div>
                <button
                    onClick={() => setShowForm(f => !f)}
                    className={`h-10 px-4 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-all
            ${showForm
                            ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                            : 'bg-accent text-white hover:bg-accent-muted'}`}
                >
                    {showForm ? <><X size={15} /> Đóng</> : <><Plus size={15} /> Ghi idea</>}
                </button>
            </div>

            {/* Quick Add Form */}
            {showForm && (
                <div className="bg-surface border border-edge rounded-2xl p-4 space-y-3 animate-fade-in">
                    <textarea
                        autoFocus
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ý tưởng, ghi chú, brain dump... gõ thoải mái ở đây 💡"
                        rows={3}
                        className="w-full bg-input border border-edge rounded-xl px-3 py-2.5 text-sm text-fg placeholder-secondary/60 focus:outline-none focus:border-accent resize-none"
                    />
                    {/* Category chips */}
                    <div className="flex flex-wrap gap-1.5">
                        {Object.entries(IDEA_CATEGORIES).map(([key, cat]) => (
                            <button
                                key={key}
                                onClick={() => setCategory(key)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border
                  ${category === key
                                        ? `${cat.bg} ${cat.text} ${cat.border}`
                                        : 'bg-input text-secondary border-transparent hover:bg-hover'}`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleAdd}
                            disabled={!content.trim()}
                            className="flex-1 h-10 bg-accent hover:bg-accent-muted disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors"
                        >
                            Lưu idea
                        </button>
                        <p className="text-[10px] text-secondary/50 self-center">Ctrl+Enter</p>
                    </div>
                </div>
            )}

            {/* Status tabs + Category filter */}
            <div className="space-y-3">
                {/* Status tabs */}
                <div className="flex gap-1.5">
                    {STATUS_TABS.map(tab => (
                        <button
                            key={tab.value}
                            onClick={() => setStatusFilter(tab.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                ${statusFilter === tab.value
                                    ? 'bg-accent text-white'
                                    : 'bg-input text-secondary hover:bg-hover'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Category filter */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    <Filter size={13} className="text-secondary shrink-0" />
                    <button
                        onClick={() => setCatFilter('all')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap border
              ${catFilter === 'all'
                                ? 'bg-accent/10 text-accent border-accent/30'
                                : 'bg-input text-secondary border-transparent hover:bg-hover'}`}
                    >
                        Tất cả ({catCounts.all})
                    </button>
                    {Object.entries(IDEA_CATEGORIES).map(([key, cat]) => (
                        <button
                            key={key}
                            onClick={() => setCatFilter(key)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap border
                ${catFilter === key
                                    ? `${cat.bg} ${cat.text} ${cat.border}`
                                    : 'bg-input text-secondary border-transparent hover:bg-hover'}`}
                        >
                            {cat.label} ({catCounts[key] || 0})
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="flex items-center gap-2 bg-input border border-edge rounded-xl px-3 py-2 focus-within:border-accent transition-colors">
                    <Search size={14} className="text-secondary shrink-0" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Tìm idea..."
                        className="flex-1 bg-transparent text-sm text-fg placeholder-secondary/60 focus:outline-none"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="text-secondary hover:text-fg">
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Ideas list */}
            <div className="space-y-2">
                {filtered.length === 0 && (
                    <div className="text-center py-12 text-secondary">
                        <Lightbulb size={40} className="mx-auto mb-3 opacity-20" />
                        <p className="text-sm">Chưa có idea nào{catFilter !== 'all' ? ' trong danh mục này' : ''}.</p>
                        <p className="text-xs mt-1">Bấm "Ghi idea" để bắt đầu brain dump! 🧠</p>
                    </div>
                )}

                {filtered.map(idea => {
                    const cat = IDEA_CATEGORIES[idea.category] || IDEA_CATEGORIES.random
                    const isEditing = editId === idea.id
                    const isEnriching = enrichingId === idea.id
                    const hasEnrichment = !!idea.enrichment
                    const isEnrichExpanded = expandedEnrichId === idea.id

                    return (
                        <div
                            key={idea.id}
                            className={`group bg-surface border rounded-xl overflow-hidden transition-all hover:shadow-sm
                ${idea.pinned ? 'border-amber-500/30 bg-amber-500/[0.03]' : 'border-edge hover:border-edge-2'}`}
                        >
                            {/* Category bar */}
                            <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cat.bg} ${cat.text}`}>
                                    {cat.label}
                                </span>
                                {idea.pinned ? (
                                    <Pin size={11} className="text-amber-400" />
                                ) : null}
                                {hasEnrichment && (
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400">
                                        ✨ Enriched
                                    </span>
                                )}
                                {idea.enrichment?.effortLevel && (
                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${EFFORT_COLORS[idea.enrichment.effortLevel]?.bg} ${EFFORT_COLORS[idea.enrichment.effortLevel]?.text}`}>
                                        {EFFORT_COLORS[idea.enrichment.effortLevel]?.label}
                                    </span>
                                )}
                                <span className="text-[10px] text-secondary/50 ml-auto">
                                    {formatDistanceToNow(new Date(idea.createdAt), { addSuffix: true, locale: vi })}
                                </span>
                            </div>

                            {/* Content */}
                            {isEditing ? (
                                <div className="px-3 pb-2">
                                    <textarea
                                        autoFocus
                                        value={editContent}
                                        onChange={e => setEditContent(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleEditSave(idea.id) }}
                                        rows={3}
                                        className="w-full bg-input border border-accent rounded-lg px-2.5 py-2 text-sm text-fg focus:outline-none resize-none"
                                    />
                                    <div className="flex gap-1.5 mt-1.5">
                                        <button
                                            onClick={() => handleEditSave(idea.id)}
                                            className="h-7 px-3 bg-accent text-white rounded-lg text-xs font-semibold"
                                        >
                                            Lưu
                                        </button>
                                        <button
                                            onClick={() => setEditId(null)}
                                            className="h-7 px-3 bg-input text-secondary rounded-lg text-xs"
                                        >
                                            Hủy
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <p
                                    className="px-3 pb-1.5 text-sm text-fg leading-relaxed whitespace-pre-wrap cursor-pointer hover:bg-hover/30 transition-colors"
                                    onClick={() => { setEditId(idea.id); setEditContent(idea.content) }}
                                    title="Click để sửa"
                                >
                                    {idea.content}
                                </p>
                            )}

                            {/* Enrichment panel */}
                            {hasEnrichment && (
                                <div className="px-3 pb-1">
                                    <button
                                        onClick={() => setExpandedEnrichId(isEnrichExpanded ? null : idea.id)}
                                        className="flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 font-medium transition-colors"
                                    >
                                        {isEnrichExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                        {isEnrichExpanded ? 'Ẩn chi tiết' : 'Xem AI analysis'}
                                    </button>

                                    {isEnrichExpanded && (
                                        <div className="mt-2 mb-1 bg-violet-500/5 border border-violet-500/15 rounded-lg p-2.5 space-y-2 animate-fade-in">
                                            {/* Expanded Notes */}
                                            {idea.enrichment.expandedNotes && (
                                                <div>
                                                    <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-0.5">📝 Phân tích</p>
                                                    <p className="text-xs text-fg-2 leading-relaxed">{idea.enrichment.expandedNotes}</p>
                                                </div>
                                            )}

                                            {/* Action Items */}
                                            {idea.enrichment.actionItems?.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-0.5">🎯 Bước tiếp theo</p>
                                                    <ul className="space-y-0.5">
                                                        {idea.enrichment.actionItems.map((item, i) => (
                                                            <li key={i} className="text-xs text-fg-2 flex items-start gap-1.5">
                                                                <span className="text-violet-400 shrink-0 mt-0.5">•</span>
                                                                {item}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {/* Meta row */}
                                            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-violet-500/10">
                                                {idea.enrichment.effortDescription && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-input text-secondary">
                                                        ⏱️ {idea.enrichment.effortDescription}
                                                    </span>
                                                )}
                                                {idea.enrichment.suggestedGoalCategory && idea.enrichment.suggestedGoalCategory !== 'null' && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                                                        🎯 Goal: {GOAL_CATEGORIES[idea.enrichment.suggestedGoalCategory]?.label || idea.enrichment.suggestedGoalCategory}
                                                    </span>
                                                )}
                                                {idea.enrichment.potentialImpact && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">
                                                        💥 {idea.enrichment.potentialImpact}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-0.5 px-2 pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {/* AI Enrich */}
                                <button
                                    onClick={() => handleEnrich(idea.id)}
                                    disabled={isEnriching}
                                    className="p-1.5 rounded-lg text-secondary hover:text-violet-400 hover:bg-violet-500/10 transition-colors disabled:opacity-40"
                                    title="AI Enrich — phân tích & mở rộng idea"
                                >
                                    {isEnriching ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                                </button>
                                {/* Pin */}
                                <button
                                    onClick={() => togglePin(idea.id)}
                                    className="p-1.5 rounded-lg text-secondary hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                                    title={idea.pinned ? 'Bỏ ghim' : 'Ghim'}
                                >
                                    {idea.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                                </button>
                                {/* Convert to Task */}
                                <button
                                    onClick={() => handleConvert(idea.id)}
                                    className="p-1.5 rounded-lg text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
                                    title="Chuyển thành Task"
                                >
                                    <ArrowRightCircle size={13} />
                                </button>
                                {/* Convert to Goal */}
                                <button
                                    onClick={() => handleConvertToGoal(idea.id)}
                                    className="p-1.5 rounded-lg text-secondary hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                                    title="Chuyển thành Goal 🎯"
                                >
                                    <Target size={13} />
                                </button>
                                {/* Archive / Restore */}
                                {idea.status === 'active' ? (
                                    <button
                                        onClick={() => archiveIdea(idea.id)}
                                        className="p-1.5 rounded-lg text-secondary hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                                        title="Archive"
                                    >
                                        <Archive size={13} />
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => updateIdea(idea.id, { status: 'active' })}
                                        className="p-1.5 rounded-lg text-secondary hover:text-green-400 hover:bg-green-500/10 transition-colors text-xs font-medium"
                                        title="Khôi phục"
                                    >
                                        ↩
                                    </button>
                                )}
                                {/* Delete */}
                                <button
                                    onClick={() => { if (confirm('Xóa idea này?')) deleteIdea(idea.id) }}
                                    className="p-1.5 rounded-lg text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                    title="Xóa"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Goal Form Sheet */}
            <Sheet open={showGoalForm} onClose={() => setShowGoalForm(false)} title="Tạo Goal từ Idea 🎯">
                <div className="p-4 space-y-4">
                    <div>
                        <label className="text-xs text-secondary mb-1.5 block">Tên Goal</label>
                        <input
                            value={goalFormData.title}
                            onChange={e => setGoalFormData(f => ({ ...f, title: e.target.value }))}
                            placeholder="Tên goal (ví dụ: Freelance $1000/tháng)"
                            autoFocus
                            className="w-full bg-input border border-edge-2 rounded-xl px-4 py-3 text-fg placeholder-secondary text-[16px] focus:outline-none focus:border-accent"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-secondary mb-1.5 block">Category</label>
                            <select
                                value={goalFormData.category}
                                onChange={e => setGoalFormData(f => ({ ...f, category: e.target.value }))}
                                className="w-full bg-input border border-edge-2 rounded-xl px-3 py-2.5 text-fg text-sm focus:outline-none"
                            >
                                {Object.entries(GOAL_CATEGORIES).map(([k, v]) => (
                                    <option key={k} value={k}>{v.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-secondary mb-1.5 block">Deadline</label>
                            <input
                                type="date"
                                value={goalFormData.deadline}
                                onChange={e => setGoalFormData(f => ({ ...f, deadline: e.target.value }))}
                                className="w-full bg-input border border-edge-2 rounded-xl px-3 py-2.5 text-fg text-sm focus:outline-none"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleGoalSave}
                        disabled={!goalFormData.title.trim()}
                        className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                    >
                        <Target size={15} />
                        Tạo Goal
                    </button>
                </div>
            </Sheet>
        </div>
    )
}
