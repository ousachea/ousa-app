<script setup lang="ts">
// A row's checkbox while selecting several (useBulkSelect). By default a round badge on the card's
// top-left corner, so nothing moves when select mode starts; `inline` sits in the row's flow instead.
defineProps<{ checked: boolean, label: string, inline?: boolean }>()
defineEmits<{ pick: [e: MouseEvent] }>()
</script>

<template>
  <!-- .stop: the row's own click (open, edit) must not run when the checkbox is clicked -->
  <label class="bulk-check" :class="{ inline }" @click.stop>
    <input type="checkbox" :checked="checked" :aria-label="label" @click="$emit('pick', $event)">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 12.5l3.5 3.5 7.5-8" /></svg>
  </label>
</template>

<style scoped>
.bulk-check {
  position: absolute;
  z-index: 3;
  top: -0.45rem;
  left: -0.45rem;
  display: grid;
  place-items: center;
  width: 1.6rem;
  height: 1.6rem;
  /* Bigger than it looks on touch screens */
  touch-action: manipulation;
}

.bulk-check::before {
  content: '';
  position: absolute;
  inset: -0.5rem;
}

.bulk-check.inline {
  position: relative;
  top: auto;
  left: auto;
  flex: none;
}

input {
  appearance: none;
  position: absolute;
  inset: 0;
  margin: 0;
  border-radius: 50%;
  background: var(--surface);
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--ink) 35%, transparent), 0 1px 3px rgb(var(--shadow) / 0.25);
  cursor: pointer;
  transition-property: background-color, box-shadow;
  transition-duration: 0.15s;
  transition-timing-function: ease-out;
}

input:hover {
  box-shadow: inset 0 0 0 2px var(--accent), 0 1px 3px rgb(var(--shadow) / 0.25);
}

input:checked {
  background: var(--accent);
  box-shadow: 0 0 0 2px var(--surface), 0 1px 3px rgb(var(--shadow) / 0.3);
}

input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

svg {
  position: relative;
  width: 62%;
  height: 62%;
  fill: none;
  stroke: var(--on-accent, #fff);
  stroke-width: 2.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: none;
  opacity: 0;
  scale: 0.25;
  filter: blur(4px);
  transition-property: opacity, scale, filter;
  transition-duration: 0.2s;
  transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
}

input:checked + svg {
  opacity: 1;
  scale: 1;
  filter: blur(0);
}
</style>
