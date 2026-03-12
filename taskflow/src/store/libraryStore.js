import { create } from 'zustand'
import { db } from '../services/db'
import { summarizeUrl } from '../services/ai'
import { syncToCloud, deleteFromCloud } from '../services/supabase'

export const useLibraryStore = create((set, get) => ({
  resources: [],
  loading: false,

  load: async () => {
    const resources = await db.resources.orderBy('createdAt').reverse().toArray()
    set({ resources })
  },

  saveUrl: async (url, { title: manualTitle, reason, skipAI } = {}) => {
    set({ loading: true })
    let meta = { title: url, summary: '', tags: [], readingMinutes: null }
    if (!skipAI) {
      try {
        meta = await summarizeUrl(url)
      } catch (e) {
        console.warn('AI summary failed:', e.message)
      }
    }
    const id = await db.resources.add({
      url,
      title: manualTitle?.trim() || meta.title || url,
      summary: meta.summary || '',
      tags: meta.tags || [],
      readingMinutes: meta.readingMinutes || null,
      reason: reason?.trim() || '',
      cloudId: crypto.randomUUID(),
      status: 'toread',
      notes: '',
      createdAt: new Date().toISOString(),
    })
    const r = await db.resources.get(id)
    set(s => ({ resources: [r, ...s.resources], loading: false }))
    syncToCloud('resources', r).catch(() => { })
  },

  updateResource: async (id, changes) => {
    await db.resources.update(id, changes)
    const updated = { ...get().resources.find(r => r.id === id), ...changes }
    set(s => ({ resources: s.resources.map(r => r.id === id ? updated : r) }))
    syncToCloud('resources', updated).catch(() => { })
  },

  updateStatus: async (id, status) => {
    await db.resources.update(id, { status })
    const updated = { ...get().resources.find(r => r.id === id), status }
    set(s => ({ resources: s.resources.map(r => r.id === id ? updated : r) }))
    syncToCloud('resources', updated).catch(() => { })
  },

  deleteResource: async (id) => {
    const r = get().resources.find(r => r.id === id)
    await db.resources.delete(id)
    set(s => ({ resources: s.resources.filter(r => r.id !== id) }))
    deleteFromCloud('resources', r?.cloudId).catch(() => { })
  },

  // Convert resource → Task
  convertToTask: (resource) => {
    return {
      title: `📖 ${resource.title}`,
      category: 'personal',
      priority: 'p2',
      notes: [
        resource.reason ? `Lý do: ${resource.reason}` : '',
        resource.summary ? `Tóm tắt: ${resource.summary}` : '',
        `🔗 ${resource.url}`,
      ].filter(Boolean).join('\n'),
    }
  },

  // Convert resource → Goal
  convertToGoal: (resource) => {
    return {
      title: resource.title,
      category: 'personal',
      notes: [
        resource.reason ? `Lý do: ${resource.reason}` : '',
        resource.summary ? `Tóm tắt: ${resource.summary}` : '',
        `🔗 ${resource.url}`,
      ].filter(Boolean).join('\n'),
    }
  },
}))
