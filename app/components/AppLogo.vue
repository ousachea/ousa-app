<script setup lang="ts">
// The Ousa’s Apps mark: one face of a scrambled cube. The server draws this fixed face; once the page
// is running it shows the same random scramble as the favicon, a fresh one each load (utils/cubeFavicon.ts).
const FIXED = [
  ['var(--blue)', 'var(--red)', 'var(--yellow)'],
  ['var(--green)', '#ffffff', 'var(--orange)'],
  ['var(--orange)', 'var(--yellow)', 'var(--blue)']
]
const STICKERS = ref(FIXED)
onMounted(() => {
  const face = pageCubeFace()
  STICKERS.value = [face.slice(0, 3), face.slice(3, 6), face.slice(6, 9)]
})
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
