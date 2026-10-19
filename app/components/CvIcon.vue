<script setup lang="ts">
// Icons for the CV page (pages/cv.vue), from the shared icon library
export type CvIconName =
  | 'wave' | 'sparkle' | 'star' | 'briefcase' | 'palette' | 'cap' | 'quote' | 'pen' | 'bolt' | 'users'
  | 'globe' | 'check' | 'arrow-right' | 'arrow-up-right' | 'monitor' | 'code' | 'layout' | 'calendar'
  | 'clipboard' | 'download' | 'mail' | 'trash' | 'plus' | 'edit' | 'arrow-left' | 'reset' | 'lock'

const props = defineProps<{ name: CvIconName }>()

const ICONS: Record<CvIconName, string> = {
  'wave': 'lucide:hand', 'sparkle': 'lucide:sparkles', 'star': 'lucide:star', 'briefcase': 'lucide:briefcase',
  'palette': 'lucide:palette', 'cap': 'lucide:graduation-cap', 'quote': 'lucide:message-square-quote', 'pen': 'lucide:pen-line',
  'bolt': 'lucide:zap', 'users': 'lucide:users', 'globe': 'lucide:globe', 'check': 'lucide:check',
  'arrow-right': 'lucide:arrow-right', 'arrow-up-right': 'lucide:arrow-up-right', 'monitor': 'lucide:monitor', 'code': 'lucide:code',
  'layout': 'lucide:layout-template', 'calendar': 'lucide:calendar', 'clipboard': 'lucide:clipboard-check', 'download': 'lucide:download',
  'mail': 'lucide:mail', 'trash': 'lucide:trash-2', 'plus': 'lucide:plus', 'edit': 'lucide:pencil-line',
  'arrow-left': 'lucide:arrow-left', 'reset': 'lucide:rotate-ccw', 'lock': 'lucide:lock'
}
</script>

<template>
  <AppIcon class="cv-icon" :name="ICONS[props.name]" />
</template>

<style scoped>
.cv-icon {
  width: 1em;
  height: 1em;
  flex: none;
}
</style>
