import { useCallback, useState } from 'react'

export type ThemeMode = 'light' | 'auto' | 'dark'

const STORAGE_KEY = 'keyboard-theme'

export function getStoredTheme(): ThemeMode {
  return (localStorage.getItem(STORAGE_KEY) as ThemeMode) || 'auto'
}

export function applyTheme(mode: ThemeMode) {
  if (mode === 'dark') {
    document.documentElement.classList.add('dark')
  }
  else if (mode === 'light') {
    document.documentElement.classList.remove('dark')
  }
  else {
    document.documentElement.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches)
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(getStoredTheme)

  const setTheme = useCallback((mode: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, mode)
    setThemeState(mode)
    applyTheme(mode)
  }, [])

  return { theme, setTheme }
}
