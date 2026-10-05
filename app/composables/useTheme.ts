// Must match the key read by the no-flash script in nuxt.config.ts
const STORAGE_KEY = 'ousa-app:theme'

export type ThemePreference = 'system' | 'light' | 'dark'

const state = reactive({
  preference: 'system' as ThemePreference,
  resolved: 'light' as 'light' | 'dark'
})

let media: MediaQueryList | undefined
let started = false

function apply() {
  const dark = state.preference === 'dark' || (state.preference === 'system' && !!media?.matches)
  state.resolved = dark ? 'dark' : 'light'
  document.documentElement.dataset.theme = state.resolved
}

function start() {
  if (started || import.meta.server) return
  started = true
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'system') state.preference = saved
  } catch {}
  media = window.matchMedia('(prefers-color-scheme: dark)')
  // Follow the device live while the preference is "system"
  media.addEventListener('change', apply)
  apply()
}

export function useTheme() {
  start()

  function setTheme(preference: ThemePreference) {
    state.preference = preference
    try {
      localStorage.setItem(STORAGE_KEY, preference)
    } catch {}
    apply()
  }

  return {
    theme: readonly(state),
    setTheme,
    // Flip whatever is showing now; this becomes an explicit choice
    toggle: () => setTheme(state.resolved === 'dark' ? 'light' : 'dark')
  }
}
