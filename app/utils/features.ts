// What each app can do, for the feature table in Settings: one row per app, one column per feature,
// so it's easy to see which app has what, and how two apps differ.
// Keep it in step with the apps: add a feature here when an app gains it.
export type FeatureKey =
  | 'sync' | 'demo' | 'drag' | 'folders' | 'search' | 'views' | 'select' | 'trash'
  | 'quickAdd' | 'drafts' | 'formats' | 'copy' | 'download'

export interface Feature {
  key: FeatureKey
  label: string
  /** One line on what it means, shown under the table and as the column's tooltip */
  description: string
}

export const FEATURES: Feature[] = [
  { key: 'sync', label: 'Saves & syncs', description: 'Keeps what you add, and syncs it to your other devices when you’re signed in.' },
  { key: 'demo', label: 'Example data', description: 'Click the app’s icon to try it with sample data, without touching yours.' },
  { key: 'drag', label: 'Drag & drop', description: 'Drag things to move or reorder them, or drop files in.' },
  { key: 'folders', label: 'Folders', description: 'Sort things into nested folders.' },
  { key: 'search', label: 'Search', description: 'A search box to find things in the app.' },
  { key: 'views', label: 'List & grid', description: 'Switch between list, grid and compact views.' },
  { key: 'select', label: 'Select several', description: 'Pick several things to delete, move or export together.' },
  { key: 'trash', label: 'Recycle Bin', description: 'Deleted things wait 30 days in the Recycle Bin.' },
  { key: 'quickAdd', label: 'Quick add', description: 'Add from anywhere with ⌘K / Ctrl+K, or A on the app’s page.' },
  { key: 'drafts', label: 'Keeps drafts', description: 'An Add form you close keeps what you typed for next time.' },
  { key: 'formats', label: 'Other formats', description: 'Imports or exports a format of its own (CSV, Markdown, browser bookmarks…), besides the backup file.' },
  { key: 'copy', label: 'Copy', description: 'Copies results or items to the clipboard in one click.' },
  { key: 'download', label: 'Download', description: 'Saves a file: an image, PDF, report or export.' }
]

/** Every app has Settings and Import & export (except the CV, which saves nothing), so they aren't columns */
export const APP_FEATURES: Record<string, FeatureKey[]> = {
  '/qr': ['copy', 'download'],
  '/phone': ['sync', 'demo', 'search', 'select', 'trash', 'quickAdd', 'copy', 'download'],
  '/compress': ['demo', 'drag', 'download'],
  '/text': ['demo', 'copy'],
  '/password': ['sync', 'search', 'quickAdd', 'copy'],
  '/exchange': [],
  '/things': ['sync', 'demo', 'search', 'views', 'select', 'trash', 'quickAdd', 'drafts', 'formats'],
  '/eat': ['sync', 'demo', 'select', 'trash', 'quickAdd', 'drafts'],
  '/weight': ['sync', 'demo', 'select', 'trash', 'quickAdd'],
  '/budget': ['sync', 'demo', 'search', 'select', 'trash', 'download'],
  '/countdown': ['sync', 'select', 'trash', 'quickAdd', 'drafts'],
  '/renewals': ['sync', 'demo', 'select', 'trash', 'quickAdd', 'drafts', 'formats', 'copy'],
  '/bookmarks': ['sync', 'demo', 'drag', 'folders', 'search', 'views', 'select', 'trash', 'quickAdd', 'formats', 'copy'],
  '/notes': ['sync', 'demo', 'drag', 'folders', 'search', 'views', 'select', 'trash', 'quickAdd', 'formats', 'copy', 'download'],
  '/battery': ['copy'],
  '/salary': [],
  '/speed': ['download'],
  '/gold': ['sync', 'demo', 'select', 'trash', 'quickAdd', 'drafts', 'formats', 'download'],
  '/ambient-studio': ['search']
}

export const hasFeature = (app: string, key: FeatureKey) => APP_FEATURES[app]?.includes(key) ?? false
