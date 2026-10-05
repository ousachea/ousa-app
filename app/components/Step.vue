<script setup lang="ts">
defineProps<{
  n: number
  title: string
  hint?: string
}>()
</script>

<template>
  <section class="step" :aria-label="`Step ${n}: ${title}`">
    <header class="step-head">
      <span class="num" aria-hidden="true">{{ n }}</span>
      <div>
        <h2>{{ title }}</h2>
        <p v-if="hint">{{ hint }}</p>
      </div>
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
    0 0 0 2px var(--ink),
    inset 0 -3px 0 rgb(0 0 0 / 0.12);
}

h2 {
  font-size: 1.15rem;
  line-height: 1.75rem;
  letter-spacing: -0.015em;
}

.step-head p {
  margin: 0.1rem 0 0;
  font-size: 0.9rem;
  color: var(--ink-2);
}
</style>
