<script setup lang="ts">
// "Possible duplicate" (CHECKLIST.md #29): shown instead of saving when something very like it already
// exists. The person decides: look at the one they have, or keep both.
defineProps<{ title: string, where?: string, detail?: string, openLabel?: string }>()
const emit = defineEmits<{ open: [], keep: [], cancel: [] }>()
</script>

<template>
  <div class="dup" role="alert">
    <div class="dup-text">
      <strong>Possible duplicate</strong>
      <span>{{ where ? `This already exists in ${where}:` : 'You already have:' }} <b>{{ title }}</b></span>
      <span v-if="detail" class="detail">{{ detail }}</span>
    </div>
    <div class="dup-actions">
      <button type="button" class="btn btn-sm" @click="emit('open')">{{ openLabel ?? 'Open existing' }}</button>
      <button type="button" class="btn btn-quiet btn-sm" @click="emit('keep')">Keep both</button>
      <button type="button" class="icon-btn" aria-label="Dismiss" title="Dismiss" @click="emit('cancel')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.dup {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1rem;
  padding: 0.8rem 0.6rem 0.8rem 1rem;
  text-align: left;
  background: color-mix(in srgb, var(--orange) 10%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--orange) 40%, var(--line));
  border-radius: var(--radius-lg);
  animation: dup-in var(--dur) var(--ease-out);
}

.dup-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.4;
}

.dup-text strong {
  color: var(--warn-ink);
}

.dup-text b {
  overflow-wrap: anywhere;
}

.detail {
  font-size: var(--text-sm);
  color: var(--ink-2);
  overflow-wrap: anywhere;
}

.dup-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

@keyframes dup-in {
  from {
    opacity: 0;
    translate: 0 -4px;
  }
}
</style>
