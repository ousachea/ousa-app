<script setup lang="ts">
import { FONT, polar, useGauge, WEIGHT, type FontFamily, type FontWeight } from '~/lib/gauge'

// A label that follows the value round the arc, on a pill. `offset` sets it in from (negative) or out past
// (positive) the reference radius. The pill's width is worked out from the text, so it needs no measuring.
const props = withDefaults(defineProps<{ offset?: number, fontSize?: number, color?: string, background?: string, font?: FontFamily, weight?: FontWeight, decimals?: number, format?: (value: number) => string }>(), { offset: 56, fontSize: 26, color: 'var(--surface)', background: 'currentColor', font: 'sans', weight: 'semibold', decimals: 0, format: undefined })
const gauge = useGauge()
const tip = computed(() => {
  const g = gauge.value
  const text = props.format ? props.format(g.value) : g.value.toFixed(props.decimals)
  const p = polar(g.radius + props.offset, g.angleOf(g.value))
  // Tabular digits run about 0.6em wide; the pill keeps half its height as padding either side
  const h = props.fontSize * 1.6
  const w = text.length * props.fontSize * 0.6 + h
  return { text, x: p.x, y: p.y, w, h }
})
</script>

<template>
  <g>
    <rect :x="tip.x - tip.w / 2" :y="tip.y - tip.h / 2" :width="tip.w" :height="tip.h" :rx="tip.h / 2" :fill="background" />
    <text :x="tip.x" :y="tip.y" :fill="color" :font-size="fontSize" text-anchor="middle" dominant-baseline="central" :style="{ fontFamily: FONT[font], fontWeight: WEIGHT[weight], fontVariantNumeric: 'tabular-nums' }">{{ tip.text }}</text>
  </g>
</template>
