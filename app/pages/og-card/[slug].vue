<script setup lang="ts">
// A 1200×630 social-share card for one page, screenshotted into public/og/<slug>.png by
// scripts/og-images.cjs. Not meant for people: it's left out of search and the sitemap.
const route = useRoute()
const slug = computed(() => String(route.params.slug))
const tool = computed(() => [...TOOLS, SETTINGS].find(t => ogSlug(t.to) === slug.value))

useHead({ title: () => tool.value?.name ?? 'Ousa’s Apps', titleTemplate: '%s' })
useSeoMeta({ robots: 'noindex, nofollow' })

// Light text on dark colours, dark text on light ones (yellow, gold)
const ink = computed(() => tool.value?.onColor ?? '#ffffff')
</script>

<template>
  <!-- Home: the cube of app icons on black plastic -->
  <div v-if="slug === 'home'" class="card home">
    <div class="home-text">
      <p class="brand"><AppLogo class="brand-logo" />Ousa’s Apps</p>
      <h1>Free tools and trackers for life in Cambodia</h1>
      <p class="list">Phone checker · KHR/USD · Gold in chi &amp; damlung · Salary tax · QR codes · Passwords · and more</p>
    </div>
    <div class="home-cube">
      <RubikCube :size="74" :links="TOOLS" app-colors />
    </div>
  </div>

  <!-- One app: its colour, its icon and what it does -->
  <div v-else-if="tool" class="card app" :style="{ '--c': tool.color, '--ink': ink }">
    <div class="grid" aria-hidden="true">
      <i v-for="n in 9" :key="n" />
    </div>
    <p class="brand"><AppLogo class="brand-logo" />Ousa’s Apps</p>
    <div class="body">
      <span class="sticker"><ToolIcon :name="tool.icon" /></span>
      <h1>{{ tool.name }}</h1>
      <p class="summary">{{ tool.summary }}</p>
    </div>
  </div>

  <p v-else>No card for “{{ slug }}”.</p>
</template>

<style scoped>
.card {
  position: relative;
  width: 1200px;
  height: 630px;
  overflow: hidden;
  font-family: var(--font);
  -webkit-font-smoothing: antialiased;
}

.brand {
  display: flex;
  align-items: center;
  gap: 18px;
  margin: 0;
  font-size: 34px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.brand-logo {
  width: 56px;
  height: 56px;
}

/* ---------- Home ---------- */
.home {
  display: grid;
  grid-template-columns: 1fr 470px;
  align-items: center;
  padding: 0 40px 0 80px;
  color: #fff;
  background:
    radial-gradient(circle at 78% 50%, rgb(255 255 255 / 0.1), transparent 55%),
    #12151d;
}

.home h1 {
  margin: 34px 0 0;
  font-size: 74px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.04em;
  text-wrap: balance;
}

.home .list {
  margin: 30px 0 0;
  max-width: 600px;
  font-size: 27px;
  line-height: 1.4;
  color: #b7bdca;
}

.home-cube {
  display: grid;
  place-items: center;
}

/* ---------- One app ---------- */
.app {
  padding: 64px 80px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  color: var(--ink);
  background: var(--c);
}

/* A faint 3×3 cube face bleeding off the right edge */
.grid {
  position: absolute;
  right: -110px;
  top: 50%;
  width: 560px;
  height: 560px;
  translate: 0 -50%;
  rotate: -12deg;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 22px;
  opacity: 0.16;
}

.grid i {
  border-radius: 40px;
  background: var(--ink);
}

.app .brand {
  position: relative;
}

.body {
  position: relative;
  max-width: 860px;
}

/* The app icon as a sticker on black plastic, like on the home cube */
.sticker {
  width: 132px;
  height: 132px;
  display: grid;
  place-items: center;
  font-size: 76px;
  /* A deeper shade of the app colour so light colours (yellow, gold) still stand out on white */
  color: color-mix(in srgb, var(--c) 72%, #000);
  background: #fff;
  border-radius: 34px;
  box-shadow: 0 0 0 10px #12151d, 0 24px 50px rgb(0 0 0 / 0.25);
}

.sticker :deep(svg) {
  width: 1em;
  height: 1em;
}

.app h1 {
  margin: 44px 0 0;
  font-size: 104px;
  font-weight: 800;
  line-height: 0.95;
  letter-spacing: -0.045em;
}

.summary {
  margin: 22px 0 0;
  font-size: 34px;
  line-height: 1.3;
  font-weight: 500;
  opacity: 0.92;
  text-wrap: balance;
}
</style>
