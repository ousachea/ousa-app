import {
  collection, doc, getDocsFromServer, onSnapshot, query, runTransaction, serverTimestamp, Timestamp, where, writeBatch,
  type DocumentSnapshot, type Firestore, type Unsubscribe
} from 'firebase/firestore'

// The one sync engine every tracker shares (CHECKLIST.md #76–#82). Plain TypeScript with no Nuxt
// auto-imports, so the emulator tests run this exact file.
//
// This device's copy (localStorage, one list per collection) is what the pages show and edit. Each
// change is noted as pending, with a copy of the record as it was before (its "base"), until the server
// confirms it. Firestore holds one document per record under users/{uid}/items:
//   { collection, data, rev, by, syncedAt, updatedAt }, or { collection, deleted: true, … } once deleted
// - rev counts writes to the record. A device remembers the last rev it saw, so a write can tell
//   whether someone else changed the record in the meantime (checked inside a transaction).
// - syncedAt is the server's clock. One listener per signed-in session asks only for documents changed
//   since the newest one already seen, so reads scale with changes, not with how much is stored.
// - Deletes leave a small "deleted" marker instead of removing the document, so a device that was away
//   learns about them and can't bring the record back by re-uploading its old copy.

export type PendingOp =
  | 'add' // created on this device and never sent: written without reading first
  | 'put' // changed here: written in a transaction that checks for changes made elsewhere
  | 'force' // replace whatever is there (restoring a backup with Replace, Keep mine)
  | 'delete'

export type EngineStatus = 'starting' | 'saving' | 'synced' | 'offline' | 'error' | 'needs-setup'

export type SyncRecord = { id: string } & Record<string, unknown>

export interface SyncConflict {
  collection: string
  /**
   * merged: both devices changed the same fields; theirs is kept and mine is handed back for the Recycle Bin.
   * edit-over-delete: deleted elsewhere, edited here; the edit is kept.
   * delete-over-edit: deleted here, edited elsewhere afterwards; the edit is kept.
   */
  kind: 'merged' | 'edit-over-delete' | 'delete-over-edit'
  mine?: SyncRecord
  theirs?: SyncRecord
  fields?: string[]
}

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

interface RemoteDoc {
  collection?: string
  data?: SyncRecord
  rev?: number
  by?: string
  deleted?: boolean
  syncedAt?: Timestamp | null
}

// Our own daily ceiling for one device, well under Firestore's free 50,000 reads and 20,000 writes a day,
// so a busy day still leaves room for other devices. An estimate, not Firebase's billing numbers.
export const SYNC_BUDGET = { reads: 15_000, writes: 5_000 }

const BATCH_LIMIT = 400 // Firestore allows 500 writes per batch or transaction
const TX_CHUNK = 100
const FLUSH_DELAY = 800 // rapid changes in a row go out together
const MAX_ATTEMPTS = 6 // then stop retrying on our own and show Sync error
const TIMEOUT = 15_000

export const listKey = (name: string) => `ousa-app:${name}`
const pendingKey = (name: string) => `ousa-app:${name}:pending`
const baseKey = (name: string) => `ousa-app:${name}:base`
const metaKey = (uid: string) => `ousa-app:sync:${uid}`
const USAGE_KEY = 'ousa-app:sync-usage'
export const LAST_SYNC_KEY = 'ousa-app:sync-last'

// ---------- This device's copy ----------

function readJson<T>(store: KeyValueStore, key: string, fallback: T): T {
  try {
    const raw = store.getItem(key)
    if (raw === null) return fallback
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed as T : fallback
  } catch {
    return fallback
  }
}

function writeJson(store: KeyValueStore, key: string, value: unknown, empty = false) {
  try {
    if (empty) store.removeItem(key)
    else store.setItem(key, JSON.stringify(value))
  } catch {}
}

const readList = (store: KeyValueStore, name: string) => {
  const list = readJson<SyncRecord[]>(store, listKey(name), [])
  return Array.isArray(list) ? list : []
}
const readPending = (store: KeyValueStore, name: string) => readJson<Record<string, PendingOp>>(store, pendingKey(name), {})
const readBase = (store: KeyValueStore, name: string) => readJson<Record<string, SyncRecord | null>>(store, baseKey(name), {})
const writePending = (store: KeyValueStore, name: string, p: Record<string, PendingOp>) => writeJson(store, pendingKey(name), p, !Object.keys(p).length)
const writeBase = (store: KeyValueStore, name: string, b: Record<string, SyncRecord | null>) => writeJson(store, baseKey(name), b, !Object.keys(b).length)

export interface LocalChange {
  id: string
  op: PendingOp
  /** The record before this change (undefined when it's new or coming back from the bin) */
  before?: SyncRecord
}

/**
 * Note changes made on this device (already in its list) so they're sent when the account can be reached.
 * Works signed out too: the first sync after signing in sends them.
 */
export function markPending(store: KeyValueStore, name: string, changes: LocalChange[]) {
  if (!changes.length) return
  const pending = readPending(store, name)
  const base = readBase(store, name)
  for (const { id, op, before } of changes) {
    const prev = pending[id]
    if (prev === 'add' && op === 'delete') {
      // Made and deleted before it ever reached the server: nothing to send
      delete pending[id]
      delete base[id]
      continue
    }
    pending[id] = prev === 'add' && op === 'put' ? 'add' : prev === 'force' && op === 'put' ? 'force' : op
    // The base is the record as the server last had it, kept from the first unsent change
    // A JSON copy: records often arrive as Vue reactive proxies, which structuredClone refuses
    if (!(id in base)) base[id] = before ? JSON.parse(JSON.stringify(before)) as SyncRecord : null
  }
  writePending(store, name, pending)
  writeBase(store, name, base)
}

export function pendingCount(store: KeyValueStore, names: readonly string[]) {
  return names.reduce((n, name) => n + Object.keys(readPending(store, name)).length, 0)
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Three-way merge of one record. Fields only one side changed are taken from that side; fields both
 * changed differently are conflicts and keep `theirs`. Without a base, every differing field is a conflict.
 */
export function merge3(base: SyncRecord | null | undefined, mine: SyncRecord, theirs: SyncRecord) {
  const merged: SyncRecord = { ...theirs, id: mine.id }
  const conflicts: string[] = []
  for (const k of new Set([...Object.keys(mine), ...Object.keys(theirs)])) {
    if (k === 'id') continue
    const m = mine[k]
    const t = theirs[k]
    if (same(m, t)) continue
    if (base && same(base[k], t)) {
      // Only this device changed it
      if (m === undefined) delete merged[k]
      else merged[k] = m
    } else if (!base || !same(base[k], m)) {
      conflicts.push(k)
    }
  }
  return { merged, conflicts }
}

// ---------- Estimated usage, this device only ----------

export interface Usage {
  day: string
  reads: number
  writes: number
}

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function readUsage(store: KeyValueStore): Usage {
  const u = readJson<Usage>(store, USAGE_KEY, { day: today(), reads: 0, writes: 0 })
  return u.day === today() ? u : { day: today(), reads: 0, writes: 0 }
}

// Live Firestore listeners in this tab (the sync listener and the vault's), for diagnostics
export const listeners = { count: 0 }

const errorCode = (e: unknown) => (e as { code?: string } | null)?.code ?? ''
const needsSetup = (e: unknown) => ['permission-denied', 'not-found'].includes(errorCode(e))
const isOffline = (e: unknown) => ['unavailable', 'deadline-exceeded'].includes(errorCode(e)) || (e instanceof Error && e.message === 'timeout')

function withTimeout<T>(promise: Promise<T>, ms = TIMEOUT) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error('timeout')), ms)))
  ]).finally(() => clearTimeout(timer))
}

// ---------- The engine ----------

export interface EngineOptions {
  db: Firestore
  uid: string
  /** Stable per browser; written into each record so a device recognises its own writes */
  deviceId: string
  collections: readonly string[]
  store: KeyValueStore
  online?: () => boolean
  /** Runs fn while no other tab of this browser is sending changes (Web Locks) */
  lock?: <T>(name: string, fn: () => Promise<T>) => Promise<T>
  /** This device's lists changed because of remote data */
  onChange?: (collections: string[]) => void
  onConflict?: (c: SyncConflict) => void
  onStatus?: () => void
  debug?: (message: string, data?: unknown) => void
}

interface Meta {
  /** Newest syncedAt seen, [seconds, nanoseconds]; null until this device has done its first full sync */
  cursor: [number, number] | null
  /** Last rev this device saw (or wrote) per record id */
  revs: Record<string, number>
}

interface Task {
  name: string
  id: string
  op: PendingOp
  rec?: SyncRecord
  base: SyncRecord | null | undefined
  /** What the record looked like when it was sent, to tell whether it changed again meanwhile */
  sent: string
}

interface Decision {
  rev: number
  write?: Record<string, unknown>
  /** What this device's copy becomes (merged, or the other device's version kept) */
  local?: SyncRecord | null
  conflict?: SyncConflict
}

export class SyncEngine {
  readonly uid: string
  status: EngineStatus = 'starting'
  lastError = ''
  errors: { at: string, message: string }[] = []
  /** Whether this tab currently runs the listener (one tab per browser does) */
  listening = false
  ready: Promise<void>

  private o: Required<Omit<EngineOptions, 'onChange' | 'onConflict' | 'onStatus' | 'debug'>> & EngineOptions
  private unsubscribe?: Unsubscribe
  private stopped = false
  private flushing?: Promise<boolean>
  private again = false
  private flushTimer?: ReturnType<typeof setTimeout>
  private retryTimer?: ReturnType<typeof setTimeout>
  private attempt = 0
  private failure: 'offline' | 'error' | 'setup' | null = null
  private initialised = false
  private resolveReady!: () => void

  constructor(options: EngineOptions) {
    this.o = { online: () => true, lock: (_n, fn) => fn(), ...options }
    this.uid = options.uid
    this.ready = new Promise(r => (this.resolveReady = r))
  }

  private get items() {
    return collection(this.o.db, 'users', this.uid, 'items')
  }

  private meta(): Meta {
    const m = readJson<Meta>(this.o.store, metaKey(this.uid), { cursor: null, revs: {} })
    return { cursor: Array.isArray(m.cursor) ? m.cursor : null, revs: m.revs && typeof m.revs === 'object' ? m.revs : {} }
  }

  private saveMeta(m: Meta) {
    writeJson(this.o.store, metaKey(this.uid), m)
  }

  private count(kind: 'reads' | 'writes', n: number) {
    if (n <= 0) return
    const u = readUsage(this.o.store)
    u[kind] += n
    writeJson(this.o.store, USAGE_KEY, u)
  }

  private log(message: string, data?: unknown) {
    this.o.debug?.(message, data)
  }

  pending() {
    return pendingCount(this.o.store, this.o.collections)
  }

  /** First sync, then keep sending pending changes. The listener is started separately (see listen). */
  async start() {
    try {
      if (!this.meta().cursor) await this.fullSync()
      this.initialised = true
      this.failure = null
    } catch (e) {
      this.fail(e)
    } finally {
      this.resolveReady()
      this.update()
    }
    if (this.initialised && this.pending()) this.schedule(0)
  }

  stop() {
    this.stopped = true
    this.stopListening()
    clearTimeout(this.flushTimer)
    clearTimeout(this.retryTimer)
  }

  /** Called when the connection comes back, the tab is shown again, or the person presses Try again */
  kick() {
    if (this.stopped) return
    this.attempt = 0
    if (this.failure !== 'setup') this.failure = null
    if (!this.initialised) {
      this.start()
      return
    }
    if (this.pending()) this.schedule(0)
    this.update()
  }

  // A device's first sync with this account: read everything once, then only changes from here on
  private async fullSync() {
    this.log('full sync')
    const snap = await withTimeout(getDocsFromServer(this.items))
    this.count('reads', Math.max(1, snap.size))
    const remoteIds = new Set(snap.docs.map(d => d.id))
    this.applyRemote(snap.docs.map(d => ({ id: d.id, data: d.data() as RemoteDoc })))
    // Anything only this device has (saved before signing in, or before sync existed) gets uploaded
    for (const name of this.o.collections) {
      const pending = readPending(this.o.store, name)
      const missing = readList(this.o.store, name).filter(r => !remoteIds.has(r.id) && !pending[r.id])
      markPending(this.o.store, name, missing.map(r => ({ id: r.id, op: 'add' as const })))
    }
    const m = this.meta()
    if (!m.cursor) {
      m.cursor = [0, 0]
      this.saveMeta(m)
    }
  }

  listen() {
    if (this.unsubscribe || this.stopped) return
    const c = this.meta().cursor ?? [0, 0]
    this.log('listening from', c)
    const q = query(this.items, where('syncedAt', '>', new Timestamp(c[0], c[1])))
    let first = true
    listeners.count++
    this.listening = true
    const unsub = onSnapshot(q, (snap) => {
      // Our own batch writes show up here first as local, unconfirmed copies; wait for the server's
      const changes = snap.docChanges().filter(ch => !ch.doc.metadata.hasPendingWrites)
      if (!snap.metadata.fromCache) {
        // A listener is billed one read per document it returns, and at least one for its first answer
        this.count('reads', first ? Math.max(1, changes.length) : changes.length)
        first = false
      }
      if (changes.length) {
        this.log(`${changes.length} remote change(s)`)
        this.applyRemote(changes.map(ch => ({ id: ch.doc.id, data: ch.type === 'removed' ? null : ch.doc.data() as RemoteDoc })))
      }
      if (!snap.metadata.fromCache) {
        try {
          this.o.store.setItem(LAST_SYNC_KEY, new Date().toISOString())
        } catch {}
        if (this.failure === 'offline') this.failure = null
        this.update()
      }
    }, (e) => {
      this.stopListening()
      this.fail(e)
    })
    this.unsubscribe = () => {
      unsub()
      listeners.count--
    }
  }

  stopListening() {
    this.unsubscribe?.()
    this.unsubscribe = undefined
    this.listening = false
  }

  /** Restart the listener from the newest change seen, so a long-lived one doesn't re-read old changes after a reconnect */
  relisten() {
    this.stopListening()
    this.listen()
  }

  // Bring remote documents into this device's lists. Records with a change of our own still waiting
  // to be sent are left alone: sending it checks against the server and sorts out any conflict.
  private applyRemote(entries: { id: string, data: RemoteDoc | null }[]) {
    const store = this.o.store
    const m = this.meta()
    const lists = new Map<string, { list: SyncRecord[], index: Map<string, number> }>()
    const pendingOf = new Map<string, Record<string, PendingOp>>()
    const touched = new Set<string>()
    const listOf = (name: string) => {
      let l = lists.get(name)
      if (!l) {
        const list = readList(store, name)
        l = { list, index: new Map(list.map((r, i) => [r.id, i])) }
        lists.set(name, l)
      }
      return l
    }
    const pending = (name: string) => {
      let p = pendingOf.get(name)
      if (!p) pendingOf.set(name, (p = readPending(store, name)))
      return p
    }
    // A document deleted outright (by an older version of the app) only tells us its id
    const findCollection = (id: string) => this.o.collections.find(n => listOf(n).index.has(id))

    for (const { id, data } of entries) {
      const at = data?.syncedAt
      if (at && (!m.cursor || at.seconds > m.cursor[0] || (at.seconds === m.cursor[0] && at.nanoseconds > m.cursor[1]))) {
        m.cursor = [at.seconds, at.nanoseconds]
      }
      const name = data ? data.collection : findCollection(id)
      // A collection this version of the app doesn't know: leave it for the version that does
      if (!name || !this.o.collections.includes(name)) continue
      if (pending(name)[id]) continue
      const rev = data?.rev ?? 0
      const known = m.revs[id]
      if (data && rev > 0 && known !== undefined && rev <= known) continue // already have it (often our own write)
      const { list, index } = listOf(name)
      const at_ = index.get(id)
      if (!data || data.deleted || !data.data) {
        if (at_ !== undefined) {
          list.splice(at_, 1)
          index.clear()
          list.forEach((r, i) => index.set(r.id, i))
          touched.add(name)
        }
        if (data) m.revs[id] = rev
        else delete m.revs[id]
        continue
      }
      const rec = { ...data.data, id }
      if (at_ === undefined) {
        index.set(id, list.length)
        list.push(rec)
        touched.add(name)
      } else if (!same(list[at_], rec)) {
        list[at_] = rec
        touched.add(name)
      }
      m.revs[id] = rev
    }
    for (const name of touched) writeJson(store, listKey(name), lists.get(name)!.list)
    this.saveMeta(m)
    if (touched.size) this.o.onChange?.([...touched])
  }

  // ---------- Sending changes ----------

  /** Send pending changes after a short pause, so a burst of edits becomes one round of writes */
  schedule(delay = FLUSH_DELAY) {
    if (this.stopped) return
    clearTimeout(this.flushTimer)
    this.flushTimer = setTimeout(() => this.flush(), delay)
    this.update()
  }

  /** Send everything pending now; resolves true once the server has confirmed it */
  flush(): Promise<boolean> {
    if (this.stopped) return Promise.resolve(false)
    clearTimeout(this.flushTimer)
    if (this.flushing) {
      // Changes made during a send go out right after it
      this.again = true
      return this.flushing
    }
    this.flushing = (async () => {
      this.update()
      try {
        do {
          this.again = false
          await this.o.lock(`ousa-sync-send:${this.uid}`, () => this.flushOnce())
        } while (this.again && !this.stopped)
        this.attempt = 0
        if (this.failure !== 'setup') this.failure = null
        return true
      } catch (e) {
        this.fail(e, true)
        return false
      } finally {
        this.flushing = undefined
        this.update()
      }
    })()
    return this.flushing
  }

  private async flushOnce() {
    if (!this.initialised) throw new Error('timeout') // not caught up with the server yet; treated as offline
    if (!this.o.online()) throw Object.assign(new Error('offline'), { code: 'unavailable' })
    const store = this.o.store
    const adds: Task[] = []
    const checked: Task[] = []
    for (const name of this.o.collections) {
      const pending = readPending(store, name)
      const ids = Object.keys(pending)
      if (!ids.length) continue
      const base = readBase(store, name)
      const byId = new Map(readList(store, name).map(r => [r.id, r]))
      for (const id of ids) {
        const op = pending[id]!
        const rec = byId.get(id)
        if (op !== 'delete' && !rec) {
          // Gone from this device before it was sent (and not a delete): nothing to send
          this.settle(name, id, op, true)
          continue
        }
        const task: Task = { name, id, op, rec, base: base[id], sent: op === 'delete' ? '' : JSON.stringify(rec) }
        if (op === 'add') adds.push(task)
        else checked.push(task)
      }
    }
    if (!adds.length && !checked.length) return
    this.log(`sending ${adds.length} new, ${checked.length} changed`)

    // New records: nobody else can have changed them, so write without reading first
    for (let i = 0; i < adds.length; i += BATCH_LIMIT) {
      const chunk = adds.slice(i, i + BATCH_LIMIT)
      const batch = writeBatch(this.o.db)
      const revs = this.meta().revs
      const decisions = chunk.map((t) => {
        const rev = (revs[t.id] ?? 0) + 1
        batch.set(doc(this.items, t.id), this.full(t.name, t.rec!, rev))
        return { rev } as Decision
      })
      try {
        await withTimeout(batch.commit())
      } catch (e) {
        // It may have arrived without us hearing back, so from now on check before writing them again
        for (const t of chunk) {
          const p = readPending(store, t.name)
          if (p[t.id] === 'add') p[t.id] = 'put'
          writePending(store, t.name, p)
        }
        throw e
      }
      this.count('writes', chunk.length)
      this.finish(chunk, decisions)
    }

    // Changes and deletes: read the server's copy in a transaction and write only if it's safe
    for (let i = 0; i < checked.length; i += TX_CHUNK) {
      const chunk = checked.slice(i, i + TX_CHUNK)
      const revs = this.meta().revs
      const decisions = await withTimeout(runTransaction(this.o.db, async (tx) => {
        const snaps = await Promise.all(chunk.map(t => tx.get(doc(this.items, t.id))))
        const out = chunk.map((t, j) => this.decide(t, snaps[j]!, revs[t.id]))
        chunk.forEach((t, j) => {
          const w = out[j]!.write
          if (w) tx.set(doc(this.items, t.id), w)
        })
        return out
      }, { maxAttempts: 3 }))
      this.count('reads', chunk.length)
      this.count('writes', decisions.filter(d => d.write).length)
      this.finish(chunk, decisions)
    }
  }

  private full(name: string, rec: SyncRecord, rev: number) {
    return { collection: name, data: rec, rev, by: this.o.deviceId, syncedAt: serverTimestamp(), updatedAt: new Date().toISOString() }
  }

  private tombstone(name: string, rev: number) {
    return { collection: name, deleted: true, rev, by: this.o.deviceId, syncedAt: serverTimestamp(), updatedAt: new Date().toISOString() }
  }

  private decide(t: Task, snap: DocumentSnapshot, knownRev: number | undefined): Decision {
    const s = snap.exists() ? snap.data() as RemoteDoc : undefined
    const serverRev = s?.rev ?? 0
    const baseRev = knownRev ?? 0
    // Changed on another device since this device last saw it (documents from before revs count as 0)
    const changedElsewhere = !!s && serverRev > baseRev && t.op !== 'force'
    const next = Math.max(serverRev, baseRev) + 1

    if (t.op === 'delete') {
      if (!s || s.deleted) return { rev: serverRev }
      if (changedElsewhere && s.data) {
        return { rev: serverRev, local: { ...s.data, id: t.id }, conflict: { collection: t.name, kind: 'delete-over-edit', theirs: { ...s.data, id: t.id } } }
      }
      return { rev: next, write: this.tombstone(t.name, next) }
    }

    const mine = t.rec!
    if (!s || !changedElsewhere) return { rev: next, write: this.full(t.name, mine, next) }
    if (s.deleted || !s.data) {
      return { rev: next, write: this.full(t.name, mine, next), conflict: { collection: t.name, kind: 'edit-over-delete', mine } }
    }
    const theirs = { ...s.data, id: t.id }
    const { merged, conflicts } = merge3(t.base, mine, theirs)
    return {
      rev: next,
      write: this.full(t.name, merged, next),
      local: same(merged, mine) ? undefined : merged,
      conflict: conflicts.length ? { collection: t.name, kind: 'merged', mine, theirs, fields: conflicts } : undefined
    }
  }

  // The server has confirmed: remember the revs, update this device's copy if the outcome differs,
  // and clear each pending change unless the record was changed again while it was being sent
  private finish(tasks: Task[], decisions: Decision[]) {
    const store = this.o.store
    const m = this.meta()
    const touched = new Set<string>()
    const conflicts: SyncConflict[] = []
    tasks.forEach((t, i) => {
      const d = decisions[i]!
      m.revs[t.id] = d.rev
      const list = readList(store, t.name)
      const current = list.find(r => r.id === t.id)
      const unchanged = t.op === 'delete' ? !current : JSON.stringify(current) === t.sent
      if (unchanged && d.local !== undefined) {
        const next = d.local ? (current ? list.map(r => (r.id === t.id ? d.local! : r)) : [...list, d.local]) : list.filter(r => r.id !== t.id)
        writeJson(store, listKey(t.name), next)
        touched.add(t.name)
      }
      this.settle(t.name, t.id, t.op, unchanged, d.local !== undefined ? d.local : t.op === 'delete' ? null : t.rec!)
      if (d.conflict) conflicts.push(d.conflict)
    })
    this.saveMeta(m)
    if (touched.size) this.o.onChange?.([...touched])
    for (const c of conflicts) this.o.onConflict?.(c)
  }

  private settle(name: string, id: string, op: PendingOp, unchanged: boolean, serverCopy?: SyncRecord | null) {
    const store = this.o.store
    const pending = readPending(store, name)
    const base = readBase(store, name)
    if (unchanged && pending[id] === op) {
      delete pending[id]
      delete base[id]
    } else if (serverCopy !== undefined) {
      // Changed again meanwhile: what the server now has is the base for the next send
      base[id] = serverCopy
      if (pending[id] === 'add') pending[id] = 'put'
    }
    writePending(store, name, pending)
    writeBase(store, name, base)
  }

  // ---------- Status and retries ----------

  private fail(e: unknown, retry = false) {
    const message = e instanceof Error ? e.message : String(e)
    this.log('failed', e)
    if (needsSetup(e)) {
      this.failure = 'setup'
    } else {
      this.failure = isOffline(e) || !this.o.online() ? 'offline' : 'error'
      if (this.failure === 'error') {
        this.lastError = message
        this.errors = [{ at: new Date().toISOString(), message }, ...this.errors].slice(0, 10)
      }
      // Bounded exponential backoff with jitter; after MAX_ATTEMPTS wait for the connection, a new change or Try again
      if ((retry || !this.initialised) && this.attempt < MAX_ATTEMPTS && !this.stopped) {
        const ceiling = Math.min(60_000, 1000 * 2 ** this.attempt++)
        clearTimeout(this.retryTimer)
        this.retryTimer = setTimeout(() => (this.initialised ? this.flush() : this.start()), ceiling / 2 + Math.random() * ceiling / 2)
      } else if (this.failure === 'offline' && this.o.online() && this.attempt >= MAX_ATTEMPTS) {
        this.failure = 'error'
        this.lastError = 'Couldn’t reach Firebase after several tries.'
      }
    }
    this.update()
  }

  private update() {
    const prev = this.status
    const pending = this.pending()
    this.status
      = this.failure === 'setup'
        ? 'needs-setup'
        : !this.o.online() || this.failure === 'offline'
          ? 'offline'
          : this.failure === 'error'
            ? 'error'
            : !this.initialised
              ? 'starting'
              : this.flushing || pending
                ? 'saving'
                : 'synced'
    if (prev !== this.status) this.log(`status ${this.status}`)
    this.o.onStatus?.()
  }
}
