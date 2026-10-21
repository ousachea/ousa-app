<script setup lang="ts">
import { polar, useGauge } from '~/lib/gauge'

// A needle pointing at the value. `line` is a stroke with round ends; `pointer` a tapered blade, widest at
// the centre with a rounded tip and a blunt tail; `compass` a two-tone lozenge, the tip in `color` and the
// tail in `tailColor`; `arrow` a shaft with a head. `length` is a share of the radius; `tail` reaches behind
// the centre in SVG units. `gap` leaves that much clear round the centre, so the needle splits round a
// readout. Add a GaugeHub for the pivot.
const props = withDefaults(defineProps<{ variant?: 'line' | 'pointer' | 'compass' | 'arrow', length?: number, width?: number, color?: string, tail?: number, tailColor?: string, gap?: number }>(), { variant: 'line', length: 0.85, width: 6, color: 'currentColor', tail: 30, tailColor: undefined, gap: 0 })
const gauge = useGauge()
type Point = { x: number, y: number }
const pts = (points: Point[]) => points.map(p => `${p.x},${p.y}`).join(' ')
const add = (a: Point, b: Point, k = 1) => ({ x: a.x + b.x * k, y: a.y + b.y * k })

interface Shape { hasTail: boolean, tip?: Point, back?: Point, front?: Point, rearStart?: Point, neck?: Point, endR?: number, blade?: string, rear?: string, head?: string }

const shape = computed<Shape>(() => {
  const g = gauge.value
  const angle = g.angleOf(g.value)
  const reach = g.radius * props.length
  const tip = polar(reach, angle)
  const back = polar(-props.tail, angle)
  // Where the needle starts out from the centre, either side
  const front = polar(props.gap, angle)
  const rearStart = polar(-props.gap, angle)
  const hasTail = props.tail > props.gap
  const left = polar(props.width / 2, angle - 90)
  const right = polar(props.width / 2, angle + 90)

  if (props.variant === 'line') return { tip, back, front, rearStart, hasTail }

  if (props.variant === 'compass') {
    // A lozenge: widest at the centre (or at the gap's edges), meeting in points at both ends
    return {
      blade: pts([tip, add(front, right), add(front, left)]),
      rear: pts([back, add(rearStart, left), add(rearStart, right)]),
      hasTail
    }
  }

  if (props.variant === 'arrow') {
    const headLength = Math.min(props.width * 3.5, reach - props.gap)
    const neck = polar(reach - headLength, angle)
    return {
      tip,
      back,
      front,
      rearStart,
      hasTail,
      neck,
      head: pts([tip, add(neck, right, 1.9), add(neck, left, 1.9)])
    }
  }

  // Pointer: two polygons meeting at the centre, so the tail can take its own colour; the tip keeps a fifth
  // of the width and is rounded with a disc, so a thin needle never vanishes to a point
  const endR = props.width * 0.2
  const endLeft = polar(endR, angle - 90)
  const endRight = polar(endR, angle + 90)
  return {
    tip,
    endR,
    hasTail,
    blade: pts([add(tip, endLeft), add(tip, endRight), add(front, right), add(front, left)]),
    rear: pts([add(back, left, 0.6), add(back, right, 0.6), add(rearStart, right), add(rearStart, left)])
  }
})
</script>

<template>
  <g v-if="variant === 'line'" :stroke="color" :stroke-width="width" stroke-linecap="round">
    <line :x1="shape.front!.x" :y1="shape.front!.y" :x2="shape.tip!.x" :y2="shape.tip!.y" />
    <line v-if="shape.hasTail" :x1="shape.rearStart!.x" :y1="shape.rearStart!.y" :x2="shape.back!.x" :y2="shape.back!.y" :stroke="tailColor" />
  </g>
  <g v-else-if="variant === 'arrow'">
    <line :x1="shape.front!.x" :y1="shape.front!.y" :x2="shape.neck!.x" :y2="shape.neck!.y" :stroke="color" :stroke-width="width" stroke-linecap="round" />
    <line v-if="shape.hasTail" :x1="shape.rearStart!.x" :y1="shape.rearStart!.y" :x2="shape.back!.x" :y2="shape.back!.y" :stroke="tailColor ?? color" :stroke-width="width" stroke-linecap="round" />
    <polygon :points="shape.head" :fill="color" stroke-linejoin="round" :stroke="color" :stroke-width="width * 0.4" />
  </g>
  <g v-else-if="variant === 'compass'">
    <polygon v-if="shape.hasTail" :points="shape.rear" :fill="tailColor ?? 'color-mix(in srgb, currentColor 30%, transparent)'" />
    <polygon :points="shape.blade" :fill="color" />
  </g>
  <g v-else>
    <polygon v-if="shape.hasTail" :points="shape.rear" :fill="tailColor ?? color" />
    <polygon :points="shape.blade" :fill="color" />
    <circle :cx="shape.tip!.x" :cy="shape.tip!.y" :r="shape.endR" :fill="color" />
  </g>
</template>
