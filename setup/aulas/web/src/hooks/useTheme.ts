import { useEffect, useState } from 'react'
type Theme = 'paper' | 'forest'
function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem('will-labs:habits:theme')
    if (saved === 'paper' || saved === 'forest') return saved
  } catch {
    /* The theme remains usable without persistent storage. */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'forest' : 'paper'
}
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  useEffect(() => {
    document.documentElement.dataset.tema = theme
    try {
      localStorage.setItem('will-labs:habits:theme', theme)
    } catch {
      /* Session only. */
    }
  }, [theme])
  return { theme, toggle: () => setTheme((value) => (value === 'paper' ? 'forest' : 'paper')) }
}
