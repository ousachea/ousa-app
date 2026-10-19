<script setup lang="ts">
// The pivot disc at the centre
withDefaults(defineProps<{ radius?: number, color?: string }>(), { radius: 12, color: 'currentColor' })
</script>

<template>
  <circle v-if="radius > 0" :r="radius" :fill="color" />
</template>
