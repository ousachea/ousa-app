<script setup lang="ts">
import { arcBox, GAUGE, useGaugeRoot, type GaugeTransition } from '~/lib/gauge'

// A composable dial (lib/gauge.ts, ported from Gauge UI). The root draws an SVG centred on the origin and
// hands the value, domain and geometry to the parts inside: GaugeTrack, GaugeArc, GaugeZones, GaugeStack,
// GaugeTicks, GaugeTickFill, GaugeMarks, GaugeTickLabels, GaugeNeedle, GaugeHub, GaugeDot, GaugeTooltip,
// GaugeValue, GaugeText, GaugeInset and GaugeControl.
const props = withDefaults(defineProps<{
  /** A value, or [from, to] for a range (the arc runs between them; a needle points at `to`) */
  value: number | [number, number]
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
  /** A domain that wraps round, max meeting min (a compass, a 24-hour clock): changes take the short way */
  wrap?: boolean
  /** Turn the scale by these degrees, or 'value' to keep the value at rotateTo while the scale turns */
  rotate?: number | 'value'
  rotateTo?: number
  /** Room around the circle for thick strokes, ticks and labels */
  padding?: number
  /** square boxes the whole circle; content fits the box to the arc's sweep, so a half dial isn't half empty */
  fit?: 'square' | 'content'
  /** An exact SVG box instead ("x y width height"), for a dial that has to line up with things laid over it */
  viewBox?: string
}>(), { min: 0, max: 100, startAngle: 40, endAngle: 320, radius: 200, transition: undefined, initialValue: undefined, wrap: false, rotate: 0, rotateTo: 180, padding: 48, fit: 'square', viewBox: undefined })

const gauge = useGaugeRoot(props)
provide(GAUGE, gauge)

const box = computed(() => {
  // A scale that turns with the value would change shape every frame, so it keeps the square box
  if (props.fit === 'content' && props.rotate !== 'value') {
    const r = gauge.value.rotation
    return arcBox(props.radius, props.startAngle + r, props.endAngle + r, props.padding)
  }
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
