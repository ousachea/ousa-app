import { toast } from 'vue-sonner'
import { onAuthStateChanged } from 'firebase/auth'

// The app's one sync session (CHECKLIST.md #77): started by plugins/sync.client.ts, it follows the
// signed-in account, keeps every tracker in step with Firestore through a single listener, and sends
// changes made on this device. Pages use it through useCollection; Settings shows its state.

export type SessionStatus = 'loading' | 'device' | EngineStatus

const state = reactive({
  status: 'loading' as SessionStatus,
  pending: 0,
  listening: false,
  lastSyncAt: '',
  lastError: '',
  errors: [] as { at: string, message: string }[]
})

let engine: SyncEngine | undefined
let started = false
let authResolved: Promise<void> | undefined
let authKnown = false
const changeHandlers = new Set<(names: string[]) => void>()

const COLLECTIONS = BACKUP_SECTIONS.map(s => s.name)
const appOf = (name: string) => BACKUP_SECTIONS.find(s => s.name === name)?.app ?? `/${name}`

function deviceId() {
  const key = 'ousa-app:device-id'
  try {
    let id = localStorage.getItem(key)
    if (!id) localStorage.setItem(key, (id = crypto.randomUUID()))
    return id
  } catch {
    return crypto.randomUUID()
  }
}

// Changes from other devices (or from sending ours) land in this device's lists; tell open pages
function changed(names: string[]) {
  for (const fn of changeHandlers) fn(names)
}

function refresh() {
  const e = engine
  state.status = e ? e.status : authKnown ? 'device' : 'loading'
  state.pending = e ? e.pending() : 0
  state.listening = !!e?.listening
  state.lastError = e?.lastError ?? ''
  state.errors = e ? [...e.errors] : []
  try {
    state.lastSyncAt = localStorage.getItem(LAST_SYNC_KEY) ?? ''
  } catch {}
}

// Both devices changed the same record: nothing is thrown away, and the person gets the final say
function conflict(c: SyncConflict) {
  const record = (c.mine ?? c.theirs)!
  const label = defaultLabel(record)
  if (c.kind === 'merged' && c.mine) {
    const mine = c.mine
    useTrash().put(c.collection, appOf(c.collection), mine, `${label} (this device’s version)`)
    toast.warning(`${label} was also changed on another device`, {
      description: 'Both changed the same details, so the other device’s version is kept. Yours is in the Recycle Bin.',
      action: { label: 'Keep mine', onClick: () => writeToCollection(c.collection, [mine], { force: true }) },
      duration: 20_000
    })
  } else if (c.kind === 'delete-over-edit') {
    toast(`${label} is back`, { description: 'It was changed on another device after you deleted it here, so the newer version is kept.', duration: 12_000 })
  } else {
    toast(`${label} was deleted on another device`, { description: 'You’d changed it here, so your version is kept.', duration: 12_000 })
  }
}

// One tab per browser runs the listener (Web Locks); the others see its updates through localStorage.
// A tab that stays hidden hands it on after a while, so a forgotten tab doesn't keep a connection open.
const HIDDEN_RELEASE_MS = 5 * 60_000
let releaseLeader: (() => void) | undefined
let abortQueue: AbortController | undefined
let hiddenTimer: ReturnType<typeof setTimeout> | undefined

function lead(e: SyncEngine) {
  if (releaseLeader || abortQueue) return
  if (!navigator.locks) {
    e.listen()
    releaseLeader = () => e.stopListening()
    return
  }
  abortQueue = new AbortController()
  navigator.locks.request(`ousa-sync-listener:${e.uid}`, { signal: abortQueue.signal }, () => new Promise<void>((release) => {
    abortQueue = undefined
    if (engine !== e) return release()
    e.listen()
    refresh()
    releaseLeader = () => {
      e.stopListening()
      release()
    }
  })).catch(() => {})
}

function stepDown() {
  releaseLeader?.()
  releaseLeader = undefined
  abortQueue?.abort()
  abortQueue = undefined
  refresh()
}

const lock = <T>(name: string, fn: () => Promise<T>) => navigator.locks ? navigator.locks.request(name, fn) as Promise<T> : fn()

function begin(uid: string) {
  const { db } = useFirebase()
  const e = new SyncEngine({
    db,
    uid,
    deviceId: deviceId(),
    collections: COLLECTIONS,
    store: localStorage,
    online: () => navigator.onLine,
    lock,
    onChange: changed,
    onConflict: conflict,
    onStatus: refresh,
    debug: import.meta.dev ? (m, d) => console.debug(`[sync] ${m}`, d ?? '') : undefined
  })
  engine = e
  refresh()
  e.start().then(() => {
    if (engine === e && document.visibilityState === 'visible') lead(e)
  })
}

function end() {
  stepDown()
  engine?.stop()
  engine = undefined
  refresh()
}

export function startSync() {
  if (started || import.meta.server) return
  started = true
  if (!firebaseConfigured()) {
    authResolved = Promise.resolve()
    authKnown = true
    refresh()
    return
  }
  const { auth } = useFirebase()
  authResolved = auth.authStateReady()
  onAuthStateChanged(auth, (user) => {
    if (user?.uid === engine?.uid) return
    end()
    if (user) begin(user.uid)
  })
  authResolved.then(() => {
    authKnown = true
    refresh()
  })

  window.addEventListener('online', () => engine?.kick())
  window.addEventListener('offline', refresh)
  document.addEventListener('visibilitychange', () => {
    clearTimeout(hiddenTimer)
    if (!engine) return
    if (document.visibilityState === 'hidden') {
      hiddenTimer = setTimeout(stepDown, HIDDEN_RELEASE_MS)
    } else {
      lead(engine)
      engine.kick()
    }
  })
  // Another tab sent changes or heard from the server
  window.addEventListener('storage', (e) => {
    if (e.key?.startsWith('ousa-app:')) refresh()
  })
  if (import.meta.dev) (window as unknown as { __ousaSync: unknown }).__ousaSync = { state, engine: () => engine, listeners }
}

/** Resolves once the account is known and, when signed in, this device has caught up (or couldn't) */
export async function syncReady() {
  startSync()
  await authResolved
  await engine?.ready
}

/** This device changed a collection: note it and send it shortly */
export function queueSync(name: string, changes: LocalChange[]) {
  try {
    markPending(localStorage, name, changes)
  } catch (e) {
    // Storage full or blocked: the change is on screen but can't be queued; useCollection warns about storage
    if (import.meta.dev) console.error('[sync] couldn’t note a change', e)
  }
  engine?.schedule()
  refresh()
}

/** Send everything now (backup restore, Recycle Bin). Throws if it couldn't be sent; it's kept and retried. */
export async function flushSync() {
  await syncReady()
  if (!engine || engine.status === 'needs-setup') return
  if (!(await engine.flush())) throw new Error('Saved on this device. It’ll sync when Firebase can be reached.')
}

/** Lists changed by sync; returns a function that stops listening */
export function onSyncChange(fn: (names: string[]) => void) {
  changeHandlers.add(fn)
  return () => changeHandlers.delete(fn)
}

export function notifySyncChange(names: string[]) {
  changed(names)
}

export function useSync() {
  startSync()
  return {
    state: readonly(state),
    retry: () => (engine ? engine.kick() : undefined),
    usage: () => readUsage(localStorage)
  }
}
