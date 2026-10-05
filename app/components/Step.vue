<script setup lang="ts">
// Without `n` it's a plain section heading: used where the content isn't a sequence
defineProps<{
  n?: number
  title: string
  hint?: string
}>()
</script>

<template>
  <section class="step" :aria-label="n ? `Step ${n}: ${title}` : title">
    <header class="step-head">
      <span v-if="n" class="num" aria-hidden="true">{{ n }}</span>
      <div class="step-text">
        <h2>{{ title }}</h2>
        <p v-if="hint">{{ hint }}</p>
      </div>
      <!-- Optional extra on the right of the heading, e.g. a data-source badge -->
      <div v-if="$slots.aside" class="aside"><slot name="aside" /></div>
    </header>
    <slot />
  </section>
</template>

<style scoped>
.step {
  min-width: 0;
}

.step-head {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.9rem;
}

/* Numbered sticker, same family as the page sticker */
.num {
  flex: none;
  width: 1.75rem;
  height: 1.75rem;
  display: grid;
  place-items: center;
  font-size: 0.95rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--on-accent, #fff);
  background: var(--accent);
  border-radius: 7px;
  box-shadow:
    0 0 0 2px var(--plastic),
    inset 0 -3px 0 rgb(0 0 0 / 0.12);
}

h2 {
  font-size: 1.15rem;
  line-height: 1.75rem;
  letter-spacing: -0.015em;
}

.step-text {
  flex: 1;
  min-width: 0;
}

.aside {
  flex: none;
}

.step-head p {
  margin: 0.1rem 0 0;
  font-size: 0.9rem;
  color: var(--ink-2);
}
</style>
