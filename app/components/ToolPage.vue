<script setup lang="ts">
import type { Tool } from '~/utils/tools'

// Pages listed in TOOLS are found by route; other pages pass their own `tool`
// hero: big centred header (single-purpose tools)
// bar: compact left-aligned header so the workspace starts high (editors, studios)
// band: full-width coloured band (collections)
type Header = 'hero' | 'bar' | 'band'

const props = withDefaults(defineProps<{ width?: string, tool?: Tool, header?: Header }>(), { width: '1320px', tool: undefined, header: 'hero' })

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

// Demo: on pages that have one, the app icon switches sample data on and off
const demo = useDemoState(route.path)
const { play } = useSound()
function toggleDemo() {
  demo.active.value = !demo.active.value
  play(demo.active.value ? 'toggle-on' : 'toggle-off')
}

// Back to wherever you came from in the app (same as Esc); straight in from outside, it goes home
const router = useRouter()
function goBack(e: MouseEvent) {
  // Let cmd/ctrl-click open home in a new tab as a normal link would
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
  if (window.history.state?.back) {
    e.preventDefault()
    router.back()
  }
}
</script>

<template>
  <main class="tool" :class="`header-${header}`" :style="{ '--accent': tool.color, '--on-accent': tool.onColor ?? '#fff', '--width': props.width }">
    <NuxtLink to="/" class="home" aria-label="Back, Ousa’s Apps" title="Back (Esc)" @click="goBack">
      <svg class="back" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      <AppLogo class="home-logo" />Ousa’s Apps
    </NuxtLink>

    <header class="head">
      <button
        v-if="demo.supported.value"
        ref="stickerEl"
        type="button"
        class="sticker demo-toggle"
        :class="{ on: demo.active.value }"
        :aria-pressed="demo.active.value"
        :aria-label="demo.active.value ? 'Turn off the demo' : `Try ${tool.name} with demo data`"
        :title="demo.active.value ? 'Turn off the demo' : 'Try it with demo data'"
        @click="toggleDemo"
      >
        <ToolIcon :name="tool.icon" />
        <span class="demo-tag" aria-hidden="true">{{ demo.active.value ? 'Demo on' : 'Demo' }}</span>
      </button>
      <span v-else ref="stickerEl" class="sticker" aria-hidden="true"><ToolIcon :name="tool.icon" /></span>
      <div class="head-text">
        <h1>{{ tool.name }}</h1>
        <p>{{ tool.summary }}</p>
      </div>
      <div v-if="$slots.actions" class="head-actions"><slot name="actions" /></div>
    </header>

    <div class="body">
      <p v-if="demo.active.value" class="demo-banner" role="status">
        <span><strong>You’re looking at demo data.</strong> Try anything: nothing you change is saved.</span>
        <button type="button" class="btn btn-sm" @click="toggleDemo">Exit demo</button>
      </p>
      <slot />
    </div>
  </main>
</template>

<style scoped>
.tool {
  --gutter: clamp(1rem, 4vw, 3rem);
  min-height: 100dvh;
  padding: 1.25rem var(--gutter) 7rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.home {
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.5rem;
  padding: 0.35rem 0.8rem 0.35rem 0.3rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ink-2);
  text-decoration: none;
  border-radius: 999px;
  transition: background-color 0.15s, color 0.15s;
}

.home-logo {
  font-size: 1.4rem;
}

.back {
  width: 1.1rem;
  height: 1.1rem;
  margin-right: -0.2rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: translate 0.2s cubic-bezier(0.2, 0, 0, 1);
}

/* The arrow nudges left on hover, pointing the way you'll go */
.home:hover .back {
  translate: -2px 0;
}

.home:hover {
  color: var(--ink);
  background: var(--surface);
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
  background: var(--accent);
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

/* A small tag hanging off the icon says it can be pressed */
.demo-tag {
  position: absolute;
  left: 50%;
  bottom: -0.85rem;
  translate: -50% 0;
  padding: 0.1rem 0.45rem;
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1.3;
  white-space: nowrap;
  color: var(--ink);
  background: var(--surface);
  border-radius: 999px;
  box-shadow: 0 0 0 1px var(--line), 0 2px 6px rgb(var(--shadow) / 0.15);
}

.demo-toggle.on .demo-tag {
  color: #fff;
  background: var(--purple);
  box-shadow: 0 2px 6px rgb(var(--shadow) / 0.2);
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

/* ---------- Band: full-width colour band; content overlaps its lower edge ---------- */
.header-band .head {
  width: calc(100% + var(--gutter) * 2);
  max-width: none;
  margin: 1rem calc(var(--gutter) * -1) 0;
  padding: 2.5rem max(var(--gutter), calc((100% + var(--gutter) * 2 - var(--width)) / 2)) 4.5rem;
  flex-direction: row;
  align-items: flex-end;
  gap: 1.25rem;
  text-align: left;
  color: var(--on-accent);
  background:
    radial-gradient(circle at 85% -20%, rgb(255 255 255 / 0.22), transparent 50%),
    var(--accent);
}

.header-band .head-text {
  align-items: flex-start;
}

.header-band .sticker {
  flex: none;
  color: var(--accent);
  background: var(--surface);
}

.header-band h1 {
  margin-top: 0;
  font-size: clamp(2.25rem, 6vw, 3.75rem);
}

.header-band .head p {
  margin-top: 0.4rem;
  color: inherit;
  opacity: 0.88;
}

.header-band .body {
  margin-top: -2.5rem;
}

@media (max-width: 640px) {
  .header-bar .head,
  .header-band .head {
    flex-wrap: wrap;
  }

  .head-actions {
    margin-left: 0;
  }
}
</style>
