<script setup lang="ts">
import type { AmbientCategoryId } from '~/types/ambient-studio'
import { AMBIENT_PRESETS } from '~/data/ambient-studio/presets'
import { useAmbientPresets } from '~/composables/ambient-studio/useAmbientPresets'
import { useAmbientStudio } from '~/composables/ambient-studio/useAmbientStudio'
import { useAmbientTimer } from '~/composables/ambient-studio/useAmbientTimer'
import { useAmbientView } from '~/composables/ambient-studio/useAmbientView'

// The library under the stage: Home (quick starts, favourites, recents, categories), Browse
// (search and filter), Favourites, Recently played and Your mixes.
const { ui, go, browse } = useAmbientView()
const library = useAmbientPresets()
const studio = useAmbientStudio()
const timer = useAmbientTimer()
const hydrated = useHydrated()
const { play } = useSound()

// ---------- Home ----------
const greeting = computed(() => {
  if (!hydrated.value) return 'Set the mood'
  const h = new Date().getHours()
  if (h < 5) return 'Late night'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
})

const QUICK = [
  { id: 'deep-focus', label: 'Focus for 25 minutes', hint: 'Deep Focus with a focus timer', timer: 'focus' as const },
  { id: 'peaceful-night', label: 'Sleep in 30 minutes', hint: 'Peaceful Night, fades out by itself', timer: 'sleep' as const },
  { id: 'rainy-window', label: 'Just rain', hint: 'Rain on the window' },
  { id: 'brown-noise-room', label: 'Block out the room', hint: 'Brown noise, works offline' }
]

function quickStart(q: typeof QUICK[number]) {
  const item = library.byId(q.id)
  if (!item) return
  studio.select(item)
  if (q.timer) {
    timer.setMode(q.timer)
    timer.start()
  }
  play('select')
}

const last = computed(() => (hydrated.value ? library.recent.value[0]?.item : undefined))
const continuing = computed(() => last.value && studio.current.value.id === last.value.id)

function onContinue() {
  if (!last.value) return
  if (continuing.value) {
    if (!studio.playing.value) studio.togglePlay()
  } else {
    studio.select(last.value)
  }
  play('select')
}

const favs = computed(() => (hydrated.value ? library.favorites.value : []))
const recents = computed(() => (hydrated.value ? library.recent.value : []))

// ---------- Browse ----------
const results = computed(() => library.search(ui.query, ui.category))
const searchInput = ref<HTMLInputElement>()

function pickCategory(id: AmbientCategoryId | 'mine' | null) {
  ui.category = ui.category === id ? null : id
  play('select')
}

function clearSearch() {
  ui.query = ''
  ui.category = null
  searchInput.value?.focus()
}

watch(() => ui.view, (v) => {
  if (v === 'browse') nextTick(() => searchInput.value?.focus({ preventScroll: true }))
})

const ago = (at: number) => {
  const mins = Math.round((Date.now() - at) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

const categoryCover = (id: AmbientCategoryId) => AMBIENT_PRESETS.find(p => p.category === id)?.artwork
</script>

<template>
  <section class="ambient-studio-library" aria-label="Library">
    <AmbientStudioNav variant="tabs" class="tabs-nav" />

    <!-- Your YouTube Music -->
    <AmbientStudioMusic v-if="ui.view === 'music'" class="view" />

    <!-- Scenes -->
    <div v-else-if="ui.view === 'home'" class="view">
      <header class="intro">
        <h2>{{ greeting }}</h2>
        <p>Pick a scene, or start with one of these.</p>
      </header>

      <div class="quick">
        <button v-for="q in QUICK" :key="q.id" type="button" class="quick-btn" :style="{ '--tint': library.byId(q.id)?.tint }" @click="quickStart(q)">
          <img :src="library.byId(q.id)?.artwork" alt="" width="160" height="90" loading="lazy">
          <span>
            <strong>{{ q.label }}</strong>
            <small>{{ q.hint }}</small>
          </span>
        </button>
      </div>

      <div v-if="last" class="continue" :style="{ '--tint': last.tint }">
        <img :src="last.artwork" alt="" width="160" height="90" loading="lazy">
        <div>
          <span class="eyebrow">Continue listening</span>
          <strong>{{ last.name }}</strong>
        </div>
        <button type="button" class="btn btn-sm" @click="onContinue">
          <AmbientStudioIcon name="play" /> {{ continuing && studio.playing.value ? 'Playing' : 'Resume' }}
        </button>
      </div>

      <section v-if="favs.length" class="block">
        <div class="block-head">
          <h3>Favourites</h3>
          <button type="button" class="more" @click="go('favorites')">See all</button>
        </div>
        <AmbientStudioGrid :items="favs.slice(0, 4)" label="Favourite scenes" />
      </section>

      <section v-if="recents.length" class="block">
        <div class="block-head">
          <h3>Recently played</h3>
          <button type="button" class="more" @click="go('recent')">See all</button>
        </div>
        <AmbientStudioGrid :items="recents.slice(0, 4).map(r => r.item)" label="Recently played scenes" />
      </section>

      <section class="block">
        <div class="block-head">
          <h3>Moods</h3>
        </div>
        <ul class="moods">
          <li v-for="c in library.categories" :key="c.id">
            <button type="button" class="mood" @click="browse(c.id)">
              <img :src="categoryCover(c.id)" alt="" width="160" height="90" loading="lazy">
              <span>
                <strong>{{ c.name }}</strong>
                <small>{{ c.blurb }}</small>
              </span>
            </button>
          </li>
        </ul>
      </section>

      <section class="block">
        <div class="block-head">
          <h3>All scenes</h3>
          <button type="button" class="more" @click="browse()">Search</button>
        </div>
        <AmbientStudioGrid :items="library.all.value" label="All scenes" />
      </section>
    </div>

    <!-- Browse -->
    <div v-else-if="ui.view === 'browse'" class="view">
      <div class="search">
        <AmbientStudioIcon name="search" class="search-icon" />
        <label for="ambient-studio-search" class="sr-only">Search scenes</label>
        <input
          id="ambient-studio-search"
          ref="searchInput"
          v-model="ui.query"
          type="search"
          class="input"
          placeholder="Search scenes, moods, tags…"
          autocomplete="off"
          @keydown.esc="ui.query ? (ui.query = '') : null"
        >
        <button v-if="ui.query" type="button" class="clear" aria-label="Clear search" @click="clearSearch">
          <AmbientStudioIcon name="x" />
        </button>
      </div>
      <div class="filters" role="group" aria-label="Filter by mood">
        <button type="button" class="filter" :aria-pressed="ui.category === null" @click="ui.category = null">All</button>
        <button v-for="c in library.categories" :key="c.id" type="button" class="filter" :aria-pressed="ui.category === c.id" @click="pickCategory(c.id)">
          {{ c.name }}
        </button>
        <button v-if="library.mixes.value.length" type="button" class="filter" :aria-pressed="ui.category === 'mine'" @click="pickCategory('mine')">Your mixes</button>
      </div>
      <p class="result-count" role="status">{{ results.length }} {{ results.length === 1 ? 'scene' : 'scenes' }}</p>
      <AmbientStudioGrid v-if="results.length" :items="results" label="Search results" />
      <div v-else class="empty">
        <h3>Nothing matches</h3>
        <p>Try fewer words, or another mood.</p>
        <button type="button" class="btn btn-sm" @click="clearSearch">Clear search</button>
      </div>
    </div>

    <!-- Favourites -->
    <div v-else-if="ui.view === 'favorites'" class="view">
      <h2 class="view-title">Favourites</h2>
      <AmbientStudioGrid v-if="favs.length" :items="favs" label="Favourite scenes" />
      <div v-else class="empty">
        <h3>No favourites yet</h3>
        <p>Tap the heart on any scene to keep it here.</p>
        <button type="button" class="btn btn-sm" @click="browse()">Browse scenes</button>
      </div>
    </div>

    <!-- Recently played -->
    <div v-else-if="ui.view === 'recent'" class="view">
      <div class="view-head">
        <h2 class="view-title">Recently played</h2>
        <button v-if="recents.length" type="button" class="more" @click="library.clearRecent()">Clear all</button>
      </div>
      <ul v-if="recents.length" class="recent">
        <li v-for="r in recents" :key="r.id">
          <AmbientStudioCard :item="r.item" compact />
          <span class="when">{{ ago(r.at) }}</span>
          <button type="button" class="remove" :aria-label="`Remove ${r.item.name} from recently played`" title="Remove" @click="library.removeRecent(r.id)">
            <AmbientStudioIcon name="x" />
          </button>
        </li>
      </ul>
      <div v-else class="empty">
        <h3>Nothing played yet</h3>
        <p>Scenes you play show up here, newest first.</p>
        <button type="button" class="btn btn-sm" @click="go('home')">Pick a scene</button>
      </div>
    </div>

    <!-- Your mixes -->
    <div v-else class="view">
      <h2 class="view-title">Your mixes</h2>
      <AmbientStudioGrid v-if="hydrated && library.mixes.value.length" :items="library.mixes.value" label="Your mixes" />
      <div v-else class="empty">
        <h3>No mixes yet</h3>
        <p>Set the sounds you like in the mixer, then choose <strong>Save as mix</strong>. It keeps the scene and video too.</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ambient-studio-library {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-width: 0;
}

/* The sidebar has the list on wide screens */
.tabs-nav {
  display: none;
}

@media (max-width: 1180px) {
  .tabs-nav {
    display: flex;
  }
}

.view {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

.intro h2,
.view-title {
  font-size: clamp(1.4rem, 3vw, 1.9rem);
  font-weight: 750;
  letter-spacing: -0.03em;
  color: var(--as-ink);
}

.intro p {
  margin: 0.35rem 0 0;
  color: var(--as-ink-2);
}

.view-head,
.block-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.block {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.block-head h3 {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--as-ink);
}

.more {
  padding: 0.25rem 0;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--as-ink-3);
  background: none;
  border: 0;
  cursor: pointer;
}

.more:hover {
  color: var(--tint);
}

/* ---------- Quick starts ---------- */
.quick {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
  gap: 0.6rem;
}

.quick-btn,
.mood {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  width: 100%;
  padding: 0.5rem 0.9rem 0.5rem 0.5rem;
  font: inherit;
  text-align: left;
  color: var(--as-ink);
  background: rgb(255 255 255 / 0.035);
  border: 1px solid var(--as-line);
  border-radius: 14px;
  cursor: pointer;
  transition: background-color var(--dur-fast), border-color var(--dur-fast), translate var(--dur-fast);
}

.quick-btn:hover,
.mood:hover {
  background: rgb(255 255 255 / 0.06);
  border-color: color-mix(in srgb, var(--tint, #fff) 35%, transparent);
}

.quick-btn:active,
.mood:active {
  translate: 0 1px;
}

.quick-btn img,
.mood img {
  width: 3.75rem;
  height: 2.6rem;
  flex: none;
  object-fit: cover;
  border-radius: 9px;
}

.quick-btn span,
.mood span {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.quick-btn strong,
.mood strong {
  font-size: 0.9rem;
  font-weight: 650;
}

.quick-btn small,
.mood small {
  font-size: 0.78rem;
  color: var(--as-ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---------- Continue ---------- */
.continue {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem 0.75rem 0.75rem;
  background: linear-gradient(100deg, color-mix(in srgb, var(--tint) 14%, transparent), transparent 70%);
  border: 1px solid color-mix(in srgb, var(--tint) 25%, var(--as-line));
  border-radius: 16px;
}

.continue img {
  width: 5rem;
  height: 3rem;
  object-fit: cover;
  border-radius: 10px;
}

.continue div {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.continue .eyebrow {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--tint);
}

.continue strong {
  color: var(--as-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---------- Moods ---------- */
.moods {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
  gap: 0.6rem;
}

/* ---------- Browse ---------- */
.search {
  position: relative;
}

.search .input {
  padding-left: 2.6rem;
  padding-right: 2.75rem;
  min-height: 3rem;
}

.search-icon {
  position: absolute;
  left: 0.9rem;
  top: 50%;
  translate: 0 -50%;
  font-size: 1.1rem;
  color: var(--as-ink-3);
  pointer-events: none;
}

.clear {
  position: absolute;
  right: 0.4rem;
  top: 50%;
  translate: 0 -50%;
  width: 2.25rem;
  height: 2.25rem;
  display: grid;
  place-items: center;
  color: var(--as-ink-3);
  background: none;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
}

.clear:hover {
  color: var(--as-ink);
  background: var(--as-hover);
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: -0.75rem;
}

.filter {
  min-height: 2.1rem;
  padding: 0 0.85rem;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--as-ink-2);
  background: none;
  border: 1px solid var(--as-line);
  border-radius: 999px;
  cursor: pointer;
  transition: color var(--dur-fast), background-color var(--dur-fast), border-color var(--dur-fast);
}

.filter:hover {
  color: var(--as-ink);
}

.filter[aria-pressed='true'] {
  color: #0b0d12;
  background: var(--tint);
  border-color: var(--tint);
}

.result-count {
  margin: -0.75rem 0 0;
  font-size: 0.8rem;
  color: var(--as-ink-3);
}

/* ---------- Recently played ---------- */
.recent {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.recent li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.45rem 0.4rem 0.45rem 0.45rem;
  border-radius: 14px;
  transition: background-color var(--dur-fast);
}

.recent li:hover {
  background: rgb(255 255 255 / 0.035);
}

.when {
  font-size: 0.8rem;
  color: var(--as-ink-3);
  white-space: nowrap;
}

.remove {
  width: 2.25rem;
  height: 2.25rem;
  display: grid;
  place-items: center;
  color: var(--as-ink-3);
  background: none;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
}

.remove:hover {
  color: var(--as-ink);
  background: var(--as-hover);
}

/* ---------- Empty states ---------- */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 3rem 1.5rem;
  text-align: center;
  border: 1px dashed var(--as-line);
  border-radius: 18px;
}

.empty h3 {
  font-size: 1.1rem;
  color: var(--as-ink);
}

.empty p {
  margin: 0 0 0.5rem;
  max-width: 26rem;
  color: var(--as-ink-2);
}

@media (max-width: 520px) {
  .when {
    display: none;
  }
}
</style>
