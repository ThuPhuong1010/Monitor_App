import { create } from 'zustand'
import { db } from '../services/db'
import { syncToCloud, deleteFromCloud } from '../services/supabase'

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
      cloudId: crypto.randomUUID(),
      status: 'active',
      progress: 0,
      createdAt: new Date().toISOString(),
    })
    const newGoal = await db.goals.get(id)
    set(s => ({ goals: [newGoal, ...s.goals] }))
    syncToCloud('goals', newGoal).catch(() => {})
    return id
  },

  updateGoal: async (id, changes) => {
    await db.goals.update(id, changes)
    const updated = { ...get().goals.find(g => g.id === id), ...changes }
    set(s => ({ goals: s.goals.map(g => g.id === id ? updated : g) }))
    syncToCloud('goals', updated).catch(() => {})
  },

  addMilestone: async (goalId, title) => {
    const id = await db.milestones.add({
      goalId,
      title,
      cloudId: crypto.randomUUID(),
      status: 'todo',
      createdAt: new Date().toISOString(),
    })
    const m = await db.milestones.get(id)
    set(s => ({ milestones: [...s.milestones, m] }))
    await get().recalcProgress(goalId)
    const goal = get().goals.find(g => g.id === goalId)
    syncToCloud('milestones', m, goal?.cloudId ? { goal_id: goal.cloudId } : {}).catch(() => {})
  },

  toggleMilestone: async (id) => {
    const m = await db.milestones.get(id)
    const newStatus = m.status === 'done' ? 'todo' : 'done'
    await db.milestones.update(id, { status: newStatus })
    set(s => ({ milestones: s.milestones.map(ms => ms.id === id ? { ...ms, status: newStatus } : ms) }))
    await get().recalcProgress(m.goalId)
    const goal = get().goals.find(g => g.id === m.goalId)
    const updated = { ...m, status: newStatus }
    syncToCloud('milestones', updated, goal?.cloudId ? { goal_id: goal.cloudId } : {}).catch(() => {})
  },

  recalcProgress: async (goalId) => {
    const all = await db.milestones.where('goalId').equals(goalId).toArray()
    const done = all.filter(m => m.status === 'done').length
    const progress = all.length ? Math.round((done / all.length) * 100) : 0
    await db.goals.update(goalId, { progress })
    set(s => ({ goals: s.goals.map(g => g.id === goalId ? { ...g, progress } : g) }))
    // get() after set() returns the freshly updated goal
    const goal = get().goals.find(g => g.id === goalId)
    if (goal) syncToCloud('goals', goal).catch(() => {})
  },

  getMilestonesForGoal: (goalId) => {
    return get().milestones.filter(m => m.goalId === goalId)
  },
}))
