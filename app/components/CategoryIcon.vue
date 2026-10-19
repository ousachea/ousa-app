<script setup lang="ts">
// Icons for Things I own categories, from the shared icon library
const props = defineProps<{ name: string }>()

const ICONS: Record<string, string> = {
  Phone: 'lucide:smartphone', Computer: 'lucide:computer', Tablet: 'lucide:tablet', Camera: 'lucide:camera',
  Gaming: 'lucide:gamepad-2', Audio: 'lucide:speaker', Watch: 'lucide:watch', Home: 'lucide:house',
  Laptop: 'lucide:laptop', Desktop: 'lucide:pc-case', Monitor: 'lucide:monitor', TV: 'lucide:tv',
  Keyboard: 'lucide:keyboard', Mouse: 'lucide:mouse', Headphones: 'lucide:headphones', Vehicle: 'lucide:car'
}
</script>

<template>
  <AppIcon class="category-icon" :name="ICONS[props.name] ?? 'lucide:box'" />
</template>

<style scoped>
.category-icon {
  display: block;
  width: 1em;
  height: 1em;
}
</style>
