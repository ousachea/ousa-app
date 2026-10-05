<script setup lang="ts">
import { getPack, packNames, type CueName, type PackName } from 'uisfx'

const sound = useSound()
const { state } = sound
const { theme, setTheme } = useTheme()

const THEMES: { value: ThemePreference, label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' }
]

function chooseTheme(value: ThemePreference) {
  setTheme(value)
  sound.play('select')
}

const PACKS = packNames.map(name => getPack(name))

const SAMPLES: { cue: CueName, label: string }[] = [
  { cue: 'press', label: 'Tap' },
  { cue: 'toggle-on', label: 'Switch' },
  { cue: 'copy', label: 'Copy' },
  { cue: 'success', label: 'Success' },
  { cue: 'error', label: 'Error' },
  { cue: 'notification', label: 'Notification' },
  { cue: 'level-up', label: 'Level up' }
]

function toggle() {
  const next = !state.enabled
  sound.setEnabled(next)
  // Confirm turning sound on with a sound; turning off stays silent
  if (next) sound.play('toggle-on')
}

function choosePack(pack: PackName) {
  sound.setPack(pack)
  sound.play('success')
}

const volume = computed({
  get: () => Math.round(state.volume * 100),
  set: (v: number) => sound.setVolume(v / 100)
})
</script>

<template>
  <ToolPage>
    <ClientOnly>
      <div class="layout">
        <div class="side">
        <Step :n="1" title="Pick a theme" hint="System follows your device’s light or dark setting.">
          <div class="panel appearance">
            <div class="segmented" role="radiogroup" aria-label="Theme">
              <label v-for="t in THEMES" :key="t.value" :class="{ active: theme.preference === t.value }">
                <input
                  type="radio"
                  name="theme"
                  :value="t.value"
                  :checked="theme.preference === t.value"
                  @change="chooseTheme(t.value)"
                >
                {{ t.label }}
              </label>
            </div>
            <p class="theme-note">
              Showing {{ theme.resolved }} mode. Press <kbd>D</kbd> anywhere to switch.
            </p>
          </div>
        </Step>

        <Step :n="2" title="Turn sound on" class="sound-step">
          <section class="panel master">
            <div>
              <h3 id="sound-label">Sound effects</h3>
              <p v-if="state.enabled">Short sounds when you navigate, copy, download and get results.</p>
              <p v-else>Sound is off. Turn it on to choose a style.</p>
            </div>
            <button
              type="button"
              role="switch"
              class="switch"
              :aria-checked="state.enabled"
              aria-labelledby="sound-label"
              @click="toggle"
            >
              <span class="knob" />
            </button>
          </section>

          <label class="panel field volume" :class="{ muted: !state.enabled }" :inert="!state.enabled">
            <span class="field-head">Volume <output>{{ volume }}%</output></span>
            <input
              v-model.number="volume"
              type="range"
              min="0"
              max="100"
              step="5"
              @change="sound.play('volume-change')"
            >
          </label>
        </Step>
        </div>

        <div class="main" :class="{ muted: !state.enabled }" :inert="!state.enabled">
          <Step :n="3" title="Choose a style" hint="Each style plays a sample when you pick it.">
            <div class="packs" role="radiogroup" aria-label="Sound style">
              <label
                v-for="pack in PACKS"
                :key="pack.name"
                class="pack"
                :class="{ active: state.pack === pack.name }"
                :style="{ '--pack': pack.color }"
              >
                <input
                  type="radio"
                  name="pack"
                  :value="pack.name"
                  :checked="state.pack === pack.name"
                  @change="choosePack(pack.name)"
                >
                <span class="swatch" aria-hidden="true" />
                <strong>{{ pack.label }}</strong>
                <span class="desc">{{ pack.description }}</span>
              </label>
            </div>
          </Step>

          <Step :n="4" title="Try it" hint="Hear the sounds you’ll get around the app." class="try">
            <div class="samples">
              <button
                v-for="s in SAMPLES"
                :key="s.cue"
                type="button"
                class="btn btn-quiet btn-sm"
                @click="sound.play(s.cue)"
              >
                {{ s.label }}
              </button>
            </div>
          </Step>
        </div>
      </div>

      <template #fallback>
        <div class="panel master loading" aria-hidden="true" />
      </template>
    </ClientOnly>
  </ToolPage>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) minmax(0, 2.2fr);
  gap: 2.5rem;
  align-items: start;
}

.side {
  position: sticky;
  top: 1.5rem;
}

.appearance {
  padding: 1rem 1.1rem;
}

.theme-note {
  margin: 0.75rem 0 0;
  font-size: 0.85rem;
  color: var(--ink-2);
}

.theme-note kbd {
  padding: 0.05rem 0.4rem;
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  background: var(--surface-2);
  border-radius: 5px;
  box-shadow: inset 0 0 0 1px var(--line), inset 0 -2px 0 var(--line);
}

.sound-step {
  margin-top: 2rem;
}

.master {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 1.25rem 1.4rem;
}

.master h3 {
  font-size: 1.15rem;
}

.master p {
  margin: 0.25rem 0 0;
  font-size: 0.925rem;
  color: var(--ink-2);
}

.loading {
  height: 5.5rem;
}

/* Switch styled like a cube sticker sliding along a rail */
.switch {
  flex: none;
  position: relative;
  width: 3.5rem;
  height: 2rem;
  padding: 0;
  background: var(--line);
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.switch[aria-checked='true'] {
  background: var(--green);
}

.knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 1.625rem;
  height: 1.625rem;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgb(var(--shadow) / 0.25);
  transition: transform 0.25s cubic-bezier(0.3, 1.4, 0.6, 1);
}

.switch[aria-checked='true'] .knob {
  transform: translateX(1.5rem);
}

.muted {
  opacity: 0.45;
  transition: opacity 0.2s;
}

.volume {
  margin-top: 1rem;
  padding: 1.1rem 1.4rem;
}

.try {
  margin-top: 2.5rem;
}

.packs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
}

.pack {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.9rem 1rem 1rem;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 16px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.pack:hover {
  border-color: var(--ink-3);
}

.pack.active {
  border-color: var(--pack);
  box-shadow: 0 0 0 1px var(--pack), 0 4px 14px color-mix(in srgb, var(--pack) 22%, transparent);
}

.pack:has(input:focus-visible) {
  outline: 3px solid color-mix(in srgb, var(--pack) 55%, transparent);
  outline-offset: 2px;
}

.pack input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.swatch {
  width: 1.25rem;
  height: 1.25rem;
  margin-bottom: 0.4rem;
  background: var(--pack);
  border-radius: 5px;
  box-shadow: 0 0 0 2px var(--plastic), inset 0 -3px 0 rgb(0 0 0 / 0.12);
  transition: transform 0.25s cubic-bezier(0.3, 1.6, 0.6, 1);
}

.pack.active .swatch {
  transform: rotate(90deg);
}

.pack strong {
  font-size: 1rem;
}

.desc {
  font-size: 0.85rem;
  line-height: 1.35;
  color: var(--ink-2);
}

.samples {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; }
  .side { position: static; }
}

@media (max-width: 640px) {
  .packs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (prefers-reduced-motion: reduce) {
  .pack.active .swatch { transform: none; }
}
</style>
