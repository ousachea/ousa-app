<script setup lang="ts">
import { arcPath, polar, useGauge, type StrokeCap, type Zone } from '~/lib/gauge'

// Coloured bands across the domain: each zone runs from the one before's `to` (or min) to its own; the last
// runs to max. `gap` leaves degrees between neighbours; `endCap` rounds the two outer ends apart from the joints.
const props = withDefaults(defineProps<{ zones: Zone[], width?: number, opacity?: number, cap?: StrokeCap, endCap?: StrokeCap, offset?: number, gap?: number }>(), { width: 8, opacity: 1, cap: 'butt', endCap: undefined, offset: 0, gap: 0 })
const gauge = useGauge()
const parts = computed(() => {
  const g = gauge.value
  const r = g.radius + props.offset
  const out: { d: string, color: string, dots: { x: number, y: number }[] }[] = []
  let from = g.min
  props.zones.forEach((zone, i) => {
    const first = i === 0
    const last = i === props.zones.length - 1
    const to = last ? g.max : Math.min(Math.max(zone.to, from), g.max)
    const a0 = g.angleOf(from) + (first ? 0 : props.gap / 2)
    const a1 = g.angleOf(to) - (last ? 0 : props.gap / 2)
    from = to
    if (a1 <= a0) return
    // Ends are drawn as discs where rounded, so the outer ends and the joints can differ
    const round = (outer: boolean) => (outer ? (props.endCap ?? props.cap) : props.cap) === 'round'
    out.push({
      d: arcPath(r, a0, a1),
      color: zone.color,
      dots: [...(round(first) ? [polar(r, a0)] : []), ...(round(last) ? [polar(r, a1)] : [])]
    })
  })
  return out
})
</script>

<template>
  <g :opacity="opacity">
    <g v-for="(p, i) in parts" :key="i">
      <path :d="p.d" fill="none" :stroke="p.color" :stroke-width="width" stroke-linecap="butt" />
      <circle v-for="(dot, j) in p.dots" :key="j" :cx="dot.x" :cy="dot.y" :r="width / 2" :fill="p.color" />
    </g>
  </g>
</template>
