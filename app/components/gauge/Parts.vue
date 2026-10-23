<script setup lang="ts">
import { wholePercents } from '~/lib/gauge'

// Stacked parts: one ring split into the parts of a whole (what you own by kind, spending by category,
// bookmarks by folder), the total in the middle and a legend beside it. Pointing at a part, or focusing
// or tapping its legend row, lifts it out and puts its own figures in the middle. Parts morph from their
// old sizes to their new ones when the data changes, and sweep in from nothing the first time; reduced
// motion jumps straight there. Built on <Gauge> and <GaugeStack>, so it shares their geometry.
export interface GaugePart {
  key: string
  label: string
  value: number
  color: string
  /** A second line in the legend: "3 items", "12 payments" */
  detail?: string
}

const props = withDefaults(defineProps<{
  parts: GaugePart[]
  format: (value: number) => string
  /** Under the total: "worth now", "bookmarks" */
  caption: string
  /** What the ring stands for, for screen readers: "Value by kind" */
  label: string
  /** The whole the parts are out of; the rest of the ring stays empty. Leave out to make the parts the whole */
  max?: number
  /** The key of the part to show in the middle, from outside (a list beside it); v-model:active */
  active?: string
  /** Clicking a legend row pins its part in the middle (a toggle). False where a row goes somewhere instead */
  selectable?: boolean
  /** Fold everything past this many parts into one grey "N more" part */
  limit?: number
  legend?: boolean
  /** Shown in the middle while every part is zero */
  empty?: string
}>(), { max: undefined, active: undefined, selectable: true, limit: 6, legend: true, empty: 'Nothing yet' })
const emit = defineEmits<{ 'update:active': [key: string | undefined], 'pick': [key: string] }>()

const OTHER = '\u0000other'
const folded = computed<GaugePart[]>(() => {
  const list = props.parts.filter(p => p.value > 0)
  if (!props.limit || list.length <= props.limit) return list
  const rest = list.slice(props.limit - 1)
  return [...list.slice(0, props.limit - 1), { key: OTHER, label: `${rest.length} more`, value: rest.reduce((n, p) => n + p.value, 0), color: 'var(--ink-3)', detail: rest.map(p => p.label).join(', ') }]
})
const sum = computed(() => folded.value.reduce((n, p) => n + p.value, 0))
const whole = computed(() => Math.max(props.max ?? 0, sum.value))
const percents = computed(() => wholePercents(folded.value.map(p => p.value), whole.value))

// ---------- The morph: each part's drawn size eases from where it was to where it's going ----------
interface Drawn { key: string, color: string, value: number }
const drawn = ref<Drawn[]>([])
const drawnMax = ref(0)
let frame = 0
function morph() {
  if (import.meta.server) return
  cancelAnimationFrame(frame)
  const before = new Map(drawn.value.map(d => [d.key, d.value]))
  const targets = folded.value.map(p => ({ key: p.key, color: p.color, to: p.value }))
  // A part that's gone shrinks away where it was, rather than vanishing
  drawn.value.forEach((d, i) => {
    if (!targets.some(t => t.key === d.key)) targets.splice(Math.min(i, targets.length), 0, { key: d.key, color: d.color, to: 0 })
  })
  const fromMax = drawnMax.value
  const toMax = whole.value
  const finish = () => {
    drawn.value = folded.value.map(p => ({ key: p.key, color: p.color, value: p.value }))
    drawnMax.value = toMax
  }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return finish()
  const start = performance.now()
  const ease = (t: number) => 1 - (1 - t) ** 3
  const tick = (now: number) => {
    const t = Math.min((now - start) / 650, 1)
    const k = ease(t)
    drawn.value = targets.map(x => ({ key: x.key, color: x.color, value: (before.get(x.key) ?? 0) + (x.to - (before.get(x.key) ?? 0)) * k }))
    drawnMax.value = fromMax + (toMax - fromMax) * k
    if (t < 1) frame = requestAnimationFrame(tick)
    else finish()
  }
  frame = requestAnimationFrame(tick)
}
onMounted(morph)
watch(() => JSON.stringify([folded.value.map(p => [p.key, p.value, p.color]), whole.value]), morph)
onBeforeUnmount(() => import.meta.client && cancelAnimationFrame(frame))
const drawnSum = computed(() => drawn.value.reduce((n, d) => n + d.value, 0))

// ---------- Which part is lifted out: the one pointed at, else the one chosen ----------
const hovered = ref<string>()
const current = computed(() => {
  const key = hovered.value ?? props.active
  const i = folded.value.findIndex(p => p.key === key)
  return i < 0 ? undefined : { ...folded.value[i]!, pct: percents.value[i]! }
})
const activeIndex = computed(() => {
  const key = current.value?.key
  const i = drawn.value.findIndex(d => d.key === key)
  return i < 0 ? undefined : i
})
function hoverDrawn(i: number | undefined) {
  hovered.value = i === undefined ? undefined : drawn.value[i]?.key
}
function choose(key: string) {
  if (props.selectable) emit('update:active', props.active === key ? undefined : key)
  if (key !== OTHER) emit('pick', key)
}
function pickDrawn(i: number) {
  const key = drawn.value[i]?.key
  if (key) choose(key)
}

const summary = computed(() => `${props.label}: ${props.format(sum.value)} ${props.caption}. ${folded.value.map((p, i) => `${p.label} ${props.format(p.value)}, ${percents.value[i]}%`).join('; ')}`)
</script>

<template>
  <div class="parts">
    <div class="parts-grid" :class="{ 'no-legend': !legend }">
    <div class="ring">
      <div role="img" :aria-label="sum ? summary : `${label}: ${empty}`">
        <Gauge :value="drawnSum" :min="0" :max="drawnMax || 1" :start-angle="40" :end-angle="320" :radius="200" :padding="30">
          <GaugeTrack :width="40" color="var(--ink)" :opacity="0.07" cap="butt" />
          <GaugeStack :parts="drawn" :width="40" :gap="drawn.length > 1 ? 1.6 : 0" :active="activeIndex" interactive @hover="hoverDrawn" @pick="pickDrawn" />
        </Gauge>
      </div>
      <!-- The middle, in HTML so long figures (riel) can shrink to fit the ring -->
      <div class="middle" aria-hidden="true">
        <Transition name="readout" mode="out-in">
          <div v-if="current" :key="current.key" class="readout">
            <span class="swatch" :style="{ background: current.color }" />
            <strong>{{ format(current.value) }}</strong>
            <span class="what">{{ current.label }} · {{ current.pct }}%</span>
          </div>
          <div v-else-if="sum" key="total" class="readout">
            <slot name="center" :total="sum">
              <strong>{{ format(sum) }}</strong>
              <span class="what">{{ caption }}</span>
            </slot>
          </div>
          <div v-else key="empty" class="readout"><span class="what">{{ empty }}</span></div>
        </Transition>
      </div>
    </div>

    <ul v-if="legend && folded.length" class="legend" @pointerleave="hovered = undefined">
      <li v-for="(p, i) in folded" :key="p.key">
        <button
          type="button"
          class="row"
          :class="{ on: current?.key === p.key, dim: current && current.key !== p.key }"
          :aria-pressed="selectable ? active === p.key : undefined"
          :aria-label="`${p.label}: ${format(p.value)}, ${percents[i]}%${p.detail ? `, ${p.detail}` : ''}`"
          @pointerenter="hovered = p.key"
          @focus="hovered = p.key"
          @blur="hovered = undefined"
          @click="choose(p.key)"
        >
          <span class="swatch" :style="{ background: p.color }" />
          <span class="name">{{ p.label }}<small v-if="p.detail">{{ p.detail }}</small></span>
          <span class="value">{{ format(p.value) }}</span>
          <span class="pct">{{ percents[i] }}%</span>
        </button>
      </li>
      <li v-if="max !== undefined && max > sum" class="rest">
        <span class="swatch" />
        <span class="name">Not yet</span>
        <span class="value">{{ format(max - sum) }}</span>
        <span class="pct">{{ 100 - percents.reduce((n, v) => n + v, 0) }}%</span>
      </li>
    </ul>
    </div>
    <slot />
  </div>
</template>

<style scoped>
.parts {
  container-type: inline-size;
}

.parts-grid {
  display: grid;
  gap: 1rem 1.75rem;
  align-items: center;
}

/* Room for both: the ring on the left, the legend beside it */
@container (min-width: 30rem) {
  .parts-grid:not(.no-legend) {
    grid-template-columns: minmax(10rem, 15rem) minmax(0, 1fr);
  }
}

.ring {
  position: relative;
  width: 100%;
  max-width: var(--parts-size, 15rem);
  justify-self: center;
  container-type: inline-size;
}

.middle {
  position: absolute;
  inset: 22% 18% 20%;
  display: grid;
  place-items: center;
  text-align: center;
  pointer-events: none;
}

.readout {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  min-width: 0;
  max-width: 100%;
}

.readout strong,
.readout :slotted(strong) {
  font-size: clamp(1rem, 13cqi, 2.1rem);
  font-weight: 750;
  line-height: 1.05;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.what,
.readout :slotted(.what) {
  font-size: clamp(0.7rem, 5.6cqi, 0.85rem);
  font-weight: 600;
  color: var(--ink-2);
  line-height: 1.2;
}

.readout .swatch {
  width: 1.1rem;
  height: 0.3rem;
}

.readout-enter-active,
.readout-leave-active {
  transition: opacity var(--dur-fast), translate var(--dur-fast) var(--ease-out);
}

.readout-enter-from {
  opacity: 0;
  translate: 0 0.3rem;
}

.readout-leave-to {
  opacity: 0;
  translate: 0 -0.3rem;
}

.legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.row,
.rest {
  width: 100%;
  padding: 0.45rem 0.55rem;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto 3.2ch;
  align-items: center;
  gap: 0.65rem;
  font: inherit;
  color: inherit;
  text-align: left;
  background: none;
  border: 0;
  border-radius: var(--radius);
  box-sizing: border-box;
}

.row {
  cursor: pointer;
  transition: background-color var(--dur-fast);
}

.row.on {
  background: var(--surface-2);
}

/* The others step back by their dot only, so their text keeps its contrast */
.row .swatch {
  transition: opacity var(--dur-fast);
}

.row.dim .swatch {
  opacity: 0.3;
}

.row[aria-pressed='true'] {
  box-shadow: inset 0 0 0 1px var(--line);
}

.swatch {
  display: block;
  width: 0.7rem;
  height: 0.7rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--ink) 12%, transparent);
}

.name {
  min-width: 0;
  display: flex;
  flex-direction: column;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.name small {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
}

.value {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.pct {
  font-size: var(--text-xs);
  color: var(--ink-3);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.rest {
  color: var(--ink-3);
}

@media (prefers-reduced-motion: reduce) {
  .readout-enter-active,
  .readout-leave-active {
    transition: none;
  }
}
</style>
