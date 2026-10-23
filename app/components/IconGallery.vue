<script setup lang="ts">
import { toast } from 'vue-sonner'
import appIcons from '#build/app-icons.mjs'
import builtUsage from '#build/app-icons-usage.mjs'
import type { ToolIconName } from '~/utils/tools'

// Settings → Logos & icons: every icon and logo the apps show, and where, and the animated icons
// (AnimatedIconGallery) to copy. Line icons are Lucide
// (@iconify-json/lucide, <AppIcon>), brand logos Simple Icons (simple-icons, <BrandLogo>). Where each one
// is used comes from modules/app-icons.ts, which reads the code at build time: the file and line, and the
// apps that end up showing it. Search covers the whole of each set, used or not.
type Spot = [file: string, line: number]
// Written by modules/app-icons.ts
const usage = builtUsage as {
  icons: Record<string, Spot[]>
  logos: Record<string, Spot[]>
  brands: { name: string, domain: string, brand?: string, logo?: string, at: Spot }[]
  drawn: { google: Spot[], phoneBrands: Spot[] }
  pages: Record<string, string[]>
}
const { play } = useSound()
type Kind = 'icons' | 'logos' | 'animated'
const kind = ref<Kind>('icons')
const KINDS: { value: Kind, label: string }[] = [
  { value: 'icons', label: 'Icons' },
  { value: 'logos', label: 'Logos' },
  { value: 'animated', label: 'Animated' }
]
const query = ref('')
const appFilter = ref('')

// ---------- Apps ----------
interface App { key: string, name: string, to?: string }
const ALL_APPS = [...TOOLS, SETTINGS, TRASH]
// A page ('/renewals') as the app it belongs to; '*' is what every page has (menus, search, sign-in)
function appOf(route: string): App | undefined {
  if (route === '*') return { key: '*', name: 'Every app' }
  if (route === '/') return { key: '/', name: 'Home', to: '/' }
  if (route.startsWith('/og-card')) return undefined
  const own = ALL_APPS.find(t => t.to === route)
  if (own && !own.app) return { key: route, name: own.name, to: route }
  const parent = TOOLS.find(t => t.tabs?.some(tab => tab.to === route))
  const tab = parent?.tabs?.find(x => x.to === route)
  if (parent && tab) return { key: route, name: `${parent.name}: ${tab.label}`, to: route }
  return { key: route, name: route.slice(1), to: route }
}
const pagesOf = (spots: Spot[]) => [...new Set(spots.flatMap(([f, l]) => usage.pages[`${f}:${l}`] ?? []))]
function appsOf(spots: Spot[]) {
  const pages = pagesOf(spots)
  // Shown everywhere: that says it all
  const apps = (pages.includes('*') ? ['*'] : pages).map(appOf).filter((a): a is App => !!a)
  return apps.sort((a, b) => (a.key === '*' ? -1 : b.key === '*' ? 1 : a.name.localeCompare(b.name)))
}
const shownIn = (spots: Spot[], app: string) => !app || pagesOf(spots).some(p => p === app || p === '*')

// ---------- Everything the apps use ----------
interface Item {
  id: string
  label: string
  code?: string
  spots: Spot[]
  apps: App[]
  // How to draw it
  icon?: string
  tool?: ToolIconName
  logo?: string
  src?: string
}
const item = (base: Omit<Item, 'apps'>): Item => ({ ...base, apps: appsOf(base.spots) })

const usedIcons: Item[] = Object.entries(usage.icons)
  .map(([name, spots]) => item({ id: `icon:${name}`, label: name.replace(/-/g, ' '), icon: name, code: `<AppIcon name="${name}" />`, spots }))
  .sort((a, b) => a.label.localeCompare(b.label))
// The apps' own icons (ToolIcon), drawn for this site: each on its app, and on Home and in the menus
const toolIcons: Item[] = [...new Map(ALL_APPS.map(t => [t.icon, t])).values()].map(t => ({
  id: `tool:${t.icon}`,
  label: t.name,
  tool: t.icon,
  code: `<ToolIcon name="${t.icon}" />`,
  spots: [['components/ToolIcon.vue', 1]],
  apps: [{ key: '*', name: 'Every app' }, appOf(t.to)!]
}))

const titleOf = (slug: string) => usage.brands.find(b => b.brand === slug)?.name ?? slug
const libraryLogos: Item[] = Object.entries(usage.logos)
  .map(([slug, spots]) => item({ id: `logo:${slug}`, label: titleOf(slug), logo: slug, code: `<BrandLogo name="${slug}" />`, spots }))
  .sort((a, b) => a.label.localeCompare(b.label))
const fileLogos: Item[] = usage.brands.filter(b => b.logo && !b.brand)
  .map(b => item({ id: `file:${b.name}`, label: b.name, src: b.logo, spots: [b.at] }))
const siteLogos: Item[] = usage.brands.filter(b => !b.logo && !b.brand)
  .map(b => item({ id: `site:${b.name}`, label: b.name, src: siteLogo(b.domain), spots: [b.at] }))
  .sort((a, b) => a.label.localeCompare(b.label))
// Drawn straight into a page's code rather than taken from the library
const PHONE_BRANDS: Record<string, string> = { apple: 'Apple', samsung: 'Samsung', google: 'Google', xiaomi: 'Xiaomi', honor: 'Honor', oppo: 'OPPO', vivo: 'vivo', oneplus: 'OnePlus' }
const drawnLogos: Item[] = [
  ...(usage.drawn.google.length ? [item({ id: 'drawn:google', label: 'Google (four colours)', src: '/logos/google.svg', spots: usage.drawn.google })] : []),
  ...usage.drawn.phoneBrands.flatMap(spot => Object.entries(PHONE_BRANDS).map(([slug, name]) =>
    item({ id: `drawn:phone:${slug}`, label: `${name} (in the text colour)`, logo: slug, spots: [spot] })))
]

interface Group { title: string, note?: string, items: Item[] }
const groups = computed<Group[]>(() => {
  const f = (list: Item[]) => list.filter(i => !appFilter.value || i.apps.some(a => a.key === appFilter.value || a.key === '*'))
  const list: Group[] = kind.value === 'icons'
    ? [
        { title: 'Line icons', note: 'From the icon library (Lucide).', items: f(usedIcons) },
        { title: 'App icons', note: 'Drawn for this site: each app’s own icon, on Home, in the menus and on its page.', items: f(toolIcons) }
      ]
    : [
        { title: 'From the logo library', note: 'Simple Icons, in each brand’s colour.', items: f(libraryLogos) },
        { title: 'From each brand’s website', note: 'Brands the library doesn’t have, or whose mark is a wordmark too wide for a square tile. Fetched once and kept.', items: f(siteLogos) },
        { title: 'Our own files', note: 'For brands whose site icon isn’t their logo (public/logos).', items: f(fileLogos) },
        { title: 'Drawn in the code', note: 'Copies of a logo written into a page, to draw it in the text colour or in several colours.', items: f(drawnLogos) }
      ]
  return list.filter(g => g.items.length)
})
const total = computed(() => groups.value.reduce((n, g) => n + g.items.length, 0))

// Apps to filter by: the ones something is shown in
const appOptions = computed(() => {
  const all = kind.value === 'icons' ? [...usedIcons, ...toolIcons] : [...libraryLogos, ...siteLogos, ...fileLogos, ...drawnLogos]
  const apps = new Map<string, string>()
  for (const i of all) for (const a of i.apps) if (a.key !== '*') apps.set(a.key, a.name)
  return [{ value: '', label: 'All apps' }, ...[...apps].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))]
})
watch(kind, () => (appFilter.value = ''))

// ---------- Search the whole library ----------
interface Logo { slug: string, title: string }
const results = ref<Item[]>()
const logoTotal = ref<number>()
const searching = ref(false)
const failed = ref(false)

let timer: ReturnType<typeof setTimeout> | undefined
let latest = 0
watch([query, kind], ([q, k]) => {
  clearTimeout(timer)
  const term = q.trim()
  failed.value = false
  if (!term) {
    results.value = undefined
    return
  }
  timer = setTimeout(async () => {
    const run = ++latest
    searching.value = true
    try {
      if (k === 'icons') {
        const ids = await $fetch<string[]>('/api/icons', { query: { q: term } })
        if (run === latest) {
          results.value = ids.map(id => id.replace(/^lucide:/, '')).map(name =>
            usedIcons.find(i => i.icon === name) ?? { id: `icon:${name}`, label: name.replace(/-/g, ' '), icon: name, code: `<AppIcon name="${name}" />`, spots: [], apps: [] })
        }
      } else {
        const res = await $fetch<{ total: number, logos: Logo[] }>('/api/logos', { query: { q: term } })
        if (run === latest) {
          logoTotal.value = res.total
          results.value = res.logos.map(l =>
            libraryLogos.find(i => i.logo === l.slug) ?? { id: `logo:${l.slug}`, label: l.title, logo: l.slug, code: `<BrandLogo name="${l.slug}" />`, spots: [], apps: [] })
        }
      }
    } catch {
      if (run === latest) failed.value = true
    } finally {
      if (run === latest) searching.value = false
    }
  }, 250)
})
onBeforeUnmount(() => clearTimeout(timer))

watch(kind, async (k) => {
  if (k !== 'logos' || logoTotal.value) return
  try {
    logoTotal.value = (await $fetch<{ total: number }>('/api/logos')).total
  } catch {}
})

const searched = computed(() => !!query.value.trim())
const empty = computed(() => searched.value && !searching.value && !failed.value && results.value?.length === 0)

// ---------- Details ----------
const open = ref<Item>()
async function copy(code: string, what: string) {
  try {
    await navigator.clipboard.writeText(code)
    toast.success('Code copied', { description: what })
    play('copy')
  } catch {
    toast.error('Couldn’t copy')
  }
}
const whereLine = (i: Item) => {
  if (!i.apps.length) return 'Not used yet'
  const names = i.apps.map(a => a.name)
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')
}
const fileLink = ([f, l]: Spot) => `app/${f}:${l}`
</script>

<template>
  <!-- Animated: its own library, with the same switch at the head of its controls -->
  <AnimatedIconGallery v-if="kind === 'animated'">
    <template #switch>
      <div class="segmented kinds" role="radiogroup" aria-label="Show">
        <label v-for="k in KINDS" :key="k.value" :class="{ active: kind === k.value }"><input v-model="kind" type="radio" name="icon-kind" :value="k.value">{{ k.label }}</label>
      </div>
    </template>
  </AnimatedIconGallery>
  <div v-else class="gallery">
    <section class="panel controls">
      <div class="segmented kinds" role="radiogroup" aria-label="Show">
        <label v-for="k in KINDS" :key="k.value" :class="{ active: kind === k.value }"><input v-model="kind" type="radio" name="icon-kind" :value="k.value">{{ k.label }}</label>
      </div>
      <label class="search">
        <AppIcon name="search" />
        <input
          v-model="query"
          type="search"
          :placeholder="kind === 'icons' ? 'Search every icon: car, wallet, cloud…' : 'Search every brand: Stripe, Spotify…'"
          :aria-label="kind === 'icons' ? 'Search icons' : 'Search logos'"
          autocomplete="off"
        >
      </label>
      <AppSelect v-if="!searched" v-model="appFilter" class="app-filter" :options="appOptions" aria-label="Show what an app uses" searchable />
      <p class="note">
        <template v-if="kind === 'icons'">
          Line icons come from <a href="https://lucide.dev" target="_blank" rel="noopener">Lucide</a> (<code>@iconify-json/lucide</code>) and are drawn with
          <code>&lt;AppIcon name="…" /&gt;</code>; only the ones the code names go into the app.
        </template>
        <template v-else>
          {{ logoTotal ? `${logoTotal.toLocaleString('en-US')} brand logos` : 'Brand logos' }} come from
          <a href="https://simpleicons.org" target="_blank" rel="noopener">Simple Icons</a> (<code>simple-icons</code>) and are drawn with
          <code>&lt;BrandLogo name="…" /&gt;</code>. Logos are their owners’ trademarks.
        </template>
        Click one to see every place it’s used, and copy its code.
      </p>
    </section>

    <p v-if="failed" class="panel state">Couldn’t search the library. Check your connection and try again.</p>
    <p v-else-if="empty" class="panel state">Nothing called “{{ query.trim() }}”. Try a simpler word.</p>

    <template v-else-if="searched">
      <header class="group-head"><h3>Results for “{{ query.trim() }}”</h3></header>
      <ul class="grid" :aria-busy="searching">
        <li v-for="i in results" :key="i.id">
          <button type="button" class="tile" :class="{ unused: !i.apps.length }" @click="open = i">
            <span class="art" :class="{ plate: i.logo || i.src }">
              <AppIcon v-if="i.icon && appIcons[i.icon]" :name="i.icon" />
              <span v-else-if="i.icon" class="masked" :style="{ '--src': `url('${libraryIconUrl(`lucide:${i.icon}`, '#000')}')` }" />
              <BrandLogo v-else-if="i.logo" :name="i.logo" />
            </span>
            <span class="name">{{ i.label }}</span>
            <span class="where">{{ whereLine(i) }}</span>
          </button>
        </li>
      </ul>
    </template>

    <template v-else>
      <p class="summary">
        <strong>{{ total }}</strong> {{ kind === 'icons' ? 'icons' : 'logos' }}
        {{ appFilter ? `in ${appOptions.find(o => o.value === appFilter)?.label}, counting the ones every app has` : 'across all the apps' }}
      </p>
      <section v-for="g in groups" :key="g.title" class="group">
        <header class="group-head">
          <h3>{{ g.title }} <span class="count">{{ g.items.length }}</span></h3>
          <p v-if="g.note">{{ g.note }}</p>
        </header>
        <ul class="grid">
          <li v-for="i in g.items" :key="i.id">
            <button type="button" class="tile" @click="open = i">
              <span class="art" :class="{ plate: i.logo || i.src }">
                <AppIcon v-if="i.icon" :name="i.icon" />
                <ToolIcon v-else-if="i.tool" :name="i.tool" />
                <BrandLogo v-else-if="i.logo" :name="i.logo" />
                <img v-else-if="i.src" :src="i.src" alt="" loading="lazy" referrerpolicy="no-referrer">
              </span>
              <span class="name">{{ i.label }}</span>
              <span class="where">{{ whereLine(i) }}</span>
            </button>
          </li>
        </ul>
      </section>
    </template>

    <Modal :open="!!open" :title="open?.label ?? ''" @close="open = undefined">
      <div v-if="open" class="detail">
        <div class="detail-head">
          <span class="art big" :class="{ plate: open.logo || open.src }">
            <AppIcon v-if="open.icon && appIcons[open.icon]" :name="open.icon" />
            <span v-else-if="open.icon" class="masked" :style="{ '--src': `url('${libraryIconUrl(`lucide:${open.icon}`, '#000')}')` }" />
            <ToolIcon v-else-if="open.tool" :name="open.tool" />
            <BrandLogo v-else-if="open.logo" :name="open.logo" />
            <img v-else-if="open.src" :src="open.src" alt="" referrerpolicy="no-referrer">
          </span>
          <div v-if="open.code" class="code-row">
            <code>{{ open.code }}</code>
            <button type="button" class="btn btn-sm" @click="copy(open.code, open.label)">Copy</button>
          </div>
        </div>

        <h4>Shown in</h4>
        <p v-if="!open.apps.length" class="muted">Not used in any app yet. Write its code anywhere and it’s added to the app.</p>
        <ul v-else class="chips">
          <li v-for="a in open.apps" :key="a.key">
            <NuxtLink v-if="a.to" :to="a.to" class="chip" @click="open = undefined">{{ a.name }}</NuxtLink>
            <span v-else class="chip every">{{ a.name }}</span>
          </li>
        </ul>

        <template v-if="open.spots.length">
          <h4>In the code</h4>
          <ul class="spots">
            <li v-for="s in open.spots" :key="fileLink(s)">
              <code>{{ fileLink(s) }}</code>
              <span class="muted">{{ appsOf([s]).map(a => a.name).join(', ') || 'not shown anywhere' }}</span>
            </li>
          </ul>
        </template>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.gallery {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
  padding: 1.1rem 1.25rem;
}

/* Room for three: Icons, Logos and Animated */
.kinds {
  flex: none;
  width: 16rem;
  max-width: 100%;
}

.search {
  flex: 1 1 14rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.6rem;
  padding: 0 0.85rem;
  color: var(--ink-3);
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

.search:focus-within {
  border-color: var(--accent);
}

.search input {
  flex: 1;
  min-width: 0;
  font: inherit;
  color: var(--ink);
  background: none;
  border: 0;
  outline: 0;
}

.app-filter {
  flex: 0 1 13rem;
}

.note {
  flex-basis: 100%;
  margin: 0;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.summary {
  margin: 0;
  color: var(--ink-2);
}

.summary strong {
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.group-head h3 {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0.5rem 0 0;
  font-size: var(--text-sm);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.group-head p {
  margin: 0.2rem 0 0;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.count {
  padding: 0.05rem 0.45rem;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
  background: var(--surface-2);
  border-radius: var(--radius-pill);
}

.state {
  margin: 0;
  padding: 1.25rem;
  text-align: center;
  color: var(--ink-2);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
  transition: opacity var(--dur-fast);
}

.grid[aria-busy='true'] {
  opacity: 0.55;
}

.tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  width: 100%;
  height: 100%;
  padding: 0.9rem 0.5rem 0.7rem;
  font: inherit;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: background-color var(--dur-fast), border-color var(--dur-fast), scale var(--dur-fast);
}

.tile:hover {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--line));
  background: color-mix(in srgb, var(--accent) 5%, var(--surface));
}

.tile:active {
  scale: 0.96;
}

.tile:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.art {
  display: grid;
  place-items: center;
  width: 2.6rem;
  height: 2.6rem;
  margin-bottom: 0.2rem;
  font-size: var(--text-xl);
}

.art :deep(.tool-icon) {
  width: 1em;
  height: 1em;
}

/* Logos keep their brand colours, so they sit on white in both themes */
.art.plate {
  font-size: var(--text-xl);
  background: #fff;
  border-radius: var(--radius);
  box-shadow: inset 0 0 0 1px var(--line);
}

.art img {
  width: 1.6rem;
  height: 1.6rem;
  object-fit: contain;
}

.masked {
  width: 1em;
  height: 1em;
  background: currentColor;
  mask: var(--src) center / contain no-repeat;
}

.name {
  max-width: 100%;
  overflow: hidden;
  font-size: var(--text-xs);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.where {
  max-width: 100%;
  overflow: hidden;
  font-size: var(--text-2xs);
  color: var(--ink-3);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unused .where {
  font-style: italic;
}

/* ---------- Details ---------- */
.detail {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.art.big {
  width: 4.5rem;
  height: 4.5rem;
  font-size: var(--text-3xl);
  margin: 0;
  background: var(--surface-2);
  border-radius: var(--radius-xl);
}

.art.big.plate {
  background: #fff;
}

.art.big img {
  width: 2.8rem;
  height: 2.8rem;
}

.code-row {
  flex: 1 1 14rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.code-row code {
  flex: 1;
  min-width: 0;
  padding: 0.5rem 0.7rem;
  overflow-x: auto;
  font-size: var(--text-sm);
  white-space: nowrap;
  background: var(--surface-2);
  border-radius: var(--radius-sm);
}

h4 {
  margin: 0.6rem 0 0;
  font-size: var(--text-xs);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.chip {
  display: inline-block;
  padding: 0.3rem 0.7rem;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink);
  text-decoration: none;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
}

a.chip:hover {
  border-color: var(--accent);
}

.chip.every {
  color: var(--accent);
}

.spots {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.spots li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 0.6rem;
  font-size: var(--text-sm);
}

.spots code {
  font-size: var(--text-sm);
}

.muted {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--ink-3);
}

@media (max-width: 480px) {
  .kinds,
  .app-filter {
    width: 100%;
    flex-basis: 100%;
  }
}
</style>
