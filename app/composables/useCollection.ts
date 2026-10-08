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
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return undefined
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : undefined
  } catch {
    return undefined // corrupt or blocked storage shouldn't break the page
  }
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
  } catch {}
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
        items.value = makeDemo().map(item => ({ ...item, id: crypto.randomUUID() }) as T)
      } else {
        items.value = readCache<T>(key) ?? realItems
      }
    })
  }

  function cache() {
    if (demoOn.value) return
    try {
      localStorage.setItem(key, JSON.stringify(items.value))
    } catch {}
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

  // Run a write against Firestore in the background and reflect the outcome in the badge
  async function sync(task: () => Promise<void>) {
    if (demoOn.value || !signedIn.value || state.value === 'needs-setup') return
    state.value = 'saving'
    try {
      await task()
      state.value = 'synced'
    } catch (e) {
      state.value = needsFirestoreSetup(e) ? 'needs-setup' : 'offline'
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
      // Union by id: the cloud wins for records it has; device-only records get uploaded
      const remoteIds = new Set(remote.map(r => r.id))
      const deviceOnly = (local ?? items.value).filter(r => !remoteIds.has(r.id))
      items.value = [...remote, ...deviceOnly]
      cache()
      state.value = 'saving'
      await push(deviceOnly)
      state.value = 'synced'
      if (deviceOnly.length) toast.success('Synced with Firebase', { description: `${deviceOnly.length} ${deviceOnly.length === 1 ? 'item' : 'items'} from this device uploaded.` })
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
  onMounted(() => window.addEventListener('storage', onStorage))
  onBeforeUnmount(() => {
    window.removeEventListener('storage', onStorage)
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
      sync(() => push([created]))
      record('added', labelOf(created))
      return created
    },
    // For imports: one cache write and one Firestore batch however many records there are
    addMany(list: Omit<T, 'id'>[]) {
      const records = list.map(item => ({ ...item, id: crypto.randomUUID() }) as T)
      items.value = [...items.value, ...records]
      cache()
      sync(() => push(records))
      if (records.length) record('imported', `${records.length} ${records.length === 1 ? 'item' : 'items'}`)
      return records
    },
    /** `quiet`: background bookkeeping (visit counts, fetched icons) that isn't worth showing in activity */
    update(id: string, patch: Partial<T>, opts: { quiet?: boolean } = {}) {
      items.value = items.value.map(i => (i.id === id ? { ...i, ...patch } : i))
      cache()
      const updated = items.value.find(i => i.id === id)
      if (updated) {
        sync(() => push([updated]))
        if (!opts.quiet) record('edited', labelOf(updated))
      }
    },
    /** Deletes a record; it goes to the Recycle Bin (unless this collection opts out) */
    remove(id: string) {
      const removed = items.value.find(i => i.id === id)
      items.value = items.value.filter(i => i.id !== id)
      cache()
      sync(() => withTimeout(deleteDoc(doc(itemsRef(uid!), id))))
      if (removed) {
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
      sync(() => push([item]))
      trash?.take([item.id])
      record('restored', labelOf(item))
    }
  }
}
