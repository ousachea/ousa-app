<script setup lang="ts">
import { toast } from 'vue-sonner'
import { useAmbientPresets } from '~/composables/ambient-studio/useAmbientPresets'
import { useAmbientSettings } from '~/composables/ambient-studio/useAmbientSettings'
import { useAmbientStorage } from '~/composables/ambient-studio/useAmbientStorage'
import { useAmbientTimer } from '~/composables/ambient-studio/useAmbientTimer'

// Ambient Studio's settings (ToolPage's settings popup). Everything here, including the resets,
// only touches Ambient Studio's own saved data.
const { settings, resetSettings } = useAmbientSettings()
const { clearRecent, recent } = useAmbientPresets()
const { resetAll } = useAmbientStorage()
const timer = useAmbientTimer()
const { play } = useSound()

const percent = (v: number) => `${Math.round(v)}%`

// Timer lengths: typed numbers, kept in range
function setMinutes(key: keyof typeof settings.value.timer, e: Event, min: number, max: number) {
  const n = Math.round(Number((e.target as HTMLInputElement).value))
  if (!Number.isFinite(n)) return
  settings.value.timer[key] = Math.min(max, Math.max(min, n))
  timer.refresh()
}

function onClearRecent() {
  clearRecent()
  play('delete')
  toast('Recently played cleared')
}

function onResetSettings() {
  resetSettings()
  timer.refresh()
  play('success')
  toast('Ambient Studio settings reset')
}

// Erasing everything can't be undone, so the button asks twice
const armed = ref(false)
let armTimer: ReturnType<typeof setTimeout> | undefined
function onEraseAll() {
  if (!armed.value) {
    armed.value = true
    play('warning')
    armTimer = setTimeout(() => (armed.value = false), 3500)
    return
  }
  clearTimeout(armTimer)
  armed.value = false
  resetAll()
  timer.refresh()
  play('delete')
  toast('Ambient Studio data erased', { description: 'Favourites, mixes, recents and settings. Other apps were not touched.' })
}
onBeforeUnmount(() => clearTimeout(armTimer))
</script>

<template>
  <h3 class="settings-head">Sound</h3>
  <label class="setting-field">
    <span class="title">Video volume</span>
    <span class="desc">Where YouTube starts for scenes that don’t set their own: {{ percent(settings.defaultVolume) }}</span>
    <input v-model.number="settings.defaultVolume" class="input-range" type="range" min="0" max="100" :aria-valuetext="percent(settings.defaultVolume)">
  </label>
  <label class="setting-field">
    <span class="title">Mixer volume</span>
    <span class="desc">How loud the mixer’s sounds are overall: {{ percent(settings.masterVolume * 100) }}</span>
    <input
      class="input-range"
      type="range"
      min="0"
      max="100"
      :value="Math.round(settings.masterVolume * 100)"
      :aria-valuetext="percent(settings.masterVolume * 100)"
      @input="settings.masterVolume = Number(($event.target as HTMLInputElement).value) / 100"
    >
  </label>

  <h3 class="settings-head">Look</h3>
  <SettingRow v-model="settings.effects" title="Scene effects" description="Rain, embers, stars and dust drawn over the scene." />
  <SettingRow v-model="settings.reduceMotion" title="Calmer motion" description="Effects hold still. Also follows your device’s reduce-motion setting." />

  <h3 class="settings-head">Timer</h3>
  <div class="setting-field">
    <span class="title">Lengths in minutes</span>
    <div class="minutes">
      <label><span>Focus</span><input class="input" type="number" min="1" max="180" :value="settings.timer.focus" @change="setMinutes('focus', $event, 1, 180)"></label>
      <label><span>Short break</span><input class="input" type="number" min="1" max="60" :value="settings.timer.shortBreak" @change="setMinutes('shortBreak', $event, 1, 60)"></label>
      <label><span>Long break</span><input class="input" type="number" min="1" max="90" :value="settings.timer.longBreak" @change="setMinutes('longBreak', $event, 1, 90)"></label>
      <label><span>Rounds</span><input class="input" type="number" min="1" max="12" :value="settings.timer.rounds" @change="setMinutes('rounds', $event, 1, 12)"></label>
      <label><span>Sleep</span><input class="input" type="number" min="1" max="600" :value="settings.timer.sleep" @change="setMinutes('sleep', $event, 1, 600)"></label>
    </div>
  </div>
  <SettingRow v-model="settings.autoAdvance" title="Start breaks automatically" description="When a focus round ends, the break starts (and the next round after it)." />
  <SettingRow v-model="settings.stopAtEnd" title="Stop the sound" description="When a sleep timer or countdown ends, stop the mixer and pause the video." />
  <SettingRow v-model="settings.fadeOut" title="Fade out" description="Turn the sound down slowly over the last 30 seconds instead of stopping it all at once." />

  <h3 class="settings-head">Your data</h3>
  <div class="setting-field">
    <span class="title">Saved on this device</span>
    <span class="desc">Favourites, mixes, recently played and these settings stay in this browser only. Clearing them here doesn’t touch your other apps.</span>
    <div class="data-actions">
      <button type="button" class="btn btn-sm btn-quiet" :disabled="!recent.length" @click="onClearRecent">Clear recently played</button>
      <button type="button" class="btn btn-sm btn-quiet" @click="onResetSettings">Reset settings</button>
      <button type="button" class="btn btn-sm erase" :class="{ armed }" @click="onEraseAll">{{ armed ? 'Click again to erase' : 'Erase everything' }}</button>
    </div>
  </div>
</template>

<style scoped>
.input-range {
  width: 100%;
  margin-top: 0.35rem;
}

.minutes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
  gap: 0.5rem;
  margin-top: 0.4rem;
}

.minutes label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.minutes .input {
  min-height: 2.4rem;
  padding: 0.4rem 0.65rem;
}

.data-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.erase {
  color: var(--bad-ink);
  background: none;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--red) 40%, transparent);
}

.erase:hover:not(:disabled) {
  background: color-mix(in srgb, var(--red) 10%, transparent);
}

.erase.armed {
  color: #fff;
  background: var(--red);
}
</style>
