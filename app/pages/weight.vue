<script setup lang="ts">
import type { BulkAction } from '~/composables/useBulkSelect'
import { toast } from 'vue-sonner'

interface Entry {
  id: string
  date: string // yyyy-mm-dd, one entry per day
  kg: number
}

type Unit = 'kg' | 'lb'
const LB_PER_KG = 2.20462
const RANGES = [
  { value: 30, label: '1 month' },
  { value: 90, label: '3 months' },
  { value: 365, label: '1 year' },
  { value: 0, label: 'All' }
]

const { play } = useSound()
// Demo: four months of weigh-ins every few days, slowly trending down with day-to-day wobble
const DEMO = (): Omit<Entry, 'id'>[] => {
  const out: Omit<Entry, 'id'>[] = []
  for (let day = 120, i = 0; day >= 0; day -= 2 + (i % 3 === 0 ? 1 : 0), i++) {
    const trend = 78.4 - (120 - day) * 0.045
    const wobble = Math.sin(i * 1.7) * 0.45 + Math.cos(i * 0.6) * 0.25
    out.push({ date: isoDaysAgo(day), kg: Math.round((trend + wobble) * 10) / 10 })
  }
  return out
}
const { items, ready, sync, add, update, replace, remove, restore } = useCollection<Entry>('weight', undefined, { demo: DEMO, label: e => `${Math.round(e.kg * 10) / 10} kg on ${e.date}` })

// Pull down on a phone to sync again (CHECKLIST.md #26)
usePullToRefresh(async () => {
  await sync.retry()
  toast(sync.signedIn.value ? 'Up to date with your account' : 'Refreshed', { duration: 1800 })
})

// Display unit is a per-visitor preference
const unit = ref<Unit>('kg')
onMounted(() => {
  try {
    if (localStorage.getItem('ousa-app:weight-unit') === 'lb') unit.value = 'lb'
  } catch {}
})
watch(unit, (u) => {
  try {
    localStorage.setItem('ousa-app:weight-unit', u)
  } catch {}
})

const show = (kg: number) => (unit.value === 'kg' ? kg : kg * LB_PER_KG)
const fmt = (kg: number, digits = 1) => `${show(kg).toFixed(digits)} ${unit.value}`
const isoToday = () => localIsoDate()
const formatDate = (d: string, long = false) => new Date(`${d}T00:00`).toLocaleDateString('en-GB', long ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' })

// ---------- Logging ----------
const form = reactive({ date: isoToday(), value: null as number | null })

const weightField = ref<HTMLInputElement>()
useAddAction(() => focusField(weightField.value))

function save() {
  if (!form.value || form.value <= 0) return
  const kg = unit.value === 'kg' ? form.value : form.value / LB_PER_KG
  const existing = items.value.find(e => e.date === form.date)
  if (existing) {
    const before = update(existing.id, { kg })
    toastSaved(before && (() => replace(before)), `Updated ${formatDate(form.date)}`)
  } else {
    const previous = [...items.value].filter(e => e.date < form.date).sort((a, b) => b.date.localeCompare(a.date))[0]
    const added = add({ date: form.date, kg })
    const diff = previous ? kg - previous.kg : 0
    toast.success(`Logged ${fmt(kg)}`, {
      description: !previous ? 'Your first entry. Log again soon to see a trend.'
        : Math.abs(diff) < 0.05 ? `Same as ${formatDate(previous.date)}`
          : `${diff < 0 ? 'Down' : 'Up'} ${fmt(Math.abs(diff))} since ${formatDate(previous.date)}`,
      action: { label: 'Undo', onClick: () => remove(added.id, { undoAdd: true }) }
    })
  }
  play('success')
  form.value = null
}

// ---------- Select several (useBulkSelect) ----------
// Picked in the table, newest first; starting opens the table
const tableRows = computed(() => [...sorted.value].reverse())
const tableView = ref<HTMLDetailsElement>()
const bulkText = (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'}`
const sel = useBulkSelect({ items, shown: tableRows, onDelete: () => deleteSelected() })
function deleteSelected() {
  sel.guard(`Delete ${bulkText(sel.selected.size)}?`, () => bulkRemove(sel.selectedItems as Entry[], remove, restore, bulkText))
}
watch(() => sel.selecting, (on) => {
  if (on && tableView.value) tableView.value.open = true
})
const bulkActions = computed<BulkAction[]>(() => [
  { label: 'Delete', icon: 'delete', danger: true, run: deleteSelected }
])

function del(e: Entry) {
  const removed = remove(e.id)
  play('delete')
  toastDeleted(`Entry for ${formatDate(e.date)}`, () => removed && restore(removed))
}

// ---------- Data for the chart ----------
// Weight settings (the gear in the header): the chart's starting range; the unit is remembered as you switch
const { prefs: weightPrefs } = useAppPrefs('weight', { range: 90, goalKg: 0 })
const range = ref(90)
const pickedRange = smoothRef(range) // picking a range cross-fades the chart
onMounted(() => (range.value = weightPrefs.range))
const sorted = computed(() => [...items.value].sort((a, b) => a.date.localeCompare(b.date)))
const visible = computed(() => {
  if (!range.value) return sorted.value
  const from = new Date()
  from.setDate(from.getDate() - range.value)
  const cut = localIsoDate(from)
  return sorted.value.filter(e => e.date >= cut)
})

const latest = computed(() => sorted.value.at(-1))

// ---------- Goal ----------
// A target weight (0 = none), kept in kg with the other Weight settings. The dial (components/gauge) shows how
// far you've come from your first entry towards it, losing or gaining alike.
const goal = computed(() => Number(weightPrefs.goalKg) || 0)
const first = computed(() => sorted.value[0])
const toGo = computed(() => (latest.value && goal.value ? latest.value.kg - goal.value : 0))
const progress = computed(() => {
  if (!goal.value || !first.value || !latest.value) return 0
  const whole = first.value.kg - goal.value
  if (Math.abs(whole) < 0.05) return 1
  return Math.max(0, Math.min(1, (first.value.kg - latest.value.kg) / whole))
})
const reached = computed(() => !!goal.value && Math.abs(toGo.value) < 0.05)
const goalDraft = ref('')
const editingGoal = ref(false)
function editGoal() {
  goalDraft.value = goal.value ? show(goal.value).toFixed(1) : ''
  editingGoal.value = true
}
function saveGoal() {
  const v = Number(goalDraft.value.replace(',', '.'))
  if (!Number.isFinite(v) || v < 0) return
  weightPrefs.goalKg = v ? Math.round((unit.value === 'kg' ? v : v / LB_PER_KG) * 100) / 100 : 0
  editingGoal.value = false
  play(v ? 'success' : 'toggle-off')
}

// Each entry against the one before it: how much you gained or lost, and over how many days
const vsPrevious = computed(() => {
  const out = new Map<string, { diff: number, days: number }>()
  sorted.value.forEach((e, i) => {
    const prev = sorted.value[i - 1]
    if (prev) out.set(e.id, { diff: e.kg - prev.kg, days: Math.round((t(e.date) - t(prev.date)) / 86_400_000) })
  })
  return out
})
// "+0.4 kg" / "−0.6 kg" in the chosen unit; anything under 0.05 reads as the same
const changeText = (diff: number) => {
  const v = show(diff)
  if (Math.abs(v) < 0.05) return 'Same'
  return `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1)} ${unit.value}`
}
// The whole log: from the first entry to the latest
const overall = computed(() => {
  const first = sorted.value[0]
  const last = sorted.value.at(-1)
  if (!first || !last || first === last) return undefined
  return { diff: last.kg - first.kg, days: Math.round((t(last.date) - t(first.date)) / 86_400_000) }
})
const changeDir = (diff: number) => (Math.abs(show(diff)) < 0.05 ? 'same' : diff > 0 ? 'up' : 'down')
const change = computed(() => {
  const list = visible.value
  return list.length >= 2 ? list.at(-1)!.kg - list[0]!.kg : undefined
})

// ---------- Chart geometry ----------
const box = ref<HTMLElement>()
const width = ref(640)
const HEIGHT = 260
const PAD = { top: 20, right: 64, bottom: 30, left: 44 }
// The plot only exists once data has loaded, so start measuring whenever it appears
let observer: ResizeObserver | undefined
watch(box, (el) => {
  observer?.disconnect()
  if (!el) return
  observer = new ResizeObserver(([e]) => (width.value = Math.max(e!.contentRect.width, 280)))
  observer.observe(el)
})
onBeforeUnmount(() => observer?.disconnect())

const t = (d: string) => new Date(`${d}T00:00`).getTime()

const scales = computed(() => {
  const list = visible.value
  const values = list.map(e => show(e.kg))
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  // "Nice" tick step so gridlines land on round numbers
  const spanRaw = Math.max(hi - lo, unit.value === 'kg' ? 2 : 4)
  const step = [0.5, 1, 2, 5, 10, 20].find(s => spanRaw / s <= 4) ?? 50
  const yMin = Math.floor((lo - step * 0.25) / step) * step
  const yMax = Math.ceil((hi + step * 0.25) / step) * step
  const x0 = t(list[0]!.date)
  const x1 = list.length > 1 ? t(list.at(-1)!.date) : x0 + 86_400_000
  const innerW = width.value - PAD.left - PAD.right
  const innerH = HEIGHT - PAD.top - PAD.bottom
  const x = (d: string) => PAD.left + ((t(d) - x0) / (x1 - x0)) * innerW
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * innerH
  const yTicks: number[] = []
  for (let v = yMin; v <= yMax + 1e-9; v += step) yTicks.push(Math.round(v * 10) / 10)
  // At most ~5 date labels, evenly spaced across the visible entries
  const every = Math.max(1, Math.ceil(list.length / 5))
  const xTicks = list.filter((_, i) => i % every === 0).map(e => e.date)
  return { x, y, yTicks, xTicks }
})

const points = computed(() => visible.value.map(e => ({ ...e, px: scales.value.x(e.date), py: scales.value.y(show(e.kg)) })))
const path = computed(() => points.value.map((p, i) => `${i ? 'L' : 'M'}${p.px.toFixed(1)} ${p.py.toFixed(1)}`).join(''))

// ---------- Hover / keyboard ----------
const active = ref<number>()
function onMove(e: PointerEvent) {
  const rect = (e.currentTarget as SVGElement).getBoundingClientRect()
  const mx = e.clientX - rect.left
  let best = 0
  points.value.forEach((p, i) => {
    if (Math.abs(p.px - mx) < Math.abs(points.value[best]!.px - mx)) best = i
  })
  active.value = best
}
function onKey(e: KeyboardEvent) {
  const n = points.value.length
  if (!n) return
  if (e.key === 'ArrowRight') active.value = Math.min((active.value ?? -1) + 1, n - 1)
  else if (e.key === 'ArrowLeft') active.value = Math.max((active.value ?? n) - 1, 0)
  else if (e.key === 'Escape') active.value = undefined
  else return
  e.preventDefault()
}
const activePoint = computed(() => (active.value === undefined ? undefined : points.value[active.value]))
</script>

<template>
  <ToolPage header="bar">
    <template #settings>
      <SettingChoice v-model="unit" title="Unit" :options="[{ value: 'kg', label: 'Kilograms' }, { value: 'lb', label: 'Pounds' }]" />
      <SettingChoice v-model="weightPrefs.range" title="Chart shows" :options="RANGES" />
    </template>
    <div class="workspace">
      <!-- Three numbered steps, the way every app here walks you through it -->
      <Step :n="1" title="Log your weight" hint="Once a day is plenty, ideally at the same time each morning." class="form-step">
        <form v-validate class="panel form" @submit.prevent="save">
          <div class="row">
            <label class="field">
              <span class="field-head">Date</span>
              <DatePicker v-model="form.date" aria-label="Date" :max="isoToday()" required />
            </label>
            <label class="field">
              <span class="field-head">Weight</span>
              <span class="weight-in input">
                <input ref="weightField" v-model.number="form.value" type="number" inputmode="decimal" min="0" step="0.1" placeholder="0.0" aria-label="Weight" required v-check="Number(form.value) > 0 ? '' : 'Enter your weight'">
                <span>{{ unit }}</span>
              </span>
            </label>
          </div>
          <div class="segmented" role="radiogroup" aria-label="Unit">
            <label v-for="u in (['kg', 'lb'] as const)" :key="u" :class="{ active: unit === u }">
              <input v-model="unit" type="radio" name="unit" :value="u">{{ u === 'kg' ? 'Kilograms' : 'Pounds' }}
            </label>
          </div>
          <button type="submit" class="btn">Log weight</button>
          <p class="hint">Logging the same day again updates that day.</p>
        </form>
      </Step>

      <Step :n="2" title="See your trend" hint="Pick a range to see how it’s changed. Tap or drag across the chart to read a day." class="chart-step">
        <template #aside><ClientOnly><DataSource :sync="sync" /></ClientOnly></template>
        <ClientOnly>
          <template v-if="ready && items.length">
            <section class="panel stats">
              <div>
                <span class="label">Latest</span>
                <strong>{{ fmt(latest!.kg) }}</strong>
                <span class="sub">{{ formatDate(latest!.date, true) }}</span>
              </div>
              <div v-if="change !== undefined">
                <span class="label">Change in this range</span>
                <strong>{{ change > 0 ? '+' : change < 0 ? '−' : '' }}{{ fmt(Math.abs(change)) }}</strong>
                <span class="sub">{{ change > 0 ? 'Up' : change < 0 ? 'Down' : 'No change' }} since {{ formatDate(visible[0]!.date) }}</span>
              </div>
              <div class="goal">
                <span class="label">Goal</span>
                <form v-if="!goal || editingGoal" class="goal-form" @submit.prevent="saveGoal">
                  <label class="goal-input">
                    <span class="sr-only">Goal weight in {{ unit }}</span>
                    <input v-model="goalDraft" class="input" inputmode="decimal" :placeholder="show(latest!.kg - (unit === 'kg' ? 3 : 3 / LB_PER_KG)).toFixed(1)" autocomplete="off">
                    <span>{{ unit }}</span>
                  </label>
                  <button type="submit" class="btn btn-sm">{{ goal ? 'Save' : 'Set goal' }}</button>
                  <button v-if="editingGoal" type="button" class="link" @click="editingGoal = false">Cancel</button>
                </form>
                <div v-else class="goal-view">
                  <div class="goal-dial" role="img" :aria-label="reached ? 'Goal reached' : `${Math.round(progress * 100)}% of the way to ${fmt(goal)}`">
                    <Gauge :value="progress" :min="0" :max="1" :start-angle="45" :end-angle="315" :radius="200" :padding="22" fit="content" transition :initial-value="0">
                      <GaugeTrack :width="30" color="var(--ink)" :opacity="0.08" />
                      <GaugeArc :width="30" :color="reached ? 'var(--green)' : 'var(--accent)'" />
                      <GaugeValue :y="0" :font-size="82" weight="bold" color="var(--ink)" :format="v => `${Math.round(v * 100)}%`" />
                    </Gauge>
                  </div>
                  <div class="goal-text">
                    <strong>{{ fmt(goal) }}</strong>
                    <span class="sub">{{ reached ? 'Reached. Nice work.' : `${fmt(Math.abs(toGo))} to go` }}</span>
                    <button type="button" class="link" @click="editGoal">Change</button>
                  </div>
                </div>
              </div>
            </section>

            <div class="segmented ranges" role="radiogroup" aria-label="Time range">
              <label v-for="r in RANGES" :key="r.value" :class="{ active: range === r.value }">
                <input v-model="pickedRange" type="radio" name="range" :value="r.value">{{ r.label }}
              </label>
            </div>

            <figure class="panel chart" aria-labelledby="chart-title">
              <figcaption id="chart-title" class="sr-only">Weight over time, in {{ unit }}</figcaption>
              <div ref="box" class="plot">
                <svg
                  v-if="visible.length"
                  :width="width"
                  :height="HEIGHT"
                  tabindex="0"
                  role="img"
                  :aria-label="`Weight chart with ${visible.length} entries. Use the arrow keys to read each point.`"
                  @pointermove="onMove"
                  @pointerleave="active = undefined"
                  @keydown="onKey"
                  @blur="active = undefined"
                >
                  <g class="grid">
                    <g v-for="v in scales.yTicks" :key="v">
                      <line :x1="PAD.left" :x2="width - PAD.right" :y1="scales.y(v)" :y2="scales.y(v)" />
                      <text :x="PAD.left - 8" :y="scales.y(v)" class="ytick">{{ v }}</text>
                    </g>
                    <text v-for="d in scales.xTicks" :key="d" :x="scales.x(d)" :y="HEIGHT - 8" class="xtick">{{ formatDate(d) }}</text>
                  </g>
                  <path :d="path" class="line" />
                  <!-- Direct label on the latest point -->
                  <g v-if="points.length">
                    <circle :cx="points.at(-1)!.px" :cy="points.at(-1)!.py" r="4.5" class="dot" />
                    <text :x="points.at(-1)!.px + 10" :y="points.at(-1)!.py" class="end-label">{{ show(points.at(-1)!.kg).toFixed(1) }}</text>
                  </g>
                  <g v-if="activePoint" class="hover">
                    <line :x1="activePoint.px" :x2="activePoint.px" :y1="PAD.top" :y2="HEIGHT - PAD.bottom" class="crosshair" />
                    <circle :cx="activePoint.px" :cy="activePoint.py" r="5" class="dot active" />
                  </g>
                </svg>
                <div
                  v-if="activePoint"
                  class="tooltip"
                  role="status"
                  :style="{ left: `${Math.min(Math.max(activePoint.px, 70), width - 70)}px`, top: `${activePoint.py - 12}px` }"
                >
                  <strong>{{ fmt(activePoint.kg) }}</strong>
                  <span>{{ formatDate(activePoint.date, true) }}</span>
                </div>
              </div>
              <p v-if="!visible.length" class="no-data">No entries in this range.</p>
            </figure>

          </template>

          <div v-else-if="ready" class="panel">
            <EmptyState title="No entries yet" icon="weight" action="Log your weight" @action="focusField(weightField)">
              Log your weight to start a trend line. Once a day is plenty, and the chart smooths out the daily ups and downs.
            </EmptyState>
          </div>
          <SkeletonList v-else variant="cards" :count="1" label="Loading your weight log" />
          <template #fallback><SkeletonList variant="cards" :count="1" label="Loading your weight log" /></template>
        </ClientOnly>
      </Step>

      <Step :n="3" title="Check your entries" hint="Every day you’ve logged. Spot a typo? Log that day again, or select entries to delete them." class="entries-step">
        <template #aside><ClientOnly><BulkToggle v-if="items.length" :select="sel" /></ClientOnly></template>
        <ClientOnly>
          <template v-if="ready && items.length">
            <details ref="tableView" class="panel table-view">
              <summary>Show all {{ items.length }} {{ items.length === 1 ? 'entry' : 'entries' }}</summary>
              <table>
                <thead><tr><th>Date</th><th>Weight</th><th>Change</th><th><span class="sr-only">Actions</span></th></tr></thead>
                <TransitionGroup tag="tbody" name="list">
                  <tr v-for="e in tableRows" :key="e.id" class="bulk-row" :data-bulk="sel.selecting || undefined" @click.capture="sel.onRowClick($event, e.id)" :class="{ 'bulk-picked': sel.has(e.id) }">
                    <td><span class="bulk-cell"><BulkCheck v-if="sel.selecting" inline :checked="sel.has(e.id)" :label="`Select ${formatDate(e.date, true)}`" @pick="sel.pick(e.id, $event)" />{{ formatDate(e.date, true) }}</span></td>
                    <td class="num">{{ fmt(e.kg) }}</td>
                    <!-- Against the entry before it: gained ▲ or lost ▼, and the gap when it isn't the day before -->
                    <td class="change">
                      <template v-if="vsPrevious.get(e.id)">
                        <span class="delta" :class="changeDir(vsPrevious.get(e.id)!.diff)">
                          <span aria-hidden="true">{{ changeDir(vsPrevious.get(e.id)!.diff) === 'up' ? '▲' : changeDir(vsPrevious.get(e.id)!.diff) === 'down' ? '▼' : '=' }}</span>
                          {{ changeText(vsPrevious.get(e.id)!.diff) }}
                          <span class="sr-only">{{ changeDir(vsPrevious.get(e.id)!.diff) === 'up' ? 'gained' : changeDir(vsPrevious.get(e.id)!.diff) === 'down' ? 'lost' : '' }} since the entry before</span>
                        </span>
                        <small v-if="vsPrevious.get(e.id)!.days > 1" class="gap">over {{ vsPrevious.get(e.id)!.days }} days</small>
                      </template>
                      <small v-else class="gap">First entry</small>
                    </td>
                    <td class="act"><ConfirmDelete :name="`the entry for ${formatDate(e.date, true)}`" @confirm="del(e)" /></td>
                  </tr>
                </TransitionGroup>
                <!-- Since your first entry -->
                <tfoot v-if="overall">
                  <tr>
                    <th scope="row">Total</th>
                    <td class="num">{{ fmt(sorted.at(-1)!.kg) }}</td>
                    <td class="change">
                      <span class="delta" :class="changeDir(overall.diff)">
                        <span aria-hidden="true">{{ changeDir(overall.diff) === 'up' ? '▲' : changeDir(overall.diff) === 'down' ? '▼' : '=' }}</span>
                        {{ changeText(overall.diff) }}
                        <span class="sr-only">{{ changeDir(overall.diff) === 'up' ? 'gained' : changeDir(overall.diff) === 'down' ? 'lost' : '' }} since your first entry</span>
                      </span>
                      <small class="gap">over {{ overall.days }} {{ overall.days === 1 ? 'day' : 'days' }}</small>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </details>
          </template>
          <p v-else class="panel step-empty">Each day you log shows up here as a row.</p>
        </ClientOnly>
      </Step>
    </div>
    <BulkBar :select="sel" :actions="bulkActions" label="Selected entries" noun="entries" />
  </ToolPage>
</template>

<style scoped>
/* Chart-first: a single quick-log row on top, the trend gets the full width */
.workspace {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 2rem;
  margin: 0 auto;
}

.form {
  padding: 0.9rem 1rem;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem 1rem;
}

.row {
  flex: 1 1 360px;
  min-width: 0;
  display: grid;
  /* minmax(0, …) lets both fields shrink on a phone instead of pushing past the panel */
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.form .segmented {
  flex: 0 1 240px;
}

.form .btn {
  flex: 0 0 auto;
}

.form .hint {
  flex-basis: 100%;
}

.step-empty {
  margin: 0;
  padding: 1rem 1.25rem;
  font-size: 0.9rem;
  color: var(--ink-2);
}

/* Phones: the unit switch and the button each take the full width, easy to hit with a thumb */
@media (max-width: 719.98px) {
  .form .segmented,
  .form .btn {
    flex: 1 1 100%;
  }

  .form .btn {
    min-height: 3rem;
  }
}

.weight-in {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.weight-in input {
  flex: 1;
  min-width: 0;
  padding: 0;
  font: inherit;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
  background: transparent;
  border: 0;
  outline: none;
}

.weight-in span {
  color: var(--ink-3);
  font-weight: 600;
}

.hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--ink-3);
}

.stats {
  padding: 1.25rem 1.4rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

/* The goal takes the whole width under the two numbers */
.stats .goal {
  grid-column: 1 / -1;
  padding-top: 1rem;
  border-top: 1px solid var(--line);
}

.goal-form,
.goal-view {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 1rem;
  margin-top: 0.4rem;
}

.goal-input {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--ink-2);
}

.goal-input .input {
  width: 6.5rem;
  font-variant-numeric: tabular-nums;
}

.stats .goal-view {
  flex-direction: row;
}

.goal-dial {
  flex: none;
  width: 6.5rem;
}

.stats .goal-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.stats div {
  display: flex;
  flex-direction: column;
}

.label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ink-2);
}

.stats strong {
  font-size: clamp(2rem, 4.5vw, 3rem);
  line-height: 1.05;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.sub {
  font-size: 0.85rem;
  color: var(--ink-2);
}

.ranges {
  margin: 1rem 0 0.75rem;
  max-width: 420px;
}

/* "3 months" stays on one line on a phone */
.ranges label {
  padding-inline: 0.35rem;
  white-space: nowrap;
}

.chart {
  margin: 0;
  padding: 1rem 0.5rem 0.5rem;
}

.plot {
  position: relative;
}

svg {
  display: block;
  overflow: visible;
  cursor: crosshair;
}

svg:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--accent) 55%, transparent);
  outline-offset: 4px;
  border-radius: 8px;
}

/* Recessive grid and axis labels in text tokens */
.grid line {
  stroke: var(--line);
  stroke-width: 1;
}

.grid text {
  font-family: var(--font);
  font-size: 11px;
  fill: var(--ink-3);
  font-variant-numeric: tabular-nums;
}

.ytick {
  text-anchor: end;
  dominant-baseline: middle;
}

.xtick {
  text-anchor: middle;
}

.line {
  fill: none;
  stroke: var(--chart-line);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.dot {
  fill: var(--chart-line);
  stroke: var(--surface);
  stroke-width: 2;
}

.end-label {
  font-family: var(--font);
  font-size: 12px;
  font-weight: 700;
  fill: var(--ink);
  dominant-baseline: middle;
}

.crosshair {
  stroke: var(--ink-3);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}

.tooltip {
  position: absolute;
  transform: translate(-50%, -100%);
  padding: 0.45rem 0.65rem;
  display: flex;
  flex-direction: column;
  font-size: 0.8rem;
  color: var(--ink-2);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  box-shadow: 0 6px 18px rgb(var(--shadow) / 0.15);
  pointer-events: none;
  white-space: nowrap;
}

.tooltip strong {
  font-size: 0.95rem;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.no-data {
  padding: 2rem;
  text-align: center;
  color: var(--ink-3);
}

.table-view {
  padding: 0.9rem 1.1rem;
}

.table-view summary {
  font-weight: 600;
  color: var(--ink-2);
  cursor: pointer;
}

table {
  width: 100%;
  margin-top: 0.75rem;
  border-collapse: collapse;
  font-size: 0.9rem;
}

th,
td {
  padding: 0.45rem 0.25rem;
  text-align: left;
  border-bottom: 1px solid var(--line);
}

th {
  font-size: 0.8rem;
  color: var(--ink-2);
}

.num {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.act {
  text-align: right;
}

/* Gained or lost since the entry before: arrows in plain ink, since which way is good depends on your goal */
.change {
  white-space: nowrap;
}

.delta {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.delta [aria-hidden='true'] {
  font-size: 0.7em;
  color: var(--ink-3);
}

.delta.same {
  font-weight: 500;
  color: var(--ink-3);
}

/* The total under the entries, set apart by a heavier rule */
tfoot th,
tfoot td {
  border-top: 2px solid var(--line);
  border-bottom: 0;
  padding-top: 0.6rem;
}

tfoot th {
  font-size: 0.9rem;
  color: var(--ink);
}

.gap {
  display: block;
  font-size: var(--text-xs);
  color: var(--ink-3);
}


.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.empty {
  padding: 2.5rem 1.5rem;
  text-align: center;
  color: var(--ink-2);
}

.empty h2 {
  font-size: 1.2rem;
  color: var(--ink);
}

.empty p {
  margin: 0.5rem 0 0;
}


</style>
