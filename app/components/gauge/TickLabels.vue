<script setup lang="ts">
import { FONT, polar, stepValues, useGauge, WEIGHT, type FontFamily, type FontWeight, type ValueColor } from '~/lib/gauge'

// Labels at evenly spaced values (or at `values`), set `offset` in from the reference radius
const props = withDefaults(defineProps<{ count?: number, values?: number[], offset?: number, fontSize?: number, color?: ValueColor, font?: FontFamily, weight?: FontWeight, decimals?: number, format?: (value: number) => string }>(), { count: 10, values: undefined, offset: -48, fontSize: 16, color: 'currentColor', font: 'sans', weight: 'medium', decimals: 0, format: undefined })
const gauge = useGauge()
const labels = computed(() => {
  const g = gauge.value
  let values = props.values
  if (!values) {
    values = stepValues(g.min, g.max, props.count)
    if (g.endAngle - g.startAngle >= 360) values.pop()
  }
  return values.map((v) => {
    const p = polar(g.radius + props.offset, g.angleOf(v))
    return { ...p, text: props.format ? props.format(v) : v.toFixed(props.decimals), color: typeof props.color === 'function' ? props.color(v) : undefined }
  })
})
</script>

<template>
  <g :fill="typeof color === 'string' ? color : undefined" :font-size="fontSize" text-anchor="middle" dominant-baseline="central" :style="{ fontFamily: FONT[font], fontWeight: WEIGHT[weight], fontVariantNumeric: 'tabular-nums' }">
    <text v-for="(l, i) in labels" :key="i" :x="l.x" :y="l.y" :fill="l.color">{{ l.text }}</text>
  </g>
</template>
