// The Recycle Bin: anything deleted from a tracker (bookmarks, things, renewals…) waits here, on this
// device, until it's restored or deleted for good. Items older than KEEP_DAYS are cleared automatically.
// useCollection puts items in; the /trash page takes them out.
const KEY = 'ousa-app:trash'
const KEEP_DAYS = 30

export interface TrashEntry {
  /** The deleted record's own id */
  id: string
  /** useCollection name it came from, e.g. 'bookmarks' */
  collection: string
  /** App path it belongs to, e.g. '/bookmarks' */
  app: string
  label: string
  deletedAt: string
  item: { id: string } & Record<string, unknown>
}

const entries = ref<TrashEntry[]>([])
let started = false

function read(): TrashEntry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed as TrashEntry[] : []
  } catch {
    return []
  }
}

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.value))
  } catch {}
}

function start() {
  if (started || import.meta.server) return
  started = true
  const cutoff = Date.now() - KEEP_DAYS * 86_400_000
  const all = read()
  entries.value = all.filter(e => new Date(e.deletedAt).getTime() > cutoff)
  if (entries.value.length !== all.length) write()
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) entries.value = read()
  })
}

export function useTrash() {
  start()
  return {
    entries: readonly(entries),
    keepDays: KEEP_DAYS,
    put(collection: string, app: string, item: TrashEntry['item'], label: string) {
      entries.value = [{ id: item.id, collection, app, label, item, deletedAt: new Date().toISOString() }, ...entries.value.filter(e => e.id !== item.id)]
      write()
    },
    /** Take entries out of the bin (after restoring, or to delete them for good) */
    take(ids: string[]) {
      const set = new Set(ids)
      const taken = entries.value.filter(e => set.has(e.id))
      entries.value = entries.value.filter(e => !set.has(e.id))
      write()
      return taken
    }
  }
}
