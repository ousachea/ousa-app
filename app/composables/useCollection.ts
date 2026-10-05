import type { PostgrestError } from '@supabase/supabase-js'
import { toast } from 'vue-sonner'

// A list of records for the personal trackers (Things I own, Renewals, Countdown…).
// Always cached in this browser; when signed in to Supabase it also syncs to the user_items table,
// so the same data appears on every device.

export interface StoredItem {
  id: string
}

export type SyncState =
  | 'loading' // reading storage
  | 'device' // signed out: this device only
  | 'saving' // writing to Supabase
  | 'synced' // matches Supabase
  | 'offline' // signed in, but Supabase couldn't be reached; changes kept on this device
  | 'needs-setup' // signed in, but the user_items table doesn't exist yet

export const SYNC_TABLE = 'user_items'

const isMissingTable = (e: PostgrestError | null) => e?.code === 'PGRST205' || e?.code === '42P01'

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

export function useCollection<T extends StoredItem>(name: string, seed: () => T[] = () => []) {
  const key = `ousa-app:${name}`
  const items = ref<T[]>([]) as Ref<T[]>
  const ready = ref(false)
  const state = ref<SyncState>('loading')
  const signedIn = ref(false)

  function cache() {
    try {
      localStorage.setItem(key, JSON.stringify(items.value))
    } catch {}
  }

  // ---------- Supabase ----------
  async function pull(): Promise<T[] | undefined> {
    const { data, error } = await useSupabase().from(SYNC_TABLE).select('data').eq('collection', name)
    if (isMissingTable(error)) {
      state.value = 'needs-setup'
      return undefined
    }
    if (error) throw error
    return (data ?? []).map(row => row.data as T)
  }

  async function push(records: T[]) {
    if (!records.length) return
    const { error } = await useSupabase().from(SYNC_TABLE).upsert(records.map(r => ({ id: r.id, collection: name, data: r, updated_at: new Date().toISOString() })))
    if (error) throw error
  }

  // Run a write against Supabase in the background and reflect the outcome in the badge
  async function sync(task: () => PromiseLike<{ error: PostgrestError | null }> | Promise<void>) {
    if (!signedIn.value || state.value === 'needs-setup') return
    state.value = 'saving'
    try {
      const result = await task()
      if (result && 'error' in result && result.error) throw result.error
      state.value = 'synced'
    } catch (e) {
      state.value = isMissingTable(e as PostgrestError) ? 'needs-setup' : 'offline'
    }
  }

  async function load() {
    const supabase = useSupabase()
    const local = readCache<T>(key)
    const { data } = await supabase.auth.getSession()
    signedIn.value = !!data.session

    if (!signedIn.value) {
      state.value = 'device'
      return
    }

    try {
      const remote = await pull()
      if (!remote) return // table missing; keep using the device copy
      // Union by id: the cloud wins for records it has; device-only records get uploaded
      const remoteIds = new Set(remote.map(r => r.id))
      const deviceOnly = (local ?? items.value).filter(r => !remoteIds.has(r.id))
      items.value = [...remote, ...deviceOnly]
      cache()
      state.value = 'saving'
      await push(deviceOnly)
      state.value = 'synced'
      if (deviceOnly.length) toast.success('Synced with Supabase', { description: `${deviceOnly.length} ${deviceOnly.length === 1 ? 'item' : 'items'} from this device uploaded.` })
    } catch {
      state.value = 'offline'
    }
  }

  let unsubscribe: (() => void) | undefined

  onMounted(async () => {
    const local = readCache<T>(key)
    // With a cached copy, show it straight away; a first visit waits for Supabase and any examples
    if (local) {
      items.value = local
      ready.value = true
    }
    await load()

    // Example data only for a brand-new user: nothing on this device and nothing in Supabase.
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
    const { data } = useSupabase().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') load()
    })
    unsubscribe = () => data.subscription.unsubscribe()
  })

  const onStorage = (e: StorageEvent) => {
    if (e.key === key) items.value = readCache<T>(key) ?? []
  }
  onMounted(() => window.addEventListener('storage', onStorage))
  onBeforeUnmount(() => {
    window.removeEventListener('storage', onStorage)
    unsubscribe?.()
  })

  return {
    items,
    ready,
    sync: { state, signedIn, retry: load },
    add(item: Omit<T, 'id'>) {
      const record = { ...item, id: crypto.randomUUID() } as T
      items.value = [...items.value, record]
      cache()
      sync(() => push([record]))
      return record
    },
    // For imports: one cache write and one Supabase request however many records there are
    addMany(list: Omit<T, 'id'>[]) {
      const records = list.map(item => ({ ...item, id: crypto.randomUUID() }) as T)
      items.value = [...items.value, ...records]
      cache()
      sync(() => push(records))
      return records
    },
    update(id: string, patch: Partial<T>) {
      items.value = items.value.map(i => (i.id === id ? { ...i, ...patch } : i))
      cache()
      const record = items.value.find(i => i.id === id)
      if (record) sync(() => push([record]))
    },
    remove(id: string) {
      const removed = items.value.find(i => i.id === id)
      items.value = items.value.filter(i => i.id !== id)
      cache()
      sync(() => useSupabase().from(SYNC_TABLE).delete().eq('id', id))
      return removed
    },
    // Put a removed item back (for Undo)
    restore(item: T) {
      if (items.value.some(i => i.id === item.id)) return
      items.value = [...items.value, item]
      cache()
      sync(() => push([item]))
    }
  }
}

export const SYNC_SETUP_SQL = `create table public.user_items (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  collection text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index user_items_owner_collection on public.user_items (user_id, collection);

alter table public.user_items enable row level security;

create policy "Owners can read their items"
  on public.user_items for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Owners can add items"
  on public.user_items for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Owners can update their items"
  on public.user_items for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Owners can delete their items"
  on public.user_items for delete to authenticated
  using ((select auth.uid()) = user_id);`
