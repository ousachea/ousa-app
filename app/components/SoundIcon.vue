<script setup lang="ts">
// Line icons for the sound settings: on/off, volume, each style and each sample sound.
// Same 24px grid and 2px rounded stroke as ToolIcon.
defineProps<{ name: string }>()
</script>

<template>
  <svg
    class="sound-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <!-- On / off and volume -->
    <template v-if="name === 'on' || name === 'loud'">
      <path d="M3.5 9.5h3l5-4v13l-5-4h-3z" />
      <path d="M15.5 9a4.2 4.2 0 0 1 0 6" />
      <path d="M18.5 6a8.5 8.5 0 0 1 0 12" />
    </template>
    <template v-else-if="name === 'off'">
      <path d="M3.5 9.5h3l5-4v13l-5-4h-3z" />
      <path d="M16 9.5l5 5M21 9.5l-5 5" />
    </template>
    <template v-else-if="name === 'quiet'">
      <path d="M5.5 9.5h3l5-4v13l-5-4h-3z" />
      <path d="M17.5 9a4.2 4.2 0 0 1 0 6" />
    </template>

    <!-- Styles -->
    <template v-else-if="name === 'minimal'">
      <circle cx="12" cy="12" r="4" />
    </template>
    <template v-else-if="name === 'soft'">
      <path d="M7 18.5h10.5a4 4 0 0 0 .4-8A6 6 0 0 0 6.3 9.6 4.5 4.5 0 0 0 7 18.5z" />
    </template>
    <template v-else-if="name === 'glass'">
      <path d="M7 3h10l-.8 6.2a4.2 4.2 0 0 1-8.4 0z" />
      <path d="M12 13.5V20M8.5 20.5h7" />
    </template>
    <template v-else-if="name === 'arcade'">
      <rect x="4" y="15" width="16" height="5" rx="1.5" />
      <path d="M12 15V9" />
      <circle cx="12" cy="6.5" r="2.5" />
    </template>
    <template v-else-if="name === 'mechanical'">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <rect x="7.5" y="8.5" width="9" height="6" rx="1" />
    </template>
    <template v-else-if="name === 'organic'">
      <path d="M5 19c0-8 5-14 14-14 0 9-6 14-14 14z" />
      <path d="M5 19l8-8" />
    </template>
    <template v-else-if="name === 'dreamy'">
      <path d="M11 3.5l1.7 4.8 4.8 1.7-4.8 1.7L11 16.5l-1.7-4.8L4.5 10l4.8-1.7z" />
      <path d="M18.5 15v5M16 17.5h5" />
    </template>
    <template v-else-if="name === 'scifi'">
      <circle cx="12" cy="12" r="5" />
      <ellipse cx="12" cy="12" rx="10" ry="3.2" transform="rotate(-20 12 12)" />
    </template>
    <template v-else-if="name === 'rubber'">
      <ellipse cx="12" cy="15.5" rx="6.5" ry="4.5" />
      <path d="M8.5 3.5v3M12 2.5v4M15.5 3.5v3" />
    </template>
    <template v-else-if="name === 'cinematic'">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7.5 4v16M16.5 4v16M3 9h4.5M3 15h4.5M16.5 9H21M16.5 15H21" />
    </template>
    <template v-else-if="name === 'studio'">
      <path d="M4 6h16M4 12h16M4 18h16" />
      <g fill="currentColor">
        <circle cx="9" cy="6" r="2" />
        <circle cx="15.5" cy="12" r="2" />
        <circle cx="7" cy="18" r="2" />
      </g>
    </template>
    <template v-else-if="name === 'zen'">
      <path d="M19.5 9.5a8 8 0 1 1-4-5" />
    </template>

    <!-- Sample sounds -->
    <template v-else-if="name === 'press'">
      <path d="M9.5 9.5l10.5 4-4.8 1.5-1.7 5z" />
      <path d="M5 4l1.3 1.8M3.5 8.5l2.2.4M9.5 3l-.3 2.2" />
    </template>
    <template v-else-if="name === 'toggle-on'">
      <rect x="2" y="6.5" width="20" height="11" rx="5.5" />
      <circle cx="16.5" cy="12" r="2.5" fill="currentColor" />
    </template>
    <template v-else-if="name === 'copy'">
      <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
      <path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" />
    </template>
    <template v-else-if="name === 'success'">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.7 2.7L16 9.8" />
    </template>
    <template v-else-if="name === 'error'">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6" />
    </template>
    <template v-else-if="name === 'notification'">
      <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </template>
    <template v-else-if="name === 'level-up'">
      <path d="M6 12.5l6-6 6 6M6 18.5l6-6 6 6" />
    </template>
  </svg>
</template>

<style scoped>
.sound-icon {
  width: 1.15em;
  height: 1.15em;
  flex: none;
}
</style>
