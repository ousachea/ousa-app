<script setup lang="ts">
import type { NoteVersion } from '~/utils/notes'

// Version history (Notes, #31): earlier states of a note, newest first. A version is shown as text
// to read, and Restore makes it the note again (what's there now is kept as a version first).
const props = defineProps<{ open: boolean, versions: NoteVersion[], noteTitle: string }>()
const emit = defineEmits<{ close: [], restore: [v: NoteVersion] }>()

const chosen = ref<string>()
watch(() => props.open, (o) => {
  if (o) chosen.value = props.versions[0]?.id
})
const current = computed(() => props.versions.find(v => v.id === chosen.value))
const text = computed(() => (current.value ? htmlToText(current.value.html) : ''))

const when = (iso: string) => {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const group = dayGroup(iso)
  return group === 'Today' || group === 'Yesterday' ? `${group} ${time}` : `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} ${time}`
}
</script>

<template>
  <Modal :open="open" :title="`Version history: ${noteTitle}`" wide @close="emit('close')">
    <div v-if="versions.length" class="history">
      <ul class="list" role="listbox" aria-label="Versions">
        <li v-for="v in versions" :key="v.id">
          <button type="button" role="option" :aria-selected="v.id === chosen" :class="{ on: v.id === chosen }" @click="chosen = v.id">
            <strong>{{ when(v.at) }}</strong>
            <span>{{ displayTitle({ title: v.title, text: htmlToText(v.html) }) }}</span>
          </button>
        </li>
      </ul>
      <div v-if="current" class="preview">
        <pre>{{ text || '(empty)' }}</pre>
        <button type="button" class="btn" @click="emit('restore', current)">Restore this version</button>
      </div>
    </div>
    <p v-else class="empty">No earlier versions yet. When you come back to edit a note after 10 minutes or more, how it was is kept here first (and every 30 minutes during a long session), up to 20 per note.</p>
  </Modal>
</template>

<style scoped>
.history {
  display: grid;
  grid-template-columns: 14rem minmax(0, 1fr);
  gap: 1rem;
  min-height: 18rem;
}

.list {
  display: grid;
  align-content: start;
  gap: 0.2rem;
  max-height: 60vh;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.list button {
  display: grid;
  gap: 0.1rem;
  width: 100%;
  padding: 0.55rem 0.7rem;
  font: inherit;
  text-align: left;
  color: var(--ink);
  background: none;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
}

.list button:hover {
  background: color-mix(in srgb, var(--ink) 6%, transparent);
}

.list button.on {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.list strong {
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
}

.list span {
  overflow: hidden;
  font-size: 0.8rem;
  color: var(--ink-2);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview {
  display: grid;
  align-content: start;
  justify-items: start;
  gap: 0.75rem;
  min-width: 0;
}

pre {
  width: 100%;
  max-height: 50vh;
  margin: 0;
  padding: 0.9rem 1rem;
  overflow: auto;
  font: inherit;
  line-height: 1.55;
  white-space: pre-wrap;
  background: color-mix(in srgb, var(--ink) 4%, var(--surface));
  border-radius: 12px;
}

.empty {
  color: var(--ink-2);
}

@media (max-width: 640px) {
  .history {
    grid-template-columns: 1fr;
  }

  .list {
    max-height: 30vh;
  }
}
</style>
