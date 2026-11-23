import { useSyncExternalStore } from 'react'

type ThemePreference = 'light' | 'dark' | 'system'
export type PdfViewerTheme = ThemePreference | 'custom'

const storageKey = '@kyrven/react-pdf-viewer:theme'
const changeEvent = storageKey + ':change'
const systemDarkQuery = '(prefers-color-scheme: dark)'
let temporaryPreference: ThemePreference | null = null

function readPreference(): ThemePreference | null {
  if (temporaryPreference) return temporaryPreference
  try {
    const value = window.localStorage.getItem(storageKey)
    if (value === 'light' || value === 'dark' || value === 'system') return value
  } catch {
    // An embedded viewer may run with browser storage disabled.
  }
  return null
}

export function saveThemePreference(value: ThemePreference) {
  try {
    window.localStorage.setItem(storageKey, value)
    temporaryPreference = null
  } catch {
    temporaryPreference = value
  }
  window.dispatchEvent(new Event(changeEvent))
}

function subscribePreference(onChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === storageKey || event.key === null) onChange()
  }
  window.addEventListener('storage', handleStorage)
  window.addEventListener(changeEvent, onChange)
  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(changeEvent, onChange)
  }
}

function subscribeSystemTheme(onChange: () => void) {
  const query = window.matchMedia(systemDarkQuery)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

const getSystemDark = () => window.matchMedia(systemDarkQuery).matches
const noPreference = () => null
const defaultSystemDark = () => false

export function useViewerTheme(initialTheme: PdfViewerTheme, remember: boolean) {
  const preference = useSyncExternalStore(subscribePreference, readPreference, noPreference)
  const systemDark = useSyncExternalStore(subscribeSystemTheme, getSystemDark, defaultSystemDark)
  const selectedTheme = !remember || initialTheme === 'custom' ? initialTheme : preference ?? initialTheme
  const systemTheme = systemDark ? 'dark' : 'light'
  const theme = selectedTheme === 'system' ? systemTheme : selectedTheme
  return { selectedTheme, theme }
}
