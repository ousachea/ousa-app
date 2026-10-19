<script setup lang="ts">
import { polar, useGauge } from '~/lib/gauge'

// A needle pointing at the value. `line` is a stroke with round ends; `pointer` a tapered blade, widest at
// the centre with a rounded tip and a blunt tail. `length` is a share of the radius; `tail` reaches behind
// the centre in SVG units. Add a GaugeHub for the pivot.
const props = withDefaults(defineProps<{ variant?: 'line' | 'pointer', length?: number, width?: number, color?: string, tail?: number, tailColor?: string }>(), { variant: 'line', length: 0.85, width: 6, color: 'currentColor', tail: 30, tailColor: undefined })
const gauge = useGauge()
const pts = (points: { x: number, y: number }[]) => points.map(p => `${p.x},${p.y}`).join(' ')

const shape = computed(() => {
  const g = gauge.value
  const angle = g.angleOf(g.value)
  const tip = polar(g.radius * props.length, angle)
  const back = polar(-props.tail, angle)
  if (props.variant === 'line') return { tip, back }
  // Two polygons meeting at the centre, so the tail can take its own colour; the tip keeps a fifth of the
  // width and is rounded with a disc, so a thin needle never vanishes to a point
  const left = polar(props.width / 2, angle - 90)
  const right = polar(props.width / 2, angle + 90)
  const endR = props.width * 0.2
  const endLeft = polar(endR, angle - 90)
  const endRight = polar(endR, angle + 90)
  return {
    tip,
    back,
    endR,
    blade: pts([{ x: tip.x + endLeft.x, y: tip.y + endLeft.y }, { x: tip.x + endRight.x, y: tip.y + endRight.y }, right, left]),
    rear: pts([{ x: back.x + left.x * 0.6, y: back.y + left.y * 0.6 }, { x: back.x + right.x * 0.6, y: back.y + right.y * 0.6 }, right, left])
  }
})
</script>

<template>
  <line v-if="variant === 'line'" :x1="shape.back.x" :y1="shape.back.y" :x2="shape.tip.x" :y2="shape.tip.y" :stroke="color" :stroke-width="width" stroke-linecap="round" />
  <g v-else>
    <polygon v-if="tail > 0" :points="shape.rear" :fill="tailColor ?? color" />
    <polygon :points="shape.blade" :fill="color" />
    <circle :cx="shape.tip.x" :cy="shape.tip.y" :r="shape.endR" :fill="color" />
  </g>
</template>
