import Dexie from 'dexie'

export const db = new Dexie('taskflow')

db.version(1).stores({
  tasks: '++id, category, priority, status, deadline, goalId, createdAt',
  goals: '++id, category, status, deadline, createdAt',
  milestones: '++id, goalId, status',
  resources: '++id, status, createdAt',
  settings: 'key',
  focusHistory: '++id, date',
})

// v2: adds estimatedMinutes (unindexed)
db.version(2).stores({
  tasks: '++id, category, priority, status, deadline, goalId, createdAt',
  goals: '++id, category, status, deadline, createdAt',
  milestones: '++id, goalId, status',
  resources: '++id, status, createdAt',
  settings: 'key',
  focusHistory: '++id, date',
})

// v3: adds weeklyReviews + recurring/checklist on tasks (unindexed)
db.version(3).stores({
  tasks: '++id, category, priority, status, deadline, goalId, createdAt',
  goals: '++id, category, status, deadline, createdAt',
  milestones: '++id, goalId, status',
  resources: '++id, status, createdAt',
  settings: 'key',
  focusHistory: '++id, date',
  weeklyReviews: '++id, weekStart',
})

// v4: adds ideas (draft notes / brain dump)
db.version(4).stores({
  tasks: '++id, category, priority, status, deadline, goalId, createdAt',
  goals: '++id, category, status, deadline, createdAt',
  milestones: '++id, goalId, status',
  resources: '++id, status, createdAt',
  settings: 'key',
  focusHistory: '++id, date',
  weeklyReviews: '++id, weekStart',
  ideas: '++id, category, status, pinned, createdAt',
})

// Seed categories
export const CATEGORIES = {
  work: { label: 'Work', color: '#6366f1', bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  personal: { label: 'Personal', color: '#10b981', bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  finance: { label: 'Finance', color: '#f59e0b', bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
  adhoc: { label: 'Ad-hoc', color: '#8b5cf6', bg: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/30' },
}

export const PRIORITIES = {
  p0: { label: 'Gấp', color: 'text-red-400', bg: 'bg-red-500/20', dot: 'bg-red-500' },
  p1: { label: 'Cao', color: 'text-orange-400', bg: 'bg-orange-500/20', dot: 'bg-orange-500' },
  p2: { label: 'Vừa', color: 'text-yellow-400', bg: 'bg-yellow-500/20', dot: 'bg-yellow-500' },
  p3: { label: 'Thấp', color: 'text-slate-400', bg: 'bg-slate-500/20', dot: 'bg-slate-500' },
}

export const GOAL_CATEGORIES = {
  career: { label: 'Career', color: '#6366f1' },
  finance: { label: 'Finance', color: '#f59e0b' },
  health: { label: 'Health', color: '#10b981' },
  travel: { label: 'Travel', color: '#06b6d4' },
  learning: { label: 'Learning', color: '#8b5cf6' },
}

export const IDEA_CATEGORIES = {
  idea: { label: '💡 Idea', color: '#f59e0b', bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
  note: { label: '📝 Note', color: '#6366f1', bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  goal: { label: '🎯 Goal Seed', color: '#10b981', bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  random: { label: '💭 Random', color: '#8b5cf6', bg: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/30' },
  project: { label: '🚀 Project', color: '#06b6d4', bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30' },
}

export async function getSetting(key, defaultValue = null) {
  const row = await db.settings.get(key)
  return row ? row.value : defaultValue
}

export async function setSetting(key, value) {
  await db.settings.put({ key, value })
}
