import { toast } from 'vue-sonner'

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
  /** On phones: each app's own keypad for numbers, and its own keys above the keyboard for text */
  phoneKeyboard: boolean
  /** On phones: the app's own keyboard for text too (its 🌐 key switches a field to the phone's) */
  textKeyboard: boolean
  /** On phones: go full screen with the first tap (browsers don't allow it before one) */
  phoneFullscreen: boolean
  density: Density
  motion: MotionPreference
  /** Apps pinned to the top of the menu and home page, in order */
  pinnedApps: string[]
  /** Button and highlight colour: each app's own ('apps'), or one colour everywhere (a palette name like 'blue') */
  accent: string
  /** Stickers on the home page's Rubik's cube: classic cube colours, or each app's own */
  cubeColors: 'cube' | 'apps'
  /** List, grid or compact, for lists you haven't picked a view for yet */
  defaultView: 'list' | 'grid' | 'compact'
  /** Low-spec PC mode: lite effects and no motion at all, plus no splash or cross-fades, for old computers */
  lowSpec: boolean
  /** Condensed: every app in a narrower column in the middle of the window, instead of the full width */
  condensed: boolean
}

const DEFAULTS: Prefs = {
  confirmDelete: false,
  autosave: true,
  shortcuts: true,
  phoneKeyboard: true,
  textKeyboard: true,
  phoneFullscreen: true,
  density: 'comfortable',
  motion: 'system',
  pinnedApps: [],
  accent: 'apps',
  cubeColors: 'cube',
  defaultView: 'list',
  lowSpec: false,
  condensed: false
}

const prefs = reactive<Prefs>({ ...DEFAULTS })
let started = false

function apply() {
  const root = document.documentElement
  root.dataset.density = prefs.density
  if (prefs.motion === 'reduced' || prefs.lowSpec) root.dataset.motion = 'reduced'
  else delete root.dataset.motion
  if (prefs.lowSpec) root.dataset.lowspec = ''
  else delete root.dataset.lowspec
  if (prefs.condensed) root.dataset.condensed = ''
  else delete root.dataset.condensed
}

function start() {
  if (started || import.meta.server) return
  started = true
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>
    for (const k of Object.keys(DEFAULTS) as (keyof Prefs)[]) {
      if (saved[k] !== undefined && typeof saved[k] === typeof DEFAULTS[k]) (prefs as Record<string, unknown>)[k] = saved[k]
    }
    // The cube colours used to be a switch on the home page with a key of their own
    if (saved.cubeColors === undefined && localStorage.getItem('ousa-app:cube-colors') === 'apps') prefs.cubeColors = 'apps'
    // A tab that used to be an app of its own (Renewals, now in Calendar): its pin moves to the app
    prefs.pinnedApps = [...new Set(prefs.pinnedApps.map(p => appFor(p)?.to ?? p))]
    // Retired apps: their pins go, and Ambient Studio's saved mixes and settings with them
    prefs.pinnedApps = prefs.pinnedApps.filter(p => p !== '/ambient-studio')
    localStorage.removeItem('ousa-app:ambient-studio')
  } catch {}
  apply()
  // In a scope of its own: started from inside a component, the watch would otherwise stop when that
  // component unmounts, and later changes (unpinning an app, say) would quietly stop being saved
  effectScope(true).run(() => watch(prefs, () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs))
    } catch {}
    apply()
  }, { deep: true }))
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

/** Condensed (the top bar's middle button, or a press of Shift on its own): every app in a centred column */
export function toggleCondensed() {
  const { prefs } = usePrefs()
  prefs.condensed = !prefs.condensed
  useSound().play(prefs.condensed ? 'toggle-on' : 'toggle-off')
  // On a window no wider than the column there's nothing to see change, so say when it will
  const visible = window.innerWidth > 1360
  toast(prefs.condensed ? 'Condensed on' : 'Full width on', {
    description: visible ? 'Press Shift to switch back.' : 'Shows on windows wider than this one. Press Shift to switch back.'
  })
}

/** Pin an app to the top of the menu, home page and palette, or unpin it (CHECKLIST.md #09) */
export function togglePinnedApp(to: string) {
  const { prefs } = usePrefs()
  const pinned = prefs.pinnedApps.includes(to)
  prefs.pinnedApps = pinned ? prefs.pinnedApps.filter(p => p !== to) : [...prefs.pinnedApps, to]
  const name = toolFor(to)?.name ?? 'App'
  useSound().play(pinned ? 'toggle-off' : 'toggle-on')
  toast(pinned ? `${name} unpinned` : `${name} pinned`, {
    description: pinned ? undefined : 'It’s at the top of the menu and home page now.',
    action: { label: 'Undo', onClick: () => togglePinnedApp(to) }
  })
}
