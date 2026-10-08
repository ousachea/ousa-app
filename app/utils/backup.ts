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
  { name: 'things', label: 'Things I own', app: '/things' },
  { name: 'renewals', label: 'Renewals', app: '/renewals' },
  { name: 'countdown', label: 'Countdowns', app: '/countdown' },
  { name: 'contacts', label: 'Contacts', app: '/phone' },
  { name: 'eat', label: 'Foods & places', app: '/eat' },
  { name: 'weight', label: 'Weight', app: '/weight' },
  { name: 'gold', label: 'Gold purchases', app: '/gold' },
  { name: 'gold-prices', label: 'Gold price history', app: '/gold' }
]

// Settings that travel with a backup: preferences, theme, effects, sound and remembered choices.
// Drafts, the activity log and the Recycle Bin stay on the device they belong to.
const SETTING_KEYS = /^ousa-app:(prefs|theme|effects|sound|cube-colors|remember:.+)$/

export interface Backup {
  app: 'ousa-app'
  kind: 'backup'
  version: 1
  exportedAt: string
  collections: Record<string, Record<string, unknown>[]>
  settings?: Record<string, string>
}

export function makeBackup(sections: string[], withSettings: boolean): Backup {
  const collections: Backup['collections'] = {}
  for (const name of sections) collections[name] = readCollection(name)
  const backup: Backup = { app: 'ousa-app', kind: 'backup', version: 1, exportedAt: new Date().toISOString(), collections }
  if (withSettings) {
    const settings: Record<string, string> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && SETTING_KEYS.test(k)) settings[k] = localStorage.getItem(k) ?? ''
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

/** Read a backup file and compare it with what's on this device. Throws a readable message if it isn't one. */
export function parseBackup(text: string): ParsedBackup {
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
  const settings = isRecord(data.settings)
    ? Object.fromEntries(Object.entries(data.settings).filter(([k, v]) => SETTING_KEYS.test(k) && typeof v === 'string')) as Record<string, string>
    : undefined
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
