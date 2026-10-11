<script setup lang="ts">
import { useAmbientMusic } from '~/composables/ambient-studio/useAmbientMusic'
import { useAmbientView } from '~/composables/ambient-studio/useAmbientView'

// What's playing from your music and what comes next. Tap a song to jump to it.
const music = useAmbientMusic()
const { go } = useAmbientView()
const m = music.state

const list = ref<HTMLElement>()
// Keep the playing song in view as the queue moves on
watch(() => m.position, () => nextTick(() => list.value?.querySelector('.on')?.scrollIntoView({ block: 'nearest' })))
</script>

<template>
  <section class="ambient-studio-queue" aria-labelledby="ambient-studio-queue-title">
    <header class="head">
      <div>
        <h3 id="ambient-studio-queue-title">{{ m.queueTitle || 'Queue' }}</h3>
        <p v-if="m.queue.length">{{ m.position >= 0 ? `${m.position + 1} of ${m.queue.length}` : `${m.queue.length} songs` }}</p>
      </div>
      <div v-if="m.queue.length" class="tools">
        <button type="button" class="icon" :aria-pressed="m.shuffled" title="Shuffle" aria-label="Shuffle" @click="music.toggleShuffle()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3.5c4 0 5 10 9 10H20M4 17h3.5c1.6 0 2.7-1.6 3.6-3.5M14 9c.8-1.2 1.6-2 3-2H20M17.5 4.5L20 7l-2.5 2.5M17.5 14.5L20 17l-2.5 2.5" /></svg>
        </button>
        <button type="button" class="icon" title="Clear the queue" aria-label="Clear the queue" @click="music.clearQueue()">
          <AmbientStudioIcon name="x" />
        </button>
      </div>
    </header>

    <ol v-if="m.queue.length" ref="list" class="songs">
      <li v-for="(t, i) in m.queue" :key="`${t.videoId}-${i}`">
        <button type="button" class="song" :class="{ on: i === m.position, done: m.position >= 0 && i < m.position, off: !t.playable }" :disabled="!t.playable" @click="music.playIndex(i)">
          <img v-if="t.thumb" :src="t.thumb" alt="" width="48" height="27" loading="lazy" referrerpolicy="no-referrer">
          <span class="text">
            <strong>{{ t.title }}</strong>
            <span>{{ t.artist }}</span>
          </span>
        </button>
      </li>
    </ol>
    <div v-else class="empty">
      <p>Nothing queued yet.</p>
      <button type="button" class="btn btn-sm" @click="go('music')">Pick from your music</button>
    </div>
  </section>
</template>

<style scoped>
.ambient-studio-queue {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

h3 {
  font-size: 1rem;
  font-weight: 700;
  color: var(--as-ink);
}

.head p {
  margin: 0.15rem 0 0;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  color: var(--as-ink-3);
}

.tools {
  display: flex;
  gap: 0.15rem;
}

.icon {
  width: 2.25rem;
  height: 2.25rem;
  display: grid;
  place-items: center;
  font-size: 1rem;
  color: var(--as-ink-3);
  background: none;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
}

.icon svg {
  width: 1.1rem;
  height: 1.1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.icon:hover {
  color: var(--as-ink);
  background: var(--as-hover);
}

.icon[aria-pressed='true'] {
  color: var(--tint);
}

.songs {
  list-style: none;
  margin: 0 -0.4rem;
  padding: 0;
  max-height: min(55vh, 30rem);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.song {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.35rem 0.4rem;
  font: inherit;
  text-align: left;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
}

@media (hover: hover) {
  .song:hover:not(:disabled) {
    background: var(--as-hover);
  }
}

.song.on {
  background: color-mix(in srgb, var(--tint) 14%, transparent);
}

.song.done {
  opacity: 0.55;
}

.song.off {
  opacity: 0.35;
  cursor: not-allowed;
}

.song img {
  width: 3rem;
  height: 1.7rem;
  flex: none;
  object-fit: cover;
  border-radius: 5px;
}

.text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.text strong {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--as-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.text span {
  font-size: 0.75rem;
  color: var(--as-ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.on .text strong {
  color: var(--tint);
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.9rem 1rem;
  font-size: 0.875rem;
  color: var(--as-ink-2);
  border: 1px dashed var(--as-line);
  border-radius: 12px;
}

.empty p {
  margin: 0;
}
</style>
