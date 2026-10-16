<script setup lang="ts">
import type { SyncState } from '~/composables/useCollection'

// Says where a list's data lives. It draws nothing itself: it hands the list's sync state to the
// dot on the app icon (components/SyncDot.vue, in ToolPage), which speaks for the whole page
const props = defineProps<{ sync: { state: Ref<SyncState> | SyncState, retry: () => void } }>()
registerSyncSource({ state: toRef(() => unref(props.sync.state)), retry: () => props.sync.retry() })
</script>

<template>
  <span hidden />
</template>
