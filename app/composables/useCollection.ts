import { toast } from 'vue-sonner'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, deleteDoc, doc, getDocsFromServer, query, where, writeBatch } from 'firebase/firestore'

// A list of records for the personal trackers (Things I own, Renewals, Countdown…).
// Always cached in this browser; when signed in to Firebase it also syncs to Firestore
// (users/{uid}/items, one document per record), so the same data appears on every device.

export interface StoredItem {
  id: string
}

export type SyncState =
  | 'loading' // reading storage
  | 'device' // signed out: this device only
  | 'saving' // writing to Firestore
  | 'synced' // matches Firestore
  | 'offline' // signed in, but Firestore couldn't be reached; changes kept on this device
  | 'needs-setup' // signed in, but the Firestore database or its rules aren't set up yet
  | 'demo' // showing sample data; nothing is saved

// Firestore allows at most 500 writes in one batch
const BATCH_LIMIT = 500

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

// Pending changes for writes made outside a page (Recycle Bin, backups); the page's own list reads the same key
function notePending(name: string, ids: string[], op: 'put' | 'delete', done = false) {
  const k = `ousa-app:${name}:pending`
  try {
    const p = JSON.parse(localStorage.getItem(k) ?? '{}') as Record<string, string>
    for (const id of ids) {
      if (done) {
        if (p[id] === op) delete p[id]
      } else {
        p[id] = op
      }
    }
    if (Object.keys(p).length) localStorage.setItem(k, JSON.stringify(p))
    else localStorage.removeItem(k)
  } catch {}
}

/**
 * Put records back into a collection from outside its page (the Recycle Bin, a backup restore).
 * Updates this device's copy and, when signed in, Firestore. Records already there are replaced.
 */
export async function writeToCollection(name: string, records: StoredItem[]) {
  if (!records.length) return
  const key = `ousa-app:${name}`
  const ids = new Set(records.map(r => r.id))
  const current = readCache<StoredItem>(key) ?? []
  try {
    localStorage.setItem(key, JSON.stringify([...current.filter(r => !ids.has(r.id)), ...records]))
    // Real data is here now; a first visit to the app shouldn't add examples on top
    localStorage.setItem(`${key}:seeded`, '1')
  } catch {}
  const recordIds = records.map(r => r.id)
  notePending(name, recordIds, 'put')
  if (!firebaseConfigured()) return
  const { auth, db } = useFirebase()
  await auth.authStateReady()
  const uid = auth.currentUser?.uid
  if (!uid) return
  const updatedAt = new Date().toISOString()
  for (let i = 0; i < records.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const r of records.slice(i, i + BATCH_LIMIT)) batch.set(doc(itemsRef(uid), r.id), { collection: name, data: r, updatedAt })
    await withTimeout(batch.commit())
  }
  notePending(name, recordIds, 'put', true)
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
  const removed = readCollection(name).filter(r => !keep.has(r.id))
  const trash = useTrash()
  for (const r of removed) trash.put(name, app, r, labelOf(r))
  try {
    localStorage.setItem(key, JSON.stringify(records))
    localStorage.setItem(`${key}:seeded`, '1')
  } catch {}
  notePending(name, removed.map(r => r.id), 'delete')
  notePending(name, records.map(r => r.id), 'put')
  if (!firebaseConfigured()) return
  const { auth, db } = useFirebase()
  await auth.authStateReady()
  const uid = auth.currentUser?.uid
  if (!uid) return
  const updatedAt = new Date().toISOString()
  const writes: ((b: ReturnType<typeof writeBatch>) => void)[] = [
    ...removed.map(r => (b: ReturnType<typeof writeBatch>) => b.delete(doc(itemsRef(uid), r.id))),
    ...records.map(r => (b: ReturnType<typeof writeBatch>) => b.set(doc(itemsRef(uid), r.id), { collection: name, data: r, updatedAt }))
  ]
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const w of writes.slice(i, i + BATCH_LIMIT)) w(batch)
    await withTimeout(batch.commit())
  }
  notePending(name, removed.map(r => r.id), 'delete', true)
  notePending(name, records.map(r => r.id), 'put', true)
}

export interface CollectionOptions<T> {
  demo?: () => Omit<T, 'id'>[]
  /** How a record is named in activity and the Recycle Bin */
  label?: (item: T) => string
  /** The app it belongs to, for activity and the Recycle Bin (default `/${name}`) */
  app?: string
  /** Deleted records go to the Recycle Bin (default true); off for background data like price history */
  trash?: boolean
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
    if (!demoOn.value) logActivity(kind, app, label)
  }
  const items = ref<T[]>([]) as Ref<T[]>
  const ready = ref(false)
  const state = ref<SyncState>('loading')
  const signedIn = ref(false)

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

  // ---------- Changes not yet confirmed by Firestore (CHECKLIST.md #19, #73) ----------
  // Every change is noted here until the server confirms it. If the app closes first (offline, a lost
  // connection), the next load pushes the device's version instead of letting the older cloud copy win,
  // and deletes made offline are carried out instead of the record coming back.
  type PendingOp = 'put' | 'delete'
  const pendingKey = `${key}:pending`
  function readPending(): Record<string, PendingOp> {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(pendingKey) ?? '{}')
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, PendingOp> : {}
    } catch {
      return {}
    }
  }
  function writePending(p: Record<string, PendingOp>) {
    try {
      if (Object.keys(p).length) localStorage.setItem(pendingKey, JSON.stringify(p))
      else localStorage.removeItem(pendingKey)
    } catch {}
  }
  function markPending(ids: string[], op: PendingOp) {
    if (demoOn.value || !ids.length) return
    const p = readPending()
    for (const id of ids) p[id] = op
    writePending(p)
  }
  function clearPending(ids: string[], op?: PendingOp) {
    const p = readPending()
    // Only clear what this write covered; a newer change to the same record stays pending
    for (const id of ids) if (!op || p[id] === op) delete p[id]
    writePending(p)
  }

  // ---------- Firestore ----------
  let uid: string | undefined

  async function pull(): Promise<T[] | undefined> {
    try {
      // From the server, not Firestore's cache, so being offline shows as offline rather than an empty list
      const snap = await getDocsFromServer(query(itemsRef(uid!), where('collection', '==', name)))
      return snap.docs.map(d => d.data().data as T)
    } catch (e) {
      if (!needsFirestoreSetup(e)) throw e
      state.value = 'needs-setup'
      return undefined
    }
  }

  async function push(records: T[]) {
    const updatedAt = new Date().toISOString()
    for (let i = 0; i < records.length; i += BATCH_LIMIT) {
      const batch = writeBatch(useFirebase().db)
      for (const r of records.slice(i, i + BATCH_LIMIT)) batch.set(doc(itemsRef(uid!), r.id), { collection: name, data: r, updatedAt })
      await withTimeout(batch.commit())
    }
  }

  // Run a write against Firestore in the background and reflect the outcome in the badge.
  // The change is already on screen and saved on this device (optimistic, CHECKLIST.md #25); if the
  // account can't be reached, say so once, with a retry, rather than undoing what you did.
  async function sync(task: () => Promise<void>, done?: { ids: string[], op: PendingOp }) {
    if (demoOn.value || !signedIn.value || state.value === 'needs-setup') return
    const wasOffline = state.value === 'offline'
    state.value = 'saving'
    try {
      await task()
      if (done) clearPending(done.ids, done.op)
      state.value = 'synced'
    } catch (e) {
      state.value = needsFirestoreSetup(e) ? 'needs-setup' : 'offline'
      // Offline is already shown by the Offline badge; only a surprise failure gets a toast
      if (state.value === 'offline' && !wasOffline && navigator.onLine) {
        toast.warning('Saved on this device only', {
          description: 'Your account couldn’t be reached just now. Nothing is lost; it’ll sync when it can.',
          action: { label: 'Retry', onClick: () => load() }
        })
      }
    }
  }

  async function load() {
    if (demoOn.value) return
    const local = readCache<T>(key)
    if (firebaseConfigured()) {
      const { auth } = useFirebase()
      await auth.authStateReady()
      uid = auth.currentUser?.uid
    }
    signedIn.value = !!uid

    if (!signedIn.value) {
      state.value = 'device'
      return
    }

    try {
      const remote = await pull()
      if (!remote) return // not set up yet; keep using the device copy
      // Union by id: the cloud wins for records it has, except ones changed on this device and not yet
      // saved there (they win and get uploaded); deletes made here are carried out; device-only records get uploaded
      const pending = readPending()
      const localList = local ?? items.value
      const localById = new Map(localList.map(r => [r.id, r]))
      const remoteIds = new Set(remote.map(r => r.id))
      const merged = remote
        .filter(r => pending[r.id] !== 'delete')
        .map(r => (pending[r.id] === 'put' && localById.has(r.id) ? localById.get(r.id)! : r))
      const deviceOnly = localList.filter(r => !remoteIds.has(r.id) && pending[r.id] !== 'delete')
      const changedHere = merged.filter(r => pending[r.id] === 'put')
      const deletedHere = remote.filter(r => pending[r.id] === 'delete')
      items.value = [...merged, ...deviceOnly]
      cache()
      state.value = 'saving'
      await push([...deviceOnly, ...changedHere])
      for (const r of deletedHere) await withTimeout(deleteDoc(doc(itemsRef(uid!), r.id)))
      writePending({})
      state.value = 'synced'
      const uploaded = deviceOnly.length + changedHere.length
      if (uploaded) toast.success('Synced with Firebase', { description: `${uploaded} ${uploaded === 1 ? 'change' : 'changes'} from this device uploaded.` })
    } catch {
      state.value = 'offline'
    }
  }

  let unsubscribe: (() => void) | undefined

  onMounted(async () => {
    const local = readCache<T>(key)
    // With a cached copy, show it straight away; a first visit waits for Firestore and any examples
    if (local) {
      items.value = local
      ready.value = true
    }
    await load()

    // Example data only for a brand-new user: nothing on this device and nothing in Firestore.
    // Checked after loading so a second device doesn't add duplicate examples.
    if (!local && !items.value.length && localStorage.getItem(`${key}:seeded`) === null) {
      items.value = seed()
      try {
        localStorage.setItem(`${key}:seeded`, '1')
      } catch {}
      cache()
      const seeded = items.value
      sync(() => push(seeded))
    }
    ready.value = true

    // Signing in or out on another page (or tab) switches this list's source
    if (firebaseConfigured()) {
      unsubscribe = onAuthStateChanged(useFirebase().auth, (user) => {
        if (user?.uid !== uid) load()
      })
    }
  })
  const onStorage = (e: StorageEvent) => {
    if (e.key === key && !demoOn.value) items.value = readCache<T>(key) ?? []
  }
  // Back online after a failed save: catch the account up straight away
  const onOnline = () => {
    if (signedIn.value && state.value === 'offline') load()
  }
  onMounted(() => {
    window.addEventListener('storage', onStorage)
    window.addEventListener('online', onOnline)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('online', onOnline)
    unsubscribe?.()
  })

  return {
    items,
    ready,
    sync: { state: computed<SyncState>(() => (demoOn.value ? 'demo' : state.value)), signedIn, retry: load },
    add(item: Omit<T, 'id'>) {
      const created = { ...item, id: crypto.randomUUID() } as T
      items.value = [...items.value, created]
      cache()
      markPending([created.id], 'put')
      sync(() => push([created]), { ids: [created.id], op: 'put' })
      record('added', labelOf(created))
      return created
    },
    // For imports: one cache write and one Firestore batch however many records there are
    addMany(list: Omit<T, 'id'>[]) {
      const records = list.map(item => ({ ...item, id: crypto.randomUUID() }) as T)
      items.value = [...items.value, ...records]
      cache()
      const ids = records.map(r => r.id)
      markPending(ids, 'put')
      sync(() => push(records), { ids, op: 'put' })
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
        markPending([id], 'put')
        sync(() => push([updated]), { ids: [id], op: 'put' })
        if (!opts.quiet) record('edited', labelOf(updated))
      }
      return before
    },
    /** Put a record back exactly as it was (Undo after an edit) */
    replace(item: T) {
      if (!items.value.some(i => i.id === item.id)) return
      items.value = items.value.map(i => (i.id === item.id ? item : i))
      cache()
      markPending([item.id], 'put')
      sync(() => push([item]), { ids: [item.id], op: 'put' })
    },
    /** Deletes a record; it goes to the Recycle Bin (unless this collection opts out) */
    /** `undoAdd`: taking back something just added (Undo), so it skips the bin and the activity log */
    remove(id: string, opts: { undoAdd?: boolean } = {}) {
      const removed = items.value.find(i => i.id === id)
      items.value = items.value.filter(i => i.id !== id)
      cache()
      markPending([id], 'delete')
      sync(() => withTimeout(deleteDoc(doc(itemsRef(uid!), id))), { ids: [id], op: 'delete' })
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
      markPending([item.id], 'put')
      sync(() => push([item]), { ids: [item.id], op: 'put' })
      trash?.take([item.id])
      record('restored', labelOf(item))
    }
  }
}
