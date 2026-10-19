<script setup lang="ts">
// A folder's icon in its colour (CHECKLIST.md #37, #38)
defineProps<{ icon?: string, color?: string }>()
</script>

<template>
  <AppIcon class="folder-icon" :name="FOLDER_ICONS[icon ?? 'folder'] ?? FOLDER_ICONS.folder!" :style="{ color: color ? `var(--${color})` : undefined }" />
</template>

<style scoped>
.folder-icon {
  flex: none;
  width: 1.1em;
  height: 1.1em;
  stroke-width: 1.9;
  color: var(--accent);
}
</style>
