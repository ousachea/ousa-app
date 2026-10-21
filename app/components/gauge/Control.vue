<script setup lang="ts">
import { angleOfPoint, arcPath, clamp, useGauge, wrapInto } from '~/lib/gauge'

// Drag the arc to set the value, like a volume knob: v-model the same value the Gauge shows. It's an
// invisible band over the track, `width` thick, and a slider for the keyboard and screen readers too
// (arrows step, Page Up / Down take ten steps, Home and End go to the ends). Outside the arc's sweep, a
// drag snaps to the nearer end; on a wrapped domain it carries on round.
const props = withDefaults(defineProps<{ step?: number, width?: number, offset?: number, label?: string, valueText?: (value: number) => string }>(), { step: 1, width: 64, offset: 0, label: 'Value', valueText: undefined })
const model = defineModel<number>()
const gauge = useGauge()
const d = computed(() => arcPath(gauge.value.radius + props.offset, gauge.value.startAngle, gauge.value.endAngle))
const current = computed(() => model.value ?? gauge.value.target)

function snap(v: number) {
  const g = gauge.value
  const stepped = g.min + Math.round((v - g.min) / props.step) * props.step
  // Rounding keeps steps like 0.1 from collecting floating-point dust
  const tidy = Number(stepped.toFixed(10))
  return g.wrap ? wrapInto(tidy, g.min, g.max - g.min) : clamp(tidy, g.min, g.max)
}

function fromPointer(e: PointerEvent) {
  const el = e.currentTarget as SVGGraphicsElement
  const m = el.getScreenCTM()
  if (!m) return
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
  const g = gauge.value
  const sweep = g.endAngle - g.startAngle
  let a = g.startAngle + wrapInto(angleOfPoint(p.x, p.y) - g.startAngle, 0, 360)
  // In the opening at the bottom: whichever end is nearer
  if (a > g.endAngle) a = a - g.endAngle < g.startAngle + 360 - a ? g.endAngle : g.startAngle
  model.value = snap(g.min + ((a - g.startAngle) / sweep) * (g.max - g.min))
}

const dragging = ref(false)
function down(e: PointerEvent) {
  if (e.button !== 0) return
  ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  dragging.value = true
  fromPointer(e)
}
function move(e: PointerEvent) {
  if (dragging.value) fromPointer(e)
}
function up(e: PointerEvent) {
  dragging.value = false
  ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
}

function key(e: KeyboardEvent) {
  const g = gauge.value
  const by = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 }[e.key]
  if (by !== undefined) model.value = snap(current.value + by * props.step)
  else if (e.key === 'Home') model.value = g.min
  else if (e.key === 'End') model.value = g.max
  else return
  e.preventDefault()
}
</script>

<template>
  <path
    class="control"
    :class="{ dragging }"
    :d="d"
    fill="none"
    stroke="transparent"
    :stroke-width="width"
    stroke-linecap="round"
    pointer-events="stroke"
    role="slider"
    tabindex="0"
    :aria-label="label"
    :aria-valuemin="gauge.min"
    :aria-valuemax="gauge.max"
    :aria-valuenow="current"
    :aria-valuetext="valueText?.(current)"
    @pointerdown="down"
    @pointermove="move"
    @pointerup="up"
    @pointercancel="up"
    @keydown="key"
  />
</template>

<style scoped>
.control {
  cursor: grab;
  outline: none;
  touch-action: none;
  transition: stroke var(--dur-fast);
}

.control.dragging {
  cursor: grabbing;
}

/* The band shows faintly while you're on it, so you can see where to drag */
.control:hover,
.control.dragging {
  stroke: color-mix(in srgb, currentColor 6%, transparent);
}

.control:focus-visible {
  stroke: color-mix(in srgb, var(--accent, currentColor) 22%, transparent);
}
</style>
