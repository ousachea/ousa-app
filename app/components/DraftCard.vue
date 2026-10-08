<script setup lang="ts">
// "Continue where you left off?" at the top of an Add form that has an autosaved draft (useDraft).
defineProps<{ lines: string[] }>()
const emit = defineEmits<{ resume: [], discard: [] }>()
</script>

<template>
  <div class="draft" role="status">
    <div class="draft-text">
      <strong>Continue where you left off?</strong>
      <span v-for="(l, i) in lines.slice(0, 4)" :key="i" class="line">{{ l }}</span>
    </div>
    <div class="draft-actions">
      <button type="button" class="btn btn-sm" @click="emit('resume')">Continue</button>
      <button type="button" class="btn btn-quiet btn-sm" @click="emit('discard')">Discard</button>
    </div>
  </div>
</template>

<style scoped>
.draft {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding: 0.8rem 0.9rem;
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--line));
  border-radius: var(--radius-lg);
  animation: draft-in var(--dur) var(--ease-out);
}

.draft-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.35;
}

.line {
  font-size: var(--text-sm);
  color: var(--ink-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.draft-actions {
  display: flex;
  gap: 0.4rem;
}

@keyframes draft-in {
  from {
    opacity: 0;
    translate: 0 -4px;
  }
}
</style>
