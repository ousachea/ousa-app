<script setup lang="ts">
import type { Activity } from '~/composables/useActivity'

// Recent activity across every app, grouped by day (CHECKLIST.md #10). `limit` keeps it short on the
// dashboard; "Show more" reveals the rest of what's kept.
const props = withDefaults(defineProps<{ limit?: number }>(), { limit: 8 })
const { log, clear } = useActivity()
const { play } = useSound()
const showAll = ref(false)
const confirmClear = ref(false)

const shown = computed(() => (showAll.value ? log.value : log.value.slice(0, props.limit)))

const dayKey = (iso: string) => new Date(iso).toDateString()
function dayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(Date.now() - 86_400_000)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
}

const days = computed(() => {
  const out: { key: string, label: string, items: Activity[] }[] = []
  for (const a of shown.value) {
    const key = dayKey(a.at)
    const last = out[out.length - 1]
    if (last?.key === key) last.items.push(a)
    else out.push({ key, label: dayLabel(a.at), items: [a] })
  }
  return out
})

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

function clearAll() {
  clear()
  confirmClear.value = false
  play('delete')
}
</script>

<template>
  <div class="activity">
    <template v-if="log.length">
      <section v-for="d in days" :key="d.key" class="day" :aria-label="d.label">
        <h3>{{ d.label }}</h3>
        <ol>
          <li v-for="a in d.items" :key="a.id">
            <NuxtLink :to="a.kind === 'deleted' ? '/trash' : a.app" class="row">
              <time :datetime="a.at">{{ time(a.at) }}</time>
              <span class="icon" aria-hidden="true" :style="{ '--c': pageFor(a.app)?.color ?? 'var(--slate)', '--on-c': pageFor(a.app)?.onColor ?? '#fff' }">
                <ToolIcon :name="pageFor(a.app)?.icon ?? 'list'" />
              </span>
              <span class="text">
                <span class="verb" :class="a.kind">{{ ACTIVITY_VERB[a.kind] }}</span>
                <span class="label">{{ a.label }}</span>
              </span>
              <span class="app">{{ pageFor(a.app)?.name }}</span>
            </NuxtLink>
          </li>
        </ol>
      </section>
      <div class="foot">
        <button v-if="log.length > limit" type="button" class="link" @click="showAll = !showAll">
          {{ showAll ? 'Show less' : `Show all ${log.length}` }}
        </button>
        <button type="button" class="link danger" @click="confirmClear = true">Clear history</button>
      </div>
    </template>
    <EmptyState v-else title="Nothing yet" icon="activity">
      Things you add, change, delete or restore in any app show up here, newest first.
    </EmptyState>

    <ConfirmDialog :open="confirmClear" title="Clear your activity history?" confirm-label="Clear history" @confirm="clearAll" @close="confirmClear = false">
      <p>This only clears the list of what happened. Nothing you’ve saved is deleted.</p>
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.day + .day {
  margin-top: 0.9rem;
}

h3 {
  margin: 0 0 0.35rem 0.5rem;
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-3);
}

ol {
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-height: 2.75rem;
  padding: 0.3rem 0.5rem;
  color: var(--ink);
  text-decoration: none;
  border-radius: var(--radius);
  transition: background-color var(--dur-fast);
}

.row:hover {
  background: var(--surface-2);
}

time {
  flex: none;
  width: 2.9rem;
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
  color: var(--ink-3);
}

.icon {
  flex: none;
  width: 1.75rem;
  height: 1.75rem;
  display: grid;
  place-items: center;
  font-size: 0.95rem;
  color: var(--on-c);
  background: var(--c);
  border-radius: 8px;
}

.text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.verb {
  font-weight: 600;
  margin-right: 0.3em;
  color: var(--ink-2);
}

.verb.deleted {
  color: var(--bad-ink);
}

.verb.restored,
.verb.added {
  color: var(--good-ink);
}

.app {
  flex: none;
  font-size: var(--text-sm);
  color: var(--ink-3);
}

.foot {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 0.75rem;
  padding: 0 0.5rem;
}

.foot .link.danger {
  margin-left: auto;
}

@media (max-width: 480px) {
  .app {
    display: none;
  }
}
</style>
