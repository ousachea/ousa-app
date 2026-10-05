<script setup lang="ts">
// The Ousa App mark: one face of a scrambled cube, using the same sticker colours as the tools.
const STICKERS = [
  ['var(--blue)', 'var(--red)', 'var(--yellow)'],
  ['var(--green)', '#ffffff', 'var(--orange)'],
  ['var(--orange)', 'var(--yellow)', 'var(--blue)']
]
</script>

<template>
  <svg class="app-logo" viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="7" fill="var(--plastic)" />
    <template v-for="(row, y) in STICKERS" :key="y">
      <rect
        v-for="(color, x) in row"
        :key="x"
        :x="3 + x * 9"
        :y="3 + y * 9"
        width="8"
        height="8"
        rx="2"
        :fill="color"
      />
    </template>
  </svg>
</template>

<style scoped>
.app-logo {
  display: block;
  width: 1em;
  height: 1em;
}
</style>
