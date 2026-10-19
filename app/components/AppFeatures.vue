<script setup lang="ts">
import type { FeatureKey } from '~/utils/features'

// Settings → App features: every app against every feature (utils/features.ts).
// Pick features to see only the apps that have them all; tick two or more apps to compare them,
// and the features they don't share light up.
const apps = TOOLS.filter(t => APP_FEATURES[t.to])
const wanted = ref<FeatureKey[]>([])
const comparing = ref<string[]>([])
const onlyDiffs = ref(false)
const { play } = useSound()

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
</script>

<template>
  <div class="features">
    <div class="filters" role="group" aria-label="Show apps that have">
      <span class="filters-label">Show apps with</span>
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
        {{ f.label }}
      </button>
    </div>

    <div class="compare-bar">
      <p v-if="comparing.length < 2" class="note">Tick two or more apps to compare them.</p>
      <template v-else>
        <p class="note"><strong>Comparing {{ comparing.length }} apps.</strong> Features only some of them have are highlighted.</p>
        <label class="check"><input v-model="onlyDiffs" type="checkbox">Only show differences</label>
      </template>
      <button v-if="wanted.length || comparing.length" type="button" class="btn btn-quiet btn-sm" @click="reset">Clear</button>
    </div>

    <!-- The table scrolls sideways on its own on narrow screens; the app column stays put -->
    <div class="table-wrap" tabindex="0" role="region" aria-label="Features of each app">
      <table>
        <thead>
          <tr>
            <th scope="col" class="app-col">App</th>
            <th v-for="f in columns" :key="f.key" scope="col" :title="f.description" :class="{ diff: differs(f.key) }">
              <span>{{ f.label }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in rows" :key="a.to" :class="{ picked: comparing.includes(a.to) }">
            <th scope="row" class="app-col">
              <label class="app">
                <input type="checkbox" :checked="comparing.includes(a.to)" :aria-label="`Compare ${a.name}`" @change="toggleCompare(a.to)">
                <span class="app-icon" :style="{ background: a.gradient ?? a.color, color: a.onColor ?? '#fff' }" aria-hidden="true"><ToolIcon :name="a.icon" /></span>
                <span class="app-name">{{ a.name }}</span>
                <span class="app-count">{{ countOf(a.to) }}</span>
              </label>
            </th>
            <td v-for="f in columns" :key="f.key" :class="{ diff: differs(f.key) }">
              <span v-if="hasFeature(a.to, f.key)" class="yes" :title="`${a.name}: ${f.label}`">
                <AppIcon name="check" />
                <span class="sr-only">Yes</span>
              </span>
              <span v-else class="no"><span class="sr-only">No</span></span>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!rows.length" class="empty">No app has all of those. Take a feature off to see more.</p>
      <p v-else-if="onlyDiffs && !columns.length" class="empty">These apps have exactly the same features.</p>
    </div>

    <dl class="legend">
      <div v-for="f in FEATURES" :key="f.key">
        <dt>{{ f.label }}</dt>
        <dd>{{ f.description }}</dd>
      </div>
    </dl>
    <p class="note">Every app also has its own Settings and Import &amp; export, under the gear by its name.</p>
  </div>
</template>

<style scoped>
.features {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}

.filters-label {
  margin-right: 0.25rem;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-2);
}

.chip {
  padding: 0.3rem 0.7rem;
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-2);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 999px;
  cursor: pointer;
  transition: background-color 0.12s, color 0.12s, border-color 0.12s;
}

.chip:hover {
  border-color: var(--ink-3);
}

.chip.on {
  color: var(--on-accent, #fff);
  background: var(--accent);
  border-color: var(--accent);
}

.compare-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  min-height: 2rem;
}

.note {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: var(--text-sm);
  font-weight: 600;
}

.compare-bar .btn {
  margin-left: auto;
}

.table-wrap {
  overflow-x: auto;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 16px;
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
  padding: 0.45rem 0.4rem;
  text-align: center;
  border-bottom: 1px solid var(--line);
}

tbody tr:last-child > * {
  border-bottom: 0;
}

thead th {
  height: 7.5rem;
  vertical-align: bottom;
  font-weight: 600;
  color: var(--ink-2);
  white-space: nowrap;
}

/* Column names read upwards so thirteen of them fit */
thead th:not(.app-col) span {
  display: inline-block;
  writing-mode: vertical-rl;
  rotate: 180deg;
}

.app-col {
  position: sticky;
  left: 0;
  z-index: 1;
  text-align: left;
  background: var(--surface);
  border-right: 1px solid var(--line);
}

thead .app-col {
  vertical-align: bottom;
}

.app {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 12rem;
  font-weight: 600;
  color: var(--ink);
  cursor: pointer;
}

.app-icon {
  flex: none;
  width: 1.6rem;
  height: 1.6rem;
  display: grid;
  place-items: center;
  font-size: 0.95rem;
  border-radius: 7px;
}

.app-name {
  flex: 1;
  white-space: nowrap;
}

.app-count {
  min-width: 1.4rem;
  font-size: var(--text-xs);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: center;
  color: var(--ink-3);
}

tbody tr:hover > * {
  background: var(--surface-2);
}

tr.picked > * {
  background: color-mix(in srgb, var(--accent) 7%, var(--surface));
}

/* A feature the compared apps don't share */
.diff {
  background: color-mix(in srgb, var(--yellow) 18%, var(--surface));
}

thead th.diff {
  color: var(--ink);
}

.yes {
  display: inline-grid;
  place-items: center;
  width: 1.4rem;
  height: 1.4rem;
  color: #fff;
  background: var(--green);
  border-radius: 50%;
}

.yes svg {
  width: 0.95rem;
  height: 0.95rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.no {
  display: inline-block;
  width: 0.5rem;
  height: 2px;
  background: var(--line);
  border-radius: 2px;
  vertical-align: middle;
}

.empty {
  margin: 0;
  padding: 1.25rem;
  text-align: center;
  color: var(--ink-2);
}

.legend {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 0.6rem 1.25rem;
  margin: 0.25rem 0 0;
}

.legend dt {
  font-size: var(--text-sm);
  font-weight: 700;
}

.legend dd {
  margin: 0.1rem 0 0;
  font-size: var(--text-xs);
  color: var(--ink-2);
}
</style>
