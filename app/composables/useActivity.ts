// Recent activity across every app: added, edited, deleted, restored, imported, exported.
// A short history on this device (the newest MAX entries), shown on the home page and in the menu.
const KEY = 'ousa-app:activity'
const MAX = 200

export type ActivityKind = 'added' | 'edited' | 'deleted' | 'restored' | 'imported' | 'exported'

export interface Activity {
  id: string
  kind: ActivityKind
  /** App path, e.g. '/bookmarks' */
  app: string
  label: string
  at: string
}

const log = ref<Activity[]>([])
let started = false

function read(): Activity[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed as Activity[] : []
  } catch {
    return []
  }
}

function start() {
  if (started || import.meta.server) return
  started = true
  log.value = read()
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) log.value = read()
  })
}

// Repeated edits to the same thing within a minute (typing, toggling) read as one
const MERGE_MS = 60_000

export function logActivity(kind: ActivityKind, app: string, label: string) {
  if (import.meta.server) return
  start()
  const now = new Date()
  const last = log.value[0]
  if (last && last.kind === kind && kind === 'edited' && last.app === app && last.label === label
    && now.getTime() - new Date(last.at).getTime() < MERGE_MS) {
    log.value = [{ ...last, at: now.toISOString() }, ...log.value.slice(1)]
  } else {
    log.value = [{ id: crypto.randomUUID(), kind, app, label, at: now.toISOString() }, ...log.value].slice(0, MAX)
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(log.value))
  } catch {}
}

export function useActivity() {
  start()
  return {
    log: readonly(log),
    clear() {
      log.value = []
      try {
        localStorage.removeItem(KEY)
      } catch {}
    }
  }
}

export const ACTIVITY_VERB: Record<ActivityKind, string> = {
  added: 'Added',
  edited: 'Updated',
  deleted: 'Deleted',
  restored: 'Restored',
  imported: 'Imported',
  exported: 'Exported'
}
