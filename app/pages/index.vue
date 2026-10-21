<script setup lang="ts">
// Pinned apps get their own row at the top (CHECKLIST.md #09); only known after mount, so the
// server-rendered page always shows the plain groups
const { prefs } = usePrefs()
const hydrated = useHydrated()
// Cube sticker colours are chosen in Settings; known only after mount, like the pins
const appColors = computed(() => hydrated.value && prefs.cubeColors === 'apps')
const GROUPS = computed(() => {
  const pins = hydrated.value ? prefs.pinnedApps : []
  const pinned = pins.map(p => TOOLS.find(t => t.to === p)).filter((t): t is typeof TOOLS[number] => !!t)
  const rest = TOOLS.filter(t => !pins.includes(t.to))
  return [
    { name: 'Pinned', tools: pinned },
    { name: 'Tools', tools: rest.filter(t => (t.group ?? 'Tools') === 'Tools') },
    { name: 'Life', tools: rest.filter(t => t.group === 'Life') }
  ].filter(g => g.tools.length)
})

// On phones the home page is a row of screens you swipe through: the hero first, then the icons
// in pages. Every app gets a fixed spot (page, row, column) counted across all groups, and the
// CSS only uses it below 720px. Each screen is four columns plus a fifth, the gutter between it and
// the next screen
const PER_PAGE = 12
const COLS = 4
const spots = computed(() => {
  const map = new Map<string, { col: number, row: number, start: boolean }>()
  GROUPS.value.flatMap(g => g.tools).forEach((t, k) => {
    const page = Math.floor(k / PER_PAGE)
    const i = k % PER_PAGE
    map.set(t.to, { col: (page + 1) * (COLS + 1) + (i % COLS) + 1, row: Math.floor(i / COLS) + 1, start: i === 0 })
  })
  return map
})
const pageCount = computed(() => 1 + Math.ceil(spots.value.size / PER_PAGE))

const pager = ref<HTMLElement>()
const page = ref(0)

// Coming back from an app lands on the screen you left from, for as long as the tab is open.
// Waits for hydration, since the pinned row can add a screen
const PAGE_KEY = 'ousa-app:home-page'
onMounted(() => {
  let saved = 0
  try {
    saved = Number(sessionStorage.getItem(PAGE_KEY)) || 0
  } catch {}
  if (!saved) return
  let restored = false
  watch(hydrated, async (ready) => {
    if (!ready || restored) return
    restored = true
    await nextTick()
    const el = pager.value
    if (!el) return
    const p = Math.min(saved, pageCount.value - 1)
    el.scrollLeft = p * el.clientWidth
    page.value = p
  }, { immediate: true })
})

// The app you just came back from glows for a moment, so you can find your place. Client-side
// navigation only, so the server-rendered page never has it
const cameFrom = useState<string | null>('came-from')
const lastApp = ref<string | null>(null)
onMounted(() => {
  if (spots.value.has(cameFrom.value ?? '')) lastApp.value = cameFrom.value
})

function onPagerScroll() {
  const el = pager.value
  if (!el) return
  page.value = Math.round(el.scrollLeft / el.clientWidth)
  try {
    sessionStorage.setItem(PAGE_KEY, String(page.value))
  } catch {}
  if (page.value > 0 && !swiped.value) {
    swiped.value = true
    try {
      localStorage.setItem('ousa-app:swiped', '1')
    } catch {}
  }
}

// The hero's "Swipe for the apps" hint nudges sideways until the visitor has swiped once
const swiped = ref(true)
onMounted(() => {
  try {
    swiped.value = localStorage.getItem('ousa-app:swiped') === '1'
  } catch {
    swiped.value = false
  }
})
function goToPage(p: number) {
  pager.value?.scrollTo({ left: p * pager.value.clientWidth, behavior: 'smooth' })
}

// Pinned apps can be dragged into any order (CHECKLIST.md #28)
const reorderPins = useDragReorder<typeof TOOLS[number]>({
  keyOf: t => t.to,
  axis: 'x',
  onMove: (from, to) => (prefs.pinnedApps = moved(prefs.pinnedApps, from, to))
})

useHead({ title: 'Ousa’s Apps: free tools and trackers for life in Cambodia', titleTemplate: '%s' })

const site = useSiteUrl()
useAppSeo({
  title: 'Ousa’s Apps: free tools and trackers for life in Cambodia',
  description: 'Free everyday tools: check Cambodian phone numbers, KHR/USD rates, gold price in chi and damlung, salary tax, QR codes, passwords and more. Nothing to install.',
  path: '/',
  imageAlt: 'Ousa’s Apps: a Rubik’s cube of app icons',
  jsonLd: {
    '@graph': [
      { '@type': 'WebSite', 'name': 'Ousa’s Apps', 'url': `${site}/`, 'inLanguage': 'en' },
      {
        '@type': 'ItemList',
        'name': 'Ousa’s Apps',
        'itemListElement': TOOLS.map((t, i) => ({ '@type': 'ListItem', 'position': i + 1, 'name': t.seoTitle ?? t.name, 'url': `${site}${t.to}` }))
      }
    ]
  }
})
</script>

<template>
  <main class="home">
    <SiteBar />
    <div ref="pager" class="groups" @scroll.passive="onPagerScroll">
      <div class="hero page-start">
        <RubikCube :size="60" follow-pointer interactive :links="TOOLS" :app-colors="appColors" class="hero-cube" />
        <h1>Ousa’s Apps</h1>
        <p>Small tools for everyday jobs, and simple trackers for the things in your life. Click an icon on the cube to open it, or anywhere else to shuffle.</p>
        <button type="button" class="swipe-hint" :class="{ nudge: !swiped }" @click="goToPage(1)">
          Swipe for the apps
          <AppIcon name="chevron-right" />
        </button>
      </div>
      <section v-for="group in GROUPS" :key="group.name" class="group" :aria-labelledby="`group-${group.name}`">
        <h2 :id="`group-${group.name}`">{{ group.name }}</h2>
        <nav class="tools" :class="{ 'drop-x': group.name === 'Pinned' }" :aria-label="group.name === 'Pinned' ? 'Pinned. Drag to reorder, or Alt and the arrow keys.' : group.name">
          <NuxtLink
            v-for="(tool, i) in group.tools"
            :key="tool.to"
            :to="tool.to"
            v-bind="group.name === 'Pinned' ? reorderPins.bind(tool, i) : {}"
            class="tile"
            :class="{ 'page-start': spots.get(tool.to)?.start, 'last-app': lastApp === tool.to }"
            :style="{ '--accent': tool.color, '--sticker': tool.gradient, '--on-accent': tool.onColor ?? '#fff', '--col': spots.get(tool.to)?.col, '--row': spots.get(tool.to)?.row }"
          >
            <span v-if="group.name === 'Pinned'" class="drag-grip corner" aria-hidden="true"><AppIcon name="grip-vertical" /></span>
            <span v-if="tool.demo" class="demo-badge" title="Open it and click the app’s icon to see it with example data">
              <AppIcon name="play" />Try it
            </span>
            <span class="sticker" aria-hidden="true"><ToolIcon :name="tool.icon" /></span>
            <strong>{{ tool.name }}</strong>
            <span class="summary">{{ tool.summary }}</span>
          </NuxtLink>
        </nav>
      </section>
    </div>
    <div v-if="pageCount > 1" class="page-dots">
      <button
        v-for="p in pageCount"
        :key="p"
        type="button"
        :class="{ active: page === p - 1 }"
        :aria-label="`Page ${p} of ${pageCount}`"
        :aria-current="page === p - 1 ? 'page' : undefined"
        @click="goToPage(p - 1)"
      />
    </div>

  </main>
</template>

<style scoped>
.home {
  min-height: 100dvh;
  /* The same side gutter as every app page (ToolPage): 1rem on phones up to 3rem on wide screens */
  padding: 1rem clamp(1rem, 4vw, 3rem) 7rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3rem;
  overflow: hidden;
}

.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.hero-cube {
  margin: -1rem 0 1rem;
}

h1 {
  font-size: clamp(3.25rem, 12vw, 6.5rem);
  font-weight: 800;
  letter-spacing: -0.05em;
  line-height: 0.95;
  font-variation-settings: 'opsz' 96;
}

.hero p {
  margin: 1rem 0 0;
  max-width: 28rem;
  font-size: var(--text-title);
  color: var(--ink-2);
}

.groups {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3rem;
}

/* Only phones page through the icons */
.page-dots,
.swipe-hint {
  display: none;
}

.group {
  width: 100%;
  max-width: var(--page-width);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.group h2 {
  font-size: var(--text-title);
  color: var(--ink-2);
  letter-spacing: -0.01em;
}

.tools {
  width: 100%;
  max-width: var(--page-width);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
}

.tools > * {
  flex: 1 1 210px;
  max-width: 260px;
}

.tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 1.5rem 1.25rem 1.4rem;
  text-align: center;
  text-decoration: none;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-xl);
  transition: border-color var(--dur-fast);
}

.tile:hover {
  border-color: var(--accent);
}

.sticker {
  width: 2.75rem;
  height: 2.75rem;
  margin-bottom: 0.6rem;
  display: grid;
  place-items: center;
  font-size: var(--text-xl);
  color: var(--on-accent);
  background: var(--sticker, var(--accent));
  border-radius: var(--radius);
  box-shadow:
    0 0 0 3px var(--plastic),
    0 0 0 4px var(--plastic-edge),
    inset 0 -5px 0 rgb(0 0 0 / 0.12),
    inset 0 5px 8px rgb(255 255 255 / 0.25),
    0 0 0 transparent;
  transition:
    transform var(--dur) cubic-bezier(0.3, 1.5, 0.6, 1),
    box-shadow var(--dur) ease;
}

.sticker svg {
  transition: transform var(--dur) cubic-bezier(0.3, 1.5, 0.6, 1);
}

/* Keycap feel: the sticker lifts and glows in its own colour on hover, then presses down on click */
.tile:hover .sticker,
.tile:focus-visible .sticker {
  transform: translateY(-3px);
  box-shadow:
    0 0 0 3px var(--plastic),
    0 0 0 4px var(--plastic-edge),
    inset 0 -5px 0 rgb(0 0 0 / 0.12),
    inset 0 5px 8px rgb(255 255 255 / 0.25),
    0 10px 18px -6px color-mix(in srgb, var(--accent) 70%, transparent);
}

.tile:hover .sticker svg,
.tile:focus-visible .sticker svg {
  transform: scale(1.08);
}

.tile:active .sticker {
  transform: translateY(1px) scale(0.96);
  transition-duration: 0.08s;
}

/* The app you just came back from: a ring and glow in its own colour that fade out */
.tile.last-app .sticker {
  animation: last-app 2.4s ease-out 0.3s both;
}

@keyframes last-app {
  0%, 40% {
    box-shadow:
      0 0 0 3px var(--plastic),
      0 0 0 6px var(--accent),
      inset 0 -5px 0 rgb(0 0 0 / 0.12),
      inset 0 5px 8px rgb(255 255 255 / 0.25),
      0 0 22px 4px color-mix(in srgb, var(--accent) 60%, transparent);
  }
  100% {
    box-shadow:
      0 0 0 3px var(--plastic),
      0 0 0 4px var(--plastic-edge),
      inset 0 -5px 0 rgb(0 0 0 / 0.12),
      inset 0 5px 8px rgb(255 255 255 / 0.25),
      0 0 0 transparent;
  }
}

/* Apps you can try with sample data; same purple as the demo switch inside each app */
.demo-badge {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.12rem 0.5rem 0.12rem 0.35rem;
  font-size: var(--text-2xs);
  font-weight: 700;
  line-height: 1.3;
  color: var(--purple);
  background: color-mix(in srgb, var(--purple) 12%, var(--surface));
  border-radius: var(--radius-pill);
}

:root[data-theme='dark'] .demo-badge {
  color: #c4b1ff;
}

.demo-badge svg {
  width: 0.7rem;
  height: 0.7rem;
  fill: currentColor;
}

.tile strong {
  font-size: var(--text-title);
  letter-spacing: -0.01em;
}

.summary {
  font-size: var(--text-base);
  color: var(--ink-2);
}

.recent-panel {
  width: 100%;
  padding: 0.85rem 0.6rem 0.75rem;
}

.recent {
  max-width: 720px;
  scroll-margin-top: var(--pin-top);
}

/* Phones get a home-screen grid: four big icons a row with a short name under each */
@media (max-width: 760px) {
  /* Still names each section for screen readers through aria-labelledby */
  .group h2 {
    display: none;
  }

  /* One grid for every group: the sections and their navs drop out of layout so the tiles flow
     straight on from Pinned into Tools and Life. Each tile sits at its spot from the script, four
     columns to a screen-wide page, and the grid scrolls sideways a page at a time */
  .groups {
    /* Each screen fills the phone: the pager takes all the height the page has left, since the
       page is at least the screen tall */
    flex: 1;
    display: grid;
    /* Edge to edge, so icons slide off the side of the screen instead of being cut off at the
       page's side padding. That padding moves inside: each screen's four columns sit within it,
       and a fifth column between screens is both screens' padding together */
    --pad: max(clamp(1rem, 4vw, 3rem), calc((100vw - 420px) / 2));
    width: 100vw;
    max-width: none;
    padding-inline: var(--pad);
    scroll-padding-inline: var(--pad);
    grid-auto-columns: 25% 25% 25% 25% calc(2 * var(--pad));
    /* Three rows of icons a screen; the spare last row soaks up the rest of the height, so the
       icon rows keep their own spacing instead of being stretched */
    grid-template-rows: auto auto auto 1fr;
    align-items: start;
    row-gap: 1.4rem;
    column-gap: 0;
    /* Room for the icons' hover lift and glow, which the scroller would otherwise clip */
    padding-block: 6px 14px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
  }

  .groups::-webkit-scrollbar {
    display: none;
  }

  .tile {
    grid-column: var(--col);
    grid-row: var(--row);
  }

  /* The hero is the first screen, filling the pager's height with its content centred */
  .hero {
    grid-column: 1 / span 4;
    grid-row: 1 / -1;
    align-self: stretch;
    justify-content: center;
    padding: 0 0.5rem;
  }

  .page-start {
    scroll-snap-align: start;
    scroll-snap-stop: always;
  }

  /* The dots sit at the foot of the screen: last in a page that's exactly the screen tall, with
     just enough room under them to clear the phone's home bar */
  .home {
    padding-bottom: max(1.25rem, calc(env(safe-area-inset-bottom) + 0.75rem));
  }

  .page-dots {
    display: flex;
    justify-content: center;
    gap: 0.2rem;
    margin-top: -2.75rem;
  }

  .swipe-hint {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    margin-top: 1.75rem;
    padding: 0.55rem 0.8rem 0.55rem 1.1rem;
    font: inherit;
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--ink-2);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-pill);
    cursor: pointer;
  }

  .swipe-hint svg {
    width: 1rem;
    height: 1rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .swipe-hint.nudge svg {
    animation: swipe-nudge 1.6s ease-in-out infinite;
  }

  .page-dots button {
    padding: 0.4rem;
    background: none;
    border: 0;
    cursor: pointer;
  }

  .page-dots button::before {
    content: '';
    display: block;
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
    background: var(--ink-2);
    opacity: 0.3;
    transition: opacity var(--dur);
  }

  .page-dots button.active::before {
    opacity: 1;
  }

  .group,
  .tools {
    display: contents;
  }

  .tools > * {
    max-width: none;
  }

  .tile {
    gap: 0.45rem;
    /* The gutter between icons, since the columns have to be exactly a quarter of the page */
    padding: 0 0.25rem;
    background: none;
    border: 0;
    border-radius: 0;
    -webkit-tap-highlight-color: transparent;
  }

  .sticker {
    width: 3.75rem;
    height: 3.75rem;
    margin: 4px 0 0;
    font-size: var(--text-2xl);
    border-radius: var(--radius-lg);
  }

  .tile strong {
    width: 100%;
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0;
    line-height: 1.25;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    overflow-wrap: anywhere;
  }

  /* Kept for screen readers; there is no room for it under an icon */
  .summary {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .demo-badge {
    display: none;
  }

  .hero-cube {
    margin: -3.5rem 0 -2.5rem;
    scale: 0.75;
  }
}

@keyframes swipe-nudge {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(4px); }
}

@media (prefers-reduced-motion: reduce) {
  .swipe-hint.nudge svg {
    animation: none;
  }

  .tile:hover .sticker,
  .tile:focus-visible .sticker,
  .tile:active .sticker,
  .tile:hover .sticker svg {
    transform: none;
  }
}
</style>
