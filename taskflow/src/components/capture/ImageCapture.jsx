import { useState, useRef } from 'react'
import { Camera, Upload, X, Check, Loader2, Image as ImageIcon, Trash2, ChevronDown, ChevronUp, Sparkles, Lightbulb } from 'lucide-react'
import { analyzeImageForTasks } from '../../services/ai'
import { useTaskStore } from '../../store/taskStore'
import { useIdeaStore } from '../../store/ideaStore'
import { CATEGORIES, PRIORITIES } from '../../services/db'

const PRIORITY_COLORS = {
    p0: 'text-red-400',
    p1: 'text-orange-400',
    p2: 'text-yellow-400',
    p3: 'text-slate-400',
}

export default function ImageCapture() {
    const [imageData, setImageData] = useState(null) // { base64, mimeType, preview }
    const [analyzing, setAnalyzing] = useState(false)
    const [result, setResult] = useState(null) // { description, tasks, ideas }
    const [error, setError] = useState('')
    const [savedCount, setSavedCount] = useState(0)
    const [expanded, setExpanded] = useState(false)

    const fileRef = useRef(null)
    const addTask = useTaskStore(s => s.addTask)
    const addTasks = useTaskStore(s => s.addTasks)
    const addIdea = useIdeaStore(s => s.addIdea)

    const handleFile = (file) => {
        if (!file) return
        if (!file.type.startsWith('image/')) {
            setError('Chỉ hỗ trợ file ảnh (jpg, png, webp, ...)')
            return
        }
        // Max 10MB
        if (file.size > 10 * 1024 * 1024) {
            setError('Ảnh quá lớn (max 10MB)')
            return
        }

        const reader = new FileReader()
        reader.onload = () => {
            const base64Full = reader.result
            // Extract base64 and mime type
            const [meta, base64] = base64Full.split(',')
            const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/jpeg'
            setImageData({ base64, mimeType, preview: base64Full })
            setResult(null)
            setError('')
            setSavedCount(0)
        }
        reader.readAsDataURL(file)
    }

    const handleDrop = (e) => {
        e.preventDefault()
        e.stopPropagation()
        const file = e.dataTransfer?.files?.[0]
        if (file) handleFile(file)
    }

    const handlePaste = (e) => {
        const items = e.clipboardData?.items
        if (!items) return
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault()
                handleFile(item.getAsFile())
                return
            }
        }
    }

    const handleAnalyze = async () => {
        if (!imageData) return
        setAnalyzing(true)
        setError('')
        setResult(null)
        try {
            const data = await analyzeImageForTasks(imageData.base64, imageData.mimeType)
            setResult(data)
        } catch (e) {
            setError(e.message === 'NO_API_KEY' ? 'Chưa có API key — vào Settings để thêm.' : `Lỗi: ${e.message}`)
        } finally {
            setAnalyzing(false)
        }
    }

    const handleRemoveTask = (index) => {
        setResult(prev => ({
            ...prev,
            tasks: prev.tasks.filter((_, i) => i !== index),
        }))
    }

    const handleRemoveIdea = (index) => {
        setResult(prev => ({
            ...prev,
            ideas: prev.ideas.filter((_, i) => i !== index),
        }))
    }

    const handleApplyAll = async () => {
        if (!result) return
        let count = 0

        // Add tasks
        if (result.tasks?.length > 0) {
            const tasksToAdd = result.tasks.map(t => ({
                title: t.title,
                category: t.category || 'adhoc',
                priority: t.priority || 'p2',
                deadline: t.deadline || null,
                estimatedMinutes: t.estimatedMinutes || null,
                notes: t.notes || '',
            }))
            await addTasks(tasksToAdd)
            count += tasksToAdd.length
        }

        // Add ideas
        if (result.ideas?.length > 0) {
            for (const idea of result.ideas) {
                await addIdea({
                    content: idea.content,
                    category: idea.category || 'random',
                })
                count++
            }
        }

        setSavedCount(count)
        setTimeout(() => {
            setResult(null)
            setImageData(null)
            setSavedCount(0)
        }, 2000)
    }

    const handleClear = () => {
        setImageData(null)
        setResult(null)
        setError('')
        setSavedCount(0)
    }

    const totalItems = (result?.tasks?.length || 0) + (result?.ideas?.length || 0)

    // Collapsed mode: just the trigger button
    if (!expanded) {
        return (
            <button
                onClick={() => setExpanded(true)}
                onPaste={handlePaste}
                className="w-full bg-surface border border-dashed border-edge-2 rounded-2xl p-4 flex items-center gap-3 text-left hover:border-accent/40 hover:bg-accent/[0.02] transition-all group"
            >
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0 group-hover:bg-violet-500/15 transition-colors">
                    <Camera size={18} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-fg">📸 Scan ảnh → Tasks</p>
                    <p className="text-[11px] text-secondary mt-0.5">Chụp/paste ảnh whiteboard, notes, screenshot — AI extract tasks tự động</p>
                </div>
                <Sparkles size={14} className="text-violet-400/50 shrink-0" />
            </button>
        )
    }

    return (
        <div
            className="bg-surface border border-edge rounded-2xl overflow-hidden"
            onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
            onDrop={handleDrop}
            onPaste={handlePaste}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <div className="flex items-center gap-2">
                    <Camera size={15} className="text-violet-400" />
                    <span className="text-sm font-semibold text-fg">📸 Scan ảnh → Tasks</span>
                </div>
                <button
                    onClick={() => { setExpanded(false); handleClear() }}
                    className="text-secondary hover:text-fg p-1 rounded-lg hover:bg-hover transition-colors"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Upload zone */}
            {!imageData ? (
                <div className="px-4 pb-4">
                    <label
                        className="block border-2 border-dashed border-edge-2 rounded-xl p-6 text-center cursor-pointer hover:border-violet-500/40 hover:bg-violet-500/[0.02] transition-all"
                    >
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={e => handleFile(e.target.files?.[0])}
                            className="hidden"
                        />
                        <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center mx-auto mb-3">
                            <Upload size={20} className="text-violet-400" />
                        </div>
                        <p className="text-sm font-medium text-fg">Kéo thả, chọn ảnh, hoặc Ctrl+V paste</p>
                        <p className="text-[11px] text-secondary mt-1">
                            Hỗ trợ: Whiteboard, meeting notes, sticky notes, screenshot, tài liệu, mindmap...
                        </p>
                        <div className="flex items-center justify-center gap-3 mt-3">
                            <span className="text-[10px] text-secondary/60 bg-input px-2 py-1 rounded">📷 Camera</span>
                            <span className="text-[10px] text-secondary/60 bg-input px-2 py-1 rounded">🖼️ Gallery</span>
                            <span className="text-[10px] text-secondary/60 bg-input px-2 py-1 rounded">📋 Ctrl+V</span>
                        </div>
                    </label>
                </div>
            ) : (
                <div className="px-4 pb-4 space-y-3">
                    {/* Image preview */}
                    <div className="relative rounded-xl overflow-hidden border border-edge bg-black/20">
                        <img
                            src={imageData.preview}
                            alt="Uploaded"
                            className="w-full max-h-48 object-contain"
                        />
                        <button
                            onClick={handleClear}
                            className="absolute top-2 right-2 w-7 h-7 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-black/80 transition-colors"
                        >
                            <X size={14} />
                        </button>
                        {analyzing && (
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                                <div className="flex items-center gap-2 bg-surface/90 rounded-xl px-4 py-2">
                                    <Loader2 size={16} className="animate-spin text-violet-400" />
                                    <span className="text-sm font-medium text-fg">AI đang phân tích...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Analyze button */}
                    {!result && !analyzing && (
                        <button
                            onClick={handleAnalyze}
                            className="w-full h-10 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                        >
                            <Sparkles size={14} />
                            AI Phân tích ảnh
                        </button>
                    )}

                    {/* Error */}
                    {error && (
                        <p className="text-xs text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
                    )}

                    {/* Results */}
                    {result && (
                        <div className="space-y-3">
                            {/* Description */}
                            {result.description && (
                                <div className="bg-violet-500/5 border border-violet-500/15 rounded-lg px-3 py-2">
                                    <p className="text-[11px] font-bold text-violet-400 uppercase tracking-wider mb-0.5">📋 AI nhận diện</p>
                                    <p className="text-xs text-fg-2 leading-relaxed">{result.description}</p>
                                </div>
                            )}

                            {/* Tasks */}
                            {result.tasks?.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-[11px] font-bold text-accent uppercase tracking-wider">
                                        📋 Tasks ({result.tasks.length})
                                    </p>
                                    {result.tasks.map((t, i) => (
                                        <div key={i} className="flex items-start gap-2 bg-input rounded-lg px-2.5 py-2 border border-edge group/item">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium text-fg">{t.title}</p>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    <span className={`text-[9px] font-semibold ${PRIORITY_COLORS[t.priority] || 'text-secondary'}`}>
                                                        {PRIORITIES[t.priority]?.label || t.priority}
                                                    </span>
                                                    <span className="text-[9px] text-secondary/60">•</span>
                                                    <span className="text-[9px]" style={{ color: CATEGORIES[t.category]?.color || '#888' }}>
                                                        {CATEGORIES[t.category]?.label || t.category}
                                                    </span>
                                                    {t.deadline && (
                                                        <>
                                                            <span className="text-[9px] text-secondary/60">•</span>
                                                            <span className="text-[9px] text-accent">📅 {t.deadline}</span>
                                                        </>
                                                    )}
                                                    {t.estimatedMinutes && (
                                                        <>
                                                            <span className="text-[9px] text-secondary/60">•</span>
                                                            <span className="text-[9px] text-secondary">⏱️ {t.estimatedMinutes}m</span>
                                                        </>
                                                    )}
                                                </div>
                                                {t.notes && (
                                                    <p className="text-[10px] text-secondary/70 mt-0.5 italic">{t.notes}</p>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleRemoveTask(i)}
                                                className="text-secondary/30 hover:text-red-400 shrink-0 mt-0.5 opacity-0 group-hover/item:opacity-100 transition-all"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Ideas */}
                            {result.ideas?.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                                        💡 Ideas / Notes ({result.ideas.length})
                                    </p>
                                    {result.ideas.map((idea, i) => (
                                        <div key={i} className="flex items-start gap-2 bg-amber-500/[0.03] border border-amber-500/15 rounded-lg px-2.5 py-2 group/item">
                                            <Lightbulb size={12} className="text-amber-400 shrink-0 mt-0.5" />
                                            <p className="text-xs text-fg-2 flex-1">{idea.content}</p>
                                            <button
                                                onClick={() => handleRemoveIdea(i)}
                                                className="text-secondary/30 hover:text-red-400 shrink-0 opacity-0 group-hover/item:opacity-100 transition-all"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* No results */}
                            {totalItems === 0 && (
                                <p className="text-xs text-secondary text-center py-3">Không tìm thấy task hay idea nào trong ảnh.</p>
                            )}

                            {/* Action bar */}
                            {totalItems > 0 && (
                                <div className="flex gap-2">
                                    {savedCount > 0 ? (
                                        <div className="flex-1 h-10 bg-green-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                                            <Check size={14} />
                                            Đã lưu {savedCount} items!
                                        </div>
                                    ) : (
                                        <>
                                            <button
                                                onClick={handleApplyAll}
                                                className="flex-1 h-10 bg-accent hover:bg-accent-muted text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                                            >
                                                <Check size={14} />
                                                Tạo {result.tasks?.length || 0} tasks{result.ideas?.length > 0 ? ` + ${result.ideas.length} ideas` : ''}
                                            </button>
                                            <button
                                                onClick={() => { setResult(null); setImageData(null) }}
                                                className="h-10 px-4 bg-input hover:bg-hover text-secondary rounded-xl text-xs font-medium transition-colors"
                                            >
                                                Hủy
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Retry */}
                            <button
                                onClick={handleAnalyze}
                                disabled={analyzing}
                                className="w-full text-[11px] text-secondary hover:text-fg text-center py-1 transition-colors"
                            >
                                🔄 Phân tích lại
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
