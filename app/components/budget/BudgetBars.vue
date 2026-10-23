<script setup lang="ts">
// A small vertical bar chart: one bar per point (a day, a week or a month), with an optional second
// series beside it. Recessive grid, rounded data-ends on the baseline, a tooltip per bar, and a
// table view for screen readers. Colours come from the --budget-* tokens so dark mode has its own.
export interface BarPoint {
  key: string
  label: string
  /** Shown in the tooltip */
  title: string
  values: (number | undefined)[]
}

const props = withDefaults(defineProps<{
  points: BarPoint[]
  series: { name: string, color: string }[]
  format: (v: number) => string
  height?: number
  /** Tick labels to show; others hidden to avoid crowding */
  labelEvery?: number
  /** A horizontal reference line, like a daily budget */
  guide?: { value: number, label: string }
  caption: string
}>(), { height: 180, labelEvery: 1, guide: undefined })
const emit = defineEmits<{ pick: [key: string] }>()

const box = ref<HTMLElement>()
const width = ref(600)
let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver(([e]) => (width.value = Math.max(e!.contentRect.width, 240)))
  if (box.value) observer.observe(box.value)
})
onBeforeUnmount(() => observer?.disconnect())

const PAD = { top: 12, right: 8, bottom: 22, left: 44 }
const max = computed(() => {
  const vals = props.points.flatMap(p => p.values).filter((v): v is number => v !== undefined)
  return Math.max(...vals, props.guide?.value ?? 0, 0)
})
// Round gridlines: 1, 2 or 5 × a power of ten, three or four of them
const ticks = computed(() => {
  if (!max.value) return [0]
  const rough = max.value / 3
  const pow = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 5, 10].map(m => m * pow).find(s => s >= rough) ?? pow * 10
  const out: number[] = []
  for (let v = 0; v <= max.value + step * 0.001; v += step) out.push(v)
  if (out.at(-1)! < max.value) out.push(out.at(-1)! + step)
  return out
})
const top = computed(() => ticks.value.at(-1) || 1)
const innerW = computed(() => width.value - PAD.left - PAD.right)
const innerH = computed(() => props.height - PAD.top - PAD.bottom)
const y = (v: number) => PAD.top + innerH.value * (1 - v / top.value)
const slot = computed(() => innerW.value / Math.max(1, props.points.length))
const n = computed(() => props.series.length)
// 2px surface gap between neighbours; bars no wider than 28px
const barW = computed(() => Math.max(2, Math.min(28, (slot.value - 2) / n.value - (n.value > 1 ? 2 : 0))))
const xOf = (i: number, s: number) => PAD.left + slot.value * i + (slot.value - (barW.value * n.value + 2 * (n.value - 1))) / 2 + s * (barW.value + 2)

// Rounded top corners only, anchored to the baseline
function barPath(x: number, v: number) {
  const h = Math.max(0, y(0) - y(v))
  if (h < 0.5) return ''
  const r = Math.min(4, barW.value / 2, h)
  const yt = y(0) - h
  return `M${x},${y(0)}V${yt + r}Q${x},${yt} ${x + r},${yt}H${x + barW.value - r}Q${x + barW.value},${yt} ${x + barW.value},${yt + r}V${y(0)}Z`
}

const active = ref<number>()
const activePoint = computed(() => (active.value === undefined ? undefined : props.points[active.value]))
function onKey(e: KeyboardEvent) {
  const len = props.points.length
  if (e.key === 'ArrowRight') active.value = Math.min((active.value ?? -1) + 1, len - 1)
  else if (e.key === 'ArrowLeft') active.value = Math.max((active.value ?? len) - 1, 0)
  else if (e.key === 'Enter' && activePoint.value) emit('pick', activePoint.value.key)
  else return
  e.preventDefault()
}
</script>

<template>
  <figure class="bars">
    <figcaption class="sr-only">{{ caption }}</figcaption>
    <div v-if="series.length > 1" class="legend" aria-hidden="true">
      <span v-for="s in series" :key="s.name"><i :style="{ background: s.color }" />{{ s.name }}</span>
    </div>
    <div ref="box" class="plot">
      <svg
        :width="width"
        :height="height"
        role="img"
        tabindex="0"
        :aria-label="`${caption}. Use the arrow keys to read each bar.`"
        @keydown="onKey"
        @blur="active = undefined"
        @pointerleave="active = undefined"
      >
        <g class="grid">
          <g v-for="t in ticks" :key="t">
            <line :x1="PAD.left" :x2="width - PAD.right" :y1="y(t)" :y2="y(t)" />
            <text :x="PAD.left - 6" :y="y(t)" class="ytick">{{ format(t) }}</text>
          </g>
        </g>
        <g v-if="guide" class="guide">
          <line :x1="PAD.left" :x2="width - PAD.right" :y1="y(guide.value)" :y2="y(guide.value)" />
          <text :x="width - PAD.right" :y="y(guide.value) - 4">{{ guide.label }}</text>
        </g>
        <g v-for="(p, i) in points" :key="p.key" :class="{ dim: active !== undefined && active !== i }">
          <path v-for="(v, s) in p.values" :key="s" :d="barPath(xOf(i, s), v ?? 0)" :fill="series[s]!.color" />
          <!-- Hit target: the whole column, bigger than the bar -->
          <rect
            :x="PAD.left + slot * i"
            :y="PAD.top"
            :width="slot"
            :height="innerH"
            class="hit"
            @pointerenter="active = i"
            @click="emit('pick', p.key)"
          />
          <text v-if="i % labelEvery === 0" :x="PAD.left + slot * i + slot / 2" :y="height - 6" class="xtick">{{ p.label }}</text>
        </g>
      </svg>
      <div v-if="activePoint" class="tooltip chart-tip" role="status" :style="{ left: `${Math.min(Math.max(PAD.left + slot * (active ?? 0) + slot / 2, 80), width - 80)}px` }">
        <strong>{{ activePoint.title }}</strong>
        <span v-for="(s, i) in series" :key="s.name"><i :style="{ background: s.color }" />{{ series.length > 1 ? `${s.name}: ` : '' }}{{ activePoint.values[i] === undefined ? '…' : format(activePoint.values[i]!) }}</span>
      </div>
    </div>
    <details class="table-view">
      <summary>Show as a table</summary>
      <table>
        <thead><tr><th>{{ caption }}</th><th v-for="s in series" :key="s.name">{{ s.name }}</th></tr></thead>
        <tbody>
          <tr v-for="p in points" :key="p.key"><td>{{ p.title }}</td><td v-for="(v, i) in p.values" :key="i" class="num">{{ v === undefined ? '…' : format(v) }}</td></tr>
        </tbody>
      </table>
    </details>
  </figure>
</template>

<style scoped>
.bars {
  margin: 0;
}

.plot {
  position: relative;
}

svg {
  display: block;
  overflow: visible;
}

svg:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--accent) 55%, transparent);
  outline-offset: 4px;
  border-radius: var(--radius-sm);
}

.grid line {
  stroke: var(--line);
  stroke-width: 1;
}

.grid text,
.xtick,
.guide text {
  font-family: var(--font);
  font-size: 10.5px;
  fill: var(--ink-3);
  font-variant-numeric: tabular-nums;
}

.ytick {
  text-anchor: end;
  dominant-baseline: middle;
}

.xtick {
  text-anchor: middle;
}

.guide line {
  stroke: var(--ink-2);
  stroke-width: 1;
  stroke-dasharray: 4 3;
}

.guide text {
  text-anchor: end;
  fill: var(--ink-2);
}

.hit {
  fill: transparent;
  cursor: pointer;
}

.dim path {
  opacity: 0.45;
}

.legend {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.5rem;
  font-size: var(--text-xs);
  color: var(--ink-2);
}

.legend i,
.tooltip i {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 0.35rem;
  border-radius: 3px;
  vertical-align: -1px;
}

/* The look is .chart-tip (main.css); this only places it over the bar */
.tooltip {
  position: absolute;
  top: 0;
  transform: translate(-50%, -100%);
}

.table-view {
  margin-top: 0.5rem;
  font-size: var(--text-sm);
}

.table-view summary {
  color: var(--ink-2);
  cursor: pointer;
}

table {
  width: 100%;
  margin-top: 0.5rem;
  border-collapse: collapse;
}

th,
td {
  padding: 0.3rem 0.25rem;
  text-align: left;
  border-bottom: 1px solid var(--line);
}

.num {
  font-variant-numeric: tabular-nums;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>
