import { create } from 'zustand'

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('tf-theme', theme)
}

export const useThemeStore = create((set) => ({
  theme: 'light',

  init: () => {
    const saved = localStorage.getItem('tf-theme') || 'light'
    applyTheme(saved)
    set({ theme: saved })
  },

  setTheme: (theme) => {
    applyTheme(theme)
    set({ theme })
  },

  toggle: () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    set({ theme: next })
  },
}))
