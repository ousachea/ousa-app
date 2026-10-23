<script setup lang="ts">
// "Suggested folder: Development [Use suggestion] [Ignore]" (CHECKLIST.md #30). Always optional.
defineProps<{ label: string, value: string }>()
const emit = defineEmits<{ use: [], ignore: [] }>()
</script>

<template>
  <div class="suggestion" role="status">
    <span class="text">
      <AnimatedIcon name="sparkles" trigger="loop" />
      {{ label }}: <strong>{{ value }}</strong>
    </span>
    <button type="button" class="link" @click="emit('use')">Use suggestion</button>
    <button type="button" class="link" @click="emit('ignore')">Ignore</button>
  </div>
</template>

<style scoped>
.suggestion {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.75rem;
  font-size: var(--text-sm);
  color: var(--ink-2);
  animation: suggest-in var(--dur) var(--ease-out);
}

.text {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.text strong {
  color: var(--ink);
}

svg {
  width: 1rem;
  height: 1rem;
  fill: var(--accent);
}

@keyframes suggest-in {
  from { opacity: 0; }
}
</style>
