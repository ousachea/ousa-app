// Whole-app backup and restore (CHECKLIST.md #17). A backup is one JSON file with every tracker's
// records and, optionally, this device's settings. Restoring always shows a preview first.
// The password vault is never included: it's encrypted with your master password and syncs on its own.

export interface BackupSection {
  /** useCollection name */
  name: string
  label: string
  app: string
}

export const BACKUP_SECTIONS: BackupSection[] = [
  { name: 'bookmarks', label: 'Bookmarks', app: '/bookmarks' },
  { name: 'bookmark-folders', label: 'Bookmark folders', app: '/bookmarks' },
  { name: 'notes', label: 'Notes', app: '/notes' },
  { name: 'note-folders', label: 'Note folders', app: '/notes' },
  { name: 'note-templates', label: 'Note templates', app: '/notes' },
  { name: 'note-versions', label: 'Note version history', app: '/notes' },
  { name: 'things', label: 'Stash', app: '/things' },
  { name: 'renewals', label: 'Renewals', app: '/renewals' },
  { name: 'countdown', label: 'Countdowns', app: '/countdown' },
  { name: 'contacts', label: 'Contacts', app: '/phone' },
  { name: 'eat', label: 'Foods & places', app: '/eat' },
  { name: 'weight', label: 'Weight', app: '/weight' },
  { name: 'budget-transactions', label: 'Budget transactions', app: '/budget' },
  { name: 'budget-categories', label: 'Budget categories', app: '/budget' },
  { name: 'budget-limits', label: 'Budgets', app: '/budget' },
  { name: 'budget-recurring', label: 'Recurring bills', app: '/budget' },
  { name: 'budget-goals', label: 'Savings goals', app: '/budget' },
  { name: 'budget-contributions', label: 'Savings contributions', app: '/budget' },
  { name: 'budget-settings', label: 'Budget settings', app: '/budget' },
  { name: 'gold', label: 'Gold purchases', app: '/gold' },
  { name: 'gold-prices', label: 'Gold price history', app: '/gold' },
  { name: 'speed', label: 'Speed tests', app: '/speed' }
]

// Settings that travel with a backup: preferences, theme, effects, sound, remembered choices and each
// app's own settings and saved inputs. Drafts, the activity log and the Recycle Bin stay on the device
// they belong to.
const SETTING_KEYS = /^ousa-app:(prefs|theme|effects|sound|cube-colors|remember:.+|app-prefs:.+|salary|battery|weight-unit|notes-prefs|gold-settings|bookmarks-view)$/

// Settings that belong to one app, for Import / Export in that app's own settings
const APP_SETTING_EXTRAS: Record<string, string[]> = {
  '/text': ['remember:compare-.+'],
  '/notes': ['notes-prefs'],
  '/gold': ['gold-settings'],
  '/weight': ['weight-unit'],
  '/bookmarks': ['bookmarks-view'],
  '/salary': ['salary'],
  '/battery': ['battery']
}

/** The localStorage keys holding one app's settings: its own settings, remembered choices and extras */
export function appSettingKeys(app: string) {
  const slug = app.replace(/^\//, '')
  return new RegExp(`^ousa-app:(app-prefs:${slug}|remember:${slug}-.+|${(APP_SETTING_EXTRAS[app] ?? []).join('|') || '$^'})$`)
}

/** What one app has to export: its collections and its settings */
export const appSections = (app: string) => BACKUP_SECTIONS.filter(s => s.app === app)

export interface Backup {
  app: 'ousa-app'
  kind: 'backup'
  version: 1
  exportedAt: string
  collections: Record<string, Record<string, unknown>[]>
  settings?: Record<string, string>
}

/** `onlyKeys` limits the settings to one app's (see appSettingKeys) */
export function makeBackup(sections: string[], withSettings: boolean, onlyKeys?: RegExp): Backup {
  const collections: Backup['collections'] = {}
  for (const name of sections) collections[name] = readCollection(name)
  const backup: Backup = { app: 'ousa-app', kind: 'backup', version: 1, exportedAt: new Date().toISOString(), collections }
  if (withSettings) {
    const settings: Record<string, string> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && SETTING_KEYS.test(k) && (!onlyKeys || onlyKeys.test(k))) settings[k] = localStorage.getItem(k) ?? ''
    }
    backup.settings = settings
  }
  return backup
}

export interface RestorePlan {
  section: BackupSection
  /** Records ready to write, every one with an id */
  records: { id: string }[]
  added: number
  changed: number
  same: number
  /** On this device but not in the backup: kept by Merge, moved to the Recycle Bin by Replace */
  onlyHere: number
}

export interface ParsedBackup {
  exportedAt?: string
  plans: RestorePlan[]
  settings?: Record<string, string>
  /** Sections in the file this app doesn't know, ignored */
  unknown: string[]
}

/** Read a backup file and compare it with what's on this device. Throws a readable message if it isn't one.
 *  With `app`, only that app's part of the file is read (a full backup works too). */
export function parseBackup(text: string, app?: string): ParsedBackup {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('That file isn’t a backup from this app (it isn’t valid JSON).')
  }
  if (!isRecord(data) || data.app !== 'ousa-app' || !isRecord(data.collections)) {
    throw new Error('That file isn’t a backup from this app. Use a file made with Export backup.')
  }
  const plans: RestorePlan[] = []
  const unknown: string[] = []
  for (const [name, list] of Object.entries(data.collections)) {
    const section = BACKUP_SECTIONS.find(s => s.name === name)
    if (section && app && section.app !== app) continue
    if (!section || !Array.isArray(list)) {
      unknown.push(name)
      continue
    }
    const here = new Map(readCollection(name).map(r => [r.id, JSON.stringify(r)]))
    const records = list.filter(isRecord).map(r => ({ ...r, id: typeof r.id === 'string' && r.id ? r.id : crypto.randomUUID() }))
    let added = 0
    let changed = 0
    let same = 0
    for (const r of records) {
      const mine = here.get(r.id)
      if (mine === undefined) added++
      else if (mine === JSON.stringify(r)) same++
      else changed++
    }
    const ids = new Set(records.map(r => r.id))
    const onlyHere = [...here.keys()].filter(id => !ids.has(id)).length
    plans.push({ section, records, added, changed, same, onlyHere })
  }
  const appKeys = app ? appSettingKeys(app) : undefined
  const picked = isRecord(data.settings)
    ? Object.fromEntries(Object.entries(data.settings).filter(([k, v]) => SETTING_KEYS.test(k) && (!appKeys || appKeys.test(k)) && typeof v === 'string')) as Record<string, string>
    : undefined
  const settings = picked && Object.keys(picked).length ? picked : undefined
  return { exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : undefined, plans, settings, unknown }
}

export function restoreSettings(settings: Record<string, string>) {
  for (const [k, v] of Object.entries(settings)) {
    if (!SETTING_KEYS.test(k)) continue
    try {
      localStorage.setItem(k, v)
    } catch {}
  }
}
