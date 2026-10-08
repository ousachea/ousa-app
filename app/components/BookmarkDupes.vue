<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { Bookmark } from '~/utils/bookmarks'
import type { Folder } from '~/utils/folders'

// Duplicate and similar bookmark finder. Each group: pick the one to keep, then Merge (the
// others' folders, notes, pin and visits move onto it; the rest go to the Recycle Bin) or say
// "Not duplicates" so the group stops showing. Everything can be undone.
const props = defineProps<{
  open: boolean
  bookmarks: Bookmark[]
  folders: readonly Folder[]
  update: (id: string, patch: Partial<Bookmark>, opts?: { quiet?: boolean }) => Bookmark | undefined
  replace: (b: Bookmark) => void
  remove: (id: string) => Bookmark | undefined
  restore: (b: Bookmark) => void
}>()
const emit = defineEmits<{ close: [] }>()
const { play } = useSound()

// "Not duplicates" answers, remembered by the page (it shows the count too)
const ignored = defineModel<string[]>('ignored', { required: true })
const groups = computed(() => findDuplicates(props.bookmarks, new Set(ignored.value)))
const tab = ref<'duplicate' | 'similar'>('duplicate')
const shown = computed(() => groups.value.filter(g => g.kind === tab.value))
const counts = computed(() => ({
  duplicate: groups.value.filter(g => g.kind === 'duplicate').length,
  similar: groups.value.filter(g => g.kind === 'similar').length
}))
watch(() => props.open, (o) => {
  if (o) tab.value = counts.value.duplicate || !counts.value.similar ? 'duplicate' : 'similar'
})

// The one worth keeping by default: pinned, with a note, in folders, opened most, saved first
const score = (b: Bookmark) => (b.pinned ? 100 : 0) + (b.note ? 20 : 0) + (b.folders?.length ?? 0) * 5 + (b.visits ?? 0)
const keep = ref<Record<string, string>>({})
const keepOf = (key: string, items: Bookmark[]) => keep.value[key]
  ?? [...items].sort((a, b) => score(b) - score(a) || a.createdAt.localeCompare(b.createdAt))[0]!.id

const folderNames = (b: Bookmark) => (b.folders ?? []).map(id => props.folders.find(f => f.id === id)?.name).filter(Boolean) as string[]
const when = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

function merge(key: string, items: Bookmark[], { quietToast = false } = {}) {
  const keepId = keepOf(key, items)
  const kept = items.find(b => b.id === keepId)!
  const others = items.filter(b => b.id !== keepId)
  const notes = [...new Set([kept.note, ...others.map(b => b.note)].map(n => n.trim()).filter(Boolean))]
  const before = props.update(kept.id, {
    folders: [...new Set([...(kept.folders ?? []), ...others.flatMap(b => b.folders ?? [])])],
    note: notes.join('\n'),
    description: kept.description || others.find(b => b.description)?.description || '',
    pinned: kept.pinned || others.some(b => b.pinned),
    visits: items.reduce((n, b) => n + (b.visits ?? 0), 0),
    updatedAt: new Date().toISOString()
  })
  const removed = others.map(b => props.remove(b.id)).filter((b): b is Bookmark => !!b)
  const undo = () => {
    if (before) props.replace(before)
    removed.forEach(props.restore)
  }
  if (!quietToast) {
    play('success')
    toast.success(`Merged into ${kept.title}`, { description: `${removed.length} ${removed.length === 1 ? 'copy' : 'copies'} moved to the Recycle Bin.`, action: { label: 'Undo', onClick: undo } })
  }
  return { undo, removed: removed.length }
}

function mergeAll() {
  const list = shown.value.map(g => ({ key: g.key, items: g.items }))
  const undos = list.map(g => merge(g.key, g.items, { quietToast: true }))
  const n = undos.reduce((s, u) => s + u.removed, 0)
  play('success')
  toast.success(`${list.length} ${list.length === 1 ? 'group' : 'groups'} merged`, {
    description: `${n} ${n === 1 ? 'copy' : 'copies'} moved to the Recycle Bin.`,
    action: { label: 'Undo', onClick: () => undos.forEach(u => u.undo()) }
  })
}

function notDuplicates(key: string) {
  ignored.value = [...ignored.value, key]
  play('select')
  toast('Marked as not duplicates', { action: { label: 'Undo', onClick: () => (ignored.value = ignored.value.filter(k => k !== key)) } })
}

function resetIgnored() {
  ignored.value = []
  play('select')
}
</script>

<template>
  <Modal :open="open" title="Duplicates and similar links" wide @close="emit('close')">
    <div class="dupes">
      <div class="tabs segmented" role="radiogroup" aria-label="Show">
        <label :class="{ active: tab === 'duplicate' }"><input v-model="tab" type="radio" value="duplicate">Duplicates <b>{{ counts.duplicate }}</b></label>
        <label :class="{ active: tab === 'similar' }"><input v-model="tab" type="radio" value="similar">Similar <b>{{ counts.similar }}</b></label>
      </div>
      <p class="intro">
        <template v-if="tab === 'duplicate'">The same page saved more than once, even when the addresses differ by http/https, www, a trailing slash, #section or tracking codes.</template>
        <template v-else>Links that are probably related: the same site and title, or a page and the page just below it. You decide.</template>
      </p>

      <div v-if="shown.length" class="groups">
        <div v-if="tab === 'duplicate' && shown.length > 1" class="all-bar">
          <span>Keep the suggested one in each group</span>
          <button type="button" class="btn btn-sm" @click="mergeAll">Merge all {{ shown.length }}</button>
        </div>
        <TransitionGroup name="list" tag="div" class="group-list">
          <section v-for="g in shown" :key="g.key" class="group panel" :aria-label="g.reason">
            <p class="reason"><span class="badge" :class="g.kind === 'duplicate' ? 'warn' : 'info'">{{ g.kind === 'duplicate' ? 'Duplicate' : 'Similar' }}</span> {{ g.reason }}</p>
            <div class="items" role="radiogroup" :aria-label="`Keep which one? ${g.reason}`">
              <label v-for="b in g.items" :key="b.id" class="item" :class="{ keep: keepOf(g.key, g.items) === b.id }">
                <input type="radio" :name="g.key" :checked="keepOf(g.key, g.items) === b.id" @change="keep = { ...keep, [g.key]: b.id }">
                <span class="item-text">
                  <strong>{{ b.title }}</strong>
                  <a :href="b.url" target="_blank" rel="noopener" class="url" @click.stop>{{ b.url }}</a>
                  <span class="meta">
                    Saved {{ when(b.createdAt) }}<template v-if="b.visits"> · opened {{ b.visits }}×</template><template v-if="b.pinned"> · pinned</template>
                    <template v-if="folderNames(b).length"> · in {{ folderNames(b).join(', ') }}</template>
                    <template v-if="b.note"> · has a note</template>
                  </span>
                </span>
                <span v-if="keepOf(g.key, g.items) === b.id" class="keep-tag">Keep</span>
              </label>
            </div>
            <div class="group-actions">
              <button type="button" class="btn btn-sm" @click="merge(g.key, g.items)">Merge into the kept one</button>
              <button type="button" class="btn btn-quiet btn-sm" @click="notDuplicates(g.key)">Not duplicates</button>
            </div>
          </section>
        </TransitionGroup>
      </div>
      <EmptyState v-else :title="tab === 'duplicate' ? 'No duplicates' : 'Nothing similar'" icon="bookmarks" :level="3">
        {{ tab === 'duplicate' ? 'Every page is saved only once.' : 'No links look alike.' }}
        <template v-if="ignored.length" #extra>
          <button type="button" class="link" @click="resetIgnored">Show {{ ignored.length }} you marked as not duplicates</button>
        </template>
      </EmptyState>
    </div>
  </Modal>
</template>

<style scoped>
.dupes {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tabs {
  width: fit-content;
  white-space: nowrap;
}

.tabs b {
  margin-left: 0.3rem;
  font-variant-numeric: tabular-nums;
  color: var(--ink-3);
}

.intro {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.groups {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.group-list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.all-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.7rem;
  font-size: var(--text-sm);
  background: var(--surface-2);
  border-radius: 12px;
}

.group {
  padding: 0.8rem;
}

.reason {
  margin: 0 0 0.6rem;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.items {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.item {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--line);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color var(--dur-fast), background-color var(--dur-fast);
}

.item.keep {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 7%, var(--surface));
}

.item input {
  margin-top: 0.25rem;
  accent-color: var(--accent);
}

.item-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.url {
  font-size: var(--text-sm);
  color: var(--ink-2);
  overflow-wrap: anywhere;
}

.meta {
  font-size: var(--text-xs);
  color: var(--ink-3);
}

.keep-tag {
  flex: none;
  padding: 0.05rem 0.45rem;
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--on-accent);
  background: var(--accent-btn, var(--accent));
  border-radius: 999px;
}

.group-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.6rem;
}
</style>
