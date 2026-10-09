<script setup lang="ts">
import type { BulkSelect } from '~/composables/useBulkSelect'

// The Select / Done button that starts and ends picking several (useBulkSelect)
defineProps<{ select: BulkSelect }>()
</script>

<template>
  <button type="button" class="btn btn-quiet btn-sm bulk-toggle" :aria-pressed="select.selecting" @click="select.selecting ? select.stop() : select.start()">
    {{ select.selecting ? 'Done' : 'Select' }}
  </button>
</template>

<style scoped>
.bulk-toggle[aria-pressed='true'] {
  color: var(--accent);
  border-color: var(--accent);
}
</style>
