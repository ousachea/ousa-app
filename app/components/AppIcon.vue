<script setup lang="ts">
// A line icon from the shared icon library (Lucide): <AppIcon name="eye" />, or name="lucide:eye". One
// colour (the text's), 1em square, so it sizes with the text around it, or `size` pixels square.
// modules/app-icons.ts bundles the icons used.
import icons from '#build/app-icons.mjs'

const props = defineProps<{ name: string, size?: number }>()
const body = computed(() => icons[props.name.replace(/^lucide:/, '')])
// Lucide's 2-unit stroke turns hairline at small sizes, so below 16px it's kept at about 1.5px
const style = computed(() => props.size && {
  width: `${props.size}px`,
  height: `${props.size}px`,
  ...(props.size < 16 && { strokeWidth: 36 / props.size })
})
if (import.meta.dev) watchEffect(() => body.value || console.warn(`[AppIcon] No icon called “${props.name}”`))
</script>

<template>
  <!-- The drawings come from the Lucide package, never from user input -->
  <svg
    class="app-icon"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    aria-hidden="true"
    :style="style || undefined"
    v-html="body"
  />
</template>

<style>
.app-icon {
  flex: none;
  width: 1em;
  height: 1em;
  vertical-align: -0.125em;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
