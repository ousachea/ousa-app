<script setup lang="ts">
import { FONT, WEIGHT, type FontFamily, type FontWeight } from '~/lib/gauge'

// A label anywhere on the gauge, relative to its centre (positive y is down)
withDefaults(defineProps<{ x?: number, y?: number, fontSize?: number, color?: string, font?: FontFamily, weight?: FontWeight, anchor?: 'start' | 'middle' | 'end' }>(), { x: 0, y: 0, fontSize: 24, color: 'currentColor', font: 'sans', weight: 'medium', anchor: 'middle' })
</script>

<template>
  <text :x="x" :y="y" :fill="color" :font-size="fontSize" :text-anchor="anchor" dominant-baseline="central" :style="{ fontFamily: FONT[font], fontWeight: WEIGHT[weight], fontVariantNumeric: 'tabular-nums' }"><slot /></text>
</template>
