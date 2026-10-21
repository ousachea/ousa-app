<script setup lang="ts">
// Claude usage's daily chart: one bar a day on a shared baseline, in the app's colour (one series, so no
// legend; the heading names it). Pointing at, touching or tabbing to a bar shows its day and value.
const props = defineProps<{ days: { day: string, value: number }[], format: (v: number) => string, label: string }>()

const max = computed(() => Math.max(...props.days.map(d => d.value), 0))
const active = ref<number | null>(null)
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
// A few dates under the axis: the first, the last and some in between
const ticks = computed(() => {
  const n = props.days.length
  if (n <= 1) return [0]
  const step = Math.max(1, Math.round(n / 5))
  const out = []
  for (let i = 0; i < n; i += step) out.push(i)
  if (out[out.length - 1] !== n - 1) out.push(n - 1)
  return out
})
const short = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
</script>

<template>
  <figure class="usage-bars">
    <div class="plot" role="list" :aria-label="label" @mouseleave="active = null">
      <div
        v-for="(d, i) in days"
        :key="d.day"
        class="slot"
        role="listitem"
        tabindex="0"
        :aria-label="`${dayLabel(d.day)}: ${format(d.value)}`"
        @mouseenter="active = i"
        @focus="active = i"
        @blur="active = null"
        @touchstart.passive="active = i"
      >
        <span class="bar" :class="{ on: active === i, empty: !d.value }" :style="{ height: max ? `${Math.max(d.value ? 2 : 0, (d.value / max) * 100)}%` : '0%' }" />
        <span v-if="active === i" class="tip" :class="{ left: i > days.length / 2 }" role="status">
          <b>{{ format(d.value) }}</b>
          <span>{{ dayLabel(d.day) }}</span>
        </span>
      </div>
    </div>
    <div class="ticks" aria-hidden="true">
      <span v-for="i in ticks" :key="i" :style="{ left: `${((i + 0.5) / days.length) * 100}%` }">{{ short(days[i]!.day) }}</span>
    </div>
  </figure>
</template>

<style scoped>
.usage-bars {
  margin: 0;
}

.plot {
  height: 11rem;
  display: flex;
  align-items: flex-end;
  /* 2px between bars, so neighbours never merge */
  gap: 2px;
  border-bottom: 1px solid var(--line);
}

.slot {
  position: relative;
  flex: 1;
  height: 100%;
  display: flex;
  align-items: flex-end;
  min-width: 0;
  outline: none;
  cursor: default;
}

.bar {
  width: 100%;
  /* Rounded at the data end only, square on the baseline */
  border-radius: 4px 4px 0 0;
  background: var(--accent);
  opacity: 0.85;
  transition: opacity var(--dur-fast, 0.15s);
}

.bar.on,
.slot:focus-visible .bar {
  opacity: 1;
  box-shadow: 0 0 0 2px var(--surface), 0 0 0 3.5px var(--accent);
}

.tip {
  position: absolute;
  z-index: 2;
  bottom: calc(100% + 0.4rem);
  left: 50%;
  translate: -50% 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 0.4rem 0.6rem;
  font-size: var(--text-xs);
  white-space: nowrap;
  color: var(--ink-2);
  background: var(--surface);
  border-radius: var(--radius-sm);
  box-shadow: 0 6px 18px rgb(var(--shadow) / 0.18), 0 0 0 1px var(--line);
  pointer-events: none;
}

.tip.left {
  left: auto;
  right: 50%;
  translate: 0 0;
}

.tip b {
  font-size: var(--text-sm);
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.ticks {
  position: relative;
  height: 1.4rem;
  font-size: var(--text-xs);
  color: var(--ink-3);
}

.ticks span {
  position: absolute;
  top: 0.35rem;
  translate: -50% 0;
  white-space: nowrap;
}

.ticks span:first-child {
  translate: 0 0;
  left: 0 !important;
}

.ticks span:last-child {
  translate: -100% 0;
  left: 100% !important;
}
</style>
