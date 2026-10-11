<script setup lang="ts">
// Ambient Studio's control icons, on the same 24px grid and 2px rounded stroke as ToolIcon
export type AmbientIconName =
  | 'play' | 'pause' | 'prev' | 'next' | 'volume' | 'mute' | 'heart' | 'external' | 'x' | 'plus'
  | 'reset' | 'image' | 'video' | 'sparkle' | 'home' | 'search' | 'clock' | 'history' | 'layers'
  | 'link' | 'moon' | 'save' | 'stop' | 'music'

defineProps<{ name: AmbientIconName }>()
</script>

<template>
  <svg class="ambient-studio-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path v-if="name === 'play'" d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke-width="1.5" />
    <g v-else-if="name === 'pause'" fill="currentColor" stroke="none"><rect x="6" y="4.5" width="4" height="15" rx="1.2" /><rect x="14" y="4.5" width="4" height="15" rx="1.2" /></g>
    <rect v-else-if="name === 'stop'" x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
    <g v-else-if="name === 'prev'"><path d="M18 5.5v13L9 12z" fill="currentColor" stroke-width="1.5" /><path d="M6 5.5v13" /></g>
    <g v-else-if="name === 'next'"><path d="M6 5.5v13l9-6.5z" fill="currentColor" stroke-width="1.5" /><path d="M18 5.5v13" /></g>
    <g v-else-if="name === 'volume'"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></g>
    <g v-else-if="name === 'mute'"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M16 9.5l5 5M21 9.5l-5 5" /></g>
    <path v-else-if="name === 'heart'" d="M12 19.5s-7.5-4.4-7.5-9.6A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.5 2.3c0 5.2-7.5 9.6-7.5 9.6z" />
    <g v-else-if="name === 'external'"><path d="M14 4.5h5.5V10M19.5 4.5L11 13" /><path d="M18 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H10" /></g>
    <path v-else-if="name === 'x'" d="M6 6l12 12M18 6L6 18" />
    <path v-else-if="name === 'plus'" d="M12 5v14M5 12h14" />
    <g v-else-if="name === 'reset'"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" /><path d="M4.5 4.5v4h4" /></g>
    <g v-else-if="name === 'image'"><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><path d="M3.5 16l5-4.5 4 3.5 3-2.5 5 4" /><circle cx="15.5" cy="9.5" r="1.4" /></g>
    <g v-else-if="name === 'video'"><rect x="3" y="5.5" width="18" height="13" rx="3" /><path d="M10.5 9.5v5l4.5-2.5z" fill="currentColor" stroke-width="1.2" /></g>
    <path v-else-if="name === 'sparkle'" d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8zM18.5 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
    <g v-else-if="name === 'home'"><path d="M4 11l8-6.5 8 6.5" /><path d="M6 9.5V19.5h12V9.5" /></g>
    <g v-else-if="name === 'search'"><circle cx="11" cy="11" r="6" /><path d="M15.5 15.5L20 20" /></g>
    <g v-else-if="name === 'clock'"><circle cx="12" cy="12.5" r="7.5" /><path d="M12 8.5v4l2.5 2M9.5 3h5" /></g>
    <g v-else-if="name === 'history'"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9" /><path d="M4.5 4.5V9H9M12 8v4.5l3 1.5" /></g>
    <g v-else-if="name === 'layers'"><path d="M5 8v8M9.5 5v14M14 9v6M18.5 7v10" /></g>
    <g v-else-if="name === 'link'"><path d="M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1" /><path d="M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1" /></g>
    <path v-else-if="name === 'moon'" d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" />
    <g v-else-if="name === 'music'"><path d="M9 17.5V6l10-2v11.5" /><circle cx="6.5" cy="17.5" r="2.5" /><circle cx="16.5" cy="15.5" r="2.5" /></g>
    <g v-else-if="name === 'save'"><path d="M6.5 4.5h11a1 1 0 0 1 1 1v14l-6.5-4-6.5 4v-14a1 1 0 0 1 1-1z" /></g>
  </svg>
</template>

<style scoped>
.ambient-studio-icon {
  width: 1em;
  height: 1em;
  flex: none;
}
</style>
