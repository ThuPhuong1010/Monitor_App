import { create } from 'zustand'
import { db } from '../services/db'
import { summarizeUrl } from '../services/ai'

export const useLibraryStore = create((set) => ({
  resources: [],
  loading: false,

  load: async () => {
    const resources = await db.resources.orderBy('createdAt').reverse().toArray()
    set({ resources })
  },

  saveUrl: async (url) => {
    set({ loading: true })
    let meta = { title: url, summary: '', tags: [], readingMinutes: null }
    try {
      meta = await summarizeUrl(url)
    } catch (e) {
      console.warn('AI summary failed:', e.message)
    }
    const id = await db.resources.add({
      url,
      title: meta.title || url,
      summary: meta.summary || '',
      tags: meta.tags || [],
      readingMinutes: meta.readingMinutes || null,
      status: 'toread',
      notes: '',
      createdAt: new Date().toISOString(),
    })
    const r = await db.resources.get(id)
    set(s => ({ resources: [r, ...s.resources], loading: false }))
  },

  updateStatus: async (id, status) => {
    await db.resources.update(id, { status })
    set(s => ({ resources: s.resources.map(r => r.id === id ? { ...r, status } : r) }))
  },

  deleteResource: async (id) => {
    await db.resources.delete(id)
    set(s => ({ resources: s.resources.filter(r => r.id !== id) }))
  },
}))
