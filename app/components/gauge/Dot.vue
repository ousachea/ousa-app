<script setup lang="ts">
import { polar, useGauge } from '~/lib/gauge'

// A dot riding the arc at the value, instead of a needle. `ring` draws an outline round it (the page's
// background colour makes it sit cut out of the track).
const props = withDefaults(defineProps<{ radius?: number, color?: string, offset?: number, ring?: string, ringWidth?: number, at?: number }>(), { radius: 16, color: 'currentColor', offset: 0, ring: undefined, ringWidth: 6, at: undefined })
const gauge = useGauge()
const p = computed(() => polar(gauge.value.radius + props.offset, gauge.value.angleOf(props.at ?? gauge.value.value)))
</script>

<template>
  <circle :cx="p.x" :cy="p.y" :r="radius" :fill="color" :stroke="ring" :stroke-width="ring ? ringWidth : undefined" />
</template>
