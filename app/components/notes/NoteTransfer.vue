<script setup lang="ts">
// Import / Export (Notes, #39). The page does the work; this is the choice.
// Export: this note or every note, as Markdown, plain text, HTML or JSON (all notes as JSON keeps
// folders, tags, favourites and dates for a full restore). Import: .md, .txt, .html or .json files.
defineProps<{ open: boolean, hasCurrent: boolean, count: number }>()
const emit = defineEmits<{
  close: []
  export: [scope: 'current' | 'all', format: 'md' | 'txt' | 'html' | 'json']
  import: [files: File[]]
}>()

const FORMATS = [
  { value: 'md', label: 'Markdown', hint: '.md' },
  { value: 'txt', label: 'Plain text', hint: '.txt' },
  { value: 'html', label: 'Web page', hint: '.html' },
  { value: 'json', label: 'JSON', hint: '.json' }
] as const

const scope = ref<'current' | 'all'>('current')
const format = ref<(typeof FORMATS)[number]['value']>('md')
const input = ref<HTMLInputElement>()

function onFiles(e: Event) {
  const el = e.target as HTMLInputElement
  const files = [...(el.files ?? [])]
  el.value = ''
  if (files.length) emit('import', files)
}
</script>

<template>
  <Modal :open="open" title="Import or export notes" @close="emit('close')">
    <section class="part">
      <h3>Export</h3>
      <div class="seg" role="radiogroup" aria-label="Which notes">
        <label :class="{ active: scope === 'current' }"><input v-model="scope" type="radio" value="current" :disabled="!hasCurrent">This note</label>
        <label :class="{ active: scope === 'all' }"><input v-model="scope" type="radio" value="all">All notes ({{ count }})</label>
      </div>
      <div class="formats" role="radiogroup" aria-label="Format">
        <label v-for="f in FORMATS" :key="f.value" class="fmt" :class="{ active: format === f.value }">
          <input v-model="format" type="radio" :value="f.value">
          <strong>{{ f.label }}</strong><span>{{ f.hint }}</span>
        </label>
      </div>
      <p v-if="scope === 'all' && format !== 'json'" class="hint">All notes go in one file, one after another.</p>
      <p v-if="scope === 'all' && format === 'json'" class="hint">Keeps folders, tags, favourites and dates, so it can be imported back exactly.</p>
      <button type="button" class="btn" :disabled="scope === 'current' && !hasCurrent" @click="emit('export', hasCurrent ? scope : 'all', format)">Download</button>
    </section>

    <section class="part">
      <h3>Import</h3>
      <p class="hint">Markdown, text, HTML or JSON files. Titles, folders, tags and dates are kept when the file has them; notes you already have are skipped.</p>
      <button type="button" class="btn btn-quiet" @click="input?.click()">Choose files…</button>
      <input ref="input" type="file" accept=".md,.markdown,.txt,.html,.htm,.json,text/markdown,text/plain,text/html,application/json" multiple hidden @change="onFiles">
    </section>
  </Modal>
</template>

<style scoped>
.part {
  display: grid;
  justify-items: start;
  gap: 0.75rem;
}

.part + .part {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--line);
}

h3 {
  margin: 0;
  font-size: 1rem;
}

.seg {
  display: inline-flex;
  padding: 0.2rem;
  background: color-mix(in srgb, var(--ink) 5%, var(--surface));
  border-radius: 12px;
}

.seg label {
  padding: 0.45rem 0.8rem;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 9px;
  cursor: pointer;
}

.seg label.active {
  background: var(--surface);
  box-shadow: 0 1px 3px rgb(var(--shadow) / 0.15);
}

.seg input,
.fmt input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.formats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  width: 100%;
}

.fmt {
  display: grid;
  gap: 0.1rem;
  padding: 0.6rem 0.7rem;
  font-size: 0.85rem;
  border: 1px solid var(--line);
  border-radius: 12px;
  cursor: pointer;
}

.fmt span {
  font-size: 0.75rem;
  color: var(--ink-3);
}

.fmt.active {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
}

.fmt:has(input:focus-visible),
.seg label:has(input:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--ink-2);
}

@media (max-width: 520px) {
  .formats {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
