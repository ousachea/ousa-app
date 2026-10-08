<script setup lang="ts">
import type { ToolIconName } from '~/utils/tools'
import type { RenewalStatus } from '~/utils/renewals'

// The personal part of the home page (CHECKLIST.md #64): a greeting, quick actions, what's coming up,
// your favourites and what you added lately. Everything is read from what's saved on this device,
// so it's instant and works offline; each item links straight to it in its app.
const now = ref(new Date())
const data = ref<Record<string, Record<string, any>[]>>({})
const NAMES = ['renewals', 'countdown', 'bookmarks', 'things', 'contacts', 'eat']

function load() {
  now.value = new Date()
  data.value = Object.fromEntries(NAMES.map(n => [n, readCollection(n)]))
}
const onStorage = (e: StorageEvent) => {
  if (!e.key || NAMES.some(n => e.key === `ousa-app:${n}`)) load()
}
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  load()
  window.addEventListener('storage', onStorage)
  // Keep "in 3 days" honest if the page stays open overnight
  timer = setInterval(() => (now.value = new Date()), 60_000)
})
onBeforeUnmount(() => {
  window.removeEventListener('storage', onStorage)
  clearInterval(timer)
})

const greeting = computed(() => {
  const h = now.value.getHours()
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
})
const today = computed(() => now.value.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))
const isEmpty = computed(() => NAMES.every(n => !(data.value[n]?.length)))

// ---------- Quick actions ----------
const QUICK: { label: string, app: string, icon: ToolIconName }[] = [
  { label: 'Bookmark', app: '/bookmarks', icon: 'bookmarks' },
  { label: 'Device', app: '/things', icon: 'things' },
  { label: 'Renewal', app: '/renewals', icon: 'renewals' },
  { label: 'Countdown', app: '/countdown', icon: 'countdown' },
  { label: 'Contact', app: '/phone', icon: 'phone' }
]
const toolOf = (app: string) => pageFor(app)

// ---------- Upcoming ----------
const daysText = (d: number) => (d < 0 ? 'ended' : d === 0 ? 'today' : d === 1 ? 'tomorrow' : `${d} days`)
const renewals = computed(() => (data.value.renewals ?? [])
  .map((r) => {
    const next = nextRenewal(r.nextDate, r.cycle, now.value)
    const days = daysUntil(next, now.value)
    return { ...r, next, days, status: statusOf(days) }
  })
  .filter(r => r.days >= 0)
  .sort((a, b) => a.days - b.days)
  .slice(0, 5))

const countdowns = computed(() => (data.value.countdown ?? [])
  .map(c => ({ ...c, days: Math.ceil((new Date(`${c.date}T${c.time || '00:00'}`).getTime() - now.value.getTime()) / 86_400_000) }))
  .filter(c => c.days >= 0)
  .sort((a, b) => a.days - b.days)
  .slice(0, 4))

// ---------- Recent and favourite ----------
const byNewest = (list: Record<string, any>[]) => [...list].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
const recentBookmarks = computed(() => byNewest(data.value.bookmarks ?? []).slice(0, 5))
const recentThings = computed(() => byNewest(data.value.things ?? []).slice(0, 5))

// Starred records from every app (#66); pinned bookmarks count as favourites
const favourites = computed(() => [
  ...(data.value.bookmarks ?? []).filter(b => b.pinned || b.favorite).map(b => ({ id: b.id, app: '/bookmarks', title: b.title, sub: hostOf(b.url), href: b.url, external: true })),
  ...(data.value.things ?? []).filter(t => t.favorite).map(t => ({ id: t.id, app: '/things', title: t.name, sub: typeOf(t.category).label, href: `/things?focus=${t.id}`, external: false })),
  ...(data.value.renewals ?? []).filter(r => r.favorite).map(r => ({ id: r.id, app: '/renewals', title: r.name, sub: formatMoney(r.price, r.currency), href: `/renewals?focus=${r.id}`, external: false })),
  ...(data.value.countdown ?? []).filter(c => c.favorite).map(c => ({ id: c.id, app: '/countdown', title: c.title, sub: c.date, href: `/countdown?focus=${c.id}`, external: false })),
  ...(data.value.contacts ?? []).filter(c => c.favorite).map(c => ({ id: c.id, app: '/phone', title: c.name || c.phone, sub: c.phone, href: `/phone?focus=${c.id}`, external: false }))
].slice(0, 12))

const { log } = useActivity()
const { openPalette } = usePalette()
const isMac = ref(false)
onMounted(() => (isMac.value = /Mac|iPhone|iPad/.test(navigator.platform)))
const brokenIcons = ref(new Set<string>())
</script>

<template>
  <section class="dashboard" aria-label="Your dashboard">
    <header class="hello">
      <div>
        <h2>{{ greeting }}</h2>
        <p>{{ today }}</p>
      </div>
      <button type="button" class="search-btn" @click="openPalette()">
        <ToolIcon name="search" />
        <span>Search everything</span>
        <kbd>{{ isMac ? '⌘' : 'Ctrl' }} K</kbd>
      </button>
    </header>

    <!-- Quick actions -->
    <nav class="quick" aria-label="Quick add">
      <NuxtLink v-for="q in QUICK" :key="q.label" :to="`${q.app}?add=1`" class="quick-btn" :style="{ '--c': toolOf(q.app)?.color, '--on-c': toolOf(q.app)?.onColor ?? '#fff' }">
        <span class="q-icon" aria-hidden="true"><ToolIcon :name="q.icon" /></span>
        <span><span class="sr-only">Add a </span>{{ q.label }}</span>
      </NuxtLink>
    </nav>

    <div v-if="isEmpty" class="panel welcome">
      <EmptyState title="Welcome to your dashboard" icon="plus" :level="3">
        Add a bookmark, something you own, a subscription or a date to count down to, and this page fills up with what’s coming next, your favourites and what you added lately.
      </EmptyState>
    </div>

    <div v-else class="cards">
      <!-- Upcoming renewals -->
      <section v-if="renewals.length" class="panel card" aria-labelledby="dash-renewals">
        <header><h3 id="dash-renewals">Upcoming renewals</h3><NuxtLink to="/renewals" class="link">All</NuxtLink></header>
        <ul>
          <li v-for="r in renewals" :key="r.id">
            <NuxtLink :to="`/renewals?focus=${r.id}`" class="row">
              <RenewalIcon :name="r.name" :icon="r.icon" class="small-icon" />
              <span class="text"><strong>{{ r.name }}</strong><span>{{ formatMoney(r.price, r.currency) }}</span></span>
              <span class="badge" :class="STATUS[r.status as RenewalStatus].badge">{{ daysText(r.days) }}</span>
            </NuxtLink>
          </li>
        </ul>
      </section>

      <!-- Active countdowns -->
      <section v-if="countdowns.length" class="panel card" aria-labelledby="dash-countdowns">
        <header><h3 id="dash-countdowns">Counting down</h3><NuxtLink to="/countdown" class="link">All</NuxtLink></header>
        <ul>
          <li v-for="c in countdowns" :key="c.id">
            <NuxtLink :to="`/countdown?focus=${c.id}`" class="row">
              <span class="days-tile"><b>{{ c.days }}</b><small>{{ c.days === 1 ? 'day' : 'days' }}</small></span>
              <span class="text"><strong>{{ c.title }}</strong><span>{{ new Date(`${c.date}T00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) }}</span></span>
            </NuxtLink>
          </li>
        </ul>
      </section>

      <!-- Favourites -->
      <section v-if="favourites.length" class="panel card" aria-labelledby="dash-favs">
        <header><h3 id="dash-favs">Favourites</h3></header>
        <ul>
          <li v-for="f in favourites" :key="`${f.app}-${f.id}`">
            <component :is="f.external ? 'a' : 'NuxtLink'" :to="f.external ? undefined : f.href" :href="f.external ? f.href : undefined" :target="f.external ? '_blank' : undefined" :rel="f.external ? 'noopener' : undefined" class="row">
              <span class="app-dot" aria-hidden="true" :style="{ '--c': toolOf(f.app)?.color, '--on-c': toolOf(f.app)?.onColor ?? '#fff' }"><ToolIcon :name="toolOf(f.app)?.icon ?? 'list'" /></span>
              <span class="text"><strong>{{ f.title }}</strong><span>{{ f.sub }}</span></span>
              <span class="star" aria-label="Favourite">★</span>
            </component>
          </li>
        </ul>
      </section>

      <!-- Recently added -->
      <section v-if="recentBookmarks.length || recentThings.length" class="panel card" aria-labelledby="dash-recent">
        <header><h3 id="dash-recent">Recently added</h3></header>
        <ul>
          <li v-for="b in recentBookmarks.slice(0, 3)" :key="b.id">
            <a :href="b.url" target="_blank" rel="noopener" class="row">
              <span class="site-icon" aria-hidden="true">
                <img v-if="b.icon && !brokenIcons.has(b.icon)" :src="b.icon" alt="" referrerpolicy="no-referrer" @error="brokenIcons.add(b.icon)">
                <ToolIcon v-else name="bookmarks" />
              </span>
              <span class="text"><strong>{{ b.title }}</strong><span>Bookmark · {{ hostOf(b.url) }}</span></span>
            </a>
          </li>
          <li v-for="t in recentThings.slice(0, 3)" :key="t.id">
            <NuxtLink :to="`/things?focus=${t.id}`" class="row">
              <span class="site-icon" aria-hidden="true">
                <img v-if="companyLogo(t.company) && !brokenIcons.has(companyLogo(t.company)!)" :src="companyLogo(t.company)" alt="" @error="brokenIcons.add(companyLogo(t.company)!)">
                <CategoryIcon v-else :name="typeOf(t.category).icon" />
              </span>
              <span class="text"><strong>{{ t.name }}</strong><span>{{ typeOf(t.category).label }}{{ t.company ? ` · ${t.company}` : '' }}</span></span>
            </NuxtLink>
          </li>
        </ul>
      </section>

      <!-- Recent activity -->
      <section v-if="log.length" id="activity" class="panel card wide" aria-labelledby="dash-activity">
        <header><h3 id="dash-activity">Recent activity</h3></header>
        <ActivityFeed :limit="6" />
      </section>
    </div>
  </section>
</template>

<style scoped>
.dashboard {
  width: 100%;
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.hello {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.75rem 1rem;
}

.hello h2 {
  font-size: clamp(1.6rem, 4vw, 2.1rem);
  letter-spacing: -0.03em;
}

.hello p {
  margin: 0.2rem 0 0;
  color: var(--ink-2);
}

.search-btn {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: min(100%, 20rem);
  min-height: 2.75rem;
  padding: 0 0.6rem 0 0.9rem;
  font: inherit;
  color: var(--ink-3);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  cursor: pointer;
  transition: border-color var(--dur-fast);
}

.search-btn:hover {
  border-color: var(--ink-3);
}

.search-btn span {
  flex: 1;
  text-align: left;
}

.quick {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.quick-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.6rem;
  padding: 0 0.95rem 0 0.4rem;
  font-weight: 600;
  color: var(--ink);
  text-decoration: none;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 999px;
  transition: border-color var(--dur-fast), translate var(--dur-fast);
}

.quick-btn:hover {
  border-color: var(--c);
  translate: 0 -1px;
}

.q-icon {
  width: 1.9rem;
  height: 1.9rem;
  display: grid;
  place-items: center;
  font-size: 1rem;
  color: var(--on-c);
  background: var(--c);
  border-radius: 50%;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
  gap: 1rem;
  align-items: start;
}

.card {
  padding: 1rem 0.75rem 0.75rem;
}

.card.wide {
  grid-column: 1 / -1;
}

.card header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0 0.5rem 0.5rem;
}

.card h3 {
  font-size: 1rem;
}

.card ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-height: 3rem;
  padding: 0.35rem 0.5rem;
  color: var(--ink);
  text-decoration: none;
  border-radius: var(--radius);
  transition: background-color var(--dur-fast);
}

.row:hover {
  background: var(--surface-2);
}

.text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.text strong,
.text span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.text span {
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.small-icon {
  width: 2.1rem;
  height: 2.1rem;
}

.days-tile {
  flex: none;
  width: 2.6rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.1;
  padding: 0.25rem 0;
  color: #fff;
  background: var(--purple);
  border-radius: 10px;
}

.days-tile b {
  font-variant-numeric: tabular-nums;
}

.days-tile small {
  font-size: 0.65rem;
}

.app-dot,
.site-icon {
  flex: none;
  width: 2.1rem;
  height: 2.1rem;
  display: grid;
  place-items: center;
  font-size: 1.05rem;
  border-radius: 10px;
}

.app-dot {
  color: var(--on-c);
  background: var(--c);
}

.site-icon {
  color: var(--ink-2);
  background: var(--surface-2);
  box-shadow: inset 0 0 0 1px var(--line);
}

.site-icon img {
  width: 1.3rem;
  height: 1.3rem;
  object-fit: contain;
}

.star {
  color: var(--gold);
}

.welcome {
  padding: 0.5rem;
}
</style>
