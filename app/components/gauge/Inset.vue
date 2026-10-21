<script setup lang="ts">
import { GAUGE, useGaugeRoot, type GaugeTransition } from '~/lib/gauge'

// A whole small gauge inside a bigger one (a fuel dial in a speedometer). It takes a value and scale of its
// own, like <Gauge>, and the parts inside it draw against those. `x`, `y` place its centre in the outer
// gauge's units; `scale` sizes it, so its own radius can stay 200 like any other gauge.
const props = withDefaults(defineProps<{
  value: number | [number, number]
  min?: number
  max?: number
  startAngle?: number
  endAngle?: number
  radius?: number
  transition?: GaugeTransition | boolean
  initialValue?: number
  wrap?: boolean
  rotate?: number | 'value'
  rotateTo?: number
  x?: number
  y?: number
  scale?: number
}>(), { min: 0, max: 100, startAngle: 40, endAngle: 320, radius: 200, transition: undefined, initialValue: undefined, wrap: false, rotate: 0, rotateTo: 180, x: 0, y: 0, scale: 0.3 })

provide(GAUGE, useGaugeRoot(props))
</script>

<template>
  <g :transform="`translate(${x} ${y}) scale(${scale})`">
    <slot />
  </g>
</template>
