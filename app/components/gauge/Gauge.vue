<script setup lang="ts">
import { arcBox, clamp, GAUGE, useAnimatedValue, valueToAngle, type GaugeTransition } from '~/lib/gauge'

// A composable dial (lib/gauge.ts, ported from Gauge UI). The root draws an SVG centred on the origin and
// hands the value, domain and geometry to the parts inside: GaugeTrack, GaugeArc, GaugeZones, GaugeTicks,
// GaugeMarks, GaugeTickLabels, GaugeNeedle, GaugeHub, GaugeValue and GaugeText.
const props = withDefaults(defineProps<{
  value: number
  min?: number
  max?: number
  /** Gauge degrees, clockwise from six o'clock */
  startAngle?: number
  endAngle?: number
  /** Reference radius in SVG units */
  radius?: number
  /** true for a gentle spring, or a spring / tween to tune it; leave out for instant updates */
  transition?: GaugeTransition | boolean
  /** Where the value starts on mount, for a sweep in */
  initialValue?: number
  /** Room around the circle for thick strokes, ticks and labels */
  padding?: number
  /** square boxes the whole circle; content fits the box to the arc's sweep, so a half dial isn't half empty */
  fit?: 'square' | 'content'
  /** An exact SVG box instead ("x y width height"), for a dial that has to line up with things laid over it */
  viewBox?: string
}>(), { min: 0, max: 100, startAngle: 40, endAngle: 320, radius: 200, transition: undefined, initialValue: undefined, padding: 48, fit: 'square', viewBox: undefined })

const lo = computed(() => Math.min(props.min, props.max))
const hi = computed(() => Math.max(props.min, props.max))
const target = computed(() => clamp(props.value, lo.value, hi.value))
const shown = useAnimatedValue(() => target.value, () => props.transition, () => hi.value - lo.value, props.initialValue === undefined ? undefined : clamp(props.initialValue, lo.value, hi.value))

const gauge = computed(() => ({
  value: props.transition ? shown.value : target.value,
  target: target.value,
  min: props.min,
  max: props.max,
  startAngle: props.startAngle,
  endAngle: props.endAngle,
  radius: props.radius,
  angleOf: (v: number) => valueToAngle(v, props.min, props.max, props.startAngle, props.endAngle)
}))
provide(GAUGE, gauge)

const box = computed(() => {
  if (props.fit === 'content') return arcBox(props.radius, props.startAngle, props.endAngle, props.padding)
  const half = props.radius + props.padding
  return { x: -half, y: -half, width: 2 * half, height: 2 * half }
})
</script>

<template>
  <svg
    class="gauge"
    :viewBox="viewBox ?? `${box.x} ${box.y} ${box.width} ${box.height}`"
    preserveAspectRatio="xMidYMid meet"
    :style="fit === 'content' && !viewBox ? { aspectRatio: `${box.width} / ${box.height}` } : undefined"
  >
    <slot />
  </svg>
</template>

<style scoped>
.gauge {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}
</style>
