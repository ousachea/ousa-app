<script setup lang="ts">
import { arcPath, useGauge, type StrokeCap } from '~/lib/gauge'

// The whole background arc, from startAngle to endAngle
const props = withDefaults(defineProps<{ width?: number, color?: string, opacity?: number, cap?: StrokeCap, offset?: number }>(), { width: 24, color: 'currentColor', opacity: 0.15, cap: 'round', offset: 0 })
const gauge = useGauge()
const d = computed(() => arcPath(gauge.value.radius + props.offset, gauge.value.startAngle, gauge.value.endAngle))
</script>

<template>
  <path :d="d" fill="none" :stroke="color" :stroke-opacity="opacity" :stroke-width="width" :stroke-linecap="cap" />
</template>
