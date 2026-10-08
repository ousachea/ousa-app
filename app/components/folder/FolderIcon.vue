<script setup lang="ts">
// A folder's icon in its colour (CHECKLIST.md #37, #38)
defineProps<{ icon?: string, color?: string }>()
</script>

<template>
  <svg class="folder-icon" viewBox="0 0 24 24" aria-hidden="true" :style="{ color: color ? `var(--${color})` : undefined }">
    <path :d="FOLDER_ICONS[icon ?? 'folder'] ?? FOLDER_ICONS.folder" />
  </svg>
</template>

<style scoped>
.folder-icon {
  flex: none;
  width: 1.1em;
  height: 1.1em;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.9;
  stroke-linecap: round;
  stroke-linejoin: round;
  color: var(--accent);
}
</style>
