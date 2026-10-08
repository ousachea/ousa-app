<script setup lang="ts">
// Asks before something that can't be undone (deleting for good, replacing data with a backup).
// Everyday deletes don't use this: they go to the Recycle Bin with Undo instead (CHECKLIST.md #02, #11).
// The safe choice has focus, so pressing Enter by accident cancels.
const props = withDefaults(defineProps<{ open: boolean, title: string, confirmLabel?: string, danger?: boolean }>(), { confirmLabel: 'Delete for good', danger: true })
const emit = defineEmits<{ confirm: [], close: [] }>()
const cancelBtn = ref<HTMLButtonElement>()

watch(() => props.open, (open) => {
  if (open) nextTick(() => cancelBtn.value?.focus())
})
</script>

<template>
  <Modal :open="open" :title="title" @close="emit('close')">
    <div class="confirm">
      <div class="confirm-text"><slot /></div>
      <div class="confirm-actions">
        <button type="button" class="btn" :class="{ 'btn-danger': danger }" @click="emit('confirm')">{{ confirmLabel }}</button>
        <button ref="cancelBtn" type="button" class="btn btn-quiet" @click="emit('close')">Cancel</button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.confirm-text {
  color: var(--ink-2);
}

.confirm-text :deep(p) {
  margin: 0 0 0.75rem;
}

.confirm-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 1.25rem;
}

.btn-danger {
  --accent: var(--red);
  --on-accent: #fff;
}
</style>
