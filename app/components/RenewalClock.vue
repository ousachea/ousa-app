<script setup lang="ts">
// A countdown to the second: days, hours, minutes and seconds, each rolling as it changes (RollingNumber,
// which holds still with reduced motion). It keeps its own timer, turning over on the second like the
// page's shared clock, so only these few digits change each second instead of the whole list. It rests
// while the tab is hidden or the clock is scrolled out of view, catching up when it's back, and stops once
// the moment has come.
const props = withDefaults(defineProps<{
  /** The moment counted down to (ms since 1970), from the same renewal date maths as the rest of the page */
  target: number
  /** Shown once it's reached: "Renewing now", "Ended" */
  doneText?: string
}>(), { doneText: 'Now' })

const now = ref(Date.now())
let timer: ReturnType<typeof setTimeout> | undefined
const left = computed(() => Math.max(0, props.target - now.value))
const root = ref<HTMLElement>()
// On screen; until the observer says otherwise it counts as seen, so the first paint is right
const seen = ref(true)
let observer: IntersectionObserver | undefined

function schedule() {
  clearTimeout(timer)
  if (document.hidden || !seen.value || props.target <= Date.now()) return
  timer = setTimeout(() => {
    now.value = Date.now()
    schedule()
  }, 1000 - (Date.now() % 1000))
}
function wake() {
  now.value = Date.now()
  schedule()
}
onMounted(() => {
  wake()
  document.addEventListener('visibilitychange', wake)
  observer = new IntersectionObserver(([entry]) => {
    seen.value = !!entry?.isIntersecting
    wake()
  })
  if (root.value) observer.observe(root.value)
})
onBeforeUnmount(() => {
  clearTimeout(timer)
  observer?.disconnect()
  document.removeEventListener('visibilitychange', wake)
})
watch(() => props.target, wake)

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const parts = computed(() => {
  const ms = left.value
  return { d: Math.floor(ms / DAY), h: Math.floor((ms % DAY) / HOUR), m: Math.floor((ms % HOUR) / MINUTE), s: Math.floor((ms % MINUTE) / SECOND) }
})
const two = (n: number) => String(n).padStart(2, '0')
// Closer means louder: the tool colour inside a week, and in the last day a faint ring leaving the seconds
const urgency = computed(() => (left.value <= 0 ? 'done' : left.value < DAY ? 'today' : left.value < 7 * DAY ? 'soon' : 'calm'))
const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`
// For screen readers, to the minute: a label changing every second is noise, and the timer role is polite anyway
const spoken = computed(() => (left.value <= 0
  ? props.doneText
  : `${[parts.value.d && plural(parts.value.d, 'day'), plural(parts.value.h, 'hour'), plural(parts.value.m, 'minute')].filter(Boolean).join(', ')} left`))
</script>

<template>
  <div ref="root" class="clock" :class="[`is-${urgency}`, { resting: !seen }]" role="timer" :aria-label="spoken">
    <p v-if="urgency === 'done'" class="done">{{ doneText }}</p>
    <div v-else class="units" aria-hidden="true">
      <span class="unit"><RollingNumber class="num" :value="parts.d" /><small>{{ parts.d === 1 ? 'day' : 'days' }}</small></span>
      <span class="sep">:</span>
      <span class="unit"><RollingNumber class="num" :value="two(parts.h)" /><small>hrs</small></span>
      <span class="sep">:</span>
      <span class="unit"><RollingNumber class="num" :value="two(parts.m)" /><small>min</small></span>
      <span class="sep">:</span>
      <span class="unit secs"><RollingNumber class="num" :value="two(parts.s)" /><small>sec</small></span>
    </div>
  </div>
</template>

<style scoped>
.units {
  display: flex;
  align-items: flex-start;
  gap: 0.3rem;
}

.unit {
  position: relative;
  min-width: 2.6em;
  padding: 0.35em 0.45em 0.3em;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--surface-2);
  border-radius: var(--radius);
  box-shadow: inset 0 0 0 1px var(--line);
  transition: background-color var(--dur-slow), box-shadow var(--dur-slow);
}

.num {
  font-size: 1.6em;
  font-weight: 750;
  line-height: 1.1;
  letter-spacing: -0.02em;
}

.unit small {
  font-size: 0.68em;
  font-weight: 600;
  color: var(--ink-3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.sep {
  padding-top: 0.45em;
  font-size: 1.3em;
  font-weight: 700;
  color: var(--ink-3);
}

.is-soon .unit,
.is-today .unit {
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 35%, var(--line));
}

.is-soon .num,
.is-today .num {
  color: color-mix(in srgb, var(--accent) 70%, var(--ink));
}

/* The last day: a thin ring leaves the seconds once a second. Only scale and opacity move, which the
   compositor handles without repainting, and it rests while the clock is out of view */
.is-today .secs::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  border: 1.5px solid var(--accent);
  opacity: 0;
  animation: beat 1s var(--ease-out) infinite;
  pointer-events: none;
}

.resting .secs::after {
  animation-play-state: paused;
}

@keyframes beat {
  from { opacity: 0.5; transform: scale(1); }
  to { opacity: 0; transform: scale(1.18); }
}

.done {
  margin: 0;
  font-size: 1.4em;
  font-weight: 750;
  color: var(--ink-2);
}

@media (prefers-reduced-motion: reduce) {
  .is-today .secs::after {
    animation: none;
  }
}

@media (max-width: 380px) {
  .units {
    gap: 0.15rem;
  }

  .unit {
    min-width: 2.2em;
    padding-inline: 0.3em;
  }
}
</style>
