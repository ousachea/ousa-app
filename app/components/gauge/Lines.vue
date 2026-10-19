<script setup lang="ts">
import { polar, useGauge, type StrokeCap, type ValueColor } from '~/lib/gauge'

// Radial lines at domain values; GaugeTicks and GaugeMarks draw with it
const props = withDefaults(defineProps<{ values: number[], length?: number, width?: number, color?: ValueColor, opacity?: number, cap?: StrokeCap, offset?: number }>(), { length: 12, width: 2, color: 'currentColor', opacity: 1, cap: 'round', offset: 0 })
const gauge = useGauge()
const lines = computed(() => props.values.map((v) => {
  const g = gauge.value
  const half = props.length / 2
  const a = polar(g.radius + props.offset - half, g.angleOf(v))
  const b = polar(g.radius + props.offset + half, g.angleOf(v))
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: typeof props.color === 'function' ? props.color(v) : undefined }
}))
</script>

<template>
  <g :stroke="typeof color === 'string' ? color : undefined" :stroke-opacity="opacity" :stroke-width="width" :stroke-linecap="cap">
    <line v-for="(l, i) in lines" :key="i" :x1="l.x1" :y1="l.y1" :x2="l.x2" :y2="l.y2" :stroke="l.color" />
  </g>
</template>
