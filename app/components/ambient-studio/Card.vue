<script setup lang="ts">
import type { AmbientItem } from '~/types/ambient-studio'
import { categoryName } from '~/data/ambient-studio/presets'
import { isMix, useAmbientPresets } from '~/composables/ambient-studio/useAmbientPresets'
import { useAmbientStudio } from '~/composables/ambient-studio/useAmbientStudio'

// One scene in the library: artwork, name and what it plays. The whole card starts it;
// the heart (and Delete, for your own mixes) sit on top as separate buttons.
const props = defineProps<{ item: AmbientItem, compact?: boolean }>()
const emit = defineEmits<{ delete: [] }>()

const { isFavorite, toggleFavorite } = useAmbientPresets()
const studio = useAmbientStudio()
const { play } = useSound()

const active = computed(() => studio.current.value.id === props.item.id)
const kind = computed(() => {
  const y = props.item.youtube
  if (y?.playlistId) return 'Playlist'
  if (y?.videoId) return 'Video'
  return 'Mixer only'
})
const fav = computed(() => isFavorite(props.item.id))

function start() {
  studio.select(props.item)
  play('select')
}

function flipFav() {
  toggleFavorite(props.item.id)
  play(fav.value ? 'toggle-on' : 'toggle-off')
}
</script>

<template>
  <article class="ambient-studio-card" :class="{ active, compact }" :style="{ '--tint': item.tint }">
    <button type="button" class="hit" :aria-current="active ? 'true' : undefined" @click="start">
      <span class="art">
        <img :src="item.artwork" alt="" loading="lazy" decoding="async" width="320" height="180">
        <span v-if="active" class="now" :class="{ moving: studio.playing.value }">
          <span class="bars" aria-hidden="true"><i /><i /><i /></span>
          {{ studio.playing.value ? 'Playing' : 'Ready' }}
        </span>
      </span>
      <span class="text">
        <span class="name">{{ item.name }}</span>
        <span class="meta">
          {{ isMix(item) ? 'Your mix' : categoryName(item.category) }} · {{ kind }}
        </span>
        <span v-if="!compact" class="desc">{{ item.description }}</span>
      </span>
      <span class="sr-only">{{ active ? ', on now' : ', play this scene' }}</span>
    </button>
    <div class="tools">
      <button
        type="button"
        class="tool-btn fav"
        :class="{ on: fav }"
        :aria-pressed="fav"
        :aria-label="fav ? `Remove ${item.name} from favourites` : `Add ${item.name} to favourites`"
        :title="fav ? 'Remove from favourites' : 'Add to favourites'"
        @click="flipFav"
      >
        <AmbientStudioIcon name="heart" />
      </button>
      <ConfirmDelete v-if="isMix(item)" :name="item.name" class="tool-btn" @confirm="emit('delete')" />
    </div>
  </article>
</template>

<style scoped>
.ambient-studio-card {
  position: relative;
  min-width: 0;
}

.hit {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 0;
  font: inherit;
  text-align: left;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 14px;
  cursor: pointer;
}

.hit:focus-visible {
  outline: 2px solid var(--tint);
  outline-offset: 4px;
}

.art {
  position: relative;
  display: block;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 14px;
  background: var(--as-raised);
  box-shadow: 0 0 0 1px var(--as-line);
  transition: box-shadow var(--dur) var(--ease-out);
}

.art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: scale 0.6s var(--ease-out), filter var(--dur);
  filter: saturate(0.9) brightness(0.92);
}

.hit:hover .art img {
  scale: 1.04;
  filter: saturate(1) brightness(1);
}

.active .art {
  box-shadow: 0 0 0 2px var(--tint), 0 12px 32px -16px var(--tint);
}

.now {
  position: absolute;
  left: 0.5rem;
  bottom: 0.5rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.55rem 0.2rem 0.45rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: #0b0d12;
  background: var(--tint);
  border-radius: 999px;
}

.bars {
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  height: 0.7rem;
}

.bars i {
  width: 2px;
  height: 40%;
  background: currentColor;
  border-radius: 1px;
}

.moving .bars i {
  animation: ambient-studio-eq 1s ease-in-out infinite alternate;
}

.moving .bars i:nth-child(2) { animation-delay: -0.35s; }
.moving .bars i:nth-child(3) { animation-delay: -0.7s; }

@keyframes ambient-studio-eq {
  from { height: 25%; }
  to { height: 100%; }
}

.text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0 0.15rem;
  min-width: 0;
}

.name {
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--as-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-right: 2.5rem;
}

.meta {
  font-size: 0.8rem;
  color: var(--as-ink-3);
}

.desc {
  margin-top: 0.2rem;
  font-size: 0.85rem;
  line-height: 1.45;
  color: var(--as-ink-2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tools {
  position: absolute;
  right: 0.4rem;
  top: 0.4rem;
  display: flex;
  gap: 0.25rem;
}

.tool-btn {
  width: 2.1rem;
  height: 2.1rem;
  display: grid;
  place-items: center;
  font-size: 1rem;
  color: #fff;
  background: rgb(8 10 14 / 0.55);
  border: 0;
  border-radius: 999px;
  backdrop-filter: blur(8px);
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--dur-fast), background-color var(--dur-fast), scale 0.1s;
}

.tool-btn:active {
  scale: 0.92;
}

.ambient-studio-card:hover .tool-btn,
.ambient-studio-card:focus-within .tool-btn,
.tool-btn.on {
  opacity: 1;
}

.fav.on {
  color: #ff8fa8;
}

.fav.on :deep(path) {
  fill: currentColor;
}

/* Touch screens have no hover: keep the heart visible */
@media (hover: none) {
  .tool-btn {
    opacity: 1;
  }
}

.compact .hit {
  flex-direction: row;
  align-items: center;
  gap: 0.75rem;
}

.compact .art {
  width: 5.5rem;
  flex: none;
  border-radius: 10px;
}

.compact .now {
  display: none;
}

.compact .tools {
  top: 50%;
  translate: 0 -50%;
}

@media (prefers-reduced-motion: reduce) {
  .moving .bars i {
    animation: none;
    height: 70%;
  }

  .hit:hover .art img {
    scale: 1;
  }
}

:root[data-motion='reduced'] .moving .bars i {
  animation: none;
}
</style>
