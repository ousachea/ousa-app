// App-wide behaviour preferences, chosen in Settings and remembered on this device.
// Appearance has its own composables (useTheme, useEffects); this holds everything else.
const KEY = 'ousa-app:prefs'

export type Density = 'spacious' | 'comfortable' | 'compact'
export type MotionPreference = 'system' | 'full' | 'reduced'

export interface Prefs {
  /** Ask for a second click before moving something to the Recycle Bin (permanent deletes always ask) */
  confirmDelete: boolean
  /** Keep unfinished forms so they can be picked up again */
  autosave: boolean
  /** Single-letter shortcuts like A (add) and D (dark mode) */
  shortcuts: boolean
  density: Density
  motion: MotionPreference
  /** Apps pinned to the top of the menu and home page, in order */
  pinnedApps: string[]
}

const DEFAULTS: Prefs = {
  confirmDelete: false,
  autosave: true,
  shortcuts: true,
  density: 'comfortable',
  motion: 'system',
  pinnedApps: []
}

const prefs = reactive<Prefs>({ ...DEFAULTS })
let started = false

function apply() {
  const root = document.documentElement
  root.dataset.density = prefs.density
  if (prefs.motion === 'reduced') root.dataset.motion = 'reduced'
  else delete root.dataset.motion
}

function start() {
  if (started || import.meta.server) return
  started = true
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>
    for (const k of Object.keys(DEFAULTS) as (keyof Prefs)[]) {
      if (saved[k] !== undefined && typeof saved[k] === typeof DEFAULTS[k]) (prefs as Record<string, unknown>)[k] = saved[k]
    }
  } catch {}
  apply()
  watch(prefs, () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs))
    } catch {}
    apply()
  }, { deep: true })
  // Another tab changed them
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return
    try {
      Object.assign(prefs, JSON.parse(e.newValue))
    } catch {}
  })
}

export function usePrefs() {
  start()
  return {
    prefs,
    reset: () => Object.assign(prefs, { ...DEFAULTS, pinnedApps: prefs.pinnedApps })
  }
}
