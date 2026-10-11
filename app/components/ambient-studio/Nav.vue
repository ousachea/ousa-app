<script setup lang="ts">
import type { AmbientIconName } from './Icon.vue'
import { useAmbientPresets } from '~/composables/ambient-studio/useAmbientPresets'
import { type AmbientView, useAmbientView } from '~/composables/ambient-studio/useAmbientView'

// The library's sections: a list in the sidebar on wide screens, a row of tabs on smaller ones
defineProps<{ variant: 'list' | 'tabs' }>()

const { ui, go } = useAmbientView()
const { favorites, recent, mixes } = useAmbientPresets()
const hydrated = useHydrated()
const { play } = useSound()

const items = computed<{ view: AmbientView, label: string, icon: AmbientIconName, count?: number }[]>(() => [
  { view: 'music', label: 'Your music', icon: 'music' },
  { view: 'home', label: 'Scenes', icon: 'home' },
  { view: 'browse', label: 'Browse', icon: 'search' },
  { view: 'favorites', label: 'Favourites', icon: 'heart', count: hydrated.value ? favorites.value.length : undefined },
  { view: 'recent', label: 'Recently played', icon: 'history', count: hydrated.value ? recent.value.length : undefined },
  { view: 'mixes', label: 'Your mixes', icon: 'layers', count: hydrated.value ? mixes.value.length : undefined }
])

function pick(view: AmbientView) {
  go(view)
  play('select')
}
</script>

<template>
  <nav class="ambient-studio-nav" :class="variant" aria-label="Library">
    <button
      v-for="i in items"
      :key="i.view"
      type="button"
      :aria-current="ui.view === i.view ? 'page' : undefined"
      @click="pick(i.view)"
    >
      <AmbientStudioIcon :name="i.icon" />
      <span class="label">{{ i.label }}</span>
      <span v-if="i.count" class="count">{{ i.count }}</span>
    </button>
  </nav>
</template>

<style scoped>
.ambient-studio-nav {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

button {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-height: 2.5rem;
  padding: 0 0.75rem;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 550;
  text-align: left;
  color: var(--as-ink-2);
  background: none;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  transition: color var(--dur-fast), background-color var(--dur-fast);
}

button :deep(.ambient-studio-icon) {
  font-size: 1.05rem;
  color: var(--as-ink-3);
}

button:hover {
  color: var(--as-ink);
  background: var(--as-hover);
}

button[aria-current='page'] {
  color: var(--as-ink);
  background: rgb(255 255 255 / 0.07);
}

button[aria-current='page'] :deep(.ambient-studio-icon) {
  color: var(--tint);
}

.label {
  flex: 1;
}

.count {
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: var(--as-ink-3);
}

/* Tabs: one scrolling row */
.tabs {
  flex-direction: row;
  gap: 0.35rem;
  overflow-x: auto;
  scrollbar-width: none;
  margin-inline: -0.25rem;
  padding: 0.1rem 0.25rem;
}

.tabs::-webkit-scrollbar {
  display: none;
}

.tabs button {
  flex: none;
  gap: 0.45rem;
  min-height: 2.25rem;
  padding: 0 0.85rem;
  font-size: 0.85rem;
  border: 1px solid var(--as-line);
  border-radius: 999px;
}

.tabs .label {
  flex: none;
}
</style>
