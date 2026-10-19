<script setup lang="ts">
// Icons for the sound settings: on/off, volume, each style and each sample sound, from the shared icon library
const props = defineProps<{ name: string }>()

const ICONS: Record<string, string> = {
  // On / off and volume
  'on': 'lucide:volume-2', 'loud': 'lucide:volume-2', 'off': 'lucide:volume-x', 'quiet': 'lucide:volume-1',
  // Styles
  'minimal': 'lucide:circle-dot', 'soft': 'lucide:feather', 'glass': 'lucide:wine', 'arcade': 'lucide:gamepad-2',
  'mechanical': 'lucide:keyboard', 'organic': 'lucide:leaf', 'dreamy': 'lucide:moon-star', 'scifi': 'lucide:rocket',
  'rubber': 'lucide:balloon', 'cinematic': 'lucide:clapperboard', 'studio': 'lucide:audio-lines', 'zen': 'lucide:flower-2',
  // Sample sounds
  'press': 'lucide:mouse-pointer-click', 'toggle-on': 'lucide:toggle-right', 'copy': 'lucide:copy', 'success': 'lucide:circle-check',
  'error': 'lucide:circle-x', 'notification': 'lucide:bell', 'level-up': 'lucide:trophy'
}
</script>

<template>
  <AppIcon class="sound-icon" :name="ICONS[props.name] ?? 'lucide:volume-2'" />
</template>

<style scoped>
.sound-icon {
  width: 1.15em;
  height: 1.15em;
  flex: none;
}
</style>
