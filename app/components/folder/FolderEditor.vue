<script setup lang="ts">
import type { Folder } from '~/utils/folders'

// Create or edit a bookmark folder: name, where it sits, icon and colour (CHECKLIST.md #36–#38)
const props = defineProps<{ open: boolean, folders: readonly Folder[], folder?: Folder, parentId?: string }>()
const emit = defineEmits<{ close: [], save: [data: Pick<Folder, 'name' | 'parentId' | 'icon' | 'color'>] }>()

const form = reactive({ name: '', parentId: '', icon: 'folder', color: '' })
const iconTouched = ref(false)

watch(() => props.open, (open) => {
  if (!open) return
  iconTouched.value = !!props.folder
  Object.assign(form, props.folder
    ? { name: props.folder.name, parentId: props.folder.parentId, icon: props.folder.icon, color: props.folder.color }
    : { name: '', parentId: props.parentId ?? '', icon: 'folder', color: '' })
}, { immediate: true })

// Until an icon is picked by hand, it follows the name ("Banking" → bank)
watch(() => form.name, (name) => {
  if (!iconTouched.value) form.icon = guessIcon(name)
})

// A folder can't go inside itself or one of its own sub-folders
const parentOptions = computed(() => {
  const blocked = props.folder ? new Set([props.folder.id, ...descendantsOf(props.folders, props.folder.id)]) : new Set<string>()
  return [
    { value: '', label: 'Top level' },
    ...flatTree(props.folders).filter(o => !blocked.has(o.folder.id)).map(o => ({ value: o.folder.id, label: `${'  '.repeat(o.depth)}${pathText(props.folders, o.folder.id)}` }))
  ]
})

// Same name in the same place would be confusing
const clash = computed(() => {
  const n = folderName(form.name).toLowerCase()
  return n && props.folders.some(f => f.id !== props.folder?.id && f.parentId === form.parentId && f.name.toLowerCase() === n)
})

function pickIcon(key: string) {
  form.icon = key
  iconTouched.value = true
}

function submit() {
  emit('save', { name: folderName(form.name), parentId: form.parentId, icon: form.icon, color: form.color })
}
</script>

<template>
  <Modal :open="open" :title="folder ? `Edit ${folder.name}` : 'New folder'" @close="emit('close')">
    <form v-validate class="folder-form" @submit.prevent="submit">
      <label class="field">
        <span class="field-head">Name</span>
        <span class="name-row input">
          <FolderIcon :icon="form.icon" :color="form.color" />
          <input
            v-model="form.name"
            placeholder="Work, Banking, Recipes…"
            required
            maxlength="60"
            data-error="Give the folder a name"
            v-check="clash ? 'There’s already a folder with that name here' : ''"
          >
        </span>
      </label>
      <label class="field">
        <span class="field-head">Inside</span>
        <AppSelect v-model="form.parentId" aria-label="Inside" :options="parentOptions" searchable />
      </label>

      <div class="field">
        <span class="field-head">Icon</span>
        <div class="icons" role="radiogroup" aria-label="Icon">
          <label v-for="(_, key) in FOLDER_ICONS" :key="key" class="icon-opt" :class="{ on: form.icon === key }" :title="String(key)">
            <input type="radio" name="folder-icon" :value="key" :checked="form.icon === key" :aria-label="String(key)" @change="pickIcon(String(key))">
            <FolderIcon :icon="String(key)" :color="form.color" />
          </label>
        </div>
      </div>

      <div class="field">
        <span class="field-head">Colour</span>
        <div class="colors" role="radiogroup" aria-label="Colour">
          <label v-for="c in FOLDER_COLORS" :key="c" class="color-opt" :class="{ on: form.color === c, default: !c }" :style="c ? { '--swatch': `var(--${c})` } : undefined" :title="c || 'Bookmarks colour'">
            <input v-model="form.color" type="radio" name="folder-color" :value="c" :aria-label="c || 'Bookmarks colour'">
          </label>
        </div>
      </div>

      <div class="actions">
        <button type="submit" class="btn">{{ folder ? 'Save changes' : 'Create folder' }}</button>
        <button type="button" class="btn btn-quiet" @click="emit('close')">Cancel</button>
      </div>
    </form>
  </Modal>
</template>

<style scoped>
.folder-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 1.2rem;
}

.name-row input {
  flex: 1;
  min-width: 0;
  padding: 0;
  font: inherit;
  font-size: 1rem;
  color: var(--ink);
  background: none;
  border: 0;
  outline: none;
}

.icons {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(2.5rem, 1fr));
  gap: 0.3rem;
}

.icon-opt {
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  font-size: 1.25rem;
  border-radius: 10px;
  cursor: pointer;
  transition: background-color var(--dur-fast);
}

.icon-opt:hover {
  background: var(--surface-2);
}

.icon-opt.on {
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
  box-shadow: inset 0 0 0 2px var(--accent);
}

.icon-opt:has(input:focus-visible),
.color-opt:has(input:focus-visible) {
  outline: 3px solid color-mix(in srgb, var(--accent) 55%, transparent);
  outline-offset: 2px;
}

.icon-opt input,
.color-opt input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.colors {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.color-opt {
  position: relative;
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 50%;
  background: var(--swatch);
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.12);
  cursor: pointer;
}

.color-opt.default {
  background: var(--accent);
}

.color-opt.default::after {
  content: 'A';
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 0.75rem;
  font-weight: 800;
  color: #fff;
}

.color-opt.on {
  box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--ink);
}

.actions {
  display: flex;
  gap: 0.5rem;
}
</style>
