<script setup lang="ts">
import { stepValues, useGauge, type StrokeCap, type ValueColor } from '~/lib/gauge'

// Evenly spaced tick marks across the arc: `count` intervals, so count + 1 ticks (or `values` to place them)
const props = withDefaults(defineProps<{ count?: number, values?: number[], length?: number, width?: number, color?: ValueColor, opacity?: number, cap?: StrokeCap, offset?: number }>(), { count: 10, values: undefined, length: 12, width: 2, color: 'currentColor', opacity: 1, cap: 'round', offset: 0 })
const gauge = useGauge()
const at = computed(() => {
  if (props.values) return props.values
  const g = gauge.value
  const v = stepValues(g.min, g.max, props.count)
  // A closed ring's last tick would land on its first
  if (g.endAngle - g.startAngle >= 360) v.pop()
  return v
})
</script>

<template>
  <GaugeLines :values="at" :length="length" :width="width" :color="color" :opacity="opacity" :cap="cap" :offset="offset" />
</template>
