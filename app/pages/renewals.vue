<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { Currency } from '~/utils/exchange'
import type { Cycle } from '~/utils/renewals'

interface Renewal {
  id: string
  name: string
  price: number
  currency: Currency
  cycle: Cycle
  nextDate: string // yyyy-mm-dd, as entered; past dates roll forward when shown
}

const SOON_DAYS = 7

const { play } = useSound()
// Demo: everyday subscriptions, a couple renewing this week so the timeline has something to show
const DEMO = (): Omit<Renewal, 'id'>[] => [
  { name: 'Netflix', price: 9.99, currency: 'USD', cycle: 'monthly', nextDate: isoDaysAhead(3) },
  { name: 'Spotify', price: 5.99, currency: 'USD', cycle: 'monthly', nextDate: isoDaysAhead(11) },
  { name: 'iCloud+ 200 GB', price: 2.99, currency: 'USD', cycle: 'monthly', nextDate: isoDaysAhead(6) },
  { name: 'ChatGPT Plus', price: 20, currency: 'USD', cycle: 'monthly', nextDate: isoDaysAhead(18) },
  { name: 'Home internet', price: 25, currency: 'USD', cycle: 'monthly', nextDate: isoDaysAhead(1) },
  { name: 'Gym', price: 35, currency: 'USD', cycle: 'monthly', nextDate: isoDaysAhead(24) },
  { name: 'Domain name', price: 12, currency: 'USD', cycle: 'yearly', nextDate: isoDaysAhead(45) },
  { name: 'Phone top-up', price: 20000, currency: 'KHR', cycle: 'weekly', nextDate: isoDaysAhead(2) }
]
const { items, ready, sync, add, update, remove, restore } = useCollection<Renewal>('renewals', undefined, { demo: DEMO })
const rate = useMarketRate()

const isoToday = () => new Date().toISOString().slice(0, 10)
const blank = (): Omit<Renewal, 'id'> => ({ name: '', price: 0, currency: 'USD', cycle: 'monthly', nextDate: isoToday() })
const form = reactive(blank())
const editingId = ref<string>()
const formOpen = ref(false)

function openAdd() {
  cancel()
  formOpen.value = true
  play('open')
}

const toUsd = (r: Pick<Renewal, 'price' | 'currency'>) => (r.currency === 'USD' ? r.price : rate.value ? r.price / rate.value : undefined)
const perMonth = (r: Renewal) => CYCLES.find(c => c.value === r.cycle)!.perMonth

const upcoming = computed(() => items.value
  .map((r) => {
    const next = nextRenewal(r.nextDate, r.cycle)
    return { ...r, next, days: daysUntil(next) }
  })
  .sort((a, b) => a.days - b.days))

const monthlyUsd = computed(() => {
  let sum = 0
  for (const r of items.value) {
    const usd = toUsd(r)
    if (usd === undefined) return undefined // waiting for the rate
    sum += usd * perMonth(r)
  }
  return sum
})

const dueSoon = computed(() => upcoming.value.filter(r => r.days <= SOON_DAYS))

// A heads-up for anything renewing today or tomorrow, once per browser session
watch(ready, (isReady) => {
  if (!isReady) return
  const urgent = upcoming.value.filter(r => r.days <= 1)
  if (!urgent.length) return
  try {
    if (sessionStorage.getItem('ousa-app:renewals-reminded') === isoToday()) return
    sessionStorage.setItem('ousa-app:renewals-reminded', isoToday())
  } catch {}
  const r = urgent[0]!
  // On a fresh load the page is ready before the app's toast area mounts; wait a moment so it isn't lost
  setTimeout(() => toast.warning(`${r.name} ${r.days === 0 ? 'renews today' : 'renews tomorrow'}`, {
    description: urgent.length > 1 ? `And ${urgent.length - 1} more within a day.` : `${formatMoney(r.price, r.currency)} ${cycleLabel(r.cycle)}`
  }), 600)
}, { immediate: true })

// ---------- 30-day timeline ----------
const WINDOW = 30

// Every renewal date inside the window (weekly plans appear several times)
const timeline = computed(() => {
  const marks: { id: string, name: string, price: string, day: number, lane: number }[] = []
  for (const r of items.value) {
    let from = new Date()
    for (let guard = 0; guard < 10; guard++) {
      const next = nextRenewal(r.nextDate, r.cycle, from)
      const day = daysUntil(next)
      if (day > WINDOW) break
      marks.push({ id: `${r.id}-${day}`, name: r.name, price: formatMoney(r.price, r.currency), day, lane: 0 })
      from = new Date(`${next}T00:00`)
      from.setDate(from.getDate() + 1)
    }
  }
  // A label is about four days wide on the track, so markers closer than that go in separate lanes
  marks.sort((a, b) => a.day - b.day)
  const laneEnds: number[] = []
  for (const m of marks) {
    let lane = laneEnds.findIndex(end => m.day - end > 5)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = m.day
    m.lane = lane
  }
  return marks
})
const lanes = computed(() => Math.max(1, ...timeline.value.map(m => m.lane + 1)))
const weekTicks = [0, 7, 14, 21, 28]
const tickLabel = (d: number) => {
  if (d === 0) return 'Today'
  const date = new Date()
  date.setDate(date.getDate() + d)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function whenText(days: number) {
  if (days === 0) return 'Renews today'
  if (days === 1) return 'Renews tomorrow'
  return `Renews in ${days} days`
}

const formatDate = (d: string) => new Date(`${d}T00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const cycleLabel = (c: Cycle) => CYCLES.find(x => x.value === c)!.label.toLowerCase()

const canSave = computed(() => form.name.trim() && form.price > 0 && form.nextDate)

function save() {
  if (!canSave.value) return
  const record = { ...form, name: form.name.trim() }
  if (editingId.value) {
    update(editingId.value, record)
    toast.success('Changes saved')
  } else {
    add(record)
    toast.success(`${record.name} added`)
  }
  play('success')
  cancel()
}

function edit(r: Renewal) {
  editingId.value = r.id
  Object.assign(form, { name: r.name, price: r.price, currency: r.currency, cycle: r.cycle, nextDate: nextRenewal(r.nextDate, r.cycle) })
  formOpen.value = true
  play('open')
}

function cancel() {
  editingId.value = undefined
  formOpen.value = false
  Object.assign(form, blank())
}

function del(r: Renewal) {
  const removed = remove(r.id)
  if (editingId.value === r.id) cancel()
  play('delete')
  toast(`${r.name} deleted`, { action: { label: 'Undo', onClick: () => removed && restore(removed) } })
}
</script>

<template>
  <ToolPage header="bar">
    <template #actions>
      <button type="button" class="btn" @click="openAdd">+ Add subscription</button>
    </template>

    <Modal :open="formOpen" :title="editingId ? 'Edit subscription' : 'Add a subscription'" @close="cancel">
      <form class="form" @submit.prevent="save">
        <label class="field">
          <span class="field-head">Name</span>
          <input v-model="form.name" class="input" placeholder="Netflix, iCloud, phone plan…" required>
        </label>
        <div class="field">
          <span class="field-head">Price</span>
          <div class="price">
            <input v-model.number="form.price" class="input" type="number" inputmode="decimal" min="0" step="any" aria-label="Price" required>
            <div class="segmented" role="radiogroup" aria-label="Currency">
              <label v-for="c in (['USD', 'KHR'] as const)" :key="c" :class="{ active: form.currency === c }">
                <input v-model="form.currency" type="radio" name="currency" :value="c">
                {{ c === 'USD' ? '$' : '៛' }}
              </label>
            </div>
          </div>
        </div>
        <div class="row">
          <label class="field">
            <span class="field-head">Billed</span>
            <AppSelect v-model="form.cycle" aria-label="Billed" :options="CYCLES" />
          </label>
          <label class="field">
            <span class="field-head">Next renewal</span>
            <DatePicker v-model="form.nextDate" aria-label="Next renewal" required />
          </label>
        </div>
        <div class="actions">
          <button type="submit" class="btn" :disabled="!canSave">{{ editingId ? 'Save changes' : 'Add subscription' }}</button>
          <button type="button" class="btn btn-quiet" @click="cancel">Cancel</button>
        </div>
      </form>
    </Modal>

    <!-- Read like a billing statement: one centred column -->
    <div class="statement">
      <Step title="What you’re paying for" class="list-step">
        <template #aside><ClientOnly><DataSource :sync="sync" /></ClientOnly></template>
        <ClientOnly>
          <template v-if="ready && items.length">
            <section class="panel summary">
              <div>
                <span class="label">Per month</span>
                <strong>{{ monthlyUsd !== undefined ? formatMoney(monthlyUsd, 'USD') : '…' }}</strong>
              </div>
              <div>
                <span class="label">Per year</span>
                <strong>{{ monthlyUsd !== undefined ? formatMoney(monthlyUsd * 12, 'USD') : '…' }}</strong>
              </div>
              <div>
                <span class="label">Renewing this week</span>
                <strong>{{ dueSoon.length }}</strong>
              </div>
            </section>

            <section class="panel timeline" aria-label="Renewals in the next 30 days">
              <h3>Next 30 days</h3>
              <div class="track" :style="{ '--lanes': lanes }">
                <span v-for="d in weekTicks" :key="d" class="tick" :style="{ left: `${(d / WINDOW) * 100}%` }">
                  <span>{{ tickLabel(d) }}</span>
                </span>
                <span
                  v-for="m in timeline"
                  :key="m.id"
                  class="mark"
                  :class="{ end: m.day > WINDOW - 7 }"
                  :style="{ left: `${(m.day / WINDOW) * 100}%`, '--lane': m.lane }"
                  :title="`${m.name}: ${m.price}, ${m.day === 0 ? 'today' : `in ${m.day} days`}`"
                >
                  <span class="mark-label"><b>{{ m.name }}</b> <span class="mark-price">{{ m.price }}</span></span>
                </span>
              </div>
              <p v-if="!timeline.length" class="quiet">Nothing renews in the next 30 days.</p>
            </section>

            <ul class="renewals">
              <li v-for="r in upcoming" :key="r.id" class="panel renewal" :class="{ soon: r.days <= SOON_DAYS, editing: editingId === r.id }">
                <div class="when" :aria-label="whenText(r.days)">
                  <strong>{{ r.days === 0 ? 'Today' : r.days }}</strong>
                  <span v-if="r.days !== 0">{{ r.days === 1 ? 'day' : 'days' }}</span>
                </div>
                <div class="main">
                  <strong>{{ r.name }}</strong>
                  <span class="meta">{{ formatMoney(r.price, r.currency) }} {{ cycleLabel(r.cycle) }} · next {{ formatDate(r.next) }}</span>
                </div>
                <span class="links">
                  <!-- A repeating event from the next renewal, so every future charge is in the calendar -->
                  <CalendarAdd
                    :title="`${r.name} renews`"
                    :date="r.next"
                    :repeat="r.cycle"
                    :details="`${formatMoney(r.price, r.currency)} ${cycleLabel(r.cycle)}. From Renewals in Ousa’s Apps.`"
                    label="Calendar"
                  />
                  <button type="button" class="link" @click="edit(r)">Edit</button>
                  <ConfirmDelete class="link danger" :name="r.name" @confirm="del(r)" />
                </span>
              </li>
            </ul>
          </template>

          <div v-else-if="ready" class="panel empty">
            <h2>No subscriptions yet</h2>
            <p>Add your streaming, cloud storage or phone plan to see what they cost each month.</p>
            <button type="button" class="btn" @click="openAdd">+ Add subscription</button>
          </div>
        </ClientOnly>
      </Step>
    </div>
  </ToolPage>
</template>

<style scoped>
.statement {
  max-width: 880px;
  margin: 0 auto;
}

/* Wide screens: the timeline gets the full width and the subscriptions sit side by side */
@media (min-width: 1200px) {
  .statement {
    max-width: none;
  }

  .renewals {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  }
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.price {
  display: flex;
  gap: 0.5rem;
}

.price .input {
  flex: 1;
  font-variant-numeric: tabular-nums;
}

.price .segmented label {
  padding: 0.45rem 0.8rem;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.actions .btn:first-child {
  flex: 1;
}

.summary {
  padding: 1.25rem 1.4rem;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.summary div {
  display: flex;
  flex-direction: column;
}

.label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ink-2);
}

.summary strong {
  font-size: clamp(1.4rem, 3vw, 1.9rem);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

/* Timeline: today on the left, one marker per renewal, lanes so close dates don't collide */
.timeline {
  margin-top: 1rem;
  padding: 1.1rem 1.4rem 2.4rem; /* room for the date labels under the track */
}

.timeline h3 {
  font-size: 0.95rem;
}

.track {
  position: relative;
  margin: 0.9rem 0.5rem 0 0.25rem;
  height: calc(var(--lanes) * 2.6rem + 1rem);
  border-bottom: 2px solid var(--line);
}

.tick {
  position: absolute;
  bottom: -0.35rem;
  width: 2px;
  height: 0.7rem;
  background: var(--line);
}

.tick span {
  position: absolute;
  top: 1rem;
  left: 0;
  font-size: 0.72rem;
  color: var(--ink-3);
  white-space: nowrap;
  transform: translateX(-10%);
}

.mark {
  position: absolute;
  bottom: -0.45rem;
  width: 0.9rem;
  height: 0.9rem;
  margin-left: -0.45rem;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 3px var(--surface);
}

/* A stem from the dot up to its label, longer for higher lanes */
.mark::before {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 100%;
  width: 1px;
  height: calc(0.6rem + var(--lane) * 2.6rem);
  background: color-mix(in srgb, var(--accent) 50%, transparent);
}

.mark-label {
  position: absolute;
  left: 0;
  bottom: calc(1.4rem + var(--lane) * 2.6rem);
  padding: 0.2rem 0.5rem;
  font-size: 0.75rem;
  color: var(--ink-2);
  background: var(--surface-2);
  border-radius: 6px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.mark.end .mark-label {
  left: auto;
  right: 0;
}

/* Phones: names only, kept short, so neighbouring labels don't run into each other.
   Prices are in the list right below. */
@media (max-width: 560px) {
  .mark-price {
    display: none;
  }

  .mark-label {
    max-width: 5.5rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.mark-label b {
  color: var(--ink);
}

.quiet {
  margin: 1.5rem 0 0;
  font-size: 0.875rem;
  color: var(--ink-3);
}

.renewals {
  list-style: none;
  margin: 1rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.renewal {
  padding: 0.8rem 1.1rem 0.8rem 0.8rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.renewal.editing {
  box-shadow: 0 0 0 2px var(--accent);
}

.when {
  flex: none;
  width: 3.75rem;
  height: 3.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: var(--surface-2);
  line-height: 1.1;
}

.when strong {
  font-size: 1.35rem;
  font-variant-numeric: tabular-nums;
}

.when span {
  font-size: 0.75rem;
  color: var(--ink-2);
}

/* Renewing within a week: the countdown tile takes the tool colour */
.soon .when {
  color: #fff;
  background: var(--accent);
}

.soon .when span {
  color: rgb(255 255 255 / 0.85);
}

.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.meta {
  font-size: 0.875rem;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}

.links {
  flex: none;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--ink-2);
}

.link {
  padding: 0;
  font: inherit;
  font-size: 0.85rem;
  color: var(--ink-2);
  background: none;
  border: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.link.danger {
  color: var(--bad-ink);
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
  margin: 0.5rem 0 1rem;
}



@media (max-width: 560px) {
  .summary { grid-template-columns: 1fr 1fr; }
  .renewal { flex-wrap: wrap; }
  .links { width: 100%; justify-content: flex-end; }
}
</style>
