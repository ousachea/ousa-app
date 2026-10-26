<script setup lang="ts">
import { toast } from 'vue-sonner'

// What an EDC bill comes to. Households pay in blocks: each rate covers only the kWh inside its own band,
// so 100 kWh is 10 at the first rate, 40 at the second and 50 at the third. Work out a bill from the kWh
// on it, or log your meter now and then to see each period's use and cost. The rates are editable (the
// gear), since EDC can change them.
interface Reading {
  id: string
  date: string // yyyy-mm-dd
  kwh: number // the meter's number
}

// Bands as EAC's report on the power sector for 2024 lists them (Prakas 0408 of December 2023), riel per kWh
const BANDS = [
  { upTo: 10, label: '0–10 kWh' },
  { upTo: 50, label: '11–50 kWh' },
  { upTo: 200, label: '51–200 kWh' },
  { upTo: Infinity, label: 'Over 200 kWh' }
]
const { prefs } = useAppPrefs('electricity', { r1: 380, r2: 480, r3: 610, r4: 730, kwh: 150 })
const rates = computed(() => [prefs.r1, prefs.r2, prefs.r3, prefs.r4].map(r => Number(r) || 0))
const RATES_DEFAULT = [380, 480, 610, 730]
const ratesChanged = computed(() => rates.value.some((r, i) => r !== RATES_DEFAULT[i]))
function resetRates() {
  Object.assign(prefs, { r1: 380, r2: 480, r3: 610, r4: 730 })
}

/** The bill for `kwh` in a month: each band's share and cost, and the total in riel */
function bill(kwh: number) {
  let left = Math.max(0, kwh)
  let from = 0
  const parts = BANDS.map((b, i) => {
    const units = Math.max(0, Math.min(left, b.upTo - from))
    left -= units
    from = b.upTo
    return { ...b, units, rate: rates.value[i]!, cost: units * rates.value[i]! }
  })
  return { parts, total: parts.reduce((n, p) => n + p.cost, 0) }
}

const market = useMarketRateInfo()
const rate = computed(() => market.value.rate ?? FALLBACK_RATE)
const riel = (v: number) => formatMoney(Math.round(v / 100) * 100, 'KHR')
const usd = (v: number) => formatMoney(v / rate.value, 'USD')

// ---------- Work out a bill ----------
const kwh = computed({ get: () => prefs.kwh as number | null, set: v => (prefs.kwh = Number(v) || 0) })
const now = computed(() => bill(Number(kwh.value) || 0))
const average = computed(() => (Number(kwh.value) ? now.value.total / Number(kwh.value) : 0))

// ---------- Meter readings ----------
const { play } = useSound()
const DEMO = (): Omit<Reading, 'id'>[] => {
  const out: Omit<Reading, 'id'>[] = []
  let meter = 12_480
  for (let m = 6; m >= 0; m--) {
    out.push({ date: isoDaysAgo(m * 30 + 2), kwh: meter })
    meter += 140 + ((m * 37) % 90)
  }
  return out
}
const { items, ready, sync, add, update, replace, remove, restore } = useCollection<Reading>('meter-readings', undefined, { demo: DEMO, label: r => `Meter ${r.kwh} kWh on ${r.date}` })
const sorted = computed(() => [...items.value].sort((a, b) => a.date.localeCompare(b.date)))
const form = reactive({ date: localIsoDate(), kwh: null as number | null })
const readingField = ref<HTMLElement>()
useAddAction(() => focusField(readingField.value?.querySelector('input')))

function saveReading() {
  const value = Number(form.kwh)
  if (!value || value <= 0) return
  const earlier = sorted.value.filter(r => r.date < form.date).at(-1)
  if (earlier && value < earlier.kwh) {
    toast.error('That’s lower than the reading before', { description: `${fmtDay(earlier.date)} was ${earlier.kwh.toLocaleString('en-US')} kWh. A meter only counts up.` })
    play('error')
    return
  }
  const same = items.value.find(r => r.date === form.date)
  if (same) {
    const before = update(same.id, { kwh: value })
    toast.success(`Updated ${fmtDay(form.date)}`, { action: { label: 'Undo', onClick: () => before && replace(before) } })
  } else {
    const added = add({ date: form.date, kwh: value })
    toast.success(`Saved ${value.toLocaleString('en-US')} kWh`, { description: earlier ? `${(value - earlier.kwh).toLocaleString('en-US')} kWh since ${fmtDay(earlier.date)}` : 'Log it again in a few weeks to see what you used.', action: { label: 'Undo', onClick: () => remove(added.id, { undoAdd: true }) } })
  }
  play('success')
  form.kwh = null
}
function del(r: Reading) {
  const removed = remove(r.id)
  play('delete')
  toastDeleted(`Reading for ${fmtDay(r.date)}`, () => removed && restore(removed))
}

// Each stretch between two readings, scaled to a 30-day month for the bill (the blocks are per month)
const periods = computed(() => sorted.value.slice(1).map((r, i) => {
  const prev = sorted.value[i]!
  const days = Math.max(1, Math.round((Date.parse(`${r.date}T00:00`) - Date.parse(`${prev.date}T00:00`)) / 86_400_000))
  const used = r.kwh - prev.kwh
  const perMonth = used / days * 30
  return { id: r.id, from: prev.date, to: r.date, days, used, perDay: used / days, cost: bill(perMonth).total * days / 30 }
}).reverse())
const fmtDay = (d: string) => new Date(`${d}T00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const maxUsed = computed(() => Math.max(1, ...periods.value.map(p => p.perDay)))
</script>

<template>
  <ToolPage header="bar">
    <template #settings>
      <div class="rates-setting">
        <p class="setting-note">Riel per kWh in each block. Each rate covers only the kWh inside its own band. These are the household rates in the Electricity Authority of Cambodia’s report for 2024; check them against your bill.</p>
        <label v-for="(b, i) in BANDS" :key="b.label" class="rate-field">
          <span>{{ b.label }}</span>
          <span class="input rate-in"><input v-model.number="prefs[(['r1', 'r2', 'r3', 'r4'] as const)[i]!]" type="number" min="0" step="1" inputmode="numeric" :aria-label="`Riel per kWh for ${b.label}`"><span>៛</span></span>
        </label>
        <button v-if="ratesChanged" type="button" class="btn btn-quiet btn-sm" @click="resetRates">Back to the 2024 rates</button>
      </div>
    </template>

    <div class="workspace">
      <Step :n="1" title="Work out a bill" hint="The kWh used in a month, from your bill or two meter readings.">
        <div class="panel calc">
          <label class="field">
            <span class="field-head">Used this month</span>
            <span class="input kwh-in">
              <GroupedNumberInput v-model="kwh" min="0" aria-label="Kilowatt-hours used in the month" />
              <span>kWh</span>
            </span>
          </label>
          <div class="quick">
            <button v-for="v in [50, 100, 200, 300, 500]" :key="v" type="button" class="chip" :class="{ active: Number(kwh) === v }" @click="kwh = v">{{ v }} kWh</button>
          </div>
          <div class="total">
            <strong>{{ riel(now.total) }}</strong>
            <span>about {{ usd(now.total) }}<template v-if="Number(kwh)"> · {{ Math.round(average) }} ៛ a kWh on average</template></span>
          </div>
          <table class="bands">
            <thead><tr><th>Block</th><th class="num">kWh</th><th class="num">Rate</th><th class="num">Cost</th></tr></thead>
            <tbody>
              <tr v-for="p in now.parts" :key="p.label" :class="{ unused: !p.units }">
                <td>{{ p.label }}</td>
                <td class="num">{{ p.units.toLocaleString('en-US') }}</td>
                <td class="num">{{ p.rate }} ៛</td>
                <td class="num">{{ riel(p.cost) }}</td>
              </tr>
            </tbody>
          </table>
          <p class="note">Household rates for EDC’s grid, as the Electricity Authority of Cambodia’s report for 2024 lists them. A landlord or a local supplier may charge more. Change the rates in Settings.</p>
        </div>
      </Step>

      <Step :n="2" title="Log your meter" hint="Read the number on your meter now and then. Each stretch between readings shows what you used and roughly what it cost.">
        <template #aside><ClientOnly><DataSource :sync="sync" /></ClientOnly></template>
        <div class="log">
          <form v-validate class="panel reading" @submit.prevent="saveReading">
            <label class="field">
              <span class="field-head">Date</span>
              <DatePicker v-model="form.date" aria-label="Date of the reading" :max="localIsoDate()" required />
            </label>
            <label ref="readingField" class="field">
              <span class="field-head">Meter reading</span>
              <span class="input kwh-in">
                <GroupedNumberInput v-model="form.kwh" min="0" aria-label="Meter reading in kWh" />
                <span>kWh</span>
              </span>
            </label>
            <button type="submit" class="btn" :disabled="!form.kwh">Save reading</button>
          </form>

          <ClientOnly>
            <ul v-if="ready && periods.length" class="panel periods">
              <li v-for="p in periods" :key="p.id">
                <div class="period-head">
                  <span><strong>{{ fmtDay(p.from) }} – {{ fmtDay(p.to) }}</strong><small>{{ p.days }} days</small></span>
                  <span class="period-cost"><strong>{{ riel(p.cost) }}</strong><small>{{ usd(p.cost) }}</small></span>
                </div>
                <div class="bar" :aria-label="`${p.perDay.toFixed(1)} kWh a day`"><span :style="{ width: `${p.perDay / maxUsed * 100}%` }" /></div>
                <small class="sub">{{ p.used.toLocaleString('en-US') }} kWh · {{ p.perDay.toFixed(1) }} kWh a day</small>
              </li>
            </ul>
            <p v-else-if="ready && items.length === 1" class="panel step-empty">One reading so far ({{ sorted[0]!.kwh.toLocaleString('en-US') }} kWh on {{ fmtDay(sorted[0]!.date) }}). Log another in a few weeks to see what you used.</p>
            <div v-else-if="ready" class="panel">
              <EmptyState title="No readings yet" icon="electricity">
                Save the number on your meter today, then again in a few weeks. The difference is what you used.
              </EmptyState>
            </div>
            <SkeletonList v-else :count="2" label="Loading your readings" />
          </ClientOnly>

          <ClientOnly>
            <details v-if="ready && items.length" class="panel readings">
              <summary>All {{ items.length }} {{ items.length === 1 ? 'reading' : 'readings' }}</summary>
              <ul>
                <li v-for="r in [...sorted].reverse()" :key="r.id">
                  <span>{{ fmtDay(r.date) }}</span>
                  <span class="num">{{ r.kwh.toLocaleString('en-US') }} kWh</span>
                  <ConfirmDelete :name="`the reading for ${fmtDay(r.date)}`" @confirm="del(r)" />
                </li>
              </ul>
            </details>
          </ClientOnly>
        </div>
      </Step>
    </div>
  </ToolPage>
</template>

<style scoped>
.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 2rem;
}

/* From a tablet held upright: the calculator and the meter log side by side */
@media (min-width: 760px) {
  .workspace {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}

.panel {
  padding: 1rem 1.1rem;
}

.calc,
.log,
.reading {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.log {
  gap: 1rem;
}

.reading {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-end;
}

.reading .field {
  flex: 1 1 10rem;
  min-width: 0;
}

.kwh-in {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.kwh-in :deep(input) {
  flex: 1;
  min-width: 0;
  width: 100%;
  padding: 0;
  font: inherit;
  font-weight: 700;
  background: transparent;
  border: 0;
  outline: none;
}

.kwh-in > span {
  color: var(--ink-3);
  font-weight: 600;
}

.quick {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.chip {
  padding: 0.35rem 0.7rem;
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-2);
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  cursor: pointer;
}

.chip.active {
  color: var(--on-accent);
  background: var(--accent);
  border-color: var(--accent);
}

.total {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.total strong {
  font-size: var(--text-2xl);
  font-weight: 800;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.total span {
  color: var(--ink-2);
}

.bands {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

.bands th,
.bands td {
  padding: 0.45rem 0.25rem;
  text-align: left;
  border-bottom: 1px solid var(--line);
}

.bands th {
  font-size: var(--text-sm);
  color: var(--ink-3);
}

.bands .num {
  text-align: right;
}

.bands tr.unused td {
  color: var(--ink-3);
}

.note,
.setting-note {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--ink-3);
}

.periods,
.readings ul {
  display: flex;
  flex-direction: column;
  margin: 0;
  list-style: none;
}

.periods li {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.7rem 0;
}

.periods li + li {
  border-top: 1px solid var(--line);
}

.period-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.period-head > span {
  display: flex;
  flex-direction: column;
}

.period-cost {
  align-items: flex-end;
  font-variant-numeric: tabular-nums;
}

.period-head small,
.sub {
  color: var(--ink-2);
  font-size: var(--text-sm);
}

.bar {
  height: 0.5rem;
  background: color-mix(in srgb, var(--ink) 8%, transparent);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.bar span {
  display: block;
  height: 100%;
  background: var(--accent);
  border-radius: inherit;
}

.readings summary {
  font-weight: 700;
  cursor: pointer;
}

.readings ul {
  padding: 0.5rem 0 0;
}

.readings li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.35rem 0;
}

.readings li > span:first-child {
  flex: 1;
}

.num {
  font-variant-numeric: tabular-nums;
}

.step-empty {
  margin: 0;
  color: var(--ink-2);
}

.rates-setting {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.rate-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.rate-in {
  width: 7rem;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.rate-in input {
  min-width: 0;
  width: 100%;
  padding: 0;
  font: inherit;
  text-align: right;
  background: transparent;
  border: 0;
  outline: none;
}
</style>
