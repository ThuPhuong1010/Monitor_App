import { create } from 'zustand'
import { db } from '../services/db'

export const useGoalStore = create((set, get) => ({
  goals: [],
  milestones: [],

  load: async () => {
    const goals = await db.goals.orderBy('createdAt').reverse().toArray()
    const milestones = await db.milestones.toArray()
    set({ goals, milestones })
  },

  addGoal: async (goal) => {
    const id = await db.goals.add({
      ...goal,
      status: 'active',
      progress: 0,
      createdAt: new Date().toISOString(),
    })
    const newGoal = await db.goals.get(id)
    set(s => ({ goals: [newGoal, ...s.goals] }))
    return id
  },

  updateGoal: async (id, changes) => {
    await db.goals.update(id, changes)
    set(s => ({ goals: s.goals.map(g => g.id === id ? { ...g, ...changes } : g) }))
  },

  addMilestone: async (goalId, title) => {
    const id = await db.milestones.add({ goalId, title, status: 'todo', createdAt: new Date().toISOString() })
    const m = await db.milestones.get(id)
    set(s => ({ milestones: [...s.milestones, m] }))
    await get().recalcProgress(goalId)
  },

  toggleMilestone: async (id) => {
    const m = await db.milestones.get(id)
    const newStatus = m.status === 'done' ? 'todo' : 'done'
    await db.milestones.update(id, { status: newStatus })
    set(s => ({ milestones: s.milestones.map(ms => ms.id === id ? { ...ms, status: newStatus } : ms) }))
    await get().recalcProgress(m.goalId)
  },

  recalcProgress: async (goalId) => {
    const all = await db.milestones.where('goalId').equals(goalId).toArray()
    const done = all.filter(m => m.status === 'done').length
    const progress = all.length ? Math.round((done / all.length) * 100) : 0
    await db.goals.update(goalId, { progress })
    set(s => ({ goals: s.goals.map(g => g.id === goalId ? { ...g, progress } : g) }))
  },

  getMilestonesForGoal: (goalId) => {
    return get().milestones.filter(m => m.goalId === goalId)
  },
}))
