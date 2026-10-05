<script setup lang="ts">
import type { ToolIconName } from '~/utils/tools'

// One line-icon per tool, drawn on a 24px grid with a 2px rounded stroke so they read as a set.
defineProps<{ name: ToolIconName }>()
</script>

<template>
  <svg
    class="tool-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <!-- QR code: three finder squares and a scatter of data blocks -->
    <template v-if="name === 'qr'">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <g fill="currentColor" stroke="none">
        <rect x="5.5" y="5.5" width="2" height="2" rx="0.4" />
        <rect x="16.5" y="5.5" width="2" height="2" rx="0.4" />
        <rect x="5.5" y="16.5" width="2" height="2" rx="0.4" />
        <rect x="13.5" y="13.5" width="3" height="3" rx="0.6" />
        <rect x="18.5" y="13.5" width="2.5" height="2.5" rx="0.5" />
        <rect x="13.5" y="18.5" width="2.5" height="2.5" rx="0.5" />
        <rect x="17.5" y="17.5" width="3.5" height="3.5" rx="0.7" />
      </g>
    </template>

    <!-- Phone checker: a phone with a check mark on screen -->
    <template v-else-if="name === 'phone'">
      <rect x="5.5" y="2" width="13" height="20" rx="3" />
      <path d="M10.5 5h3" />
      <path d="M9 12.5l2.2 2.2L15.5 10" />
    </template>

    <!-- Image compressor: four corners folding inward, with the picture's sun at the centre -->
    <template v-else-if="name === 'compress'">
      <path d="M3.5 9H9V3.5" />
      <path d="M20.5 9H15V3.5" />
      <path d="M3.5 15H9v5.5" />
      <path d="M20.5 15H15v5.5" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </template>

    <!-- Text case converter: capital A beside lowercase a -->
    <template v-else-if="name === 'case'">
      <path d="M2.5 19L7.5 5l5 14" />
      <path d="M4.3 14h6.4" />
      <circle cx="17.5" cy="15.5" r="3.5" />
      <path d="M21 11.5V19" />
    </template>

    <!-- Settings (sound): a speaker with two sound waves -->
    <template v-else-if="name === 'sound'">
      <path d="M3.5 9.5h3l5-4v13l-5-4h-3z" />
      <path d="M15.5 9a4.2 4.2 0 0 1 0 6" />
      <path d="M18.5 6a8.5 8.5 0 0 1 0 12" />
    </template>
  </svg>
</template>

<style scoped>
.tool-icon {
  display: block;
  width: 1em;
  height: 1em;
}
</style>
