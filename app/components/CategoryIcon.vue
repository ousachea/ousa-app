<script setup lang="ts">
// Line icons for Things I own categories, on the same 24px grid and 2px stroke as ToolIcon
defineProps<{ name: string }>()
</script>

<template>
  <svg
    class="category-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'Phone'">
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </template>
    <template v-else-if="name === 'Computer'">
      <rect x="4" y="5" width="16" height="11" rx="1.5" />
      <path d="M2 19.5h20" />
    </template>
    <template v-else-if="name === 'Tablet'">
      <rect x="4.5" y="3" width="15" height="18" rx="2.5" />
      <circle cx="12" cy="17.8" r="0.7" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'Camera'">
      <path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </template>
    <template v-else-if="name === 'Gaming'">
      <path d="M7 8h10a4 4 0 0 1 4 4l.6 4.2a2.4 2.4 0 0 1-4.3 1.8L15.5 16h-7l-1.8 2a2.4 2.4 0 0 1-4.3-1.8L3 12a4 4 0 0 1 4-4z" />
      <path d="M7.5 10.5v3M6 12h3" />
      <circle cx="15.5" cy="11" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="17.3" cy="13" r="0.9" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'Audio'">
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <rect x="3" y="14" width="4" height="6.5" rx="1.5" />
      <rect x="17" y="14" width="4" height="6.5" rx="1.5" />
    </template>
    <template v-else-if="name === 'Watch'">
      <rect x="6" y="6" width="12" height="12" rx="3" />
      <path d="M9 6l1-3.5h4L15 6M9 18l1 3.5h4l1-3.5" />
      <path d="M12 9.5V12l1.5 1.5" />
    </template>
    <template v-else-if="name === 'Home'">
      <path d="M3.5 11L12 4l8.5 7" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-5h4v5" />
    </template>
    <template v-else-if="name === 'Vehicle'">
      <path d="M3.5 16.5V13l2-4.5h13l2 4.5v3.5" />
      <path d="M3.5 13h17" />
      <circle cx="7.5" cy="16.5" r="2" />
      <circle cx="16.5" cy="16.5" r="2" />
    </template>
    <!-- Other: a box -->
    <template v-else>
      <path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
      <path d="M3.5 7.5L12 12l8.5-4.5" />
      <path d="M12 12v9" />
    </template>
  </svg>
</template>

<style scoped>
.category-icon {
  display: block;
  width: 1em;
  height: 1em;
}
</style>
