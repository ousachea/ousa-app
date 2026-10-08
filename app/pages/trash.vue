<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { TrashEntry } from '~/composables/useTrash'

// Recycle Bin for every tracker: restore things, or delete them for good (CHECKLIST.md #02, #41)
const { entries, take, keepDays } = useTrash()
const { play } = useSound()

// ---------- Filter by app ----------
const appFilter = ref<string>() // undefined = everything
const apps = computed(() => {
  const counts = new Map<string, number>()
  for (const e of entries.value) counts.set(e.app, (counts.get(e.app) ?? 0) + 1)
  return [...counts].map(([to, count]) => ({ to, count, tool: pageFor(to) }))
})
const shown = computed(() => entries.value.filter(e => !appFilter.value || e.app === appFilter.value))
watch(apps, (list) => {
  if (appFilter.value && !list.some(a => a.to === appFilter.value)) appFilter.value = undefined
})

// ---------- Selection ----------
const selected = ref(new Set<string>())
const selectedShown = computed(() => shown.value.filter(e => selected.value.has(e.id)))
const allChecked = computed(() => shown.value.length > 0 && selectedShown.value.length === shown.value.length)
const someChecked = computed(() => selectedShown.value.length > 0 && !allChecked.value)

function toggle(id: string) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

function toggleAll() {
  selected.value = allChecked.value ? new Set() : new Set(shown.value.map(e => e.id))
}

// Anything that left the bin can't stay selected
watch(entries, (list) => {
  const ids = new Set(list.map(e => e.id))
  selected.value = new Set([...selected.value].filter(id => ids.has(id)))
})

// ---------- Restore ----------
async function restore(list: readonly TrashEntry[]) {
  if (!list.length) return
  const taken = take(list.map(e => e.id))
  const byCollection = new Map<string, TrashEntry[]>()
  for (const e of taken) byCollection.set(e.collection, [...(byCollection.get(e.collection) ?? []), e])
  try {
    for (const [name, group] of byCollection) await writeToCollection(name, group.map(e => e.item))
    for (const e of taken) logActivity('restored', e.app, e.label)
    play('success')
    toast.success(list.length === 1 ? `${list[0]!.label} restored` : `${list.length} items restored`, {
      description: list.length === 1 ? `It’s back in ${pageFor(list[0]!.app)?.name ?? 'its app'}.` : 'They’re back where they were.'
    })
  } catch {
    // Saved on this device even if the cloud copy failed; it syncs next time the app opens
    toast.warning('Restored on this device', { description: 'It couldn’t reach your account just now. It’ll sync next time you open the app.' })
  }
}

// ---------- Delete for good (always asks first) ----------
const pending = ref<readonly TrashEntry[]>([])
const confirmOpen = computed(() => pending.value.length > 0)

function askDelete(list: readonly TrashEntry[]) {
  if (!list.length) return
  pending.value = [...list]
  play('warning')
}

function deleteForGood() {
  const n = pending.value.length
  const one = pending.value[0]
  take(pending.value.map(e => e.id))
  pending.value = []
  play('delete')
  toast(n === 1 ? `${one!.label} deleted for good` : `${n} items deleted for good`)
}

function ago(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

function daysLeft(iso: string) {
  const left = keepDays - Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return left <= 1 ? 'goes tomorrow' : `${left} days left`
}
</script>

<template>
  <ToolPage :tool="TRASH" header="bar" width="980px">
    <ClientOnly>
      <template v-if="entries.length">
        <!-- Filter by app -->
        <div v-if="apps.length > 1" class="filters" role="radiogroup" aria-label="Show">
          <button type="button" role="radio" class="chip" :aria-checked="!appFilter" @click="appFilter = undefined">
            Everything <b>{{ entries.length }}</b>
          </button>
          <button
            v-for="a in apps"
            :key="a.to"
            type="button"
            role="radio"
            class="chip"
            :aria-checked="appFilter === a.to"
            @click="appFilter = a.to"
          >
            {{ a.tool?.name ?? a.to }} <b>{{ a.count }}</b>
          </button>
        </div>

        <div v-sticky-bar class="toolbar">
          <label class="check-all">
            <input type="checkbox" :checked="allChecked" :indeterminate="someChecked" aria-label="Select all" @change="toggleAll">
            <span>{{ selectedShown.length ? `${selectedShown.length} selected` : 'Select all' }}</span>
          </label>
          <div class="bulk">
            <template v-if="selectedShown.length">
              <button type="button" class="btn btn-sm" @click="restore(selectedShown)">Restore selected</button>
              <button type="button" class="btn btn-quiet btn-sm danger-text" @click="askDelete(selectedShown)">Delete selected</button>
            </template>
            <template v-else>
              <button type="button" class="btn btn-quiet btn-sm" @click="restore(shown)">Restore all</button>
              <button type="button" class="btn btn-quiet btn-sm danger-text" @click="askDelete(shown)">{{ appFilter ? 'Delete all' : 'Empty bin' }}</button>
            </template>
          </div>
        </div>

        <TransitionGroup tag="ul" name="list" class="bin">
          <li v-for="e in shown" :key="e.id" class="row" :class="{ checked: selected.has(e.id) }">
            <label class="row-check">
              <input type="checkbox" :checked="selected.has(e.id)" :aria-label="`Select ${e.label}`" @change="toggle(e.id)">
            </label>
            <span class="app-icon" aria-hidden="true" :style="{ '--c': pageFor(e.app)?.color ?? 'var(--slate)', '--on-c': pageFor(e.app)?.onColor ?? '#fff' }">
              <ToolIcon :name="pageFor(e.app)?.icon ?? 'list'" />
            </span>
            <span class="row-text">
              <strong>{{ e.label }}</strong>
              <span class="meta">{{ pageFor(e.app)?.name ?? e.app }} · deleted {{ ago(e.deletedAt) }} · {{ daysLeft(e.deletedAt) }}</span>
            </span>
            <span class="row-actions">
              <button type="button" class="btn btn-quiet btn-sm" :aria-label="`Restore ${e.label}`" @click="restore([e])">Restore</button>
              <button type="button" class="icon-btn danger" :aria-label="`Delete ${e.label} for good`" title="Delete for good" @click="askDelete([e])">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15M10 7V4.5h4V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5" /></svg>
              </button>
            </span>
          </li>
        </TransitionGroup>

        <p class="note">Things you delete stay here for {{ keepDays }} days, on this device, then they’re cleared for good.</p>
      </template>

      <div v-else class="panel">
        <EmptyState title="The Recycle Bin is empty" icon="trash">
          When you delete a bookmark, a renewal, something you own or anything else you track, it waits here for {{ keepDays }} days so you can put it back.
        </EmptyState>
      </div>

      <template #fallback>
        <div class="panel skeleton-list" aria-hidden="true">
          <span v-for="i in 4" :key="i" class="skeleton" />
        </div>
      </template>
    </ClientOnly>

    <ConfirmDialog
      :open="confirmOpen"
      :title="pending.length === 1 ? `Delete ${pending[0]!.label} for good?` : `Delete ${pending.length} items for good?`"
      :confirm-label="pending.length === 1 ? 'Delete for good' : `Delete ${pending.length} for good`"
      @confirm="deleteForGood"
      @close="pending = []"
    >
      <p>This can’t be undone.</p>
    </ConfirmDialog>
  </ToolPage>
</template>

<style scoped>
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2.1rem;
  padding: 0 0.85rem;
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-2);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: background-color var(--dur-fast), color var(--dur-fast), border-color var(--dur-fast);
}

.chip b {
  font-weight: 600;
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}

.chip:hover {
  color: var(--ink);
  border-color: var(--ink-3);
}

.chip[aria-checked='true'] {
  color: var(--on-accent);
  background: var(--accent);
  border-color: var(--accent);
}

.chip[aria-checked='true'] b {
  color: inherit;
  opacity: 0.8;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem 1rem;
  margin-bottom: 0.75rem;
}

.check-all {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding-left: 0.85rem;
  font-weight: 600;
  color: var(--ink-2);
  cursor: pointer;
}

.bulk {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.danger-text:hover:not(:disabled) {
  color: var(--bad-ink);
}

input[type='checkbox'] {
  width: 1.15rem;
  height: 1.15rem;
  margin: 0;
  accent-color: var(--accent);
  cursor: pointer;
}

.bin {
  position: relative;
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.5rem;
}

.row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.7rem 0.75rem 0.7rem 0.85rem;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  transition: border-color var(--dur-fast), background-color var(--dur-fast);
}

.row.checked {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--line));
  background: color-mix(in srgb, var(--accent) 6%, var(--surface));
}

.row-check {
  display: grid;
  place-items: center;
  cursor: pointer;
}

.app-icon {
  flex: none;
  width: 2.25rem;
  height: 2.25rem;
  display: grid;
  place-items: center;
  font-size: 1.15rem;
  color: var(--on-c);
  background: var(--c);
  border-radius: 10px;
  box-shadow: 0 0 0 2px var(--plastic), 0 0 0 3px var(--plastic-edge);
}

.row-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.row-text strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta {
  font-size: var(--text-sm);
  color: var(--ink-3);
}

.row-actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.note {
  margin: 1.25rem 0 0;
  font-size: var(--text-sm);
  text-align: center;
  color: var(--ink-3);
}

.skeleton-list {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
}

.skeleton-list .skeleton {
  height: 3.25rem;
}

/* Phones: the meta line wraps, and the actions tuck under the name */
@media (max-width: 560px) {
  .row {
    flex-wrap: wrap;
  }

  .row-text {
    flex-basis: calc(100% - 6rem);
  }

  .row-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .meta {
    white-space: normal;
  }
}
</style>
