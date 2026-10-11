<script setup lang="ts">
import type { AmbientItem } from '~/types/ambient-studio'
import { useAmbientPresets } from '~/composables/ambient-studio/useAmbientPresets'
import { useAmbientStudio } from '~/composables/ambient-studio/useAmbientStudio'

// Wide screens: the library's sections, then your favourites and latest scenes one tap away
const { favorites, recent } = useAmbientPresets()
const studio = useAmbientStudio()
const hydrated = useHydrated()
const { play } = useSound()

const favs = computed(() => (hydrated.value ? favorites.value.slice(0, 5) : []))
const recents = computed(() => (hydrated.value ? recent.value.filter(r => !favs.value.some(f => f.id === r.id)).slice(0, 5).map(r => r.item) : []))

function start(item: AmbientItem) {
  studio.select(item)
  play('select')
}
</script>

<template>
  <aside class="ambient-studio-sidebar" aria-label="Ambient Studio">
    <AmbientStudioNav variant="list" />

    <section v-if="favs.length" class="mini">
      <h3>Favourites</h3>
      <ul>
        <li v-for="f in favs" :key="f.id">
          <button type="button" :aria-current="studio.current.value.id === f.id ? 'true' : undefined" @click="start(f)">
            <img :src="f.artwork" alt="" width="64" height="36" loading="lazy">
            <span>{{ f.name }}</span>
          </button>
        </li>
      </ul>
    </section>

    <section v-if="recents.length" class="mini">
      <h3>Recent</h3>
      <ul>
        <li v-for="r in recents" :key="r.id">
          <button type="button" :aria-current="studio.current.value.id === r.id ? 'true' : undefined" @click="start(r)">
            <img :src="r.artwork" alt="" width="64" height="36" loading="lazy">
            <span>{{ r.name }}</span>
          </button>
        </li>
      </ul>
    </section>
  </aside>
</template>

<style scoped>
.ambient-studio-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

.mini h3 {
  margin: 0 0 0.5rem 0.75rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--as-ink-3);
}

.mini ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.mini button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.35rem 0.5rem;
  font: inherit;
  font-size: 0.85rem;
  text-align: left;
  color: var(--as-ink-2);
  background: none;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  transition: color var(--dur-fast), background-color var(--dur-fast);
}

.mini button:hover {
  color: var(--as-ink);
  background: var(--as-hover);
}

.mini button[aria-current='true'] {
  color: var(--as-ink);
}

.mini img {
  width: 2.5rem;
  height: 1.6rem;
  flex: none;
  object-fit: cover;
  border-radius: 6px;
}

.mini span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
