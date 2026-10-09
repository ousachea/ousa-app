import { toast } from 'vue-sonner'
import { collection } from 'firebase/firestore'

// A list of records for the personal trackers (Things I own, Renewals, Countdown…).
// Always kept in this browser; when signed in, the shared sync session (useSync, utils/sync.ts) keeps it
// in step with Firestore (users/{uid}/items, one document per record), so the same data is on every device.

export interface StoredItem {
  id: string
}

export type SyncState =
  | 'loading' // reading storage, or catching up with Firestore for the first time
  | 'device' // signed out: this device only
  | 'saving' // changes waiting for Firestore to confirm them
  | 'synced' // Firestore has confirmed everything
  | 'offline' // no connection; changes kept on this device and sent when it's back
  | 'error' // Firestore keeps refusing or failing; changes kept, Try again
  | 'needs-setup' // signed in, but the Firestore database or its rules aren't set up yet
  | 'demo' // showing sample data; nothing is saved

// Where a signed-in user's tracker records live
export const itemsRef = (uid: string) => collection(useFirebase().db, 'users', uid, 'items')

function readCache<T>(key: string): T[] | undefined {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(key)
    if (!raw) return undefined
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as T[]
  } catch {}
  // Corrupt or blocked storage shouldn't break the page, but the damaged copy is set aside before the
  // next save replaces it, so it can still be recovered by hand (CHECKLIST.md #73)
  if (raw) {
    try {
      if (!localStorage.getItem(`${key}:damaged`)) localStorage.setItem(`${key}:damaged`, raw)
    } catch {}
  }
  return undefined
}

// A full or blocked storage: said once per visit, not on every change
let warnedStorage = false
function warnStorage(signedIn: boolean) {
  if (warnedStorage) return
  warnedStorage = true
  toast.error('Couldn’t save on this device', {
    description: signedIn
      ? 'This browser’s storage is full or blocked. Your changes still go to your account, but this device won’t have them offline.'
      : 'This browser’s storage is full or blocked, so your latest changes will be lost when you close the page. Export a backup in Settings → Data, or sign in to keep them in your account.',
    duration: 15_000
  })
}

// What a record is called in activity, the Recycle Bin and search, when the page doesn't say
export function defaultLabel(item: Record<string, unknown>) {
  for (const k of ['title', 'name', 'site', 'label']) {
    const v = item[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return typeof item.date === 'string' ? `Entry on ${item.date}` : 'Item'
}

/**
 * Put records back into a collection from outside its page (the Recycle Bin, a backup restore, Keep mine).
 * Updates this device's copy and, when signed in, sends it. Records already there are replaced;
 * `force` replaces them even if another device changed them since.
 */
export async function writeToCollection(name: string, records: StoredItem[], opts: { force?: boolean } = {}) {
  if (!records.length) return
  const key = `ousa-app:${name}`
  const ids = new Set(records.map(r => r.id))
  const current = readCache<SyncRecord>(key) ?? []
  const before = new Map(current.map(r => [r.id, r]))
  try {
    localStorage.setItem(key, JSON.stringify([...current.filter(r => !ids.has(r.id)), ...records]))
    // Real data is here now; a first visit to the app shouldn't add examples on top
    localStorage.setItem(`${key}:seeded`, '1')
  } catch {}
  queueSync(name, records.map(r => ({ id: r.id, op: opts.force ? 'force' : 'put', before: before.get(r.id) })))
  notifySyncChange([name])
  await flushSync()
}

/** What this device has saved for a collection (empty when nothing is) */
export const readCollection = (name: string) => readCache<StoredItem & Record<string, unknown>>(`ousa-app:${name}`) ?? []

/**
 * Make a collection exactly `records` (restoring a backup with Replace). Anything it removes goes to
 * the Recycle Bin first, so even a replace can be undone.
 */
export async function replaceCollection(name: string, app: string, records: StoredItem[], labelOf: (r: Record<string, unknown>) => string = defaultLabel) {
  const key = `ousa-app:${name}`
  const keep = new Set(records.map(r => r.id))
  const current = readCollection(name) as SyncRecord[]
  const removed = current.filter(r => !keep.has(r.id))
  const trash = useTrash()
  for (const r of removed) trash.put(name, app, r, labelOf(r))
  try {
    localStorage.setItem(key, JSON.stringify(records))
    localStorage.setItem(`${key}:seeded`, '1')
  } catch {}
  const before = new Map(current.map(r => [r.id, r]))
  queueSync(name, [
    ...removed.map(r => ({ id: r.id, op: 'delete' as const, before: r })),
    ...records.map(r => ({ id: r.id, op: 'force' as const, before: before.get(r.id) }))
  ])
  notifySyncChange([name])
  await flushSync()
}

export interface CollectionOptions<T> {
  demo?: () => Omit<T, 'id'>[]
  /** How a record is named in activity and the Recycle Bin */
  label?: (item: T) => string
  /** The app it belongs to, for activity and the Recycle Bin (default `/${name}`) */
  app?: string
  /** Deleted records go to the Recycle Bin (default true); off for background data like price history */
  trash?: boolean
  /** Changes show in Recent activity (default true); off for bookkeeping like note versions */
  activity?: boolean
}

export function useCollection<T extends StoredItem>(
  name: string,
  seed: () => T[] = () => [],
  options: CollectionOptions<T> = {}
) {
  const key = `ousa-app:${name}`
  const app = options.app ?? `/${name}`
  const labelOf = (item: T) => options.label?.(item) ?? defaultLabel(item as unknown as Record<string, unknown>)
  const useBin = options.trash !== false
  const trash = useBin ? useTrash() : undefined
  // Demo data is make-believe: it never reaches the activity log or the bin
  const record = (kind: ActivityKind, label: string) => {
    if (!demoOn.value && options.activity !== false) logActivity(kind, app, label)
  }
  const items = ref<T[]>([]) as Ref<T[]>
  const ready = ref(false)
  const session = useSync()
  const signedIn = computed(() => !['loading', 'device'].includes(session.state.status))

  // Demo mode: sample items live only in memory. Nothing reaches this device's storage or Firestore,
  // and switching it off brings the real list back exactly as it was.
  const demoOn = options.demo ? useDemo().active : ref(false)
  let realItems: T[] = []
  if (options.demo) {
    const makeDemo = options.demo
    watch(demoOn, (on) => {
      if (on) {
        realItems = items.value
        // Demo records may bring their own ids (so demo bookmarks can point at demo folders)
        items.value = makeDemo().map(item => ({ id: crypto.randomUUID(), ...item }) as T)
      } else {
        items.value = readCache<T>(key) ?? realItems
      }
    })
  }

  function cache() {
    if (demoOn.value) return
    try {
      localStorage.setItem(key, JSON.stringify(items.value))
    } catch {
      warnStorage(signedIn.value)
    }
  }

  // Every change is noted as pending until Firestore confirms it (CHECKLIST.md #19, #73, #78), so
  // nothing is lost to a closed tab or a dropped connection, and a burst of edits goes out as one write
  function changed(changes: LocalChange[]) {
    if (demoOn.value || !changes.length) return
    queueSync(name, changes)
  }

  const reload = () => {
    if (!demoOn.value) items.value = readCache<T>(key) ?? []
  }

  let stopChanges: (() => void) | undefined
  onMounted(async () => {
    const local = readCache<T>(key)
    // With a saved copy, show it straight away; a first visit waits for Firestore and any examples
    if (local) {
      items.value = local
      ready.value = true
    }
    // Changes from other devices arrive while the page is open
    stopChanges = onSyncChange((names) => {
      if (names.includes(name)) reload()
    })
    await syncReady()
    if (!demoOn.value) items.value = readCache<T>(key) ?? items.value

    // Example data only for a brand-new user: nothing on this device and nothing in Firestore.
    // Checked after catching up so a second device doesn't add duplicate examples.
    if (!local && !items.value.length && localStorage.getItem(`${key}:seeded`) === null) {
      items.value = seed()
      try {
        localStorage.setItem(`${key}:seeded`, '1')
      } catch {}
      cache()
      changed(items.value.map(r => ({ id: r.id, op: 'add' })))
    }
    ready.value = true
  })
  // Another tab changed it
  const onStorage = (e: StorageEvent) => {
    if (e.key === key) reload()
  }
  onMounted(() => window.addEventListener('storage', onStorage))
  onBeforeUnmount(() => {
    window.removeEventListener('storage', onStorage)
    stopChanges?.()
  })

  const asRecord = (item: T | undefined) => item as unknown as SyncRecord | undefined

  return {
    items,
    ready,
    sync: { state: computed<SyncState>(() => (demoOn.value ? 'demo' : session.state.status === 'starting' ? 'loading' : session.state.status)), signedIn, retry: session.retry },
    add(item: Omit<T, 'id'>) {
      const created = { ...item, id: crypto.randomUUID() } as T
      items.value = [...items.value, created]
      cache()
      changed([{ id: created.id, op: 'add' }])
      record('added', labelOf(created))
      return created
    },
    // For imports: one cache write and one Firestore batch however many records there are
    addMany(list: Omit<T, 'id'>[]) {
      const records = list.map(item => ({ ...item, id: crypto.randomUUID() }) as T)
      items.value = [...items.value, ...records]
      cache()
      changed(records.map(r => ({ id: r.id, op: 'add' })))
      if (records.length) record('imported', `${records.length} ${records.length === 1 ? 'item' : 'items'}`)
      return records
    },
    /** `quiet`: background bookkeeping (visit counts, fetched icons) that isn't worth showing in activity */
    /** Returns the record as it was before, for Undo */
    update(id: string, patch: Partial<T>, opts: { quiet?: boolean } = {}) {
      const before = items.value.find(i => i.id === id)
      items.value = items.value.map(i => (i.id === id ? { ...i, ...patch } : i))
      cache()
      const updated = items.value.find(i => i.id === id)
      if (updated) {
        changed([{ id, op: 'put', before: asRecord(before) }])
        if (!opts.quiet) record('edited', labelOf(updated))
      }
      return before
    },
    /** Put a record back exactly as it was (Undo after an edit) */
    replace(item: T) {
      const before = items.value.find(i => i.id === item.id)
      if (!before) return
      items.value = items.value.map(i => (i.id === item.id ? item : i))
      cache()
      changed([{ id: item.id, op: 'put', before: asRecord(before) }])
    },
    /** Deletes a record; it goes to the Recycle Bin (unless this collection opts out) */
    /** `undoAdd`: taking back something just added (Undo), so it skips the bin and the activity log */
    remove(id: string, opts: { undoAdd?: boolean } = {}) {
      const removed = items.value.find(i => i.id === id)
      items.value = items.value.filter(i => i.id !== id)
      cache()
      if (removed) changed([{ id, op: 'delete', before: asRecord(removed) }])
      if (removed && !opts.undoAdd) {
        if (trash && !demoOn.value) trash.put(name, app, removed as TrashEntry['item'], labelOf(removed))
        record('deleted', labelOf(removed))
      }
      return removed
    },
    // Put a removed item back (for Undo, or from the Recycle Bin)
    restore(item: T) {
      if (items.value.some(i => i.id === item.id)) return
      items.value = [...items.value, item]
      cache()
      changed([{ id: item.id, op: 'put' }])
      trash?.take([item.id])
      record('restored', labelOf(item))
    }
  }
}
