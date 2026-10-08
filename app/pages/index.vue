<script setup lang="ts">
// Cube sticker style for the app icons, remembered per visitor
const appColors = ref(false)
onMounted(() => {
  try {
    appColors.value = localStorage.getItem('ousa-app:cube-colors') === 'apps'
  } catch {}
})
const { play } = useSound()
function setColors(apps: boolean) {
  appColors.value = apps
  play('select')
  try {
    localStorage.setItem('ousa-app:cube-colors', apps ? 'apps' : 'cube')
  } catch {}
}

// Pinned apps get their own row at the top (CHECKLIST.md #09); only known after mount, so the
// server-rendered page always shows the plain groups
const { prefs } = usePrefs()
const hydrated = useHydrated()
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
    <div class="hero">
      <RubikCube :size="60" follow-pointer interactive :links="TOOLS" :app-colors="appColors" class="hero-cube" />
      <div class="segmented cube-colors" role="radiogroup" aria-label="Icon sticker colours">
        <label :class="{ active: !appColors }">
          <input type="radio" name="cube-colors" :checked="!appColors" @change="setColors(false)">
          <span class="swatches" aria-hidden="true"><i style="background: #1f5bd8" /><i style="background: #f7c324" /><i style="background: #179a54" /></span>
          Cube colours
        </label>
        <label :class="{ active: appColors }">
          <input type="radio" name="cube-colors" :checked="appColors" @change="setColors(true)">
          <span class="swatches" aria-hidden="true"><i style="background: var(--teal)" /><i style="background: var(--purple)" /><i style="background: var(--pink)" /></span>
          App colours
        </label>
      </div>
      <h1>Ousa’s Apps</h1>
      <p>Small tools for everyday jobs, and simple trackers for the things in your life. Click an icon on the cube to open it, or anywhere else to shuffle.</p>
    </div>

    <!-- Your dashboard: greeting, quick add, what's coming up, favourites, recent (#64) -->
    <ClientOnly>
      <HomeDashboard />
      <template #fallback><SkeletonList variant="cards" :count="3" label="Loading your dashboard" class="dash-skeleton" /></template>
    </ClientOnly>

    <section v-for="group in GROUPS" :key="group.name" class="group" :aria-labelledby="`group-${group.name}`">
      <h2 :id="`group-${group.name}`">{{ group.name }}</h2>
      <nav class="tools" :class="{ 'drop-x': group.name === 'Pinned' }" :aria-label="group.name === 'Pinned' ? 'Pinned. Drag to reorder, or Alt and the arrow keys.' : group.name">
        <NuxtLink
          v-for="(tool, i) in group.tools"
          :key="tool.to"
          :to="tool.to"
          v-bind="group.name === 'Pinned' ? reorderPins.bind(tool, i) : {}"
          class="tile"
          :style="{ '--accent': tool.color, '--on-accent': tool.onColor ?? '#fff' }"
        >
          <span v-if="tool.demo" class="demo-badge" title="Open it and click the app’s icon to see it with example data">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z" /></svg>Try it
          </span>
          <span class="sticker" aria-hidden="true"><ToolIcon :name="tool.icon" /></span>
          <strong>{{ tool.name }}</strong>
          <span class="summary">{{ tool.summary }}</span>
        </NuxtLink>
      </nav>
    </section>

  </main>
</template>

<style scoped>
.home {
  min-height: 100dvh;
  padding: 2rem 1rem 7rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3rem;
  overflow: hidden;
}

.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.cube-colors {
  width: fit-content;
  margin: -0.5rem 0 1.75rem;
  font-size: 0.85rem;
}

.cube-colors label {
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.4rem 0.8rem;
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
  font-size: 1.15rem;
  color: var(--ink-2);
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
  font-size: 1.1rem;
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
  border-radius: 20px;
  transition: border-color 0.15s;
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
  font-size: 1.6rem;
  color: var(--on-accent);
  background: var(--accent);
  border-radius: 11px;
  box-shadow:
    0 0 0 3px var(--plastic),
    0 0 0 4px var(--plastic-edge),
    inset 0 -5px 0 rgb(0 0 0 / 0.12),
    inset 0 5px 8px rgb(255 255 255 / 0.25),
    0 0 0 transparent;
  transition:
    transform 0.2s cubic-bezier(0.3, 1.5, 0.6, 1),
    box-shadow 0.2s ease;
}

.sticker svg {
  transition: transform 0.2s cubic-bezier(0.3, 1.5, 0.6, 1);
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

/* Apps you can try with sample data; same purple as the demo switch inside each app */
.demo-badge {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.12rem 0.5rem 0.12rem 0.35rem;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.3;
  color: var(--purple);
  background: color-mix(in srgb, var(--purple) 12%, var(--surface));
  border-radius: 999px;
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
  font-size: 1.15rem;
  letter-spacing: -0.01em;
}

.summary {
  font-size: 0.925rem;
  color: var(--ink-2);
}

.dash-skeleton {
  width: 100%;
  max-width: 1200px;
}

.recent-panel {
  width: 100%;
  padding: 0.85rem 0.6rem 0.75rem;
}

.recent {
  max-width: 720px;
  scroll-margin-top: 5rem;
}

@media (max-width: 720px) {
  .tools {
    flex-direction: column;
    max-width: 420px;
  }

  .tools > * {
    flex: none;
    max-width: none;
  }

  .tile {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 1.1rem;
    padding: 1rem 1.15rem;
    text-align: left;
    align-items: center;
  }

  .sticker {
    grid-row: span 2;
    margin: 0 0 0 3px;
  }

  .hero-cube {
    margin: -3.5rem 0 -2.5rem;
    scale: 0.75;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tile:hover .sticker,
  .tile:focus-visible .sticker,
  .tile:active .sticker,
  .tile:hover .sticker svg {
    transform: none;
  }
}
</style>
