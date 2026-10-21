<script setup lang="ts">
import type { FeatureKey } from '~/utils/features'

// Settings → App features: every app against every feature (utils/features.ts), as cards (one per app,
// its features as pills) or as a table (apps down, features across). Pick features to see only the apps
// that have them all; tick two or more apps to compare them, and the features they don't share light up.
const apps = TOOLS.filter(t => APP_FEATURES[t.to])
const wanted = ref<FeatureKey[]>([])
const comparing = ref<string[]>([])
const onlyDiffs = ref(false)
const { play } = useSound()

// A line icon for each feature, in the column heads, the pills and the key
const FEATURE_ICON: Record<FeatureKey, string> = {
  sync: 'lucide:refresh-cw',
  demo: 'lucide:flask-conical',
  drag: 'lucide:grip-vertical',
  folders: 'lucide:folder',
  search: 'lucide:search',
  views: 'lucide:layout-grid',
  select: 'lucide:list-checks',
  trash: 'lucide:trash-2',
  quickAdd: 'lucide:zap',
  drafts: 'lucide:file-pen',
  formats: 'lucide:file-type',
  copy: 'lucide:copy',
  download: 'lucide:download'
}

// Cards or table, remembered; until you pick, phones get cards (the table is wide) and bigger screens the table
type View = 'cards' | 'table'
const savedView = useRemembered<View | ''>('features-view', '', v => v === '' || v === 'cards' || v === 'table')
const narrow = ref(false)
onMounted(() => (narrow.value = matchMedia('(max-width: 760px)').matches))
const view = computed<View>(() => savedView.value || (narrow.value ? 'cards' : 'table'))
function setView(v: View) {
  savedView.value = v
  play('select')
}

function toggleFeature(k: FeatureKey) {
  wanted.value = wanted.value.includes(k) ? wanted.value.filter(x => x !== k) : [...wanted.value, k]
  play('select')
}
function toggleCompare(to: string) {
  comparing.value = comparing.value.includes(to) ? comparing.value.filter(x => x !== to) : [...comparing.value, to]
  play('select')
}
function reset() {
  wanted.value = []
  comparing.value = []
  onlyDiffs.value = false
  play('toggle-off')
}

const rows = computed(() => {
  let list = apps.filter(a => wanted.value.every(k => hasFeature(a.to, k)))
  if (comparing.value.length >= 2) list = list.filter(a => comparing.value.includes(a.to))
  return list
})

// With apps ticked to compare: a feature differs when some of them have it and some don't
const compared = computed(() => (comparing.value.length >= 2 ? comparing.value : []))
const differs = (k: FeatureKey) => {
  if (!compared.value.length) return false
  const has = compared.value.map(a => hasFeature(a, k))
  return has.some(Boolean) && !has.every(Boolean)
}
const columns = computed(() => (onlyDiffs.value && compared.value.length ? FEATURES.filter(f => differs(f.key)) : FEATURES))
const countOf = (to: string) => APP_FEATURES[to]?.length ?? 0
const shareOf = (to: string) => countOf(to) / FEATURES.length
const featuresOf = (to: string) => FEATURES.filter(f => hasFeature(to, f.key) && columns.value.includes(f))
</script>

<template>
  <div class="features">
    <!-- Filters, the view switch and Clear, together in one panel -->
    <section class="panel toolbar">
      <div class="toolbar-head">
        <h3>Show apps with</h3>
        <div class="views" role="radiogroup" aria-label="Show as">
          <button type="button" role="radio" :aria-checked="view === 'cards'" @click="setView('cards')"><AppIcon name="lucide:layout-dashboard" />Cards</button>
          <button type="button" role="radio" :aria-checked="view === 'table'" @click="setView('table')"><AppIcon name="lucide:table" />Table</button>
        </div>
      </div>
      <div class="filters" role="group" aria-label="Show apps that have">
        <button
          v-for="f in FEATURES"
          :key="f.key"
          type="button"
          class="chip"
          :class="{ on: wanted.includes(f.key) }"
          :aria-pressed="wanted.includes(f.key)"
          :title="f.description"
          @click="toggleFeature(f.key)"
        >
          <AppIcon :name="FEATURE_ICON[f.key]" />{{ f.label }}
        </button>
      </div>
      <div class="compare-bar">
        <p v-if="comparing.length < 2" class="note">
          <AppIcon name="lucide:info" />
          {{ comparing.length === 1 ? 'Tick one more app to compare them.' : 'Tick two or more apps to compare them.' }}
        </p>
        <template v-else>
          <p class="note"><strong>Comparing {{ comparing.length }} apps.</strong> Features only some of them have are highlighted.</p>
          <label class="check"><input v-model="onlyDiffs" type="checkbox">Only differences</label>
        </template>
        <span class="count">{{ rows.length }} of {{ apps.length }} apps</span>
        <button v-if="wanted.length || comparing.length" type="button" class="btn btn-quiet btn-sm" @click="reset"><AppIcon name="lucide:x" />Clear</button>
      </div>
    </section>

    <!-- ---------- Cards: one per app, its features as pills ---------- -->
    <div v-if="view === 'cards'" class="cards">
      <article v-for="a in rows" :key="a.to" class="panel card" :class="{ picked: comparing.includes(a.to) }">
        <label class="card-head">
          <span class="tile" :style="{ background: a.gradient ?? a.color, color: a.onColor ?? '#fff' }" aria-hidden="true"><ToolIcon :name="a.icon" /></span>
          <span class="card-name">
            <strong>{{ a.name }}</strong>
            <small>{{ countOf(a.to) }} of {{ FEATURES.length }} features</small>
          </span>
          <input type="checkbox" :checked="comparing.includes(a.to)" :aria-label="`Compare ${a.name}`" @change="toggleCompare(a.to)">
        </label>
        <span class="bar" aria-hidden="true"><span :style="{ width: `${shareOf(a.to) * 100}%`, background: a.color }" /></span>
        <ul v-if="featuresOf(a.to).length" class="pills">
          <li v-for="f in featuresOf(a.to)" :key="f.key" :class="{ diff: differs(f.key), want: wanted.includes(f.key) }" :title="f.description">
            <AppIcon :name="FEATURE_ICON[f.key]" />{{ f.label }}
          </li>
        </ul>
        <p v-else class="none">{{ countOf(a.to) ? 'None of these differ.' : 'A single tool: no lists to save, so none of these apply.' }}</p>
      </article>
    </div>

    <!-- ---------- Table: apps down, features across. Scrolls sideways on its own; the app column stays ---------- -->
    <div v-else class="panel table-wrap" tabindex="0" role="region" aria-label="Features of each app">
      <table>
        <thead>
          <tr>
            <th scope="col" class="app-col">App</th>
            <th v-for="f in columns" :key="f.key" scope="col" :title="f.description" :class="{ diff: differs(f.key), want: wanted.includes(f.key) }">
              <span class="col-head"><AppIcon :name="FEATURE_ICON[f.key]" /><span class="col-label">{{ f.label }}</span></span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in rows" :key="a.to" :class="{ picked: comparing.includes(a.to) }">
            <th scope="row" class="app-col">
              <label class="app">
                <input type="checkbox" :checked="comparing.includes(a.to)" :aria-label="`Compare ${a.name}`" @change="toggleCompare(a.to)">
                <span class="tile small" :style="{ background: a.gradient ?? a.color, color: a.onColor ?? '#fff' }" aria-hidden="true"><ToolIcon :name="a.icon" /></span>
                <span class="app-name">{{ a.name }}</span>
                <span class="app-count" :title="`${countOf(a.to)} of ${FEATURES.length} features`">
                  {{ countOf(a.to) }}
                  <span class="mini-bar" aria-hidden="true"><span :style="{ width: `${shareOf(a.to) * 100}%`, background: a.color }" /></span>
                </span>
              </label>
            </th>
            <td v-for="f in columns" :key="f.key" :class="{ diff: differs(f.key), want: wanted.includes(f.key) }">
              <span v-if="hasFeature(a.to, f.key)" class="yes" :style="{ '--app': a.color }" :title="`${a.name}: ${f.label}`">
                <AppIcon name="check" />
                <span class="sr-only">Yes</span>
              </span>
              <span v-else class="no"><span class="sr-only">No</span></span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="!rows.length" class="panel empty">No app has all of those. Take a feature off to see more.</p>
    <p v-else-if="onlyDiffs && !columns.length" class="panel empty">These apps have exactly the same features.</p>

    <!-- What each feature means, folded away until wanted -->
    <details class="panel key">
      <summary><AppIcon name="lucide:info" />What the features mean</summary>
      <dl>
        <div v-for="f in FEATURES" :key="f.key">
          <dt><AppIcon :name="FEATURE_ICON[f.key]" />{{ f.label }}</dt>
          <dd>{{ f.description }}</dd>
        </div>
      </dl>
    </details>
    <p class="foot">Every app also has its own Settings and Import &amp; export, under the gear by its name.</p>
  </div>
</template>

<style scoped>
.features {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ---------- Toolbar ---------- */
.toolbar {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1rem 1.15rem;
}

.toolbar-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
}

.toolbar-head h3 {
  margin: 0;
  font-size: var(--text-xs);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.views {
  display: inline-flex;
  padding: 3px;
  gap: 2px;
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--line);
}

.views button {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.7rem;
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-2);
  background: none;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.views button[aria-checked='true'] {
  color: var(--ink);
  background: var(--surface);
  box-shadow: 0 1px 3px rgb(var(--shadow) / 0.15);
}

.views .app-icon {
  width: 0.95rem;
  height: 0.95rem;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.32rem 0.7rem 0.32rem 0.55rem;
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--ink-2);
  background: var(--surface);
  border: 0;
  border-radius: var(--radius-pill);
  box-shadow: inset 0 0 0 1px var(--line);
  cursor: pointer;
  transition: background-color var(--dur-fast), color var(--dur-fast), box-shadow var(--dur-fast);
}

.chip .app-icon {
  width: 0.9rem;
  height: 0.9rem;
  color: var(--ink-3);
}

.chip:hover {
  color: var(--ink);
  box-shadow: inset 0 0 0 1px var(--ink-3);
}

.chip.on {
  color: var(--on-accent, #fff);
  background: var(--accent);
  box-shadow: none;
}

.chip.on .app-icon {
  color: inherit;
}

.compare-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--line);
}

.note {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.note .app-icon {
  flex: none;
  color: var(--ink-3);
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: var(--text-sm);
  font-weight: 600;
}

.count {
  margin-left: auto;
  font-size: var(--text-sm);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--ink-3);
}

.compare-bar .btn .app-icon {
  width: 0.9rem;
  height: 0.9rem;
}

/* ---------- Cards ---------- */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
  gap: 0.75rem;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 0.95rem 1rem 1rem;
  transition: box-shadow var(--dur-fast);
}

.card.picked {
  box-shadow: 0 0 0 2px var(--accent);
}

.card-head {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  cursor: pointer;
}

.card-name {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.25;
}

.card-name small {
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  color: var(--ink-3);
}

.tile {
  flex: none;
  width: 2.1rem;
  height: 2.1rem;
  display: grid;
  place-items: center;
  font-size: var(--text-title);
  border-radius: var(--radius-sm);
}

.tile.small {
  width: 1.6rem;
  height: 1.6rem;
  font-size: var(--text-sm);
  border-radius: var(--radius-xs);
}

.bar,
.mini-bar {
  display: block;
  overflow: hidden;
  background: color-mix(in srgb, var(--ink) 8%, transparent);
  border-radius: var(--radius-pill);
}

.bar {
  height: 5px;
}

.bar span,
.mini-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
}

.pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pills li {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.55rem 0.2rem 0.45rem;
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--ink-2);
  background: var(--surface-2);
  border-radius: var(--radius-pill);
}

.pills .app-icon {
  width: 0.8rem;
  height: 0.8rem;
  color: var(--ink-3);
}

.pills li.want {
  color: var(--ink);
  box-shadow: inset 0 0 0 1px var(--accent);
}

.pills li.diff {
  color: var(--ink);
  background: color-mix(in srgb, var(--orange) 16%, var(--surface));
}

.none {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--ink-3);
}

/* ---------- Table ---------- */
.table-wrap {
  overflow-x: auto;
  padding: 0;
}

.table-wrap:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: var(--text-sm);
}

th,
td {
  border-bottom: 1px solid var(--line);
}

tbody tr:last-child th,
tbody tr:last-child td {
  border-bottom: 0;
}

/* From the top, so every icon sits on one line whether its name takes one line or two */
thead th {
  padding: 0.8rem 0.1rem 0.65rem;
  vertical-align: top;
  font-weight: 600;
  color: var(--ink-2);
}

/* Icon on top, the name level underneath, wrapping onto two short lines ("Recycle / Bin") */
.col-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  min-width: 3.1rem;
}

.col-head .app-icon {
  width: 1rem;
  height: 1rem;
  color: var(--ink-3);
}

.col-label {
  max-width: 4rem;
  font-size: var(--text-2xs);
  line-height: 1.2;
  text-align: center;
  overflow-wrap: normal;
}

thead .app-col {
  text-align: left;
  vertical-align: bottom;
  padding-left: 1rem;
  font-size: var(--text-xs);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ink-3);
}

/* The app column stays in view while the rest scrolls sideways */
.app-col {
  position: sticky;
  left: 0;
  z-index: 1;
  min-width: 10rem;
  background: var(--surface);
  border-right: 1px solid var(--line);
}

tbody .app-col {
  padding: 0.5rem 0.75rem 0.5rem 1rem;
  text-align: left;
  font-weight: 500;
}

.app {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  cursor: pointer;
}

/* Long names wrap onto a second line rather than widening the column */
.app-name {
  flex: 1;
  min-width: 0;
  line-height: 1.25;
}

.app-count {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.2rem;
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  color: var(--ink-3);
}

.mini-bar {
  width: 1.6rem;
  height: 3px;
}

td {
  padding: 0 0.1rem;
  text-align: center;
}

tbody tr:hover th,
tbody tr:hover td {
  background: color-mix(in srgb, var(--ink) 3%, var(--surface));
}

tr.picked th,
tr.picked td {
  background: color-mix(in srgb, var(--accent) 7%, var(--surface));
}

/* A feature you filtered by, and one the compared apps don't share */
th.want,
td.want {
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}

th.diff,
td.diff {
  background: color-mix(in srgb, var(--orange) 12%, transparent);
}

/* Has it: a small tick in the app's colour. Doesn't: a faint dot */
.yes {
  display: inline-grid;
  place-items: center;
  width: 1.3rem;
  height: 1.3rem;
  color: var(--app, var(--green));
  background: color-mix(in srgb, var(--app, var(--green)) 14%, transparent);
  border-radius: 50%;
}

.yes .app-icon {
  width: 0.8rem;
  height: 0.8rem;
  stroke-width: 3;
}

.no {
  display: inline-block;
  width: 0.3rem;
  height: 0.3rem;
  background: color-mix(in srgb, var(--ink) 18%, transparent);
  border-radius: 50%;
}

.empty {
  margin: 0;
  padding: 1rem 1.15rem;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

/* ---------- What the features mean ---------- */
.key {
  padding: 0;
}

.key summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem 1.15rem;
  font-weight: 600;
  cursor: pointer;
  list-style: none;
}

.key summary::-webkit-details-marker {
  display: none;
}

.key summary .app-icon {
  color: var(--ink-3);
}

.key summary::after {
  content: '';
  width: 0.5rem;
  height: 0.5rem;
  margin-left: auto;
  border-right: 2px solid var(--ink-3);
  border-bottom: 2px solid var(--ink-3);
  rotate: 45deg;
  translate: 0 -2px;
  transition: rotate var(--dur);
}

.key[open] summary::after {
  rotate: 225deg;
  translate: 0 2px;
}

.key dl {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
  gap: 0.85rem 1.25rem;
  margin: 0;
  padding: 0.25rem 1.15rem 1.1rem;
}

.key dt {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: var(--text-sm);
  font-weight: 600;
}

.key dt .app-icon {
  width: 0.95rem;
  height: 0.95rem;
  color: var(--ink-3);
}

.key dd {
  margin: 0.2rem 0 0;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.foot {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--ink-3);
}
</style>
