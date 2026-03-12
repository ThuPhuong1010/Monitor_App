import { create } from 'zustand'

export const useUIStore = create(set => ({
  taskCaptureOpen: false,
  ideaCaptureOpen: false,
  shortcutsOpen: false,

  openTaskCapture: () => set({ taskCaptureOpen: true }),
  closeTaskCapture: () => set({ taskCaptureOpen: false }),

  openIdeaCapture: () => set({ ideaCaptureOpen: true }),
  closeIdeaCapture: () => set({ ideaCaptureOpen: false }),

  toggleShortcuts: () => set(s => ({ shortcutsOpen: !s.shortcutsOpen })),
  closeShortcuts: () => set({ shortcutsOpen: false }),
}))
