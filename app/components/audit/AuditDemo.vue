<script setup lang="ts">
import type { AuditCheck } from '~/utils/craftAudit'

// One check: what it is, then the same element done wrong (Before) and right (After), side by side.
// The examples are only built once the card nears the screen, so 90 of them don't all run at once.
// Play replays both sides together: each example is keyed by `run`, so bumping it restarts it.
const props = defineProps<{ check: AuditCheck }>()

const DEMOS = {
  core: resolveComponent('AuditDemoCore'),
  visual: resolveComponent('AuditDemoVisual'),
  mobile: resolveComponent('AuditDemoMobile'),
  type: resolveComponent('AuditDemoType'),
  polish: resolveComponent('AuditDemoPolish'),
  motion: resolveComponent('AuditDemoMotion')
}
const demo = computed(() => DEMOS[props.check.section])

const card = ref<HTMLElement>()
const shown = ref(false)
const run = ref(0)
let io: IntersectionObserver | undefined
onMounted(() => {
  if (!('IntersectionObserver' in window)) {
    shown.value = true
    return
  }
  io = new IntersectionObserver(([e]) => {
    if (!e?.isIntersecting) return
    shown.value = true
    io?.disconnect()
  }, { rootMargin: '200px 0px' })
  if (card.value) io.observe(card.value)
})
onBeforeUnmount(() => io?.disconnect())
</script>

<template>
  <article ref="card" class="panel check" :aria-labelledby="`check-${check.id}`">
    <header class="head">
      <div class="title">
        <h3 :id="`check-${check.id}`"><span class="id">{{ check.id }}</span> {{ check.title }}</h3>
        <p>{{ check.hint }}</p>
      </div>
      <button v-if="check.kind === 'play'" type="button" class="btn btn-quiet play" :aria-label="`Play ${check.id} ${check.title} again`" @click="run++">
        <AppIcon name="play" />Play
      </button>
      <span v-else-if="check.kind === 'try'" class="badge info">{{ check.phone ? 'Try it on a phone' : 'Try it' }}</span>
    </header>
    <div class="pair">
      <figure v-for="after in [false, true]" :key="String(after)" class="side" :class="after ? 'is-after' : 'is-before'">
        <figcaption>
          <span class="label"><AppIcon :name="after ? 'check' : 'x'" />{{ after ? 'After' : 'Before' }}</span>
          <span class="what">{{ after ? check.after : check.before }}</span>
        </figcaption>
        <div class="stage">
          <component :is="demo" v-if="shown" :id="check.id" :after="after" :run="run" />
        </div>
      </figure>
    </div>
  </article>
</template>

<style scoped>
.check {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  scroll-margin-top: 12rem;
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.title {
  min-width: 0;
}

h3 {
  margin: 0;
  font-size: var(--text-title);
}

.id {
  margin-right: 0.2rem;
  font-size: var(--text-sm);
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}

.title p {
  margin: 0.2rem 0 0;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.play,
.badge {
  flex: none;
}

.pair {
  display: grid;
  gap: 0.75rem;
}

@media (min-width: 640px) {
  .pair {
    grid-template-columns: 1fr 1fr;
  }
}

.side {
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 0.5rem;
  margin: 0;
  min-width: 0;
}

figcaption {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.15rem 0.5rem;
  font-size: var(--text-sm);
}

.label {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-weight: 700;
}

.is-before .label {
  color: var(--bad-ink);
}

.is-after .label {
  color: var(--good-ink);
}

.what {
  color: var(--ink-2);
}

/* Each example plays out on its own small stage; container queries let one scale with it */
.stage {
  position: relative;
  min-height: 10rem;
  display: grid;
  place-items: center;
  padding: 1rem;
  overflow: hidden;
  container-type: inline-size;
  background: var(--surface-2);
  border-radius: var(--radius-lg);
  box-shadow: inset 0 0 0 1px var(--border);
}

.is-before .stage {
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--red) 25%, var(--border));
}

.is-after .stage {
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--green) 30%, var(--border));
}
</style>
