<script setup lang="ts">
import { arcPath, clamp, useGauge, type StrokeCap } from '~/lib/gauge'

// One arc split into weighted parts laid end to end from min (memory: used, cached, free). Set the Gauge's
// value to the parts' total and they sweep in together, each its share of the way. `gap` leaves degrees
// between neighbours. `active` (a part's index) draws that part wider and fades the rest; with
// `interactive` the parts take the pointer and say which one is under it (hover) or was clicked (pick).
const props = withDefaults(defineProps<{ parts: { value: number, color: string }[], width?: number, opacity?: number, cap?: StrokeCap, offset?: number, gap?: number, active?: number, interactive?: boolean }>(), { width: 24, opacity: 1, cap: 'butt', offset: 0, gap: 0, active: undefined, interactive: false })
const emit = defineEmits<{ hover: [index: number | undefined], pick: [index: number] }>()
const gauge = useGauge()
const arcs = computed(() => {
  const g = gauge.value
  // How far the sweep has come: the animated value as a share of where it's heading
  const span = g.target - g.min
  const k = span === 0 ? 1 : clamp((g.value - g.min) / span, 0, 1.5)
  const out: { d: string, color: string, index: number }[] = []
  let at = g.min
  props.parts.forEach((part, i) => {
    const from = at
    at += Math.max(0, part.value) * k
    const a0 = g.angleOf(from) + (i ? props.gap / 2 : 0)
    const a1 = g.angleOf(at) - (i < props.parts.length - 1 ? props.gap / 2 : 0)
    if (a1 > a0) out.push({ d: arcPath(g.radius + props.offset, a0, a1), color: part.color, index: i })
  })
  return out
})
</script>

<template>
  <g :opacity="opacity" fill="none" :stroke-width="width" :stroke-linecap="cap" :class="{ 'stack-live': interactive }" @pointerleave="interactive && emit('hover', undefined)">
    <path
      v-for="a in arcs"
      :key="a.index"
      :d="a.d"
      :stroke="a.color"
      :stroke-width="active === a.index ? width * 1.28 : undefined"
      :stroke-opacity="active !== undefined && active !== a.index ? 0.32 : 1"
      @pointerenter="interactive && emit('hover', a.index)"
      @click="interactive && emit('pick', a.index)"
    />
  </g>
</template>

<style scoped>
path {
  transition: stroke-opacity var(--dur-fast), stroke-width var(--dur-fast) var(--ease-out);
}

.stack-live path {
  pointer-events: stroke;
  cursor: pointer;
}
</style>
