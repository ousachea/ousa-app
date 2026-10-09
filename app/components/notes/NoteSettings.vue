<script setup lang="ts">
import type { Folder } from '~/utils/folders'

// Notes → Settings (#49): how the editor looks and behaves, remembered on this device (useNotePrefs)
defineProps<{ open: boolean, folders: readonly Folder[] }>()
const emit = defineEmits<{ close: [] }>()
const { prefs, reset } = useNotePrefs()

const FONTS = [{ value: 'sans', label: 'Sans' }, { value: 'serif', label: 'Serif' }, { value: 'mono', label: 'Mono' }] as const
const SIZES = [{ value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }] as const
const LEADING = [{ value: 'tight', label: 'Tight' }, { value: 'normal', label: 'Normal' }, { value: 'relaxed', label: 'Relaxed' }] as const
const PREVIEW = [{ value: 0, label: 'None' }, { value: 80, label: 'Short' }, { value: 140, label: 'Medium' }, { value: 240, label: 'Long' }] as const
</script>

<template>
  <Modal :open="open" title="Notes settings" @close="emit('close')">
    <div class="settings">
      <h3>Editor</h3>
      <div class="row">
        <span>Font</span>
        <div class="seg" role="radiogroup" aria-label="Font">
          <label v-for="o in FONTS" :key="o.value" :class="{ active: prefs.font === o.value }"><input v-model="prefs.font" type="radio" :value="o.value">{{ o.label }}</label>
        </div>
      </div>
      <div class="row">
        <span>Size</span>
        <div class="seg" role="radiogroup" aria-label="Text size">
          <label v-for="o in SIZES" :key="o.value" :class="{ active: prefs.size === o.value }"><input v-model="prefs.size" type="radio" :value="o.value">{{ o.label }}</label>
        </div>
      </div>
      <div class="row">
        <span>Line spacing</span>
        <div class="seg" role="radiogroup" aria-label="Line spacing">
          <label v-for="o in LEADING" :key="o.value" :class="{ active: prefs.leading === o.value }"><input v-model="prefs.leading" type="radio" :value="o.value">{{ o.label }}</label>
        </div>
      </div>
      <label class="row check"><span>Spellcheck</span><input v-model="prefs.spellcheck" type="checkbox"></label>

      <h3>Behaviour</h3>
      <label class="row">
        <span>New notes go in</span>
        <select v-model="prefs.defaultFolder" class="input">
          <option value="">No folder (or the open folder)</option>
          <option v-for="o in flatTree(folders)" :key="o.folder.id" :value="o.folder.id">{{ '— '.repeat(o.depth) }}{{ o.folder.name }}</option>
        </select>
      </label>
      <p class="hint">Notes save by themselves as you type. Markdown shortcuts (# heading, - list, [ ] checklist, &gt; quote) always work.</p>

      <h3>Display</h3>
      <div class="row">
        <span>Preview</span>
        <div class="seg" role="radiogroup" aria-label="Preview length">
          <label v-for="o in PREVIEW" :key="o.value" :class="{ active: prefs.previewLength === o.value }"><input v-model="prefs.previewLength" type="radio" :value="o.value">{{ o.label }}</label>
        </div>
      </div>
      <label class="row check"><span>Show details under a note (dates, words, folder)</span><input v-model="prefs.showDetails" type="checkbox"></label>

      <button type="button" class="link reset" @click="reset">Reset Notes settings</button>
    </div>
  </Modal>
</template>

<style scoped>
.settings {
  display: grid;
  gap: 0.7rem;
}

h3 {
  margin: 0.6rem 0 0;
  font-size: 0.8rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ink-3);
}

h3:first-child {
  margin-top: 0;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.9rem;
}

.row select {
  max-width: 60%;
}

.check input {
  width: 1.15rem;
  height: 1.15rem;
  accent-color: var(--accent);
}

.seg {
  display: inline-flex;
  padding: 0.2rem;
  background: color-mix(in srgb, var(--ink) 5%, var(--surface));
  border-radius: 12px;
}

.seg label {
  padding: 0.4rem 0.7rem;
  font-size: 0.82rem;
  font-weight: 600;
  border-radius: 9px;
  cursor: pointer;
}

.seg label.active {
  background: var(--surface);
  box-shadow: 0 1px 3px rgb(var(--shadow) / 0.15);
}

.seg label:has(input:focus-visible) {
  outline: 2px solid var(--accent);
}

.seg input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.hint {
  margin: 0;
  font-size: 0.82rem;
  color: var(--ink-2);
}

.reset {
  justify-self: start;
  margin-top: 0.5rem;
}
</style>
