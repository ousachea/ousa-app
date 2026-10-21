<script setup lang="ts">
import { arcPath, clamp, useGauge, type StrokeCap } from '~/lib/gauge'

// One arc split into weighted parts laid end to end from min (memory: used, cached, free). Set the Gauge's
// value to the parts' total and they sweep in together, each its share of the way. `gap` leaves degrees
// between neighbours.
const props = withDefaults(defineProps<{ parts: { value: number, color: string }[], width?: number, opacity?: number, cap?: StrokeCap, offset?: number, gap?: number }>(), { width: 24, opacity: 1, cap: 'butt', offset: 0, gap: 0 })
const gauge = useGauge()
const arcs = computed(() => {
  const g = gauge.value
  // How far the sweep has come: the animated value as a share of where it's heading
  const span = g.target - g.min
  const k = span === 0 ? 1 : clamp((g.value - g.min) / span, 0, 1.5)
  const out: { d: string, color: string }[] = []
  let at = g.min
  props.parts.forEach((part, i) => {
    const from = at
    at += Math.max(0, part.value) * k
    const a0 = g.angleOf(from) + (i ? props.gap / 2 : 0)
    const a1 = g.angleOf(at) - (i < props.parts.length - 1 ? props.gap / 2 : 0)
    if (a1 > a0) out.push({ d: arcPath(g.radius + props.offset, a0, a1), color: part.color })
  })
  return out
})
</script>

<template>
  <g :opacity="opacity" fill="none" :stroke-width="width" :stroke-linecap="cap">
    <path v-for="(a, i) in arcs" :key="i" :d="a.d" :stroke="a.color" />
  </g>
</template>
