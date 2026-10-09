// Notes settings (font, size, spacing, spellcheck, default folder, preview length, details panel),
// remembered on this device like the rest of Settings (usePrefs) and changed from Notes → Settings.
const KEY = 'ousa-app:notes-prefs'

export interface NotePrefs {
  font: 'sans' | 'serif' | 'mono'
  size: 'small' | 'medium' | 'large'
  leading: 'tight' | 'normal' | 'relaxed'
  spellcheck: boolean
  /** Folder new notes go in when you're not in a folder ('' = none) */
  defaultFolder: string
  /** Characters of preview under each note's title (0 = none) */
  previewLength: number
  /** Created, modified, words and folder under the editor */
  showDetails: boolean
}

const DEFAULTS: NotePrefs = {
  font: 'sans',
  size: 'medium',
  leading: 'normal',
  spellcheck: true,
  defaultFolder: '',
  previewLength: 140,
  showDetails: true
}

const prefs = reactive<NotePrefs>({ ...DEFAULTS })
let started = false

function start() {
  if (started || import.meta.server) return
  started = true
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<NotePrefs>
    for (const k of Object.keys(DEFAULTS) as (keyof NotePrefs)[]) {
      if (saved[k] !== undefined && typeof saved[k] === typeof DEFAULTS[k]) (prefs as Record<string, unknown>)[k] = saved[k]
    }
  } catch {}
  watch(prefs, () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs))
    } catch {}
  }, { deep: true })
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return
    try {
      Object.assign(prefs, JSON.parse(e.newValue))
    } catch {}
  })
}

const FONTS = { sans: 'inherit', serif: 'ui-serif, Georgia, Cambria, serif', mono: 'ui-monospace, SFMono-Regular, Menlo, monospace' }
const SIZES = { small: '0.95rem', medium: '1.0625rem', large: '1.2rem' }
const LEADING = { tight: '1.45', normal: '1.65', relaxed: '1.85' }

export function useNotePrefs() {
  start()
  return {
    prefs,
    /** CSS variables the editor reads */
    editorStyle: computed(() => ({ '--note-font': FONTS[prefs.font], '--note-size': SIZES[prefs.size], '--note-leading': LEADING[prefs.leading] })),
    reset: () => Object.assign(prefs, DEFAULTS)
  }
}
