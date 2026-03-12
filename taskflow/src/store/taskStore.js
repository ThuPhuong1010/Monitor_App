import { create } from 'zustand'
import { db } from '../services/db'
import { notifyTaskDone } from '../services/telegram'
import { syncToCloud, deleteFromCloud } from '../services/supabase'

export const useTaskStore = create((set, get) => ({
  tasks: [],
  focusTasks: [], // max 3 ids
  loading: false,

  load: async () => {
    const tasks = await db.tasks.orderBy('createdAt').reverse().toArray()
    const today = new Date().toISOString().slice(0, 10)

    // Load today's focus
    const history = await db.focusHistory.where('date').equals(today).first()
    set({ tasks, focusTasks: history?.taskIds || [] })
  },

  addTask: async (task) => {
    const now = new Date().toISOString()
    const id = await db.tasks.add({
      ...task,
      cloudId: crypto.randomUUID(),
      status: 'todo',
      progress: 0,
      createdAt: now,
    })
    const newTask = await db.tasks.get(id)
    set(s => ({ tasks: [newTask, ...s.tasks] }))
    // Resolve goalId (int) → goal's cloudId (UUID) for Supabase FK
    const goalCloudId = task.goalId
      ? (await db.goals.get(task.goalId))?.cloudId ?? null
      : null
    syncToCloud('tasks', newTask, goalCloudId ? { goal_id: goalCloudId } : {}).catch(() => {})
    return id
  },

  addTasks: async (taskList) => {
    const now = new Date().toISOString()
    const ids = await db.tasks.bulkAdd(
      taskList.map(t => ({ ...t, cloudId: crypto.randomUUID(), status: 'todo', progress: 0, createdAt: now })),
      { allKeys: true }
    )
    const newTasks = await db.tasks.bulkGet(ids)
    set(s => ({ tasks: [...newTasks, ...s.tasks] }))
    newTasks.forEach(t => syncToCloud('tasks', t).catch(() => {}))
  },

  updateTask: async (id, changes) => {
    await db.tasks.update(id, changes)
    const existing = get().tasks.find(t => t.id === id)
    const updated = { ...existing, ...changes }
    set(s => ({
      tasks: s.tasks.map(t => t.id === id ? updated : t),
    }))
    syncToCloud('tasks', updated).catch(() => {})
  },

  deleteTask: async (id) => {
    const task = get().tasks.find(t => t.id === id)
    await db.tasks.delete(id)
    set(s => ({
      tasks: s.tasks.filter(t => t.id !== id),
      focusTasks: s.focusTasks.filter(fid => fid !== id),
    }))
    deleteFromCloud('tasks', task?.cloudId).catch(() => {})
  },

  markDone: async (id) => {
    const now = new Date().toISOString()
    await db.tasks.update(id, { status: 'done', doneAt: now, progress: 100 })
    const task = await db.tasks.get(id)
    set(s => ({
      tasks: s.tasks.map(t => t.id === id ? { ...t, status: 'done', doneAt: now, progress: 100 } : t),
    }))
    notifyTaskDone(task).catch(() => {})
    syncToCloud('tasks', task).catch(() => {})

    // Auto-create next occurrence for recurring tasks
    if (task?.recurring && task?.deadline) {
      const next = new Date(task.deadline)
      if (task.recurring === 'daily') next.setDate(next.getDate() + 1)
      else if (task.recurring === 'weekly') next.setDate(next.getDate() + 7)
      else if (task.recurring === 'monthly') next.setMonth(next.getMonth() + 1)
      const nextId = await db.tasks.add({
        title: task.title,
        category: task.category,
        priority: task.priority,
        notes: task.notes || null,
        estimatedMinutes: task.estimatedMinutes || null,
        recurring: task.recurring,
        checklist: task.checklist
          ? task.checklist.map(item => ({ ...item, done: false }))
          : null,
        deadline: next.toISOString().slice(0, 10),
        goalId: task.goalId || null,
        cloudId: crypto.randomUUID(),
        status: 'todo',
        progress: 0,
        createdAt: now,
      })
      const nextTask = await db.tasks.get(nextId)
      set(s => ({ tasks: [nextTask, ...s.tasks] }))
      syncToCloud('tasks', nextTask).catch(() => {})
    }
  },

  setFocus: async (taskIds) => {
    const today = new Date().toISOString().slice(0, 10)
    const existing = await db.focusHistory.where('date').equals(today).first()
    if (existing) {
      await db.focusHistory.update(existing.id, { taskIds })
    } else {
      await db.focusHistory.add({ date: today, taskIds })
    }
    set({ focusTasks: taskIds })
  },

  addToFocus: async (taskId) => {
    const { focusTasks, setFocus } = get()
    if (focusTasks.includes(taskId) || focusTasks.length >= 3) return false
    await setFocus([...focusTasks, taskId])
    return true
  },

  removeFromFocus: async (taskId) => {
    const { focusTasks, setFocus } = get()
    await setFocus(focusTasks.filter(id => id !== taskId))
  },

}))
