import { create } from 'zustand'
import { db } from '../services/db'
import { syncToCloud, deleteFromCloud } from '../services/supabase'

export const useIdeaStore = create((set, get) => ({
    ideas: [],
    loading: false,

    load: async () => {
        const ideas = await db.ideas.orderBy('createdAt').reverse().toArray()
        set({ ideas })
    },

    addIdea: async (idea) => {
        const id = await db.ideas.add({
            ...idea,
            cloudId: crypto.randomUUID(),
            status: 'active',
            pinned: 0,
            createdAt: new Date().toISOString(),
        })
        const newIdea = await db.ideas.get(id)
        set(s => ({ ideas: [newIdea, ...s.ideas] }))
        syncToCloud('ideas', newIdea, { pinned: false }).catch(() => {})
        return id
    },

    updateIdea: async (id, changes) => {
        await db.ideas.update(id, changes)
        const updated = { ...get().ideas.find(i => i.id === id), ...changes }
        set(s => ({
            ideas: s.ideas.map(i => i.id === id ? updated : i),
        }))
        syncToCloud('ideas', updated, { pinned: !!updated.pinned }).catch(() => {})
    },

    deleteIdea: async (id) => {
        const idea = get().ideas.find(i => i.id === id)
        await db.ideas.delete(id)
        set(s => ({ ideas: s.ideas.filter(i => i.id !== id) }))
        deleteFromCloud('ideas', idea?.cloudId).catch(() => {})
    },

    togglePin: async (id) => {
        const idea = get().ideas.find(i => i.id === id)
        if (!idea) return
        const pinned = idea.pinned ? 0 : 1
        await db.ideas.update(id, { pinned })
        const updated = { ...idea, pinned }
        set(s => ({
            ideas: s.ideas.map(i => i.id === id ? updated : i),
        }))
        syncToCloud('ideas', updated, { pinned: !!pinned }).catch(() => {})
    },

    archiveIdea: async (id) => {
        await db.ideas.update(id, { status: 'archived' })
        const updated = { ...get().ideas.find(i => i.id === id), status: 'archived' }
        set(s => ({
            ideas: s.ideas.map(i => i.id === id ? updated : i),
        }))
        syncToCloud('ideas', updated, { pinned: !!updated.pinned }).catch(() => {})
    },

    convertToTask: async (id) => {
        const idea = get().ideas.find(i => i.id === id)
        if (!idea) return null
        // Return the idea data so caller can create a task from it
        return {
            title: idea.content.slice(0, 100),
            notes: idea.content,
            category: 'adhoc',
            priority: 'p2',
        }
    },

    convertToGoal: async (id) => {
        const idea = get().ideas.find(i => i.id === id)
        if (!idea) return null
        // Map idea category to goal category
        const categoryMap = {
            idea: 'career',
            note: 'learning',
            goal: 'career',
            random: 'career',
            project: 'career',
        }
        return {
            title: idea.content.slice(0, 200),
            category: idea.enrichment?.suggestedGoalCategory || categoryMap[idea.category] || 'career',
        }
    },

    updateIdeaEnrichment: async (id, enrichment) => {
        await db.ideas.update(id, { enrichment })
        const updated = { ...get().ideas.find(i => i.id === id), enrichment }
        set(s => ({
            ideas: s.ideas.map(i => i.id === id ? updated : i),
        }))
        syncToCloud('ideas', updated, { pinned: !!updated.pinned }).catch(() => {})
    },
}))
