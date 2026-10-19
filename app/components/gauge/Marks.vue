<script setup lang="ts">
import type { StrokeCap, ValueColor } from '~/lib/gauge'

// Radial marks at chosen domain values, such as the cutoffs between zones
withDefaults(defineProps<{ values: number[], length?: number, width?: number, color?: ValueColor, opacity?: number, cap?: StrokeCap, offset?: number }>(), { length: 12, width: 2, color: 'currentColor', opacity: 1, cap: 'round', offset: 0 })
</script>

<template>
  <GaugeLines :values="values" :length="length" :width="width" :color="color" :opacity="opacity" :cap="cap" :offset="offset" />
</template>
