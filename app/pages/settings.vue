<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { EffectsPreference } from '~/composables/useEffects'
import type { Density, MotionPreference, Prefs } from '~/composables/usePrefs'
import { getPack, packNames, type CueName, type PackName } from 'uisfx'
import { getDocsFromServer, limit, query } from 'firebase/firestore'

const sound = useSound()
const { state } = sound
const { theme, setTheme } = useTheme()

// ---------- Sections ----------
// One section at a time, picked from the menu down the side (a row of chips on phones). The hash keeps
// the old links working (#sync, #data, #about), and "Find a setting" narrows the menu by keyword.
type SectionId = 'appearance' | 'performance' | 'behaviour' | 'sync' | 'data' | 'sound' | 'features' | 'about'
interface Section { id: SectionId, label: string, hint: string, icon: string, keywords: string }
const SECTIONS: Section[] = [
  { id: 'appearance', label: 'Appearance', hint: 'Theme, colours and density', icon: 'M12 3a9 9 0 1 0 0 18c1 0 1.6-.8 1.6-1.6 0-.5-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5C21 6.6 17 3 12 3zM7.5 12.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2zM10 8.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2zM14.5 8.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z', keywords: 'theme dark light mode accent colour color cube stickers density compact spacious comfortable' },
  { id: 'performance', label: 'Performance', hint: 'Low-spec PC mode, effects, animations', icon: 'M13 3L5 13.5h6L10 21l8-10.5h-6z', keywords: 'low spec slow old computer pc fast smooth lite effects blur animations motion reduce speed' },
  { id: 'behaviour', label: 'Behaviour', hint: 'Shortcuts, keyboards, deleting, autosave', icon: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4', keywords: 'keyboard shortcuts phone keypad full screen confirm delete autosave forms drafts default view list grid' },
  { id: 'sync', label: 'Account & sync', hint: 'Sign in and sync your devices', icon: 'M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9M18.5 3.5v3.6h-3.6M5.5 20.5v-3.6h3.6', keywords: 'sign in sign out google account firebase sync devices cloud login' },
  { id: 'data', label: 'Your data', hint: 'Back up and restore', icon: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14', keywords: 'backup restore export import file data download' },
  { id: 'sound', label: 'Sound', hint: 'Effects, volume and style', icon: 'M5 9.5h3l4.5-4v13l-4.5-4H5zM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11', keywords: 'sound effects volume audio style pack mute' },
  { id: 'features', label: 'App features', hint: 'What each app can do', icon: 'M4 5h16v14H4zM4 10h16M9.5 5v14', keywords: 'features compare apps table drag drop folders search sync demo which app' },
  { id: 'about', label: 'About', hint: 'Version, what’s new, install', icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5.5M12 7.6v.1', keywords: 'about version what’s new changelog install app shortcuts help' }
]
const isSection = (h: string): h is SectionId => SECTIONS.some(s => s.id === h)

const route = useRoute()
const current = ref<SectionId>('appearance')
const find = ref('')
const found = computed(() => {
  const q = find.value.trim().toLowerCase()
  if (!q) return SECTIONS
  return SECTIONS.filter(s => `${s.label} ${s.hint} ${s.keywords}`.toLowerCase().includes(q))
})
// Typing jumps to the first section that matches
watch(found, (list) => {
  if (list.length && !list.some(s => s.id === current.value)) current.value = list[0]!.id
})

const panel = ref<HTMLElement>()
function open(id: SectionId) {
  if (id === current.value) return
  viewTransition(() => (current.value = id))
  history.replaceState(history.state, '', `#${id}`)
  sound.play('select')
  // On phones the section starts below the menu; bring its top into view
  if (matchMedia('(max-width: 900px)').matches) nextTick(() => panel.value?.scrollIntoView({ block: 'start' }))
}
function fromHash() {
  const h = route.hash.slice(1)
  if (isSection(h)) current.value = h
}
onMounted(fromHash)
watch(() => route.hash, fromHash)
const section = computed(() => SECTIONS.find(s => s.id === current.value)!)

// ---------- Sync with Firebase ----------
// Signing in uses the Passwords account; trackers then sync to Firestore under users/{uid}
const { vault, signOut } = useVault()
const gate = useSignInGate()
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

// ---------- Appearance ----------
const THEMES: { value: ThemePreference, label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' }
]
const themeChoice = computed({
  get: () => theme.preference,
  set: (value: ThemePreference) => {
    setTheme(value)
    toast(value === 'system' ? 'Following your device’s theme' : `${value === 'dark' ? 'Dark' : 'Light'} theme on`)
  }
})

const { prefs } = usePrefs()
const DENSITIES: { value: Density, label: string }[] = [
  { value: 'spacious', label: 'Spacious' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' }
]
// Accent: each app's own colour, or one of these everywhere
const ACCENTS = ['apps', 'blue', 'green', 'purple', 'teal', 'rust', 'slate', 'pink'] as const
function chooseAccent(a: string) {
  prefs.accent = a
  sound.play('select')
}
function chooseCube(value: Prefs['cubeColors']) {
  prefs.cubeColors = value
  sound.play('select')
}

// ---------- Performance ----------
// Low-spec PC mode bundles everything that keeps an old computer smooth; while it's on, the finer
// choices below it step aside
const { effects, setEffects } = useEffects()
const EFFECTS: { value: EffectsPreference, label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'full', label: 'Full' },
  { value: 'lite', label: 'Lite' }
]
const effectsChoice = computed({
  get: () => effects.preference,
  set: (value: EffectsPreference) => {
    setEffects(value)
    toast(value === 'lite' ? 'Lite effects on' : value === 'full' ? 'Full effects on' : 'Effects follow this computer’s speed')
  }
})
const MOTIONS: { value: MotionPreference, label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'full', label: 'On' },
  { value: 'reduced', label: 'Reduced' }
]
const lowSpec = computed({
  get: () => prefs.lowSpec,
  set: (on: boolean) => {
    prefs.lowSpec = on
    toast(on ? 'Low-spec PC mode on' : 'Low-spec PC mode off', { description: on ? 'No blur, no animations, no splash: pages show the moment they’re ready.' : undefined })
  }
})
const LOW_SPEC_DOES = [
  'Turns off blur and see-through glass, the hardest thing for an old graphics chip to draw',
  'Stops every animation and transition: pages, lists, menus and the home page cube',
  'Skips the splash screen and cross-fades, so each page shows as soon as it’s ready',
  'Draws ambient scenes as one still picture instead of moving'
]

// ---------- Behaviour ----------
const VIEWS: { value: Prefs['defaultView'], label: string }[] = [
  { value: 'list', label: 'List' },
  { value: 'grid', label: 'Grid' },
  { value: 'compact', label: 'Compact' }
]

// ---------- Sound ----------
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
  <ToolPage header="bar" width="1100px">
    <ClientOnly>
      <div class="settings">
        <nav v-sticky-fit class="snav" aria-label="Settings sections">
          <label class="find">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
            <input v-model="find" type="search" placeholder="Find a setting" aria-label="Find a setting">
          </label>
          <ul class="snav-list">
            <li v-for="s in found" :key="s.id">
              <button type="button" class="snav-item" :aria-current="current === s.id ? 'page' : undefined" @click="open(s.id)">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="s.icon" /></svg>
                <span class="snav-text">
                  <span class="snav-label">{{ s.label }}</span>
                  <span class="snav-hint">{{ s.hint }}</span>
                </span>
              </button>
            </li>
          </ul>
          <p v-if="!found.length" class="snav-empty">No setting matches “{{ find }}”.</p>
        </nav>

        <div ref="panel" class="sbody" :aria-labelledby="`h-${current}`">
          <header class="shead">
            <h2 :id="`h-${current}`">{{ section.label }}</h2>
            <p>{{ section.hint }}</p>
          </header>

          <!-- Appearance -->
          <div v-if="current === 'appearance'" class="group">
            <div class="panel rows">
              <SettingChoice v-model="themeChoice" title="Theme" :description="`Showing ${theme.resolved} mode. Press D anywhere to switch.`" :options="THEMES" />
              <div class="setting-choice">
                <div class="text">
                  <span class="title">Accent</span>
                  <span class="desc">Buttons and highlights. The first keeps each app’s own colour.</span>
                </div>
                <div class="accents" role="radiogroup" aria-label="Accent colour">
                  <label v-for="a in ACCENTS" :key="a" class="accent" :class="{ active: prefs.accent === a, apps: a === 'apps' }" :style="a === 'apps' ? undefined : { '--swatch': `var(--${a})` }" :title="a === 'apps' ? 'Each app’s own colour' : a">
                    <input type="radio" name="accent" :value="a" :checked="prefs.accent === a" :aria-label="a === 'apps' ? 'Each app’s own colour' : a" @change="chooseAccent(a)">
                  </label>
                </div>
              </div>
              <div class="setting-choice">
                <div class="text">
                  <span class="title">Cube colours</span>
                  <span class="desc">The stickers on the home page’s cube: classic Rubik’s colours, or each app’s own.</span>
                </div>
                <div class="segmented cube-colors" role="radiogroup" aria-label="Cube sticker colours">
                  <label :class="{ active: prefs.cubeColors === 'cube' }">
                    <input type="radio" name="cube-colors" value="cube" :checked="prefs.cubeColors === 'cube'" @change="chooseCube('cube')">
                    <span class="swatches" aria-hidden="true"><i style="background: #1f5bd8" /><i style="background: #f7c324" /><i style="background: #179a54" /></span>
                    Cube
                  </label>
                  <label :class="{ active: prefs.cubeColors === 'apps' }">
                    <input type="radio" name="cube-colors" value="apps" :checked="prefs.cubeColors === 'apps'" @change="chooseCube('apps')">
                    <span class="swatches" aria-hidden="true"><i style="background: var(--teal)" /><i style="background: var(--purple)" /><i style="background: var(--pink)" /></span>
                    Apps
                  </label>
                </div>
              </div>
              <SettingChoice v-model="prefs.density" title="Density" description="How much room lists and cards get. Compact fits more on screen." :options="DENSITIES" />
            </div>
          </div>

          <!-- Performance -->
          <div v-else-if="current === 'performance'" class="group">
            <section class="panel lowspec" :class="{ on: prefs.lowSpec }">
              <div class="lowspec-head">
                <span class="lowspec-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" /></svg></span>
                <SettingRow v-model="lowSpec" class="lowspec-row" title="Low-spec PC mode" description="Makes every app lighter, so it runs smoothly and quickly on an old or slow computer." />
              </div>
              <ul class="lowspec-list">
                <li v-for="d in LOW_SPEC_DOES" :key="d">{{ d }}</li>
              </ul>
              <p v-if="!prefs.lowSpec && effects.slowDevice" class="lowspec-tip">This computer looks slow. Low-spec mode should help.</p>
            </section>

            <div class="panel rows" :class="{ muted: prefs.lowSpec }" :inert="prefs.lowSpec">
              <p v-if="prefs.lowSpec" class="rows-note">Low-spec PC mode is on, so effects stay lite and animations stay off.</p>
              <SettingChoice v-model="effectsChoice" title="Effects" :description="`Lite turns off blur and background animation.${effects.preference === 'auto' ? ` This computer gets ${effects.slowDevice ? 'lite' : 'full'} effects.` : ''}`" :options="EFFECTS" />
              <SettingChoice v-model="prefs.motion" title="Animations" description="System follows your device’s reduce-motion setting." :options="MOTIONS" />
            </div>
          </div>

          <!-- Behaviour -->
          <div v-else-if="current === 'behaviour'" class="group">
            <div class="panel rows">
              <SettingRow v-model="prefs.shortcuts" title="Keyboard shortcuts" description="Single keys like A to add, D for dark mode and M for the menu. ⌘K / Ctrl+K always works." />
              <SettingRow v-model="prefs.confirmDelete" title="Confirm before delete" description="Ask for a second click before something goes to the Recycle Bin." />
              <SettingRow v-model="prefs.autosave" title="Autosave forms" description="Keep what you’ve typed into an Add form if you close it, so you can continue later." />
              <SettingChoice v-model="prefs.defaultView" title="Default view" description="How lists look until you pick a view for them." :options="VIEWS" />
            </div>
            <h3 class="sub">On phones</h3>
            <div class="panel rows">
              <SettingRow v-model="prefs.phoneKeyboard" title="App keyboards" description="Each app’s own keypad for numbers and prices, with its own keys (like amounts or network prefixes) on top." />
              <SettingRow v-if="prefs.phoneKeyboard" v-model="prefs.textKeyboard" title="App keyboard for text too" description="Type words on the app’s keyboard as well. Its 🌐 key switches to your phone’s keyboard for Khmer, emoji or voice." />
              <SettingRow v-model="prefs.phoneFullscreen" title="Full screen" description="Fill the whole screen, without the browser’s bars, from your first tap. Swipe back or use the menu to leave it for this visit." />
            </div>
          </div>

          <!-- Account & sync -->
          <div v-else-if="current === 'sync'" class="group">
            <div class="panel sync">
              <template v-if="!signedIn">
                <p>You’re not signed in, so your apps stay locked. Sign in to open them and sync them across your devices.</p>
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
          </div>

          <!-- Your data -->
          <div v-else-if="current === 'data'" class="group">
            <DataPanel v-if="gate.open.value" />
            <div v-else class="panel sync">
              <p>Sign in to back up or restore your data.</p>
              <button type="button" class="btn btn-sm" @click="open('sync')">Go to Account &amp; sync</button>
            </div>
          </div>

          <!-- Sound -->
          <div v-else-if="current === 'sound'" class="group">
            <section class="panel master">
              <span class="master-icon" :class="{ on: state.enabled }"><SoundIcon :name="state.enabled ? 'on' : 'off'" /></span>
              <div class="master-text">
                <h3 id="sound-label">Sound effects</h3>
                <p v-if="state.enabled">Short sounds when you navigate, copy, download and get results.</p>
                <p v-else>Sound is off. Turn it on to choose a style.</p>
              </div>
              <button type="button" role="switch" class="switch" :aria-checked="state.enabled" aria-labelledby="sound-label" @click="toggle">
                <span class="knob" />
              </button>
            </section>

            <div class="sound-options" :class="{ muted: !state.enabled }" :inert="!state.enabled">
              <label class="panel field volume">
                <span class="field-head">Volume <output>{{ volume }}%</output></span>
                <span class="slider">
                  <SoundIcon name="quiet" />
                  <input v-model.number="volume" type="range" min="0" max="100" step="5" @change="sound.play('volume-change')">
                  <SoundIcon name="loud" />
                </span>
              </label>

              <h3 class="sub">Style</h3>
              <div class="packs" role="radiogroup" aria-label="Sound style">
                <label v-for="pack in PACKS" :key="pack.name" class="pack" :class="{ active: state.pack === pack.name }" :style="{ '--pack': pack.color }">
                  <input type="radio" name="pack" :value="pack.name" :checked="state.pack === pack.name" @change="choosePack(pack.name)">
                  <span class="swatch" aria-hidden="true"><SoundIcon :name="pack.name" /></span>
                  <strong>{{ pack.label }}</strong>
                  <span class="desc">{{ pack.description }}</span>
                </label>
              </div>

              <h3 class="sub">Try it</h3>
              <div class="samples">
                <button v-for="s in SAMPLES" :key="s.cue" type="button" class="btn btn-quiet btn-sm" @click="trySample(s)">
                  <SoundIcon :name="s.cue" />
                  {{ s.label }}
                </button>
              </div>
            </div>
          </div>

          <!-- App features -->
          <div v-else-if="current === 'features'" class="group">
            <AppFeatures />
          </div>

          <!-- About -->
          <div v-else class="group">
            <AboutPanel />
          </div>
        </div>
      </div>

      <template #fallback>
        <div class="panel loading" aria-hidden="true" />
      </template>
    </ClientOnly>
  </ToolPage>
</template>

<style scoped>
.settings {
  width: 100%;
  display: grid;
  grid-template-columns: 16rem minmax(0, 1fr);
  gap: 2.5rem;
  align-items: start;
}

/* ---------- Section menu ---------- */
.snav {
  position: sticky;
  top: var(--pin-top);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.find {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.8rem;
  height: 2.6rem;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
}

.find:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
}

.find svg {
  flex: none;
  width: 1.05rem;
  height: 1.05rem;
  fill: none;
  stroke: var(--ink-3);
  stroke-width: 2;
  stroke-linecap: round;
}

.find input {
  flex: 1;
  min-width: 0;
  font: inherit;
  color: var(--ink);
  background: none;
  border: 0;
  outline: none;
}

.snav-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.snav-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0.7rem;
  font: inherit;
  text-align: left;
  color: var(--ink-2);
  background: none;
  border: 0;
  border-radius: 12px;
  cursor: pointer;
  transition: background-color 0.12s, color 0.12s;
}

.snav-item:hover {
  color: var(--ink);
  background: var(--surface-2);
}

.snav-item[aria-current='page'] {
  color: var(--ink);
  background: var(--surface);
  box-shadow: inset 3px 0 0 var(--accent), 0 0 0 1px var(--line);
}

.snav-item svg {
  flex: none;
  width: 1.25rem;
  height: 1.25rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.snav-item[aria-current='page'] svg {
  color: var(--accent);
}

.snav-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.snav-label {
  font-weight: 600;
}

.snav-hint {
  font-size: var(--text-xs);
  color: var(--ink-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.snav-empty {
  margin: 0;
  padding: 0 0.7rem;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

/* ---------- Section ---------- */
.sbody {
  min-width: 0;
  scroll-margin-top: calc(var(--pin-top) + 4rem);
}

.shead {
  margin-bottom: 1.1rem;
}

.shead h2 {
  font-size: 1.5rem;
  letter-spacing: -0.02em;
}

.shead p {
  margin: 0.15rem 0 0;
  color: var(--ink-2);
}

.group {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sub {
  margin: 0.75rem 0 -0.25rem;
  font-size: 0.95rem;
  color: var(--ink-2);
}

/* Settings rows share one card, divided by lines */
.rows {
  padding: 0 1.1rem;
}

.rows > :deep(:first-child) {
  border-top: 0;
}

.rows-note {
  margin: 0;
  padding: 0.85rem 0 0;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-2);
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

.cube-colors label {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.swatches {
  display: inline-flex;
}

.swatches i {
  width: 0.65rem;
  height: 0.65rem;
  margin-left: -0.15rem;
  border-radius: 3px;
  box-shadow: 0 0 0 1.5px var(--surface);
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

/* ---------- Low-spec PC mode ---------- */
.lowspec {
  padding: 0.4rem 1.1rem 1.1rem;
  transition: border-color 0.2s;
}

.lowspec.on {
  border-color: var(--green);
  box-shadow: 0 0 0 1px var(--green);
}

.lowspec-head {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.lowspec-icon {
  flex: none;
  width: 2.75rem;
  height: 2.75rem;
  display: grid;
  place-items: center;
  color: var(--ink-2);
  background: var(--surface-2);
  border-radius: 12px;
  transition: color 0.2s, background-color 0.2s;
}

.lowspec.on .lowspec-icon {
  color: #fff;
  background: var(--green);
}

.lowspec-icon svg {
  width: 1.4rem;
  height: 1.4rem;
  fill: currentColor;
}

.lowspec-row {
  flex: 1;
  border-top: 0;
}

.lowspec-list {
  margin: 0.25rem 0 0;
  padding: 0 0 0 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.lowspec-tip {
  margin: 0.8rem 0 0;
  padding: 0.6rem 0.8rem;
  font-size: var(--text-sm);
  font-weight: 600;
  background: color-mix(in srgb, var(--yellow) 18%, var(--surface));
  border-radius: 10px;
}

/* ---------- Account ---------- */
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

/* ---------- Sound ---------- */
.sound-options {
  display: flex;
  flex-direction: column;
  gap: 1rem;
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
  width: 100%;
  height: 24rem;
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
  padding: 1.1rem 1.4rem;
}

.slider {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--ink-2);
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

/* ---------- Phones and narrow windows: the menu becomes a row of chips across the top ---------- */
@media (max-width: 900px) {
  .settings {
    grid-template-columns: minmax(0, 1fr);
    gap: 1.25rem;
  }

  .snav {
    position: static;
  }

  .snav-list {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .snav-item {
    width: auto;
    gap: 0.4rem;
    padding: 0.45rem 0.75rem;
    background: var(--surface);
    border-radius: 999px;
    box-shadow: 0 0 0 1px var(--line);
  }

  .snav-item[aria-current='page'] {
    color: var(--on-accent, #fff);
    background: var(--accent);
    box-shadow: none;
  }

  .snav-item[aria-current='page'] svg {
    color: inherit;
  }

  .snav-item svg {
    width: 1rem;
    height: 1rem;
  }

  .snav-hint {
    display: none;
  }
}

@media (max-width: 640px) {
  .packs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (prefers-reduced-motion: reduce) {
  .pack.active .swatch { transform: none; }
}
</style>
