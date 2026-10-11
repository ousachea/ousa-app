<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { AmbientLayerId } from '~/types/ambient-studio'
import { AMBIENT_LAYERS } from '~/data/ambient-studio/presets'
import { useAmbientMixer } from '~/composables/ambient-studio/useAmbientMixer'
import { useAmbientSettings } from '~/composables/ambient-studio/useAmbientSettings'
import { LINK_ID, useAmbientStudio } from '~/composables/ambient-studio/useAmbientStudio'

// The sound layers for this scene: a slider and mute for each, add and remove, reset to the
// scene's own mix, and save the whole thing (with the video) as a mix of your own.
const mixer = useAmbientMixer()
const studio = useAmbientStudio()
const { settings } = useAmbientSettings()
const { play } = useSound()

const m = mixer.state
const nameOf = (id: AmbientLayerId) => AMBIENT_LAYERS.find(l => l.id === id)!
const available = computed(() => AMBIENT_LAYERS.filter(l => !m.layers.some(x => x.id === l.id)))
const changed = computed(() => JSON.stringify(m.layers.map(l => [l.id, l.volume, !!l.muted])) !== JSON.stringify(m.defaults.map(l => [l.id, l.volume, !!l.muted])))

function onLayer(id: AmbientLayerId, e: Event) {
  mixer.setVolume(id, Number((e.target as HTMLInputElement).value) / 100)
}

function onMaster(e: Event) {
  settings.value.masterVolume = Number((e.target as HTMLInputElement).value) / 100
}

function add(id: AmbientLayerId) {
  mixer.add(id)
  play('select')
}

// ---------- Save as a mix ----------
const saving = ref(false)
const mixName = ref('')
const nameError = ref('')
const nameInput = ref<HTMLInputElement>()

function openSave() {
  saving.value = true
  const base = studio.current.value
  mixName.value = base.id === LINK_ID ? 'My mix' : `${base.name} (my mix)`
  nameError.value = ''
  nextTick(() => nameInput.value?.select())
}

function save() {
  if (!mixName.value.trim()) {
    nameError.value = 'Give your mix a name.'
    play('error')
    return
  }
  const mix = studio.saveMix(mixName.value)
  saving.value = false
  play('success')
  toast.success(`Saved “${mix.name}”`, { description: 'Find it under Your mixes.' })
}
</script>

<template>
  <section class="ambient-studio-mixer" aria-labelledby="ambient-studio-mixer-title">
    <header class="head">
      <div>
        <h3 id="ambient-studio-mixer-title">Sound mixer</h3>
        <p>Made in your browser, so it works offline. Separate from the video’s sound.</p>
      </div>
      <button
        type="button"
        class="btn btn-sm"
        :disabled="!m.supported || !m.layers.length"
        :aria-pressed="m.playing"
        @click="mixer.toggle()"
      >
        <AmbientStudioIcon :name="m.playing ? 'stop' : 'play'" />
        {{ m.playing ? 'Stop' : 'Play' }}
      </button>
    </header>

    <p v-if="!m.supported" class="unsupported" role="note">{{ m.error }}</p>

    <template v-else>
      <label class="master">
        <span>Mixer volume</span>
        <input
          type="range"
          min="0"
          max="100"
          :value="Math.round(settings.masterVolume * 100)"
          :aria-valuetext="`${Math.round(settings.masterVolume * 100)}%`"
          @input="onMaster"
        >
        <output>{{ Math.round(settings.masterVolume * 100) }}</output>
      </label>

      <TransitionGroup v-if="m.layers.length" tag="ul" name="list" class="layers">
        <li v-for="layer in m.layers" :key="layer.id" class="layer" :class="{ muted: layer.muted }">
          <div class="layer-head">
            <span class="layer-name">{{ nameOf(layer.id).name }}</span>
            <span class="layer-hint">{{ nameOf(layer.id).hint }}</span>
          </div>
          <div class="layer-controls">
            <button
              type="button"
              class="icon"
              :aria-pressed="!!layer.muted"
              :aria-label="layer.muted ? `Unmute ${nameOf(layer.id).name}` : `Mute ${nameOf(layer.id).name}`"
              @click="mixer.toggleMute(layer.id)"
            >
              <AmbientStudioIcon :name="layer.muted ? 'mute' : 'volume'" />
            </button>
            <input
              type="range"
              min="0"
              max="100"
              :value="Math.round(layer.volume * 100)"
              :aria-label="`${nameOf(layer.id).name} volume`"
              :aria-valuetext="layer.muted ? 'muted' : `${Math.round(layer.volume * 100)}%`"
              @input="onLayer(layer.id, $event)"
            >
            <button type="button" class="icon" :aria-label="`Remove ${nameOf(layer.id).name}`" title="Remove" @click="mixer.remove(layer.id)">
              <AmbientStudioIcon name="x" />
            </button>
          </div>
        </li>
      </TransitionGroup>
      <p v-else class="empty">No sounds in this mix. Add one below.</p>

      <div v-if="available.length" class="add">
        <span class="add-label">Add a sound</span>
        <div class="chips">
          <button v-for="l in available" :key="l.id" type="button" class="chip" :title="l.hint" @click="add(l.id)">
            <AmbientStudioIcon name="plus" /> {{ l.name }}
          </button>
        </div>
      </div>

      <div class="actions">
        <button type="button" class="btn btn-sm btn-quiet" :disabled="!changed" @click="mixer.reset()">
          <AmbientStudioIcon name="reset" /> Reset to scene
        </button>
        <button v-if="!saving" type="button" class="btn btn-sm btn-quiet" @click="openSave">
          <AmbientStudioIcon name="save" /> Save as mix
        </button>
      </div>

      <Transition name="collapse">
        <form v-if="saving" class="save" novalidate @submit.prevent="save">
          <label class="field">
            <span>Name</span>
            <input ref="nameInput" v-model="mixName" class="input" :class="{ 'is-invalid': nameError }" maxlength="80" required @keydown.esc="saving = false">
          </label>
          <p v-if="nameError" class="field-error" role="alert">{{ nameError }}</p>
          <p class="save-note">Saves these sounds, the video and the scene together.</p>
          <div class="save-actions">
            <button type="button" class="btn btn-sm btn-quiet" @click="saving = false">Cancel</button>
            <button type="submit" class="btn btn-sm">Save mix</button>
          </div>
        </form>
      </Transition>
    </template>
  </section>
</template>

<style scoped>
.ambient-studio-mixer {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

h3 {
  font-size: 1rem;
  font-weight: 700;
  color: var(--as-ink);
}

.head p {
  margin: 0.2rem 0 0;
  font-size: 0.8rem;
  color: var(--as-ink-3);
}

.head .btn {
  flex: none;
}

.unsupported,
.empty {
  margin: 0;
  padding: 0.9rem 1rem;
  font-size: 0.875rem;
  color: var(--as-ink-2);
  background: rgb(255 255 255 / 0.03);
  border: 1px dashed var(--as-line);
  border-radius: 12px;
}

.master {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 2rem;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--as-ink-2);
}

.master output {
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--as-ink);
}

input[type='range'] {
  accent-color: var(--tint);
}

.layers {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.layer {
  padding: 0.6rem 0.4rem 0.35rem 0.75rem;
  background: rgb(255 255 255 / 0.03);
  border: 1px solid var(--as-line);
  border-radius: 12px;
  transition: opacity var(--dur-fast);
}

.layer.muted .layer-head,
.layer.muted input {
  opacity: 0.45;
}

.layer-head {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  min-width: 0;
}

.layer-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--as-ink);
}

.layer-hint {
  font-size: 0.75rem;
  color: var(--as-ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.layer-controls {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.25rem;
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
  transition: color var(--dur-fast), background-color var(--dur-fast);
}

.icon:hover {
  color: var(--as-ink);
  background: var(--as-hover);
}

.icon[aria-pressed='true'] {
  color: var(--tint);
}

.add-label {
  display: block;
  margin-bottom: 0.45rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--as-ink-3);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 2rem;
  padding: 0 0.7rem 0 0.55rem;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--as-ink-2);
  background: none;
  border: 1px solid var(--as-line);
  border-radius: 999px;
  cursor: pointer;
  transition: color var(--dur-fast), border-color var(--dur-fast), background-color var(--dur-fast);
}

.chip:hover {
  color: var(--as-ink);
  border-color: color-mix(in srgb, var(--tint) 50%, transparent);
  background: color-mix(in srgb, var(--tint) 8%, transparent);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.save {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.9rem;
  background: rgb(255 255 255 / 0.03);
  border: 1px solid var(--as-line);
  border-radius: 14px;
}

.save .field-error,
.save-note {
  margin: 0;
}

.save-note {
  font-size: 0.8rem;
  color: var(--as-ink-3);
}

.save-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
