<script setup lang="ts">
import { arcPath, useGauge, type StrokeCap } from '~/lib/gauge'

// The filled arc, from min (or `from`, or a range's low end) to the value (or `to`). Ends may come either way
// round, so an arc anchored above the value grows back towards it. `reverse` grows it back from the end of the
// sweep instead.
const props = withDefaults(defineProps<{ width?: number, color?: string, opacity?: number, cap?: StrokeCap, offset?: number, from?: number, to?: number, reverse?: boolean }>(), { width: 24, color: 'currentColor', opacity: 1, cap: 'round', offset: 0, from: undefined, to: undefined, reverse: false })
const gauge = useGauge()
const d = computed(() => {
  const g = gauge.value
  const tail = props.from ?? g.from ?? g.min
  const head = props.to ?? g.value
  const lo = Math.min(tail, head)
  const hi = Math.max(tail, head)
  const [a0, a1] = props.reverse ? [g.angleOf(g.max - (hi - lo)), g.angleOf(g.max)] : [g.angleOf(lo), g.angleOf(hi)]
  return a1 > a0 ? arcPath(g.radius + props.offset, a0, a1) : ''
})
</script>

<template>
  <path v-if="d" :d="d" fill="none" :stroke="color" :stroke-opacity="opacity" :stroke-width="width" :stroke-linecap="cap" />
</template>
