<script setup lang="ts">
// Without `n` it's a plain section heading: used where the content isn't a sequence
defineProps<{
  n?: number
  title: string
  hint?: string
}>()
</script>

<template>
  <section class="step" :aria-label="n ? `Step ${n}: ${title}` : title" :style="n ? { '--step': Math.min(n, 5) - 1 } : undefined">
    <header class="step-head">
      <!-- The number and title always stay together; only the aside drops below when it's tight -->
      <div class="step-main">
        <span v-if="n" class="num" aria-hidden="true">{{ n }}</span>
        <div class="step-text">
          <h2>{{ title }}</h2>
          <p v-if="hint">{{ hint }}</p>
        </div>
      </div>
      <!-- Optional extra on the right of the heading, e.g. a data-source badge -->
      <div v-if="$slots.aside" class="aside"><slot name="aside" /></div>
    </header>
    <slot />
  </section>
</template>

<style scoped>
/* Steps rise in one after another as the page opens. Only the start is held (backwards), so once it
   has played nothing is left on the step: a lingering transform would break sticky columns and
   anything fixed inside it */
.step {
  min-width: 0;
  animation: step-in var(--dur-slow) var(--ease-out) backwards;
  animation-delay: calc(var(--step, 0) * 60ms);
}

@keyframes step-in {
  from {
    opacity: 0;
    translate: 0 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .step {
    animation: none;
  }
}

:root[data-motion='reduced'] .step,
:root[data-effects='lite'] .step {
  animation: none;
}

.step-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.6rem 0.75rem;
  margin-bottom: 0.9rem;
}

/* Numbered sticker, same family as the page sticker */
.num {
  flex: none;
  width: 1.75rem;
  height: 1.75rem;
  display: grid;
  place-items: center;
  font-size: var(--text-base);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--on-accent, #fff);
  background: var(--accent);
  border-radius: var(--radius-xs);
  box-shadow:
    0 0 0 2px var(--plastic),
    inset 0 -3px 0 rgb(0 0 0 / 0.12);
}

h2 {
  font-size: var(--text-title);
  line-height: 1.75rem;
  letter-spacing: -0.015em;
}

.step-main {
  /* With buttons beside the title (Select, the sync badge…), they drop below it on narrow screens
     instead of squeezing the title into a thin column */
  flex: 1 1 12rem;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  min-width: 0;
}

.step-text {
  flex: 1;
  min-width: 0;
}

.aside {
  flex: none;
  margin-left: auto;
}

.step-head p {
  margin: 0.1rem 0 0;
  font-size: var(--text-base);
  color: var(--ink-2);
}
</style>
