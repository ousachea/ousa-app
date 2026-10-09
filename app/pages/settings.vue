<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { EffectsPreference } from '~/composables/useEffects'
import type { Density, MotionPreference, Prefs } from '~/composables/usePrefs'
import { getPack, packNames, type CueName, type PackName } from 'uisfx'
import { getDocsFromServer, limit, query } from 'firebase/firestore'

const sound = useSound()
const { state } = sound
const { theme, setTheme } = useTheme()

// ---------- Sync with Firebase ----------
// Signing in uses the Passwords account; trackers then sync to Firestore under users/{uid}
const { vault, signOut } = useVault()
const signedIn = computed(() => !['loading', 'signed-out'].includes(vault.status))
const table = ref<'checking' | 'ready' | 'missing' | 'error'>('checking')

async function checkTable() {
  if (!signedIn.value) return
  table.value = 'checking'
  const uid = useFirebase().auth.currentUser?.uid
  if (!uid) return
  try {
    await getDocsFromServer(query(itemsRef(uid), limit(1)))
    table.value = 'ready'
  } catch (e) {
    table.value = needsFirestoreSetup(e) ? 'missing' : 'error'
  }
}
watch(signedIn, checkTable, { immediate: true })

async function copyRules() {
  try {
    await navigator.clipboard.writeText(FIRESTORE_RULES)
    toast.success('Rules copied', { description: 'Paste them into the Firestore rules editor and publish.' })
    sound.play('copy')
  } catch {
    toast.error('Could not copy')
  }
}

const THEMES: { value: ThemePreference, label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' }
]

function chooseTheme(value: ThemePreference) {
  setTheme(value)
  sound.play('select')
  toast(value === 'system' ? 'Following your device’s theme' : `${value === 'dark' ? 'Dark' : 'Light'} theme on`)
}

// Effects: lite keeps old computers smooth
const { effects, setEffects } = useEffects()
const EFFECTS: { value: EffectsPreference, label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'full', label: 'Full' },
  { value: 'lite', label: 'Lite' }
]

function chooseEffects(value: EffectsPreference) {
  setEffects(value)
  sound.play('select')
  toast(value === 'lite' ? 'Lite effects on' : value === 'full' ? 'Full effects on' : 'Effects follow this computer’s speed')
}

// Behaviour and density (usePrefs); appearance above, data below
const { prefs } = usePrefs()
const DENSITIES: { value: Density, label: string }[] = [
  { value: 'spacious', label: 'Spacious' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' }
]
const MOTIONS: { value: MotionPreference, label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'full', label: 'On' },
  { value: 'reduced', label: 'Reduced' }
]
// Accent: each app's own colour, or one of these everywhere
const ACCENTS = ['apps', 'blue', 'green', 'purple', 'teal', 'rust', 'slate', 'pink'] as const
function chooseAccent(a: string) {
  prefs.accent = a
  sound.play('select')
}
const VIEWS: { value: Prefs['defaultView'], label: string }[] = [
  { value: 'list', label: 'List' },
  { value: 'grid', label: 'Grid' },
  { value: 'compact', label: 'Compact' }
]

function choose<K extends 'density' | 'motion' | 'defaultView'>(key: K, value: Prefs[K]) {
  prefs[key] = value
  sound.play('select')
}

const PACKS = packNames.map(name => getPack(name))

// Each sample also pops the toast that goes with that sound around the app
const SAMPLES: { cue: CueName, label: string, show: () => void }[] = [
  { cue: 'press', label: 'Tap', show: () => toast('Tapped') },
  { cue: 'toggle-on', label: 'Switch', show: () => toast('Switched on') },
  { cue: 'copy', label: 'Copy', show: () => toast.success('Copied', { description: 'Ready to paste anywhere.' }) },
  { cue: 'success', label: 'Success', show: () => toast.success('Saved', { description: 'Everything went to plan.' }) },
  { cue: 'error', label: 'Error', show: () => toast.error('Something went wrong', { description: 'This is only a test.' }) },
  { cue: 'notification', label: 'Notification', show: () => toast.info('New notification', { description: 'You have a message waiting.' }) },
  { cue: 'level-up', label: 'Level up', show: () => toast.success('Level up!', { description: 'You unlocked something new.' }) }
]

function trySample(sample: typeof SAMPLES[number]) {
  sound.play(sample.cue)
  sample.show()
}

function toggle() {
  const next = !state.enabled
  sound.setEnabled(next)
  // Confirm turning sound on with a sound; turning off stays silent
  if (next) sound.play('toggle-on')
  toast(next ? 'Sound effects on' : 'Sound effects off')
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
        <div v-sticky-fit class="side">
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

            <h3 class="effects-head">Effects</h3>
            <div class="segmented" role="radiogroup" aria-label="Effects">
              <label v-for="e in EFFECTS" :key="e.value" :class="{ active: effects.preference === e.value }">
                <input
                  type="radio"
                  name="effects"
                  :value="e.value"
                  :checked="effects.preference === e.value"
                  @change="chooseEffects(e.value)"
                >
                {{ e.label }}
              </label>
            </div>
            <p class="theme-note">
              Lite turns off blur and background animation so older computers stay smooth.
              <template v-if="effects.preference === 'auto'">This computer gets {{ effects.slowDevice ? 'lite' : 'full' }} effects.</template>
            </p>

            <h3 class="effects-head">Accent</h3>
            <div class="accents" role="radiogroup" aria-label="Accent colour">
              <label v-for="a in ACCENTS" :key="a" class="accent" :class="{ active: prefs.accent === a, apps: a === 'apps' }" :style="a === 'apps' ? undefined : { '--swatch': `var(--${a})` }" :title="a === 'apps' ? 'Each app’s own colour' : a">
                <input type="radio" name="accent" :value="a" :checked="prefs.accent === a" :aria-label="a === 'apps' ? 'Each app’s own colour' : a" @change="chooseAccent(a)">
              </label>
            </div>
            <p class="theme-note">Buttons and highlights. The first keeps each app’s own colour.</p>

            <h3 class="effects-head">Density</h3>
            <div class="segmented" role="radiogroup" aria-label="Density">
              <label v-for="d in DENSITIES" :key="d.value" :class="{ active: prefs.density === d.value }">
                <input type="radio" name="density" :value="d.value" :checked="prefs.density === d.value" @change="choose('density', d.value)">
                {{ d.label }}
              </label>
            </div>
            <p class="theme-note">How much room lists and cards get. Compact fits more on screen.</p>

            <h3 class="effects-head">Animations</h3>
            <div class="segmented" role="radiogroup" aria-label="Animations">
              <label v-for="m in MOTIONS" :key="m.value" :class="{ active: prefs.motion === m.value }">
                <input type="radio" name="motion" :value="m.value" :checked="prefs.motion === m.value" @change="choose('motion', m.value)">
                {{ m.label }}
              </label>
            </div>
            <p class="theme-note">System follows your device’s reduce-motion setting.</p>
          </div>
        </Step>

        <Step id="behaviour" :n="2" title="Behaviour" hint="How the apps respond when you work in them." class="sync-step">
          <div class="panel behaviour">
            <SettingRow v-model="prefs.shortcuts" title="Keyboard shortcuts" description="Single keys like A to add, D for dark mode and M for the menu. ⌘K / Ctrl+K always works." />
            <SettingRow v-model="prefs.confirmDelete" title="Confirm before delete" description="Ask for a second click before something goes to the Recycle Bin." />
            <SettingRow v-model="prefs.autosave" title="Autosave forms" description="Keep what you’ve typed into an Add form if you close it, so you can continue later." />
            <div class="setting-choice">
              <div class="text">
                <span class="title">Default view</span>
                <span class="desc">How lists look until you pick a view for them.</span>
              </div>
              <div class="segmented" role="radiogroup" aria-label="Default view">
                <label v-for="v in VIEWS" :key="v.value" :class="{ active: prefs.defaultView === v.value }">
                  <input type="radio" name="default-view" :value="v.value" :checked="prefs.defaultView === v.value" @change="choose('defaultView', v.value)">
                  {{ v.label }}
                </label>
              </div>
            </div>
          </div>
        </Step>

        <Step id="sync" :n="3" title="Sync with Firebase" hint="Keep your trackers in your Firebase account and see them on every device." class="sync-step">
          <div class="panel sync">
            <template v-if="!signedIn">
              <p>You’re not signed in, so Things I own, Renewals, Countdown and the other trackers are saved on this device only.</p>
              <p class="small">It’s the same account as the password saver.</p>
              <VaultAuth purpose="account" class="sign-in" />
            </template>
            <template v-else>
              <p>Signed in as <strong>{{ vault.email }}</strong>.</p>
              <p v-if="table === 'checking'" class="small">Checking Firebase…</p>
              <template v-else-if="table === 'ready'">
                <p class="ok">Your trackers sync to Firebase.</p>
                <SyncStatus />
              </template>
              <p v-else-if="table === 'error'" class="small">Couldn’t reach Firebase right now. Your data is safe on this device.</p>
              <template v-else>
                <p class="small">One-time setup: create a Firestore database in the Firebase console, then publish these rules. Each account can only see its own data.</p>
                <pre><code>{{ FIRESTORE_RULES }}</code></pre>
                <div class="row-actions">
                  <button type="button" class="btn btn-sm" @click="copyRules">Copy rules</button>
                  <a class="btn btn-quiet btn-sm" :href="firestoreRulesUrl()" target="_blank" rel="noopener">Open Firestore rules</a>
                  <button type="button" class="btn btn-quiet btn-sm" @click="checkTable">Check again</button>
                </div>
              </template>
              <button type="button" class="link" @click="signOut">Sign out</button>
            </template>
          </div>
        </Step>
        </div>

        <div class="main">
          <Step id="data" :n="4" title="Your data" hint="Back up everything to one file, or restore from one." class="data-step">
            <DataPanel />
          </Step>

          <Step :n="5" title="Sound" hint="Turn it on, set the volume, then pick a style and try it.">
            <section class="panel master">
              <span class="master-icon" :class="{ on: state.enabled }"><SoundIcon :name="state.enabled ? 'on' : 'off'" /></span>
              <div class="master-text">
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
              <span class="slider">
                <SoundIcon name="quiet" />
                <input
                  v-model.number="volume"
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  @change="sound.play('volume-change')"
                >
                <SoundIcon name="loud" />
              </span>
            </label>
          </Step>

          <div class="sound-options" :class="{ muted: !state.enabled }" :inert="!state.enabled">
          <Step :n="6" title="Choose a style" hint="Each style plays a sample when you pick it.">
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
                <span class="swatch" aria-hidden="true"><SoundIcon :name="pack.name" /></span>
                <strong>{{ pack.label }}</strong>
                <span class="desc">{{ pack.description }}</span>
              </label>
            </div>
          </Step>

          <Step :n="7" title="Try it" hint="Hear the sounds and see the pop-ups you’ll get around the app." class="try">
            <div class="samples">
              <button
                v-for="s in SAMPLES"
                :key="s.cue"
                type="button"
                class="btn btn-quiet btn-sm"
                @click="trySample(s)"
              >
                <SoundIcon :name="s.cue" />
                {{ s.label }}
              </button>
            </div>
          </Step>
          </div>

          <Step id="about" :n="8" title="About" hint="Version, what’s new everywhere, installing the app and keyboard shortcuts." class="about-step">
            <AboutPanel />
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
  top: 5.5rem; /* clear of the menu button in the top-right corner */
}

.appearance {
  padding: 1rem 1.1rem;
}

.effects-head {
  margin-top: 1.25rem;
  margin-bottom: 0.6rem;
  font-size: 1rem;
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

.data-step {
  margin-bottom: 2rem;
  scroll-margin-top: 6rem;
}

.accents {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.accent {
  position: relative;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--swatch);
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.12);
  cursor: pointer;
  transition: scale var(--dur-fast);
}

/* Each app's own colour: a little wheel of stickers */
.accent.apps {
  background: conic-gradient(var(--blue) 0 25%, var(--red) 0 50%, var(--yellow) 0 75%, var(--green) 0);
}

.accent:hover {
  scale: 1.08;
}

.accent.active {
  box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--ink);
}

.accent:has(input:focus-visible) {
  outline: 3px solid color-mix(in srgb, var(--ink) 40%, transparent);
  outline-offset: 3px;
}

.accent input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.setting-choice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem 1rem;
  padding: 0.85rem 0;
  border-top: 1px solid var(--line);
}

.setting-choice .text {
  display: flex;
  flex-direction: column;
}

.setting-choice .title {
  font-weight: 600;
}

.setting-choice .desc {
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.about-step {
  margin-top: 2rem;
  margin-bottom: 2rem;
  scroll-margin-top: 6rem;
}

.behaviour {
  padding: 0.25rem 1.1rem;
}

.sync-step {
  margin-top: 2rem;
  scroll-margin-top: 6rem;
}

.sync {
  padding: 1.1rem 1.25rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.6rem;
}

.sync p {
  margin: 0;
}

.sync .small {
  font-size: 0.85rem;
  color: var(--ink-2);
}

.sign-in {
  align-self: stretch;
  margin-top: 0.4rem;
}

.sync .ok {
  font-weight: 600;
  color: var(--good-ink);
}

.sync pre {
  width: 100%;
  max-height: 14rem;
  margin: 0;
  padding: 0.75rem;
  overflow: auto;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 0.75rem;
  background: var(--surface-2);
  border-radius: 10px;
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.sync .link {
  padding: 0;
  font: inherit;
  font-size: 0.85rem;
  color: var(--ink-2);
  background: none;
  border: 0;
  text-decoration: underline;
  cursor: pointer;
}

/* Style and samples sit under the sound switch and fade out while sound is off */
.sound-options {
  margin-top: 2.5rem;
}

.master {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 1.4rem;
}

.master-text {
  flex: 1;
}

.master-icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  font-size: 1.3rem;
  color: var(--ink-2);
  background: var(--surface-2);
  border-radius: 12px;
  transition: color 0.2s, background-color 0.2s;
}

.master-icon.on {
  color: #fff;
  background: var(--green);
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

.slider {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--ink-2);
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
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  margin-bottom: 0.4rem;
  font-size: 1.05rem;
  color: #fff;
  background: var(--pack);
  border-radius: 8px;
  box-shadow: 0 0 0 2px var(--plastic), inset 0 -3px 0 rgb(0 0 0 / 0.12);
  transition: transform 0.25s cubic-bezier(0.3, 1.6, 0.6, 1);
}

.pack.active .swatch {
  transform: scale(1.12) rotate(-6deg);
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
  .layout { grid-template-columns: minmax(0, 1fr); }
  .side { position: static; }
}

@media (max-width: 640px) {
  .packs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (prefers-reduced-motion: reduce) {
  .pack.active .swatch { transform: none; }
}
</style>
