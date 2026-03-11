import { create } from 'zustand'
import { db } from '../services/db'
import { notifyTaskDone } from '../services/telegram'

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
    const id = await db.tasks.add({
      ...task,
      status: 'todo',
      progress: 0,
      createdAt: new Date().toISOString(),
    })
    const newTask = await db.tasks.get(id)
    set(s => ({ tasks: [newTask, ...s.tasks] }))
    return id
  },

  addTasks: async (taskList) => {
    const now = new Date().toISOString()
    const ids = await db.tasks.bulkAdd(
      taskList.map(t => ({ ...t, status: 'todo', progress: 0, createdAt: now })),
      { allKeys: true }
    )
    const newTasks = await db.tasks.bulkGet(ids)
    set(s => ({ tasks: [...newTasks, ...s.tasks] }))
  },

  updateTask: async (id, changes) => {
    await db.tasks.update(id, changes)
    set(s => ({
      tasks: s.tasks.map(t => t.id === id ? { ...t, ...changes } : t),
    }))
  },

  deleteTask: async (id) => {
    await db.tasks.delete(id)
    set(s => ({
      tasks: s.tasks.filter(t => t.id !== id),
      focusTasks: s.focusTasks.filter(fid => fid !== id),
    }))
  },

  markDone: async (id) => {
    const now = new Date().toISOString()
    await db.tasks.update(id, { status: 'done', doneAt: now, progress: 100 })
    const task = await db.tasks.get(id)
    set(s => ({
      tasks: s.tasks.map(t => t.id === id ? { ...t, status: 'done', doneAt: now, progress: 100 } : t),
    }))
    notifyTaskDone(task).catch(() => {})

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
        status: 'todo',
        progress: 0,
        createdAt: now,
      })
      const nextTask = await db.tasks.get(nextId)
      set(s => ({ tasks: [nextTask, ...s.tasks] }))
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
