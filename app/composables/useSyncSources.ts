import type { SyncState } from '~/composables/useCollection'

// Where each list on the page keeps its data (DataSource registers one per list), gathered so the
// app icon in the header can show a single sync dot for the whole page (components/SyncDot.vue).
// Only changed in the browser, after mount, so the server never shares it between visitors.
export interface SyncSource { state: Ref<SyncState> | SyncState, retry: () => void }

const sources = shallowReactive(new Map<symbol, SyncSource>())

// The one the dot shows: whatever most needs your attention
const RANK: SyncState[] = ['error', 'offline', 'needs-setup', 'saving', 'loading', 'device', 'demo', 'synced']

export function useSyncSources() {
  const state = computed<SyncState | null>(() => {
    const states = [...sources.values()].map(s => unref(s.state))
    return RANK.find(r => states.includes(r)) ?? null
  })
  const retry = () => sources.forEach(s => s.retry())
  return { state, retry }
}

export function registerSyncSource(source: SyncSource) {
  const id = Symbol('sync')
  onMounted(() => sources.set(id, source))
  onBeforeUnmount(() => sources.delete(id))
}
