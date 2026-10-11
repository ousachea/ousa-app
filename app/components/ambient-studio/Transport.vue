<script setup lang="ts">
import { categoryName } from '~/data/ambient-studio/presets'
import { useAmbientMixer } from '~/composables/ambient-studio/useAmbientMixer'
import { useAmbientMusic } from '~/composables/ambient-studio/useAmbientMusic'
import { useAmbientPlayer } from '~/composables/ambient-studio/useAmbientPlayer'
import { useAmbientPresets } from '~/composables/ambient-studio/useAmbientPresets'
import { useAmbientSettings } from '~/composables/ambient-studio/useAmbientSettings'
import { LINK_ID, useAmbientStudio } from '~/composables/ambient-studio/useAmbientStudio'
import { parseYouTubeLink, youtubeUrl } from '~/utils/ambient-studio/youtube'

// Under the stage: what's on, one Play button for video and mixer together, the video's own
// volume, and switches for the view and effects. Also where a YouTube link can be pasted.
const studio = useAmbientStudio()
const player = useAmbientPlayer()
const mixer = useAmbientMixer()
const { isFavorite, toggleFavorite } = useAmbientPresets()
const { settings } = useAmbientSettings()
const online = useOnline()
const { play } = useSound()

const p = player.state
const music = useAmbientMusic()
const item = computed(() => studio.current.value)
// Skipping works through your music's queue when it's playing, otherwise through a YouTube playlist
const canSkip = computed(() => music.hasQueue.value || p.count > 1)
const prev = () => (music.hasQueue.value ? music.previous() : player.previous())
const next = () => (music.hasQueue.value ? music.next() : player.next())
const title = computed(() => p.title || item.value.youtube?.title || item.value.name)
const subtitle = computed(() => {
  if (music.hasQueue.value) return [p.channel, `${music.state.position + 1} of ${music.state.queue.length} · ${music.state.queueTitle}`].filter(Boolean).join(' · ')
  if (p.source) return [p.channel || item.value.youtube?.channel, p.count ? `${p.index + 1} of ${p.count}` : ''].filter(Boolean).join(' · ') || 'YouTube'
  return mixer.state.layers.length ? 'Sound mixer only' : 'Nothing to play yet'
})
const canPlay = computed(() => studio.hasVideo.value || studio.hasLayers.value)
const fav = computed(() => item.value.id !== LINK_ID && isFavorite(item.value.id))

// Status line, read out to screen readers as it changes
const status = computed(() => {
  if (p.source && !online.value) return 'You’re offline. Videos need an internet connection; the mixer keeps playing.'
  if (p.status === 'blocked') return 'Your browser stopped the video starting by itself. Press play on the video.'
  if (p.status === 'error' && p.view !== 'video') return p.error
  if (mixer.state.error) return mixer.state.error
  if (mixer.state.fading) return 'Fading out…'
  return ''
})

function onPlay() {
  studio.togglePlay()
  play(studio.playing.value ? 'toggle-on' : 'toggle-off')
}

function flipFav() {
  toggleFavorite(item.value.id)
  play(fav.value ? 'toggle-on' : 'toggle-off')
}

function onVolume(e: Event) {
  player.setVolume(Number((e.target as HTMLInputElement).value))
}

// ---------- Paste a link ----------
const linkOpen = ref(false)
const link = ref('')
const linkError = ref('')
const linkInput = ref<HTMLInputElement>()

function openLink() {
  linkOpen.value = !linkOpen.value
  linkError.value = ''
  if (linkOpen.value) nextTick(() => linkInput.value?.focus())
}

function submitLink() {
  const parsed = parseYouTubeLink(link.value)
  if (!parsed.ok) {
    linkError.value = parsed.error
    play('error')
    return
  }
  linkError.value = ''
  studio.playLink(parsed.source)
  link.value = ''
  linkOpen.value = false
  play('select')
}
</script>

<template>
  <section class="ambient-studio-transport" aria-label="Playback">
    <div class="row">
      <div class="now">
        <img :src="music.current.value?.thumb || item.artwork" alt="" class="thumb" width="96" height="54" referrerpolicy="no-referrer">
        <div class="now-text">
          <strong :title="title">{{ title }}</strong>
          <span>{{ subtitle }}</span>
        </div>
        <button
          v-if="item.id !== LINK_ID"
          type="button"
          class="round quiet fav"
          :class="{ on: fav }"
          :aria-pressed="fav"
          :aria-label="fav ? `Remove ${item.name} from favourites` : `Add ${item.name} to favourites`"
          @click="flipFav"
        >
          <AmbientStudioIcon name="heart" />
        </button>
      </div>

      <div class="controls">
        <button v-if="canSkip" type="button" class="round quiet" :aria-label="music.hasQueue.value ? 'Previous song' : 'Previous video'" @click="prev">
          <AmbientStudioIcon name="prev" />
        </button>
        <button type="button" class="play" :disabled="!canPlay" :aria-label="studio.playing.value ? 'Pause' : 'Play'" @click="onPlay">
          <AmbientStudioIcon :name="studio.playing.value ? 'pause' : 'play'" />
        </button>
        <button v-if="canSkip" type="button" class="round quiet" :aria-label="music.hasQueue.value ? 'Next song' : 'Next video'" @click="next">
          <AmbientStudioIcon name="next" />
        </button>
      </div>

      <div class="extras">
        <div class="volume" :class="{ off: !p.source }">
          <button
            type="button"
            class="round quiet"
            :disabled="!p.source"
            :aria-pressed="p.muted"
            :aria-label="p.muted ? 'Unmute video' : 'Mute video'"
            @click="player.toggleMute()"
          >
            <AmbientStudioIcon :name="p.muted || p.volume === 0 ? 'mute' : 'volume'" />
          </button>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            :value="p.muted ? 0 : p.volume"
            :disabled="!p.source"
            aria-label="Video volume"
            :aria-valuetext="`${p.muted ? 0 : p.volume}%`"
            @input="onVolume"
          >
        </div>

        <div class="seg" role="group" aria-label="Show">
          <button type="button" :aria-pressed="p.view === 'scene' || !p.source" title="Scene artwork (pauses the video)" @click="player.showScene()">
            <AmbientStudioIcon name="image" /><span>Scene</span>
          </button>
          <button type="button" :aria-pressed="p.view === 'video' && !!p.source" :disabled="!p.source" title="YouTube video" @click="player.showVideo()">
            <AmbientStudioIcon name="video" /><span>Video</span>
          </button>
        </div>

        <button
          type="button"
          class="round quiet"
          :class="{ on: settings.effects }"
          :aria-pressed="settings.effects"
          :aria-label="settings.effects ? 'Turn scene effects off' : 'Turn scene effects on'"
          :title="settings.effects ? 'Scene effects on' : 'Scene effects off'"
          @click="settings.effects = !settings.effects"
        >
          <AmbientStudioIcon name="sparkle" />
        </button>

        <button type="button" class="round quiet" :class="{ on: linkOpen }" :aria-expanded="linkOpen" aria-label="Play a YouTube link" title="Play a YouTube link" @click="openLink">
          <AmbientStudioIcon name="link" />
        </button>
      </div>
    </div>

    <Transition name="collapse">
      <form v-if="linkOpen" class="link-form" novalidate @submit.prevent="submitLink">
        <label class="sr-only" for="ambient-studio-link">YouTube or YouTube Music link</label>
        <input
          id="ambient-studio-link"
          ref="linkInput"
          v-model="link"
          class="input"
          :class="{ 'is-invalid': linkError }"
          type="url"
          inputmode="url"
          placeholder="Paste a YouTube video or playlist link"
          autocomplete="off"
          :aria-invalid="!!linkError"
          aria-describedby="ambient-studio-link-help"
          @keydown.esc="linkOpen = false"
        >
        <button type="submit" class="btn">Play</button>
        <p v-if="linkError" id="ambient-studio-link-help" class="field-error" role="alert">{{ linkError }}</p>
        <p v-else id="ambient-studio-link-help" class="help">
          Public videos and playlists whose owners allow embedding. Private playlists and YouTube’s automatic mixes can’t play here.
        </p>
      </form>
    </Transition>

    <div class="foot">
      <p class="status" role="status" aria-live="polite">{{ status }}</p>
      <div v-if="p.source" class="open">
        <a :href="youtubeUrl(p.source)" target="_blank" rel="noopener">YouTube <AmbientStudioIcon name="external" /></a>
        <a :href="youtubeUrl(p.source, true)" target="_blank" rel="noopener">YouTube Music <AmbientStudioIcon name="external" /></a>
      </div>
      <span v-else class="open quiet-note">{{ categoryName(item.category) }}</span>
    </div>
  </section>
</template>

<style scoped>
.ambient-studio-transport {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.75rem 0.9rem;
  background: var(--as-raised);
  border: 1px solid var(--as-line);
  border-radius: 18px;
}

.row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 1rem;
}

.now {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.thumb {
  width: 3.5rem;
  height: 2.5rem;
  flex: none;
  object-fit: cover;
  border-radius: 8px;
  box-shadow: 0 0 0 1px var(--as-line);
}

.now-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.now-text strong {
  font-weight: 650;
  color: var(--as-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.now-text span {
  font-size: 0.8rem;
  color: var(--as-ink-3);
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.play {
  width: 3.25rem;
  height: 3.25rem;
  display: grid;
  place-items: center;
  font-size: 1.25rem;
  color: #0b0d12;
  background: var(--tint);
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 8px 24px -10px var(--tint);
  transition: scale 0.12s var(--ease-out), filter var(--dur-fast);
}

.play:hover:not(:disabled) {
  filter: brightness(1.08);
}

.play:active:not(:disabled) {
  scale: 0.94;
}

.play:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.round {
  width: 2.5rem;
  height: 2.5rem;
  flex: none;
  display: grid;
  place-items: center;
  font-size: 1.1rem;
  color: var(--as-ink-2);
  background: none;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  transition: color var(--dur-fast), background-color var(--dur-fast), scale 0.1s;
}

.round:hover:not(:disabled) {
  color: var(--as-ink);
  background: var(--as-hover);
}

.round:active:not(:disabled) {
  scale: 0.92;
}

.round:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.round.on {
  color: var(--tint);
}

.fav.on :deep(path) {
  fill: currentColor;
}

.fav.on {
  color: #ff8fa8;
}

.extras {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.35rem;
  min-width: 0;
}

.volume {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  min-width: 0;
}

.volume input {
  width: 7rem;
  accent-color: var(--tint);
}

.seg {
  display: inline-flex;
  padding: 3px;
  background: rgb(255 255 255 / 0.04);
  border: 1px solid var(--as-line);
  border-radius: 999px;
}

.seg button {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  height: 2rem;
  padding: 0 0.7rem;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--as-ink-3);
  background: none;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  transition: color var(--dur-fast), background-color var(--dur-fast);
}

.seg button[aria-pressed='true'] {
  color: var(--as-ink);
  background: rgb(255 255 255 / 0.09);
}

.seg button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.link-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.5rem;
  padding-top: 0.25rem;
}

.link-form .field-error,
.link-form .help {
  grid-column: 1 / -1;
  margin: 0;
}

.help {
  font-size: 0.8rem;
  color: var(--as-ink-3);
}

.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 1.25rem;
  font-size: 0.8rem;
}

.status {
  margin: 0;
  color: var(--tint);
}

.open {
  display: flex;
  gap: 1rem;
  margin-left: auto;
  color: var(--as-ink-3);
  white-space: nowrap;
}

.open a {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--as-ink-3);
  text-decoration: none;
}

.open a:hover {
  color: var(--as-ink);
}

/* Narrower: what's on, then controls and switches on their own line */
@container (max-width: 900px) {
  .row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .extras {
    grid-column: 1 / -1;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .volume {
    flex: 1;
  }

  .volume input {
    width: 100%;
    max-width: 14rem;
  }
}

@container (max-width: 480px) {
  .seg span {
    display: none;
  }

  .foot {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.4rem;
  }

  .open {
    margin-left: 0;
  }
}
</style>
