<script setup lang="ts">
// Line icons for the CV page (pages/cv.vue), drawn like ToolIcon: a 24px grid with a 2px rounded
// stroke, so they read as one set with the app icons
export type CvIconName =
  | 'wave' | 'sparkle' | 'star' | 'briefcase' | 'palette' | 'cap' | 'quote' | 'pen' | 'bolt' | 'users'
  | 'globe' | 'check' | 'arrow-right' | 'arrow-up-right' | 'monitor' | 'code' | 'layout' | 'calendar'
  | 'clipboard' | 'download' | 'mail' | 'trash' | 'plus' | 'edit' | 'arrow-left' | 'reset' | 'lock'

defineProps<{ name: CvIconName }>()
</script>

<template>
  <svg
    class="cv-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <!-- Hello: a raised hand -->
    <template v-if="name === 'wave'">
      <path d="M8 11.5V6.5a1.5 1.5 0 0 1 3 0v4.5" />
      <path d="M11 10V5a1.5 1.5 0 0 1 3 0v5.5" />
      <path d="M14 10.5V6.5a1.5 1.5 0 0 1 3 0V13" />
      <path d="M17 11.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.6a6 6 0 0 1-5-2.7L4.6 15a1.6 1.6 0 0 1 2.6-1.9L8 14" />
    </template>

    <!-- What I do: a four-point sparkle and a small one -->
    <template v-else-if="name === 'sparkle'">
      <path d="M11 3.5l1.8 5.2 5.2 1.8-5.2 1.8L11 17.5l-1.8-5.2L4 10.5l5.2-1.8z" />
      <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
    </template>

    <!-- Selected work: a star -->
    <template v-else-if="name === 'star'">
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
    </template>

    <!-- Experience: a briefcase -->
    <template v-else-if="name === 'briefcase'">
      <rect x="3" y="7" width="18" height="13" rx="2.5" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M3 12.5h18" />
    </template>

    <!-- Design: a palette with three paint dots -->
    <template v-else-if="name === 'palette'">
      <path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.9 1.4-1.9-.5-1.2.3-2.4 1.6-2.4H17a4 4 0 0 0 4-4C21 7.6 17 3 12 3z" />
      <g fill="currentColor" stroke="none">
        <circle cx="7.5" cy="11.5" r="1.3" />
        <circle cx="10" cy="7.5" r="1.3" />
        <circle cx="14.6" cy="7.6" r="1.3" />
      </g>
    </template>

    <!-- Education: a graduation cap -->
    <template v-else-if="name === 'cap'">
      <path d="M2.5 9L12 4.5 21.5 9 12 13.5z" />
      <path d="M6.5 11v4.5c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3V11" />
      <path d="M21.5 9v5" />
    </template>

    <!-- Testimonials: a speech bubble with lines of text -->
    <template v-else-if="name === 'quote'">
      <path d="M4 4.5h16A1.5 1.5 0 0 1 21.5 6v9a1.5 1.5 0 0 1-1.5 1.5h-8.5l-5 4v-4H4A1.5 1.5 0 0 1 2.5 15V6A1.5 1.5 0 0 1 4 4.5z" />
      <path d="M7.5 9h9M7.5 12h6" />
    </template>

    <!-- Articles: a pen -->
    <template v-else-if="name === 'pen'">
      <path d="M15.5 4.5l4 4L8 20H4v-4z" />
      <path d="M13 7l4 4" />
    </template>

    <!-- Currently building, projects: a lightning bolt -->
    <template v-else-if="name === 'bolt'">
      <path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z" />
    </template>

    <!-- Clients: two people -->
    <template v-else-if="name === 'users'">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.5 3.2-5.5 6.5-5.5s5.9 2 6.5 5.5" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.7.8 2.7 2.6 3 5.2" />
    </template>

    <!-- Countries: a globe -->
    <template v-else-if="name === 'globe'">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z" />
    </template>

    <template v-else-if="name === 'check'">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </template>

    <template v-else-if="name === 'arrow-right'">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </template>

    <template v-else-if="name === 'arrow-up-right'">
      <path d="M7 17L17 7M8 7h9v9" />
    </template>

    <!-- Web design: a screen on a stand -->
    <template v-else-if="name === 'monitor'">
      <rect x="3" y="4" width="18" height="12.5" rx="2" />
      <path d="M8.5 20.5h7M12 16.5v4" />
    </template>

    <!-- Development, technical skills: code brackets -->
    <template v-else-if="name === 'code'">
      <path d="M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5" />
      <path d="M13.5 5l-3 14" />
    </template>

    <!-- UX/UI design: a page layout -->
    <template v-else-if="name === 'layout'">
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <path d="M3.5 9h17M9 9v11.5" />
    </template>

    <!-- Project management: a calendar -->
    <template v-else-if="name === 'calendar'">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="M8 14.5h3" />
    </template>

    <!-- Management skills: a clipboard with a tick -->
    <template v-else-if="name === 'clipboard'">
      <rect x="5" y="4.5" width="14" height="16.5" rx="2.5" />
      <path d="M9 3h6v3H9z" />
      <path d="M8.5 13l2 2 4-4" />
    </template>

    <template v-else-if="name === 'download'">
      <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
    </template>

    <template v-else-if="name === 'trash'">
      <path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 13h9l1-13" />
      <path d="M10.5 10.5v5.5M13.5 10.5v5.5" />
    </template>

    <template v-else-if="name === 'plus'">
      <path d="M12 5v14M5 12h14" />
    </template>

    <!-- Edit: a pencil over a line -->
    <template v-else-if="name === 'edit'">
      <path d="M14.5 5.5l4 4L9 19H5v-4z" />
      <path d="M12.5 7.5l4 4" />
    </template>

    <template v-else-if="name === 'arrow-left'">
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </template>

    <!-- Reset: an arrow coming back round -->
    <template v-else-if="name === 'reset'">
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9" />
      <path d="M4.5 4.5V9H9" />
    </template>

    <!-- Owner sign-in: a padlock -->
    <template v-else-if="name === 'lock'">
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </template>

    <template v-else-if="name === 'mail'">
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M3.5 7l8.5 6 8.5-6" />
    </template>
  </svg>
</template>

<style scoped>
.cv-icon {
  width: 1em;
  height: 1em;
  flex: none;
}
</style>
