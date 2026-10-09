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

    <!-- Password generator: a padlock with hidden-password dots -->
    <template v-else-if="name === 'password'">
      <rect x="3.5" y="10" width="17" height="11.5" rx="2.5" />
      <path d="M7.5 10V7a4.5 4.5 0 0 1 9 0v3" />
      <g fill="currentColor" stroke="none">
        <circle cx="8.5" cy="15.75" r="1.25" />
        <circle cx="12" cy="15.75" r="1.25" />
        <circle cx="15.5" cy="15.75" r="1.25" />
      </g>
    </template>

    <!-- Todos: a checklist -->
    <template v-else-if="name === 'list'">
      <path d="M4 6.5l1.5 1.5L8.5 5" />
      <path d="M4 12.5l1.5 1.5 3-3" />
      <path d="M11.5 6.5H20" />
      <path d="M11.5 12.5H20" />
      <path d="M11.5 18.5H20" />
      <circle cx="6" cy="18.5" r="1.6" />
    </template>

    <!-- Password saver: a shield with a keyhole -->
    <template v-else-if="name === 'vault'">
      <path d="M12 2.5l7.5 3v5.8c0 4.6-3.1 8.2-7.5 10.2-4.4-2-7.5-5.6-7.5-10.2V5.5z" />
      <circle cx="12" cy="10.5" r="1.8" />
      <path d="M12 12.3V16" />
    </template>

    <!-- KHR/USD exchange: two arrows trading places -->
    <template v-else-if="name === 'exchange'">
      <path d="M4 8h14.5" />
      <path d="M15 4.5L18.5 8 15 11.5" />
      <path d="M20 16H5.5" />
      <path d="M9 12.5L5.5 16 9 19.5" />
    </template>

    <!-- Things I own: a box -->
    <template v-else-if="name === 'things'">
      <path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
      <path d="M3.5 7.5L12 12l8.5-4.5" />
      <path d="M12 12v9" />
    </template>

    <!-- What should I eat: fork and knife -->
    <template v-else-if="name === 'eat'">
      <path d="M6 3v5a2.5 2.5 0 0 0 5 0V3" />
      <path d="M8.5 3v18" />
      <path d="M17.5 21V3c-2.2 1.4-3.5 4-3.5 7.5V14h3.5" />
    </template>

    <!-- Weight: bathroom scale -->
    <template v-else-if="name === 'weight'">
      <rect x="3" y="3.5" width="18" height="17" rx="4" />
      <path d="M8 10a4.5 4.5 0 0 1 8 0" />
      <path d="M12 11.5l1.6-2.6" />
    </template>

    <!-- Countdown: hourglass -->
    <template v-else-if="name === 'countdown'">
      <path d="M6.5 3h11M6.5 21h11" />
      <path d="M7.5 3v3.2L12 12l-4.5 5.8V21M16.5 3v3.2L12 12l4.5 5.8V21" />
    </template>

    <!-- Renewals: calendar with a repeat arrow -->
    <template v-else-if="name === 'renewals'">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <path d="M14.6 13.2a3 3 0 1 0 .3 2.8" />
      <path d="M15 11.3v2.2h-2.2" />
    </template>

    <!-- Notes: a page with a folded corner and lines of writing -->
    <template v-else-if="name === 'notes'">
      <path d="M5.5 3.5h9l4 4v12a1 1 0 0 1-1 1h-12a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z" />
      <path d="M14.5 3.5v4h4M8 11.5h8M8 15h8M8 18.5h5" />
    </template>

    <!-- Bookmarks: a ribbon bookmark with a notch -->
    <template v-else-if="name === 'bookmarks'">
      <path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.5-6.5 4.5v-16a1 1 0 0 1 1-1z" />
      <path d="M9.5 8h5" />
    </template>

    <!-- Phone battery: a battery with a charge bar -->
    <template v-else-if="name === 'battery'">
      <rect x="2.5" y="7" width="17" height="10" rx="2.5" />
      <path d="M21.5 10.5v3" />
      <path d="M6 10.5v3M9.5 10.5v3" />
    </template>

    <!-- Salary: a banknote with a rising arrow -->
    <template v-else-if="name === 'salary'">
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M8 14.5l3-3 2 2 3-3.5" />
      <path d="M14 10h2v2" />
    </template>

    <!-- Gold tracker: a stacked gold bar -->
    <template v-else-if="name === 'gold'">
      <path d="M7 10.5h10l3 7.5H4z" />
      <path d="M9.5 4.5h5l1.6 6h-8.2z" />
    </template>

    <!-- Settings: three sliders -->
    <template v-else-if="name === 'settings'">
      <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="17" r="2" />
    </template>

    <!-- Sound effects: a speaker with two sound waves -->
    <template v-else-if="name === 'sound'">
      <path d="M3.5 9.5h3l5-4v13l-5-4h-3z" />
      <path d="M15.5 9a4.2 4.2 0 0 1 0 6" />
      <path d="M18.5 6a8.5 8.5 0 0 1 0 12" />
    </template>

    <!-- Recycle Bin: a bin with its lid -->
    <template v-else-if="name === 'trash'">
      <path d="M4 7h16" />
      <path d="M9.5 7V4.5h5V7" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v5M14 11v5" />
    </template>

    <!-- Activity: a clock face with its hands -->
    <template v-else-if="name === 'activity'">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </template>

    <!-- Add: a plus in a rounded square -->
    <template v-else-if="name === 'plus'">
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </template>

    <!-- Search -->
    <template v-else-if="name === 'search'">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
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
