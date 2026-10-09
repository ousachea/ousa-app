<script setup lang="ts">
// Settings → Sync status (CHECKLIST.md #81): what the sync session is doing and roughly how much of
// Firebase's free daily allowance this device has used. Counts are this device's own estimate.
const { state, retry, usage } = useSync()

const LABEL: Record<SessionStatus, string> = {
  'loading': 'Checking…',
  'device': 'Signed out',
  'starting': 'Catching up…',
  'saving': 'Saving…',
  'synced': 'Synced',
  'offline': 'Offline',
  'error': 'Sync error',
  'needs-setup': 'Needs setup'
}

const now = ref(Date.now())
const today = ref(usage())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now()
    today.value = usage()
  }, 5000)
})
onBeforeUnmount(() => clearInterval(timer))
watch(() => [state.pending, state.lastSyncAt], () => (today.value = usage()))

const lastSync = computed(() => {
  if (!state.lastSyncAt) return 'Not yet'
  const s = Math.max(0, Math.round((now.value - new Date(state.lastSyncAt).getTime()) / 1000))
  if (s < 10) return 'Just now'
  if (s < 60) return `${s} seconds ago`
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  return new Date(state.lastSyncAt).toLocaleString()
})

// Warn well before this device reaches our own budget, which is itself well under Firebase's free limits
const meters = computed(() => (['reads', 'writes'] as const).map((kind) => {
  const used = today.value[kind]
  const budget = SYNC_BUDGET[kind]
  return { kind, used, budget, pct: Math.min(100, Math.round((used / budget) * 100)) }
}))
const nearBudget = computed(() => meters.value.some(m => m.pct >= 80))
</script>

<template>
  <div class="sync-status" :data-state="state.status">
    <dl>
      <div><dt>Status</dt><dd><span class="dot" aria-hidden="true" />{{ LABEL[state.status] }}</dd></div>
      <div><dt>Waiting to send</dt><dd>{{ state.pending ? `${state.pending} ${state.pending === 1 ? 'change' : 'changes'}` : 'Nothing' }}</dd></div>
      <div><dt>Last heard from Firebase</dt><dd>{{ lastSync }}</dd></div>
      <div><dt>Live updates</dt><dd>{{ state.listening ? 'On in this tab' : 'Handled by another tab, or paused' }}</dd></div>
    </dl>

    <p v-if="state.status === 'error'" class="err">{{ state.lastError || 'Firebase didn’t accept the latest changes.' }} They’re kept on this device.</p>
    <button v-if="state.status === 'offline' || state.status === 'error'" type="button" class="btn btn-sm" @click="retry">Try again</button>

    <div class="usage">
      <p class="small">Today on this device (estimate)</p>
      <div v-for="m in meters" :key="m.kind" class="meter">
        <span class="name">{{ m.kind === 'reads' ? 'Reads' : 'Writes' }}</span>
        <span class="bar" role="meter" :aria-valuenow="m.used" aria-valuemin="0" :aria-valuemax="m.budget" :aria-label="`${m.kind} today`"><span :style="{ width: `${m.pct}%` }" :class="{ warn: m.pct >= 80 }" /></span>
        <span class="num">{{ m.used.toLocaleString() }} / {{ m.budget.toLocaleString() }}</span>
      </div>
      <p v-if="nearBudget" class="err">This device is close to its daily sync budget. Syncing still works; the budget is set well below Firebase’s free limit.</p>
      <p class="small">Counted by this app, not Firebase’s billing. Firebase’s free plan allows 50,000 reads and 20,000 writes a day across all your devices; the official numbers are under Usage in the Firebase console.</p>
    </div>
  </div>
</template>

<style scoped>
.sync-status {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--line);
}

dl {
  display: grid;
  gap: 0.35rem;
  width: 100%;
  margin: 0;
}

dl div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.875rem;
}

dt {
  color: var(--ink-2);
}

dd {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  font-weight: 600;
  text-align: right;
}

.dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: var(--ink-3);
}

[data-state='synced'] .dot { background: var(--green); }
[data-state='saving'] .dot,
[data-state='starting'] .dot { background: var(--blue); }
[data-state='offline'] .dot,
[data-state='needs-setup'] .dot { background: var(--orange); }
[data-state='error'] .dot { background: var(--red); }

.usage {
  display: grid;
  gap: 0.4rem;
  width: 100%;
}

.meter {
  display: grid;
  grid-template-columns: 3.5rem 1fr auto;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.8rem;
}

.bar {
  height: 0.4rem;
  border-radius: 999px;
  background: var(--line);
  overflow: hidden;
}

.bar span {
  display: block;
  height: 100%;
  background: var(--green);
}

.bar span.warn {
  background: var(--orange);
}

.num {
  font-variant-numeric: tabular-nums;
  color: var(--ink-2);
}

.small {
  margin: 0;
  font-size: 0.8rem;
  color: var(--ink-2);
}

.err {
  margin: 0;
  font-size: 0.85rem;
  color: var(--red);
}
</style>
