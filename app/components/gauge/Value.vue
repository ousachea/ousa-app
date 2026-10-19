<script setup lang="ts">
import { useGauge, type FontFamily, type FontWeight } from '~/lib/gauge'

// The value as text, following the needle frame by frame
const props = withDefaults(defineProps<{ x?: number, y?: number, fontSize?: number, color?: string, font?: FontFamily, weight?: FontWeight, anchor?: 'start' | 'middle' | 'end', decimals?: number, format?: (value: number) => string }>(), { x: 0, y: 0, fontSize: 96, color: 'currentColor', font: 'sans', weight: 'semibold', anchor: 'middle', decimals: 0, format: undefined })
const gauge = useGauge()
const text = computed(() => (props.format ? props.format(gauge.value.value) : gauge.value.value.toFixed(props.decimals)))
</script>

<template>
  <GaugeText :x="x" :y="y" :font-size="fontSize" :color="color" :font="font" :weight="weight" :anchor="anchor">{{ text }}</GaugeText>
</template>
