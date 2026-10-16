<script setup lang="ts">
// The owner's tools on one item of the CV while editing (pages/cv.vue): edit, move it earlier or
// later in its list, and delete. `vertical` lists (work history) move up and down instead of sideways.
defineProps<{ label: string, first?: boolean, last?: boolean, vertical?: boolean }>()
const emit = defineEmits<{ edit: [], earlier: [], later: [], remove: [] }>()
</script>

<template>
  <div class="cv-tools" :class="{ vertical }" role="group" :aria-label="`${label}: edit tools`" @click.stop>
    <button type="button" :title="`Edit ${label}`" :aria-label="`Edit ${label}`" @click="emit('edit')"><CvIcon name="edit" /></button>
    <button type="button" :disabled="first" :title="vertical ? 'Move up' : 'Move earlier'" :aria-label="`Move ${label} ${vertical ? 'up' : 'earlier'}`" @click="emit('earlier')"><CvIcon name="arrow-left" class="arrow" /></button>
    <button type="button" :disabled="last" :title="vertical ? 'Move down' : 'Move later'" :aria-label="`Move ${label} ${vertical ? 'down' : 'later'}`" @click="emit('later')"><CvIcon name="arrow-right" class="arrow" /></button>
    <button type="button" class="danger" :title="`Delete ${label}`" :aria-label="`Delete ${label}`" @click="emit('remove')"><CvIcon name="trash" /></button>
  </div>
</template>

<style scoped>
.cv-tools {
  /* Floats on the card's top edge, so it never covers the card's own title or tags */
  position: absolute;
  z-index: 3;
  top: -1.1rem;
  right: 1rem;
  display: flex;
  gap: 0.15rem;
  padding: 0.2rem;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  border: 1px solid var(--line);
  border-radius: 999px;
  box-shadow: 0 8px 20px -10px rgb(var(--shadow) / 0.45);
  backdrop-filter: blur(10px);
  animation: tools-in 0.25s cubic-bezier(0.3, 1.5, 0.6, 1) both;
}

@keyframes tools-in {
  from {
    opacity: 0;
    transform: scale(0.85);
  }
}

button {
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  padding: 0;
  font-size: 1rem;
  color: var(--ink-2);
  background: none;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

button:hover:not(:disabled) {
  color: var(--ink);
  background: var(--surface-2);
}

button:disabled {
  opacity: 0.3;
  cursor: default;
}

.danger:hover {
  color: var(--bad-ink) !important;
}

.vertical .arrow {
  rotate: 90deg;
}
</style>
