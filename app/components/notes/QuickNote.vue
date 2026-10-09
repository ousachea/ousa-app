<script setup lang="ts">
// Quick capture (Notes, #33): one box, saved straight away without opening the editor.
// Organise it later. Enter saves; Shift+Enter is a new line.
defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [], save: [text: string] }>()

const text = ref('')
const box = ref<HTMLTextAreaElement>()

function save() {
  if (!text.value.trim()) {
    box.value?.focus()
    return
  }
  emit('save', text.value)
  text.value = ''
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    save()
  }
}
</script>

<template>
  <Modal :open="open" title="Quick note" @close="emit('close')">
    <form class="quick" @submit.prevent="save">
      <label class="sr-only" for="quick-note">What do you want to remember?</label>
      <textarea id="quick-note" ref="box" v-model="text" class="input" rows="4" placeholder="What do you want to remember?" autofocus @keydown="onKey" />
      <div class="row">
        <span class="hint">Enter saves · Shift+Enter for a new line</span>
        <button type="submit" class="btn">Save</button>
      </div>
    </form>
  </Modal>
</template>

<style scoped>
.quick {
  display: grid;
  gap: 0.75rem;
}

textarea {
  width: 100%;
  min-height: 7rem;
  resize: vertical;
  font: inherit;
  line-height: 1.5;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.hint {
  font-size: 0.8rem;
  color: var(--ink-3);
}
</style>
