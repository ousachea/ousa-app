<script setup lang="ts">
// Optional fields tucked away until they're wanted (progressive disclosure, CHECKLIST.md #13).
// Opens by itself when any field inside already has a value, so editing never hides filled-in data.
const props = withDefaults(defineProps<{ label?: string, filled?: boolean }>(), { label: 'More details', filled: false })
const open = ref(props.filled)
watch(() => props.filled, (f) => {
  if (f) open.value = true
})
</script>

<template>
  <div class="more" :class="{ open }">
    <button type="button" class="more-toggle" :aria-expanded="open" @click="open = !open">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
      {{ label }}
    </button>
    <Transition name="collapse">
      <div v-show="open" class="more-body">
        <div class="more-inner"><slot /></div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.more-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 2.25rem;
  padding: 0 0.2rem;
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-2);
  background: none;
  border: 0;
  cursor: pointer;
}

.more-toggle:hover {
  color: var(--ink);
}

.more-toggle svg {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: rotate var(--dur) var(--ease-out);
}

.open .more-toggle svg {
  rotate: 90deg;
}

.more-body {
  display: grid;
  grid-template-rows: 1fr;
}

.more-inner {
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: inherit;
  padding-top: 0.5rem;
}

.more {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.more-inner {
  gap: 1rem;
}
</style>
