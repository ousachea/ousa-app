<script setup lang="ts">
import { stepValues, useGauge, type StrokeCap, type ValueColor } from '~/lib/gauge'

// Ticks that are the fill: the ones between `from` (min, or a range's low end) and `to` (the value) light up
// in `color`, the rest stay `trackColor`. mode="pointer" lights only the tick nearest the value.
const props = withDefaults(defineProps<{ count?: number, values?: number[], length?: number, width?: number, color?: ValueColor, trackColor?: string, cap?: StrokeCap, offset?: number, from?: number, to?: number, mode?: 'fill' | 'pointer' }>(), { count: 24, values: undefined, length: 24, width: 6, color: 'currentColor', trackColor: 'color-mix(in srgb, currentColor 14%, transparent)', cap: 'round', offset: 0, from: undefined, to: undefined, mode: 'fill' })
const gauge = useGauge()
const at = computed(() => {
  if (props.values) return props.values
  const g = gauge.value
  const v = stepValues(g.min, g.max, props.count)
  if (g.endAngle - g.startAngle >= 360) v.pop()
  return v
})
const tone = computed(() => {
  const g = gauge.value
  const lit = (v: number) => (typeof props.color === 'function' ? props.color(v) : props.color)
  const head = props.to ?? g.value
  if (props.mode === 'pointer') {
    const nearest = at.value.reduce((best, v) => (Math.abs(v - head) < Math.abs(best - head) ? v : best), at.value[0] ?? g.min)
    return (v: number) => (v === nearest ? lit(v) : props.trackColor)
  }
  const tail = props.from ?? g.from ?? g.min
  const lo = Math.min(tail, head)
  const hi = Math.max(tail, head)
  // Nothing lit at an empty value, so zero reads as zero rather than one tick
  const eps = (g.max - g.min) * 1e-6
  return (v: number) => (hi - lo > eps && v >= lo - eps && v <= hi + eps ? lit(v) : props.trackColor)
})
</script>

<template>
  <GaugeLines :values="at" :length="length" :width="width" :color="tone" :cap="cap" :offset="offset" />
</template>
