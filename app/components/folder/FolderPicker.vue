<script setup lang="ts">
import type { Folder } from '~/utils/folders'

// Which folders a bookmark is in, as chips: [ Work × ] [ Banking × ] (CHECKLIST.md #39).
// Type to search folders, Enter adds the highlighted one or creates a new folder with that name,
// Backspace in an empty box removes the last chip. Names always start with a capital.
const props = defineProps<{ folders: readonly Folder[], createFolder: (name: string) => string }>()
const model = defineModel<string[]>({ required: true })

const uid = useId()
const query = ref('')
const open = ref(false)
const active = ref(0)
const input = ref<HTMLInputElement>()

const selected = computed(() => model.value.map(id => props.folders.find(f => f.id === id)).filter((f): f is Folder => !!f))
const options = computed(() => {
  const q = query.value.trim().toLowerCase()
  return flatTree(props.folders)
    .filter(o => !model.value.includes(o.folder.id))
    .filter(o => !q || pathText(props.folders, o.folder.id).toLowerCase().includes(q))
    .slice(0, 50)
})
const exact = computed(() => props.folders.some(f => f.name.toLowerCase() === query.value.trim().toLowerCase()))
const canCreate = computed(() => !!query.value.trim() && !exact.value)
// The create row sits after the matches
const count = computed(() => options.value.length + (canCreate.value ? 1 : 0))
watch(query, () => {
  active.value = 0
  open.value = true
})

function add(id: string) {
  if (!model.value.includes(id)) model.value = [...model.value, id]
  query.value = ''
  nextTick(() => input.value?.focus())
}

function removeId(id: string) {
  model.value = model.value.filter(x => x !== id)
}

function choose(i: number) {
  const o = options.value[i]
  if (o) add(o.folder.id)
  else if (canCreate.value) add(props.createFolder(folderName(query.value)))
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    open.value = true
    active.value = Math.min(count.value - 1, active.value + 1)
  } else if (e.key === 'ArrowUp') {
    active.value = Math.max(0, active.value - 1)
  } else if (e.key === 'Enter') {
    // Enter with an empty box submits the form as usual
    if (!query.value.trim() && !open.value) return
    if (count.value) choose(active.value)
  } else if (e.key === 'Escape' && open.value) {
    open.value = false
    e.stopPropagation()
  } else if (e.key === 'Backspace' && !query.value && model.value.length) {
    model.value = model.value.slice(0, -1)
    return
  } else {
    return
  }
  e.preventDefault()
}

function onBlur(e: FocusEvent) {
  if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) open.value = false
}
</script>

<template>
  <div class="folder-picker" @focusout="onBlur">
    <div class="box input" @click="input?.focus()">
      <TransitionGroup name="pop">
        <span v-for="f in selected" :key="f.id" class="chip" :style="{ '--tag': folderColor(f) }">
          <FolderIcon :icon="f.icon" :color="f.color" />
          <span class="chip-name" :title="pathText(folders, f.id)">{{ f.name }}</span>
          <button type="button" class="chip-x" :aria-label="`Remove from ${f.name}`" @click.stop="removeId(f.id)">×</button>
        </span>
      </TransitionGroup>
      <input
        :id="uid"
        ref="input"
        v-model="query"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="open && count > 0"
        :aria-controls="`${uid}-list`"
        :aria-activedescendant="open && count ? `${uid}-opt-${active}` : undefined"
        aria-label="Add to a folder"
        :placeholder="selected.length ? 'Add another…' : 'Add to a folder…'"
        autocomplete="off"
        @focus="open = true"
        @keydown="onKey"
      >
      <button v-if="selected.length" type="button" class="link clear" @click.stop="model = []">Clear</button>
    </div>

    <Transition name="slide-down">
      <ul v-if="open && count" :id="`${uid}-list`" class="options" role="listbox" aria-label="Folders">
        <li
          v-for="(o, i) in options"
          :id="`${uid}-opt-${i}`"
          :key="o.folder.id"
          role="option"
          :aria-selected="i === active"
          :style="{ paddingLeft: `${0.7 + o.depth * 0.9}rem` }"
          @pointerenter="active = i"
          @mousedown.prevent="choose(i)"
        >
          <FolderIcon :icon="o.folder.icon" :color="o.folder.color" />
          <span>{{ o.folder.name }}</span>
          <small v-if="o.depth" class="path">{{ pathOf(folders, o.folder.id).slice(0, -1).join(' → ') }}</small>
        </li>
        <li
          v-if="canCreate"
          :id="`${uid}-opt-${options.length}`"
          role="option"
          class="create"
          :aria-selected="active === options.length"
          @pointerenter="active = options.length"
          @mousedown.prevent="choose(options.length)"
        >
          <span class="plus" aria-hidden="true">+</span>
          <span>Create folder “{{ folderName(query) }}”</span>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.folder-picker {
  position: relative;
}

.box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  min-height: 2.75rem;
  padding: 0.35rem 0.5rem;
  cursor: text;
}

.box input {
  flex: 1;
  min-width: 8rem;
  padding: 0.25rem 0.3rem;
  font: inherit;
  font-size: 1rem;
  color: var(--ink);
  background: none;
  border: 0;
  outline: none;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  max-width: 100%;
  padding: 0.15rem 0.2rem 0.15rem 0.55rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ink);
  background: color-mix(in srgb, var(--tag) 12%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--tag) 35%, transparent);
  border-radius: 999px;
}

.chip-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip-x {
  width: 1.4rem;
  height: 1.4rem;
  display: grid;
  place-items: center;
  padding: 0;
  font: inherit;
  font-size: 1rem;
  line-height: 1;
  color: var(--ink-2);
  background: none;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
}

.chip-x:hover {
  color: var(--ink);
  background: color-mix(in srgb, var(--tag) 20%, transparent);
}

.clear {
  flex: none;
  margin: 0 0.35rem 0 auto;
  font-size: var(--text-sm);
}

.options {
  position: absolute;
  z-index: 20;
  left: 0;
  right: 0;
  top: calc(100% + 4px);
  max-height: 15rem;
  overflow-y: auto;
  margin: 0;
  padding: 0.3rem;
  list-style: none;
  background: var(--surface);
  border-radius: 12px;
  box-shadow: 0 18px 40px -12px rgb(var(--shadow) / 0.35), 0 0 0 1px var(--line);
}

.options li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.4rem;
  padding: 0.3rem 0.7rem;
  font-size: 0.95rem;
  border-radius: 8px;
  cursor: pointer;
}

.options li[aria-selected='true'] {
  background: var(--surface-2);
}

.path {
  margin-left: auto;
  font-size: var(--text-xs);
  color: var(--ink-3);
}

.create {
  font-weight: 600;
  color: var(--ink);
}

.plus {
  width: 1.1em;
  text-align: center;
  font-size: 1.15rem;
  color: var(--accent);
}
</style>
