<script setup lang="ts">
import type { Tool } from '~/utils/tools'

// Pages listed in TOOLS are found by route; other pages pass their own `tool`
// hero: big centred header (single-purpose tools)
// bar: compact left-aligned header so the workspace starts high (editors, studios)
// band: full-width coloured band (collections)
// none: no header; the page draws its own (the CV's landing-page hero)
type Header = 'hero' | 'bar' | 'band' | 'none'

// siteBar: false leaves out the app's top bar, for a page with a nav of its own (the CV)
const props = withDefaults(defineProps<{ width?: string, tool?: Tool, header?: Header, siteBar?: boolean }>(), { width: 'var(--page-width)', tool: undefined, header: 'hero', siteBar: true })

const route = useRoute()
const tool = computed(() => props.tool ?? toolFor(route.path)!)

// Search titles are worded the way people search ("Cambodian phone number checker"); the page heading keeps the short name
useHead({ title: () => tool.value.seoTitle ?? tool.value.name })

// Pages that aren't real apps stay out of search results
const listed = computed(() => !!toolFor(route.path))
const site = useSiteUrl()
const seo = useAppSeo(() => ({
  title: `${tool.value.seoTitle ?? tool.value.name} · Ousa’s Apps`,
  description: tool.value.description ?? tool.value.summary,
  path: route.path,
  image: listed.value ? undefined : 'home',
  noindex: !listed.value,
  jsonLd: listed.value
    ? {
        '@type': 'WebApplication',
        'name': tool.value.seoTitle ?? tool.value.name,
        'alternateName': tool.value.name,
        'description': tool.value.description ?? tool.value.summary,
        'applicationCategory': tool.value.group === 'Life' ? 'LifestyleApplication' : 'UtilitiesApplication',
        'operatingSystem': 'Any (web browser)',
        'offers': { '@type': 'Offer', 'price': '0', 'priceCurrency': 'USD' },
        'isPartOf': { '@type': 'WebSite', 'name': 'Ousa’s Apps', 'url': `${site}/` }
      }
    : undefined
}))
void seo

// Tab icon: the app's own icon as a cube sticker (its colour on black plastic). Built from the
// icon already drawn in the header, so it always matches; the home page keeps its cube.
const stickerEl = ref<HTMLElement | { $el: HTMLElement }>()
// app.vue owns the favicon tag; pages hand it their icon through this shared state
const appFavicon = useState<string | null>('app-favicon', () => null)
onBeforeUnmount(() => (appFavicon.value = null))
onMounted(() => {
  const el = stickerEl.value && '$el' in stickerEl.value ? stickerEl.value.$el : stickerEl.value
  const icon = el?.querySelector('svg')
  if (!icon) return
  const css = getComputedStyle(document.documentElement)
  // Tool colours are CSS variables like var(--teal); a favicon needs the real value
  const resolve = (c: string) => c.replace(/var\((--[\w-]+)\)/g, (_, name: string) => css.getPropertyValue(name).trim())
  const fill = resolve(tool.value.color)
  const ink = resolve(tool.value.onColor ?? '#ffffff')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">`
    + `<rect width="32" height="32" rx="8" fill="#1b1f2a"/>`
    + `<rect x="2" y="2" width="28" height="28" rx="6.5" fill="${fill}"/>`
    + `<g transform="translate(5.2 5.2) scale(0.9)" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="color:${ink}">${icon.innerHTML}</g>`
    + `</svg>`
  appFavicon.value = `data:image/svg+xml,${encodeURIComponent(svg)}`
})

// ---------- Version and what's new ----------
const releases = computed(() => releasesFor(route.path))
const latest = computed(() => releases.value[0])
const whatsNewOpen = ref(false)
// "New" for a week after an app's latest release, until you open What's new to see it
const NEW_FOR_MS = 7 * 86_400_000
const seenVersions = useRemembered<Record<string, string>>('whats-new-seen', {}, v => !!v && typeof v === 'object' && !Array.isArray(v))
const recent = ref(false)
onMounted(() => {
  if (latest.value) recent.value = Date.now() - new Date(`${latest.value.date}T00:00:00`).getTime() < NEW_FOR_MS
})
const isNew = computed(() => recent.value && !!latest.value && seenVersions.value[route.path] !== latest.value.version)
const releaseDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
// This app's own settings, when the page has any (#settings slot)
const slots = useSlots()
// Shared so a page can open its own settings too (Notes' "Notes settings" link); closed when the page goes
const settingsOpen = useAppSettingsOpen()
onBeforeUnmount(() => (settingsOpen.value = false))
// Listed apps always have settings, if only Import & export; pages that save nothing (the CV) don't
const hasSettings = computed(() => !!slots.settings || (TOOLS.some(t => t.to === route.path) && !tool.value.readOnly))
function openSettings() {
  settingsOpen.value = true
  play('open')
}

function openWhatsNew() {
  whatsNewOpen.value = true
  if (latest.value) seenVersions.value = { ...seenVersions.value, [route.path]: latest.value.version }
  play('open')
}

// Pin this app to the top of the menu, home page and palette (CHECKLIST.md #09)
const { prefs } = usePrefs()
const pinnable = computed(() => TOOLS.some(t => t.to === route.path))
const pinned = computed(() => prefs.pinnedApps.includes(route.path))
// One accent everywhere, if chosen in Settings (after hydration, so the server's colours match first)
const hydrated = useHydrated()
const accent = computed(() => (hydrated.value && prefs.accent !== 'apps'
  ? { override: true, color: `var(--${prefs.accent})`, on: '#fff' }
  : { override: false, color: tool.value.color, on: tool.value.onColor ?? '#fff' }))

// Demo: on pages that have one, the app icon switches sample data on and off
const demo = useDemoState(route.path)
const { play } = useSound()
function toggleDemo() {
  demo.active.value = !demo.active.value
  play(demo.active.value ? 'toggle-on' : 'toggle-off')
}

</script>

<template>
  <main class="tool" :class="`header-${header}`" :style="{ '--accent': tool.color, '--sticker': tool.gradient, '--accent-btn': tool.buttonColor, '--on-accent': tool.onColor ?? '#fff', '--width': props.width }">
    <SiteBar v-if="siteBar" back />

    <header v-if="header !== 'none'" class="head">
      <button
        v-if="demo.supported.value"
        ref="stickerEl"
        type="button"
        class="sticker demo-toggle"
        :class="{ on: demo.active.value }"
        :aria-pressed="demo.active.value"
        :aria-label="demo.active.value ? 'Example on: go back to your own data' : `See example: show ${tool.name} with example data`"
        :title="demo.active.value ? 'Go back to your own data' : 'See how it looks with example data'"
        @click="toggleDemo"
      >
        <ToolIcon :name="tool.icon" />
        <span class="demo-tag" aria-hidden="true">
          <svg viewBox="0 0 12 12"><path v-if="demo.active.value" d="M3.5 2.5h1.75v7H3.5zM6.75 2.5H8.5v7H6.75z" /><path v-else d="M4 2.25v7.5L9.75 6z" /></svg>
        </span>
      </button>
      <span v-else ref="stickerEl" class="sticker" aria-hidden="true"><ToolIcon :name="tool.icon" /></span>
      <div class="head-text">
        <h1>{{ tool.name }}</h1>
        <p>{{ tool.summary }}</p>
        <div class="head-meta">
        <button v-if="latest" type="button" class="version" @click="openWhatsNew">
          <span>v{{ latest.version }}</span>
          <ClientOnly><span v-if="isNew" class="version-new">New</span></ClientOnly>
          <span class="version-more"><span class="sr-only">, see </span>What’s new</span>
        </button>
        <ClientOnly>
          <button
            v-if="pinnable"
            type="button"
            class="pin"
            :class="{ on: pinned }"
            :aria-pressed="pinned"
            :title="pinned ? 'Unpin from the top of the menu' : 'Pin to the top of the menu and home page'"
            @click="togglePinnedApp(route.path)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6l-1 5 3 3v2H7v-2l3-3zM12 14v6" /></svg>
            {{ pinned ? 'Pinned' : 'Pin' }}
          </button>
        </ClientOnly>
        <button v-if="hasSettings" type="button" class="pin gear" :title="`${tool.name} settings`" @click="openSettings">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M6 18l1.4-1.4M16.6 7.4L18 6" /></svg>
          Settings
        </button>
        </div>
      </div>
      <div v-if="$slots.actions" class="head-actions"><slot name="actions" /></div>
      <!-- The band's artwork: the app's icon drawn large and faint behind the header -->
      <ToolIcon v-if="header === 'band'" :name="tool.icon" class="band-art" aria-hidden="true" />
    </header>

    <Modal v-if="hasSettings" :open="settingsOpen" :title="`${tool.name} settings`" @close="settingsOpen = false">
      <template v-if="slots.settings">
        <div class="app-settings">
          <slot name="settings" />
        </div>
        <p class="app-settings-note">Saved on this device. They set where {{ tool.name }} starts; you can still change things on the page.</p>
      </template>
      <!-- Every app can take its data and settings out to a file and bring them back -->
      <section v-if="pinnable" class="app-data" aria-label="Import and export">
        <h3 class="app-data-head">Import &amp; export</h3>
        <DataPanel v-if="settingsOpen" :app="route.path" :app-name="tool.name" />
        <!-- Apps with formats of their own (CSV, browser bookmarks, Markdown) open them from here -->
        <div v-if="slots.transfer" class="app-data-more">
          <slot name="transfer" />
        </div>
      </section>
    </Modal>

    <Modal :open="whatsNewOpen" :title="`What’s new in ${tool.name}`" @close="whatsNewOpen = false">
      <ol class="releases">
        <li v-for="(r, i) in releases" :key="r.version" class="release" :class="{ current: i === 0 }">
          <div class="release-head">
            <strong>Version {{ r.version }}</strong>
            <span v-if="i === 0" class="release-tag">Current</span>
            <time :datetime="r.date">{{ releaseDate(r.date) }}</time>
          </div>
          <ul>
            <li v-for="c in r.changes" :key="c">{{ c }}</li>
          </ul>
        </li>
      </ol>
    </Modal>

    <!-- The header keeps the app's own colour; buttons and highlights can use one accent everywhere -->
    <div class="body" :style="accent.override ? { '--accent': accent.color, '--accent-btn': `var(--${prefs.accent}-btn, ${accent.color})`, '--on-accent': accent.on } : undefined">
      <p v-if="demo.active.value" class="demo-banner" role="status">
        <span><strong>This is example data.</strong> Explore freely: changes here aren’t saved, and your own data is untouched.</span>
        <button type="button" class="btn btn-sm" @click="toggleDemo">Back to my data</button>
      </p>
      <slot />
    </div>
  </main>
</template>

<style scoped>
.tool {
  --gutter: clamp(1rem, 4vw, 3rem);
  min-height: 100dvh;
  padding: 1rem var(--gutter) 7rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.head {
  margin: 2rem 0 2.5rem;
  max-width: 34rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.sticker {
  width: 3.5rem;
  height: 3.5rem;
  display: grid;
  place-items: center;
  font-size: 2rem;
  color: var(--on-accent);
  background: var(--sticker, var(--accent));
  border-radius: 14px;
  /* Glossy sticker on black plastic, like the cube */
  box-shadow:
    0 0 0 4px var(--plastic),
    0 0 0 5px var(--plastic-edge),
    inset 0 -6px 0 rgb(0 0 0 / 0.12),
    inset 0 6px 10px rgb(255 255 255 / 0.25);
}

/* ---------- Demo switch: the app icon itself ---------- */
.demo-toggle {
  position: relative;
  padding: 0;
  border: 0;
  font-family: inherit;
  cursor: pointer;
  transition: scale 0.15s, translate 0.15s;
}

.demo-toggle:hover {
  translate: 0 -1px;
}

.demo-toggle:active {
  scale: 0.96;
}

.demo-toggle:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--ink) 40%, transparent);
  outline-offset: 7px;
}

/* A small play / pause badge on the icon's corner says it can be pressed: play shows the example, pause stops it */
.demo-tag {
  position: absolute;
  right: -0.55rem;
  bottom: -0.55rem;
  width: 1.3rem;
  height: 1.3rem;
  display: grid;
  place-items: center;
  color: var(--ink);
  background: var(--surface);
  border-radius: 999px;
  box-shadow: 0 0 0 1px var(--line), 0 2px 6px rgb(var(--shadow) / 0.15);
  transition: scale 0.15s;
}

.demo-tag svg {
  width: 0.7rem;
  height: 0.7rem;
  fill: currentColor;
}

.demo-toggle:hover .demo-tag {
  scale: 1.1;
}

.demo-toggle.on .demo-tag {
  color: #fff;
  background: var(--purple);
  box-shadow: 0 0 0 2px var(--bg), 0 2px 6px rgb(var(--shadow) / 0.2);
}

/* While the demo is on, the icon gets a dashed ring so it reads as "switched" */
.demo-toggle.on {
  box-shadow:
    0 0 0 4px var(--plastic),
    0 0 0 5px var(--plastic-edge),
    0 0 0 8px var(--bg),
    0 0 0 10px var(--purple),
    inset 0 -6px 0 rgb(0 0 0 / 0.12),
    inset 0 6px 10px rgb(255 255 255 / 0.25);
}

.demo-banner {
  width: 100%;
  margin: 0 0 1.5rem;
  padding: 0.75rem 0.75rem 0.75rem 1.1rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem 1rem;
  font-size: 0.925rem;
  color: var(--ink);
  background: color-mix(in srgb, var(--purple) 12%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--purple) 35%, transparent);
  border-radius: 16px;
}

.demo-banner .btn {
  --accent: var(--purple);
  --on-accent: #fff;
}

h1 {
  margin-top: 1.5rem;
  font-size: clamp(2.25rem, 7vw, 3.5rem);
  font-weight: 800;
  letter-spacing: -0.035em;
  font-variation-settings: 'opsz' 96;
}

.head p {
  margin: 0.75rem 0 0;
  font-size: 1.1rem;
  color: var(--ink-2);
}

.head-text {
  display: flex;
  flex-direction: column;
  align-items: inherit;
}

/* Version and Pin sit side by side, the same height */
.head-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: inherit;
  gap: 0.4rem;
  margin-top: 0.75rem;
}

.header-bar .head-meta {
  margin-top: 0.45rem;
}

.head-meta:empty {
  display: none;
}

.pin {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  height: 1.6rem;
  padding: 0 0.6rem 0 0.45rem;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--ink-3);
  background: none;
  border: 1px solid var(--line);
  border-radius: 999px;
  cursor: pointer;
  transition: color var(--dur-fast), border-color var(--dur-fast), background-color var(--dur-fast);
}

.pin:hover {
  color: var(--ink);
  border-color: var(--ink-3);
}

.pin.on {
  color: var(--ink);
  background: var(--surface);
}

.pin svg {
  width: 0.85rem;
  height: 0.85rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.pin.on svg {
  fill: currentColor;
}

/* ---------- This app's settings ---------- */
.app-settings {
  display: flex;
  flex-direction: column;
}

/* Rows (SettingRow, SettingChoice) with a hairline between them */
.app-settings > :deep(* + *) {
  border-top: 1px solid var(--line);
}

.app-settings :deep(.settings-head) {
  margin: 1rem 0 0;
  padding-top: 1rem;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.app-settings :deep(.settings-head:first-child) {
  margin-top: 0;
  padding-top: 0;
}

.app-settings :deep(.settings-head + *) {
  border-top: 0;
}

/* A typed setting (a number, a key): title, explanation, then the field */
.app-settings :deep(.setting-field) {
  display: grid;
  gap: 0.2rem;
  padding: 0.85rem 0;
}

.app-settings :deep(.setting-field .title) {
  font-weight: 600;
}

.app-settings :deep(.setting-field .desc) {
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.app-settings :deep(.setting-field .input) {
  margin-top: 0.35rem;
}

.app-settings :deep(.setting-field input[type='color']) {
  width: 4.5rem;
  height: 2.5rem;
  padding: 0.25rem;
  cursor: pointer;
}

.app-settings-note {
  margin: 0.75rem 0 0;
  font-size: var(--text-sm);
  color: var(--ink-3);
}

.app-data {
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid var(--line);
}

.app-data:first-child {
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
}

.app-data-more {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  margin-top: 1rem;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.app-data-head {
  margin: 0 0 0.75rem;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.header-band .pin {
  color: inherit;
  opacity: 0.85;
  border-color: color-mix(in srgb, currentColor 30%, transparent);
}

.header-band .pin.on {
  background: color-mix(in srgb, currentColor 12%, transparent);
}

.body {
  width: 100%;
  max-width: var(--width);
}

/* ---------- Bar: compact, left-aligned, workspace starts high ---------- */
.header-bar .head {
  width: 100%;
  max-width: var(--width);
  margin: 1.25rem 0 2rem;
  flex-direction: row;
  align-items: center;
  gap: 1.1rem;
  text-align: left;
}

.header-bar .head-text {
  align-items: flex-start;
}

.header-bar .sticker {
  flex: none;
  width: 3rem;
  height: 3rem;
  font-size: 1.6rem;
  border-radius: 12px;
}

.header-bar h1 {
  margin-top: 0;
  font-size: clamp(1.75rem, 4vw, 2.4rem);
}

.header-bar .head p {
  margin-top: 0.2rem;
  font-size: 1rem;
}

.head-actions {
  margin-left: auto;
}

/* ---------- Band: full-width colour band; content overlaps its lower edge ----------
   Depth from two soft glows on the app colour, a fine dot grid fading in from the right, and the
   app's icon drawn large and faint behind it. */
.header-band .head {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  width: calc(100% + var(--gutter) * 2);
  max-width: none;
  margin: 1rem calc(var(--gutter) * -1) 0;
  padding: 3rem max(var(--gutter), calc((100% + var(--gutter) * 2 - var(--width)) / 2)) 5rem;
  flex-direction: row;
  align-items: center;
  gap: 1.5rem;
  text-align: left;
  color: var(--on-accent);
  background:
    radial-gradient(90% 140% at 100% 0%, color-mix(in srgb, var(--accent) 70%, #fff) 0%, transparent 55%),
    radial-gradient(70% 120% at 0% 100%, color-mix(in srgb, var(--accent) 60%, #000) 0%, transparent 65%),
    var(--accent);
}

.header-band .head::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background-image: radial-gradient(rgb(255 255 255 / 0.18) 1px, transparent 1.6px);
  background-size: 18px 18px;
  mask-image: linear-gradient(100deg, transparent 35%, #000 85%);
  pointer-events: none;
}

.band-art {
  position: absolute;
  z-index: -1;
  right: max(var(--gutter), calc((100% - var(--width)) / 2 + 2rem));
  bottom: -2.5rem;
  font-size: 15rem;
  color: #fff;
  opacity: 0.1;
  rotate: -12deg;
  pointer-events: none;
}

.header-band .head-text {
  align-items: flex-start;
}

.header-band .sticker {
  flex: none;
  width: 4.25rem;
  height: 4.25rem;
  font-size: 2.4rem;
  color: var(--accent);
  background: var(--surface);
}

.header-band h1 {
  margin-top: 0;
  font-size: clamp(2.25rem, 6vw, 3.75rem);
  line-height: 1.05;
}

.header-band .head p {
  margin-top: 0.5rem;
  color: inherit;
  opacity: 0.9;
}

.header-band .head-actions {
  align-self: center;
}

/* The page's quiet buttons turn to frosted glass on the colour */
.header-band .head-actions :deep(.btn-quiet) {
  color: var(--on-accent);
  background: rgb(255 255 255 / 0.14);
  border-color: rgb(255 255 255 / 0.3);
  box-shadow: none;
  backdrop-filter: blur(6px);
}

.header-band .head-actions :deep(.btn-quiet:hover) {
  background: rgb(255 255 255 / 0.24);
}

.header-band .body {
  /* Above the band (it's a stacking context for its artwork), overlapping its lower edge */
  position: relative;
  z-index: 1;
  margin-top: -2.75rem;
}

/* ---------- Version: a small pill under the summary that opens what's new ---------- */
.version {
  display: inline-flex;
  align-items: center;
  height: 1.6rem;
  padding: 0 0.6rem;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--ink-2);
  background: color-mix(in srgb, currentColor 6%, transparent);
  border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
  border-radius: 999px;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;
}

.version:hover {
  color: var(--ink);
  border-color: color-mix(in srgb, currentColor 35%, transparent);
}

.version:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* "What's new" only appears on hover, so the pill stays small */
.version-new {
  margin-left: 0.4rem;
}

.version-more {
  max-width: 0;
  overflow: hidden;
  white-space: nowrap;
  opacity: 0;
  transition: max-width 0.25s cubic-bezier(0.2, 0, 0, 1), opacity 0.2s;
}

.version:hover .version-more,
.version:focus-visible .version-more {
  max-width: 6rem;
  margin-left: 0.4rem;
  opacity: 1;
}

.version-new {
  padding: 0 0.4rem;
  font-size: 0.7rem;
  font-weight: 700;
  color: #fff;
  background: var(--good-ink-solid, #127a43);
  border-radius: 999px;
}

/* On the coloured band it takes the band's text colour */
.header-band .version {
  color: inherit;
}

.header-band .version:hover {
  color: inherit;
  opacity: 1;
}


/* ---------- What's new list ---------- */
.releases {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: min(60vh, 32rem);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.release {
  position: relative;
  padding: 0 0 1.1rem 1.4rem;
  border-left: 2px solid var(--line);
  margin-left: 0.4rem;
}

.release:last-child {
  padding-bottom: 0.2rem;
  border-left-color: transparent;
}

/* A dot on the timeline for each release; the current one in the app's colour */
.release::before {
  content: '';
  position: absolute;
  left: -0.45rem;
  top: 0.25rem;
  width: 0.8rem;
  height: 0.8rem;
  border-radius: 50%;
  background: var(--surface);
  border: 2px solid var(--line);
}

.release.current::before {
  background: var(--accent);
  border-color: var(--accent);
}

.release-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.release-head strong {
  font-size: 0.95rem;
}

.release-tag {
  padding: 0.05rem 0.45rem;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--on-accent);
  background: var(--accent);
  border-radius: 999px;
}

.release-head time {
  margin-left: auto;
  font-size: 0.8rem;
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}

.release ul {
  margin: 0.45rem 0 0;
  padding-left: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.9rem;
  color: var(--ink-2);
}

@media (prefers-reduced-motion: reduce) {
  .version-more { transition: none; }
}

/* Phones: one compact header for every style. The icon sits beside the name, the summary and
   pills run underneath, and the page's own buttons follow, so the app starts on the first screen. */
@media (max-width: 640px) {
  .head,
  .header-bar .head,
  .header-band .head {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0 0.9rem;
    text-align: left;
  }

  .head {
    width: 100%;
    margin: 1rem 0 1.75rem;
  }

  .header-band .head {
    width: calc(100% + var(--gutter) * 2);
    margin-top: 0.75rem;
    padding: 1.75rem var(--gutter) 4rem;
  }

  .band-art {
    right: -1.5rem;
    bottom: auto;
    top: -1.5rem;
    font-size: 10rem;
  }

  /* Name, summary and pills join the header's grid */
  .head-text {
    display: contents;
  }

  .sticker,
  .header-bar .sticker,
  .header-band .sticker {
    grid-column: 1;
    grid-row: 1;
    width: 2.75rem;
    height: 2.75rem;
    font-size: 1.5rem;
    border-radius: 11px;
  }

  h1,
  .header-bar h1,
  .header-band h1 {
    grid-column: 2;
    grid-row: 1;
    margin: 0;
    font-size: clamp(1.75rem, 8vw, 2.25rem);
    line-height: 1.1;
  }

  .head p,
  .header-bar .head p,
  .header-band .head p {
    grid-column: 1 / -1;
    margin-top: 0.75rem;
    font-size: 1rem;
  }

  .head-meta,
  .head-actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }

  .head-actions {
    margin: 1rem 0 0;
  }
}
</style>
