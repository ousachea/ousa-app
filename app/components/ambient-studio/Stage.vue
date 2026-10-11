<script setup lang="ts">
import { categoryName } from '~/data/ambient-studio/presets'
import { useAmbientPlayer } from '~/composables/ambient-studio/useAmbientPlayer'
import { useAmbientSettings } from '~/composables/ambient-studio/useAmbientSettings'
import { useAmbientStudio } from '~/composables/ambient-studio/useAmbientStudio'
import { youtubeUrl } from '~/utils/ambient-studio/youtube'

// The big picture: the scene's artwork with its effect, or the YouTube player. YouTube is shown
// whenever it plays (its rules require a visible player); choosing the scene pauses it.
const studio = useAmbientStudio()
const player = useAmbientPlayer()
const { settings, reducedMotion } = useAmbientSettings()
const hydrated = useHydrated()

const host = ref<HTMLElement>()
onMounted(() => player.mount(host.value!))
onBeforeUnmount(player.destroy)

const item = computed(() => studio.current.value)
const p = player.state
const showVideo = computed(() => p.view === 'video' && !!p.source)
const busy = computed(() => showVideo.value && p.status === 'loading')
const failed = computed(() => showVideo.value && p.status === 'error')
</script>

<template>
  <section class="ambient-studio-stage" :class="{ video: showVideo }" aria-label="Scene">
    <!-- The scene -->
    <div class="scene" :aria-hidden="showVideo">
      <Transition name="ambient-studio-xfade">
        <img :key="item.artwork" :src="item.artwork" alt="" class="art" fetchpriority="high" width="1600" height="900">
      </Transition>
      <ClientOnly>
        <LazyAmbientStudioEffects
          v-if="hydrated && settings.effects && !showVideo"
          :effect="item.effect"
          :tint="item.tint"
          :reduced="reducedMotion"
        />
      </ClientOnly>
      <div class="caption">
        <span class="eyebrow">{{ item.id === 'link' ? 'YouTube link' : categoryName(item.category) }}</span>
        <h2>{{ item.name }}</h2>
        <p>{{ item.description }}</p>
      </div>
    </div>

    <!-- The YouTube player (always in the page so it's ready; only hidden while paused) -->
    <div class="player" :class="{ hidden: !showVideo }">
      <div ref="host" class="host" />
      <div v-if="busy" class="veil" role="status">
        <span class="spinner" aria-hidden="true" />
        Loading video…
      </div>
      <div v-else-if="failed" class="veil error" role="alert">
        <strong>Can’t play this here</strong>
        <p>{{ p.error }}</p>
        <div class="veil-actions">
          <button v-if="p.apiFailed" type="button" class="btn btn-sm" @click="player.retry()">Try again</button>
          <a v-if="p.source && !p.apiFailed" class="btn btn-sm" :href="youtubeUrl(p.source)" target="_blank" rel="noopener">Open on YouTube</a>
          <button type="button" class="btn btn-sm btn-quiet" @click="player.showScene()">Show the scene</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ambient-studio-stage {
  position: relative;
  aspect-ratio: 16 / 9;
  /* YouTube needs at least 200 × 200 to play; phones keep the stage taller than that */
  min-height: 220px;
  max-height: 72vh;
  width: 100%;
  overflow: hidden;
  border-radius: 20px;
  background: #050608;
  box-shadow: 0 0 0 1px var(--as-line), 0 40px 80px -40px color-mix(in srgb, var(--tint) 35%, transparent);
  isolation: isolate;
}

.scene,
.player {
  position: absolute;
  inset: 0;
}

.art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Text stays readable over any artwork */
.scene::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(to top, rgb(5 6 8 / 0.85), rgb(5 6 8 / 0.2) 45%, transparent 70%),
    radial-gradient(120% 90% at 50% 40%, transparent 55%, rgb(5 6 8 / 0.5));
  pointer-events: none;
}

.caption {
  position: absolute;
  z-index: 1;
  left: clamp(1rem, 3vw, 2.25rem);
  right: clamp(1rem, 3vw, 2.25rem);
  bottom: clamp(1rem, 3vw, 2rem);
  max-width: 38rem;
}

.eyebrow {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--tint);
}

.caption h2 {
  margin-top: 0.3rem;
  font-size: clamp(1.6rem, 4vw, 3rem);
  font-weight: 750;
  letter-spacing: -0.035em;
  color: #f4f5f8;
}

.caption p {
  margin: 0.5rem 0 0;
  max-width: 32rem;
  font-size: clamp(0.9rem, 1.4vw, 1.05rem);
  color: rgb(235 238 245 / 0.78);
}

.player {
  z-index: 2;
  background: #000;
  transition: opacity var(--dur-slow) var(--ease-out);
}

.player.hidden {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.host,
.host :deep(iframe) {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}

.veil {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 1.5rem;
  text-align: center;
  color: var(--as-ink);
  background: rgb(5 6 8 / 0.82);
}

.veil p {
  margin: 0;
  max-width: 28rem;
  color: var(--as-ink-2);
}

.veil-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.4rem;
}

.spinner {
  width: 1.75rem;
  height: 1.75rem;
  border: 2px solid rgb(255 255 255 / 0.15);
  border-top-color: var(--tint);
  border-radius: 50%;
  animation: ambient-studio-spin 0.9s linear infinite;
}

@keyframes ambient-studio-spin {
  to { rotate: 1turn; }
}

.ambient-studio-xfade-enter-active,
.ambient-studio-xfade-leave-active {
  transition: opacity 0.7s ease;
}

.ambient-studio-xfade-enter-from,
.ambient-studio-xfade-leave-to {
  opacity: 0;
}

@media (max-width: 640px) {
  .ambient-studio-stage {
    border-radius: 16px;
  }

  .caption p {
    display: none;
  }
}
</style>
