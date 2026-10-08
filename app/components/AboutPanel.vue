<script setup lang="ts">
import { toast } from 'vue-sonner'

// Settings → About (CHECKLIST.md #31, #32): the app's version, installing it, what's new across every
// app, and the keyboard shortcuts. Opening it marks the latest release as seen (the "New" dot in the menu).
const { installed, canPrompt, ios, install } = useInstall()
const { play } = useSound()
const releases = allReleases()
const showAll = ref(false)
const shown = computed(() => (showAll.value ? releases : releases.slice(0, 6)))

onMounted(() => markReleaseSeen())

async function doInstall() {
  const ok = await install()
  play(ok ? 'success' : 'select')
  if (ok) toast.success('Installed', { description: 'Open Ousa’s Apps from your home screen or app list.' })
}

const when = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const isMac = ref(false)
onMounted(() => (isMac.value = /Mac|iPhone|iPad/.test(navigator.platform)))
const mod = computed(() => (isMac.value ? '⌘' : 'Ctrl'))

const SHORTCUTS = computed(() => [
  { keys: [mod.value, 'K'], what: 'Search everything and run commands' },
  { keys: ['A'], what: 'Add something on this page, or choose what to add' },
  { keys: ['M'], what: 'Open the menu; then a letter opens an app' },
  { keys: ['0', '–', '9'], what: 'Jump to an app by its number' },
  { keys: ['[', ']'], what: 'Previous or next app' },
  { keys: ['/'], what: 'Search this page’s list (where it has one)' },
  { keys: ['D'], what: 'Switch dark and light mode' },
  { keys: ['Enter'], what: 'Save a form, or open the first search result' },
  { keys: ['Esc'], what: 'Close a popup or menu, then go back' },
  { keys: ['Alt', '↑↓'], what: 'Move a pinned item while it’s focused' }
])
</script>

<template>
  <div class="about">
    <section class="panel block" aria-labelledby="about-app">
      <div class="app-row">
        <AppLogo class="logo" />
        <div class="app-text">
          <h3 id="about-app">Ousa’s Apps</h3>
          <span class="note">Version {{ APP_VERSION }}</span>
        </div>
        <ClientOnly>
          <span v-if="installed" class="badge good">Installed</span>
          <button v-else-if="canPrompt" type="button" class="btn btn-sm" @click="doInstall">Install app</button>
        </ClientOnly>
      </div>
      <ClientOnly>
        <p v-if="!installed && !canPrompt" class="note install-help">
          <template v-if="ios">To install it on this iPhone or iPad, tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</template>
          <template v-else>Install it from your browser’s menu (Install app, or Add to Home screen) to open it like any other app, even offline.</template>
        </p>
      </ClientOnly>
    </section>

    <section class="panel block" aria-labelledby="about-new">
      <h3 id="about-new">What’s new</h3>
      <ol class="releases">
        <li v-for="r in shown" :key="`${r.app}-${r.version}`" class="release">
          <span class="rel-icon" aria-hidden="true" :style="{ '--c': pageFor(r.app)?.color ?? 'var(--plastic)', '--on-c': pageFor(r.app)?.onColor ?? '#fff' }">
            <AppLogo v-if="!r.app" />
            <ToolIcon v-else :name="pageFor(r.app)?.icon ?? 'list'" />
          </span>
          <div class="rel-text">
            <div class="rel-head">
              <component :is="r.app ? 'NuxtLink' : 'strong'" :to="r.app || undefined" class="rel-name">{{ r.app ? pageFor(r.app)?.name ?? r.app : 'Everywhere' }}</component>
              <span class="badge">v{{ r.version }}</span>
              <time :datetime="r.date">{{ when(r.date) }}</time>
            </div>
            <ul>
              <li v-for="c in r.changes" :key="c">{{ c }}</li>
            </ul>
          </div>
        </li>
      </ol>
      <button v-if="releases.length > 6" type="button" class="btn btn-quiet btn-sm" @click="showAll = !showAll">{{ showAll ? 'Show less' : `Show all ${releases.length} updates` }}</button>
    </section>

    <section class="panel block" aria-labelledby="about-keys">
      <h3 id="about-keys">Keyboard shortcuts</h3>
      <dl class="keys">
        <template v-for="k in SHORTCUTS" :key="k.what">
          <dt><kbd v-for="key in k.keys" :key="key">{{ key }}</kbd></dt>
          <dd>{{ k.what }}</dd>
        </template>
      </dl>
    </section>
  </div>
</template>

<style scoped>
.about {
  display: grid;
  gap: 1rem;
}

.block {
  padding: 1.1rem 1.25rem;
}

h3 {
  font-size: 1.05rem;
}

.note {
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.app-row {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.logo {
  font-size: 2.4rem;
}

.app-text {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.install-help {
  margin: 0.75rem 0 0;
}

.releases {
  margin: 0.75rem 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.9rem;
}

.release {
  display: flex;
  gap: 0.75rem;
}

.rel-icon {
  flex: none;
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  font-size: 1rem;
  color: var(--on-c);
  background: var(--c);
  border-radius: 9px;
}

.rel-text {
  min-width: 0;
  flex: 1;
}

.rel-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem 0.5rem;
}

.rel-name {
  font-weight: 700;
  color: var(--ink);
  text-decoration: none;
}

a.rel-name:hover {
  text-decoration: underline;
}

time {
  font-size: var(--text-sm);
  color: var(--ink-3);
}

.rel-text ul {
  margin: 0.3rem 0 0;
  padding-left: 1.1rem;
  font-size: 0.925rem;
  color: var(--ink-2);
}

.keys {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.55rem 1rem;
  margin: 0.75rem 0 0;
  align-items: baseline;
}

.keys dt {
  display: flex;
  gap: 0.2rem;
  white-space: nowrap;
}

.keys dd {
  margin: 0;
  color: var(--ink-2);
}
</style>
