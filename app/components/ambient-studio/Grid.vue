<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { AmbientItem } from '~/types/ambient-studio'
import { useAmbientPresets } from '~/composables/ambient-studio/useAmbientPresets'

// A responsive grid of scene cards. Deleting a mix offers Undo, like everywhere else in the app.
defineProps<{ items: AmbientItem[], label: string }>()

const { deleteMix, restoreMix } = useAmbientPresets()

function del(item: AmbientItem) {
  const removed = deleteMix(item.id)
  if (!removed) return
  toast(`${item.name} deleted`, {
    duration: 6000,
    action: { label: 'Undo', onClick: () => restoreMix(removed) }
  })
}
</script>

<template>
  <TransitionGroup tag="ul" name="list" class="ambient-studio-grid" :aria-label="label">
    <li v-for="item in items" :key="item.id">
      <AmbientStudioCard :item="item" @delete="del(item)" />
    </li>
  </TransitionGroup>
</template>

<style scoped>
.ambient-studio-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 14.5rem), 1fr));
  gap: 1.5rem 1.1rem;
}
</style>
