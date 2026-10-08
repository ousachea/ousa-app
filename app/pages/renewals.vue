<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { Currency } from '~/utils/exchange'
import type { Countdown, Cycle, Period } from '~/utils/renewals'
import type { RenewalCategory } from '~/utils/services'
import type { CsvColumn } from '~/utils/transfer'
import type { MenuEntry } from '~/composables/useContextMenu'

interface Renewal {
  id: string
  name: string
  price: number
  currency: Currency
  cycle: Cycle
  nextDate: string // yyyy-mm-dd, as entered; past dates roll forward when shown
  category?: RenewalCategory | '' // optional; suggested from the name (CHECKLIST.md #30)
  icon?: string // '' automatic from the name; 'letter', 'svc:<service>' or an image link chosen by hand (#54)
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
const { items, ready, sync, add, addMany, update, replace, remove, restore } = useCollection<Renewal>('renewals', undefined, { demo: DEMO })
const rate = useMarketRate()

// Pull down on a phone to sync again (CHECKLIST.md #26)
usePullToRefresh(async () => {
  await sync.retry()
  toast(sync.signedIn.value ? 'Up to date with your account' : 'Refreshed', { duration: 1800 })
})

const isoToday = () => new Date().toISOString().slice(0, 10)
// New subscriptions start with the currency and billing cycle used last time (CHECKLIST.md #14)
const lastCurrency = useRemembered<Renewal['currency']>('renewals-currency', 'USD', v => v === 'USD' || v === 'KHR')
const lastCycle = useRemembered<Renewal['cycle']>('renewals-cycle', 'monthly', v => CYCLES.some(c => c.value === v))
const blank = (): Omit<Renewal, 'id'> => ({ name: '', price: 0, currency: lastCurrency.value, cycle: lastCycle.value, nextDate: isoToday(), category: '', icon: '' })

// Icon (#54): type a service to look like it, "Letter only", or paste an image link; empty = automatic
const ICON_OPTIONS = [{ value: 'Letter only' }, ...SERVICES.map(s => ({ value: s.name, logo: siteLogo(s.domain) }))]
const iconText = ref('')
const iconFrom = (text: string) => {
  const t = text.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  if (t.toLowerCase() === 'letter only') return 'letter'
  const svc = SERVICES.find(s => s.name.toLowerCase() === t.toLowerCase())
  return svc ? `svc:${svc.name}` : ''
}
const textFromIcon = (icon?: string) => (!icon ? '' : icon === 'letter' ? 'Letter only' : icon.startsWith('svc:') ? icon.slice(4) : icon)
watch(iconText, t => (form.icon = iconFrom(t)))

// Category suggestion from the name, e.g. Netflix → Entertainment (CHECKLIST.md #30)
const CATEGORY_OPTIONS = [{ value: '', label: 'No category' }, ...RENEWAL_CATEGORIES.map(c => ({ value: c, label: c }))]
const ignoredCategory = ref('')
const knownService = computed(() => findService(form.name))
const categorySuggestion = computed(() => {
  const s = knownService.value
  return s && !form.category && ignoredCategory.value !== s.name ? s.category : undefined
})
const form = reactive(blank())
const editingId = ref<string>()
const formOpen = ref(false)

const draft = useDraft('renewals', form, {
  active: () => formOpen.value && !editingId.value,
  isEmpty: f => !f.name.trim() && !f.price,
  summary: f => [f.name, f.price && formatMoney(f.price, f.currency), CYCLES.find(c => c.value === f.cycle)?.label]
})

useAddAction(() => openAdd())
function openAdd() {
  cancel()
  formOpen.value = true
  draft.check()
  play('open')
}

// Conversions go through the shared helpers in utils/exchange.ts (#57)
const usdOf = (r: Pick<Renewal, 'price' | 'currency'>) => toUsd(r.price, r.currency, rate.value)
const perMonth = (r: Renewal) => CYCLES.find(c => c.value === r.cycle)!.perMonth

// A clock for the countdowns (#55): every second while something is under an hour away, else every 30 s
const now = ref(new Date())
let tick: ReturnType<typeof setTimeout> | undefined
function scheduleTick() {
  clearTimeout(tick)
  const live = upcoming.value.some(r => r.countdown.live)
  tick = setTimeout(() => {
    now.value = new Date()
    scheduleTick()
  }, live ? 1000 : 30_000)
}
onMounted(scheduleTick)
onBeforeUnmount(() => clearTimeout(tick))

// Equivalent cost per period (#58), and which currency the totals show in (#57)
const period = useRemembered<Period>('renewals-period', 'month', v => PERIODS.some(p => p.value === v))
const periodLabel = computed(() => PERIODS.find(p => p.value === period.value)!.label.toLowerCase())
const showIn = useRemembered<'both' | 'USD' | 'KHR'>('renewals-show-in', 'both', v => v === 'both' || v === 'USD' || v === 'KHR')

const SORTS = [
  { value: 'soonest', label: 'Soonest' },
  { value: 'expensive', label: 'Most expensive' },
  { value: 'name', label: 'Name' }
] as const
const sort = useRemembered<(typeof SORTS)[number]['value']>('renewals-sort', 'soonest', v => SORTS.some(s => s.value === v))

// Compared by what they cost per month in dollars, so a yearly plan and a monthly one line up
const monthlyCost = (r: Renewal) => (usdOf(r) ?? r.price / 4000) * perMonth(r)

const upcoming = computed(() => items.value
  .map((r) => {
    const next = nextRenewal(r.nextDate, r.cycle, now.value)
    const days = daysUntil(next, now.value)
    return { ...r, next, days, status: statusOf(days), countdown: countdown(renewalMoment(next), now.value) }
  })
  .sort((a, b) => {
    // Expired ones always sink to the bottom
    if ((a.status === 'expired') !== (b.status === 'expired')) return a.status === 'expired' ? 1 : -1
    if (sort.value === 'expensive') return monthlyCost(b) - monthlyCost(a) || a.days - b.days
    if (sort.value === 'name') return a.name.localeCompare(b.name)
    return a.days - b.days
  }))

const active = computed(() => upcoming.value.filter(r => r.status !== 'expired'))
const monthlyUsd = computed(() => {
  let sum = 0
  for (const r of active.value) {
    const usd = usdOf(r)
    if (usd === undefined) return undefined // waiting for the rate
    sum += usd * perMonth(r)
  }
  return sum
})
// The chosen period's total, in dollars (converted for riel below)
const periodUsd = computed(() => monthlyUsd.value === undefined ? undefined : monthlyUsd.value * PERIODS.find(p => p.value === period.value)!.perMonth)
const totalText = (usd: number) => showIn.value === 'KHR' && rate.value
  ? formatMoney(usd * rate.value, 'KHR')
  : showIn.value === 'both' ? formatBoth(usd, 'USD', rate.value) : formatMoney(usd, 'USD')

const dueSoon = computed(() => upcoming.value.filter(r => r.status === 'due' || r.status === 'soon'))
const expired = computed(() => upcoming.value.filter(r => r.status === 'expired'))

// "≈ $0.50 a day" under each subscription, unless it's already billed that often
const SAME_PERIOD: Partial<Record<Cycle, Period>> = { weekly: 'week', monthly: 'month', quarterly: 'quarter', halfyearly: 'half', yearly: 'year' }
const rowEquivalent = (r: Renewal) => {
  if (r.cycle === 'once' || SAME_PERIOD[r.cycle] === period.value) return ''
  return `≈ ${formatMoney(equivalent(r.price, r.cycle, period.value), r.currency)} a ${periodLabel.value}`
}

// A heads-up for anything renewing today or tomorrow, once per browser session
watch(ready, (isReady) => {
  if (!isReady) return
  const urgent = upcoming.value.filter(r => r.status === 'due')
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
      if (r.cycle === 'once' && guard > 0) break
      const next = nextRenewal(r.nextDate, r.cycle, from)
      const day = daysUntil(next)
      if (day > WINDOW || day < 0) break
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

function whenText(r: { days: number, cycle: Cycle, countdown: Countdown }) {
  const verb = r.cycle === 'once' ? 'Ends' : 'Renews'
  if (r.days < 0) return `Ended ${-r.days} ${-r.days === 1 ? 'day' : 'days'} ago`
  if (r.days === 0) return `${verb} today`
  if (r.days === 1) return `${verb} tomorrow, in ${r.countdown.text}`
  return `${verb} in ${r.countdown.text}`
}

const formatDate = (d: string) => new Date(`${d}T00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const cycleLabel = (c: Cycle) => CYCLES.find(x => x.value === c)!.label.toLowerCase()

const canSave = computed(() => form.name.trim() && form.price > 0 && form.nextDate)

function save() {
  if (!canSave.value) return
  const record = { ...form, name: form.name.trim() }
  if (editingId.value) {
    const before = update(editingId.value, record)
    toastSaved(before && (() => replace(before)))
  } else {
    const added = add(record)
    draft.clear()
    lastCurrency.value = record.currency
    lastCycle.value = record.cycle
    toast.success(`${record.name} added`, { action: { label: 'Undo', onClick: () => remove(added.id, { undoAdd: true }) } })
  }
  play('success')
  cancel()
}

// Right-click / long-press (CHECKLIST.md #27)
const menuFor = useRowMenu()
const renewalMenu = (r: Renewal): MenuEntry[] => [
  { label: 'Edit', icon: 'edit', run: () => edit(r) },
  { label: 'Duplicate', icon: 'duplicate', run: () => duplicate(r) },
  { label: 'Copy details', icon: 'copy', run: () => copyText(`${r.name}: ${formatMoney(r.price, r.currency)} ${cycleLabel(r.cycle)}, next ${formatDate(nextRenewal(r.nextDate, r.cycle))}`) },
  '-',
  { label: 'Delete', icon: 'delete', danger: true, run: () => del(r) }
]
function duplicate(r: Renewal) {
  const { id: _, ...rest } = r
  const copy = add({ ...rest, name: `${r.name} (copy)` })
  play('success')
  toast.success('Renewal duplicated', { description: copy.name, action: { label: 'Undo', onClick: () => remove(copy.id, { undoAdd: true }) } })
}
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    play('copy')
    toast.success('Copied', { description: text })
  } catch {
    toast.error('Couldn’t copy')
  }
}

function edit(r: Renewal) {
  editingId.value = r.id
  Object.assign(form, { name: r.name, price: r.price, currency: r.currency, cycle: r.cycle, nextDate: nextRenewal(r.nextDate, r.cycle), category: r.category ?? '', icon: r.icon ?? '' })
  iconText.value = textFromIcon(r.icon)
  formOpen.value = true
  play('open')
}

function cancel() {
  editingId.value = undefined
  formOpen.value = false
  Object.assign(form, blank())
  iconText.value = ''
}

// ---------- Import & export (CHECKLIST.md #18) ----------
const transferOpen = ref(false)
const RENEWAL_COLUMNS: CsvColumn<Renewal>[] = [
  { header: 'Name', get: r => r.name },
  { header: 'Price', get: r => r.price },
  { header: 'Currency', get: r => r.currency },
  { header: 'Billed', get: r => CYCLES.find(c => c.value === r.cycle)?.label ?? r.cycle },
  { header: 'Next renewal', get: r => nextRenewal(r.nextDate, r.cycle) },
  { header: 'Category', get: r => r.category ?? '' }
]
const cycleFrom = (s: string): Cycle => {
  const t = s.trim().toLowerCase()
  return CYCLES.find(c => c.value === t || c.label.toLowerCase() === t)?.value
    ?? (/week/.test(t) ? 'weekly' : /quarter|3 month/.test(t) ? 'quarterly' : /year|annual/.test(t) ? 'yearly' : 'monthly')
}
function renewalFrom(name: string, price: number | undefined, currency: string, cycle: string, date: string, category = ''): Omit<Renewal, 'id'> | undefined {
  if (!name.trim() || !price || price <= 0) return undefined
  const cat = RENEWAL_CATEGORIES.find(c => c.toLowerCase() === category.trim().toLowerCase()) ?? ''
  return { name: name.trim(), price, currency: currency.toUpperCase() === 'KHR' ? 'KHR' : 'USD', cycle: cycleFrom(cycle), nextDate: toIsoDate(date) || isoToday(), category: cat }
}
const renewalFromRow = (row: Record<string, string>) => renewalFrom(
  cellOf(row, 'name', 'service', 'subscription'),
  toNumber(cellOf(row, 'price', 'amount', 'cost')),
  cellOf(row, 'currency'),
  cellOf(row, 'billed', 'cycle', 'billing'),
  cellOf(row, 'next renewal', 'next date', 'nextdate', 'date'),
  cellOf(row, 'category')
)
const renewalFromJSON = (r: Record<string, unknown>) => renewalFrom(String(r.name ?? ''), Number(r.price), String(r.currency ?? ''), String(r.cycle ?? ''), String(r.nextDate ?? ''), String(r.category ?? ''))
const renewalKey = (r: Omit<Renewal, 'id'>) => `${r.name.toLowerCase()}|${r.price}|${r.cycle}`

function del(r: Renewal) {
  const removed = remove(r.id)
  if (editingId.value === r.id) cancel()
  play('delete')
  toastDeleted(r.name, () => removed && restore(removed))
}
</script>

<template>
  <ToolPage header="bar">
    <template #actions>
      <div class="head-buttons">
        <ClientOnly><button type="button" class="btn btn-quiet" @click="transferOpen = true">Import / Export</button></ClientOnly>
        <button type="button" class="btn" @click="openAdd">+ Add subscription</button>
      </div>
    </template>

    <TransferDialog
      :open="transferOpen"
      title="Renewals"
      collection="renewals"
      app="/renewals"
      :items="items"
      :columns="RENEWAL_COLUMNS"
      :from-row="renewalFromRow"
      :from-json="renewalFromJSON"
      :same-as="renewalKey"
      :add-many="addMany"
      :remove="remove"
      @close="transferOpen = false"
    />

    <Modal :open="formOpen" :title="editingId ? 'Edit subscription' : 'Add a subscription'" @close="cancel">
      <form v-validate class="form" @submit.prevent="save">
        <DraftCard v-if="draft.offered.value" :lines="draft.lines.value" @resume="draft.resume()" @discard="draft.discard()" />
        <label class="field">
          <span class="field-head">Name</span>
          <input v-model="form.name" class="input" placeholder="Netflix, iCloud, phone plan…" required data-error="Give it a name, like Netflix">
        </label>
        <SuggestionChip
          v-if="categorySuggestion"
          label="Suggested category"
          :value="categorySuggestion"
          @use="form.category = categorySuggestion"
          @ignore="ignoredCategory = knownService?.name ?? ''"
        />
        <div class="field">
          <span class="field-head">Price</span>
          <div class="price">
            <input v-model.number="form.price" class="input" type="number" inputmode="decimal" min="0" step="any" aria-label="Price" required v-check="Number(form.price) > 0 ? '' : 'Enter what it costs'">
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
        <label class="field">
          <span class="field-head">Category <span class="optional">Optional</span></span>
          <AppSelect v-model="form.category" aria-label="Category" :options="CATEGORY_OPTIONS" />
        </label>
        <div class="field">
          <span class="field-head">Icon <span class="optional">Automatic</span></span>
          <div class="icon-row">
            <RenewalIcon :name="form.name || '?'" :icon="form.icon" />
            <ComboInput v-model="iconText" :options="ICON_OPTIONS" placeholder="From the name. Or pick a service, “Letter only”, or paste an image link" aria-label="Icon" />
          </div>
        </div>
        <div class="actions">
          <button type="submit" class="btn">{{ editingId ? 'Save changes' : 'Add subscription' }}</button>
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
              <div class="total">
                <span class="label">What it all costs, spread evenly</span>
                <div class="periods segmented" role="radiogroup" aria-label="Per">
                  <label v-for="p in PERIODS" :key="p.value" :class="{ active: period === p.value }">
                    <input v-model="period" type="radio" name="period" :value="p.value">{{ p.label }}
                  </label>
                </div>
                <strong class="total-figure">{{ periodUsd !== undefined ? `≈ ${totalText(periodUsd)}` : '…' }}</strong>
                <span class="total-note">
                  An equivalent per {{ periodLabel }}, not what you’re charged on any one day.
                  <span class="show-in">Show in
                    <button v-for="c in (['both', 'USD', 'KHR'] as const)" :key="c" type="button" class="link" :aria-pressed="showIn === c" @click="showIn = c">{{ c === 'both' ? 'both' : c === 'USD' ? '$' : '៛' }}</button>
                  </span>
                </span>
              </div>
              <div>
                <span class="label">Due soon</span>
                <strong>{{ dueSoon.length }}</strong>
                <span class="total-note">Within a week</span>
              </div>
              <div v-if="expired.length">
                <span class="label">Expired</span>
                <strong>{{ expired.length }}</strong>
                <span class="total-note">One-off dates that passed</span>
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

            <div class="list-head">
              <h3>{{ items.length }} {{ items.length === 1 ? 'subscription' : 'subscriptions' }}</h3>
              <AppSelect v-model="sort" class="sort" aria-label="Sort by" :options="SORTS" />
            </div>
            <TransitionGroup tag="ul" name="list" class="renewals">
              <li v-for="r in upcoming" :key="r.id" :data-item-id="r.id" class="panel renewal" v-bind="menuFor(() => renewalMenu(r), r.name)" v-swipe-delete="() => del(r)" :class="[`is-${r.status}`, { soon: r.status === 'soon' || r.status === 'due', editing: editingId === r.id }]">
                <!-- Countdown (#55): bigger units far away, down to seconds in the last hour -->
                <div class="when" role="timer" :aria-label="whenText(r)" :title="whenText(r)">
                  <template v-if="r.status === 'expired'"><strong>✕</strong><span>ended</span></template>
                  <template v-else-if="r.days === 0"><strong class="word">Today</strong><span>renews</span></template>
                  <template v-else><strong>{{ r.countdown.value }}</strong><span>{{ r.countdown.unit }}</span></template>
                </div>
                <RenewalIcon :name="r.name" :icon="r.icon" />
                <div class="main">
                  <span class="title-row">
                    <strong>{{ r.name }}</strong>
                    <span class="badge" :class="STATUS[r.status].badge"><span aria-hidden="true">{{ STATUS[r.status].symbol }}</span> {{ r.status === 'due' && r.days === 1 ? 'Due tomorrow' : r.status === 'due' ? 'Due today' : STATUS[r.status].label }}</span>
                  </span>
                  <span class="meta">
                    {{ formatBoth(r.price, r.currency, rate) }} {{ r.cycle === 'once' ? '' : cycleLabel(r.cycle) }} · {{ r.status === 'expired' ? 'ended' : r.cycle === 'once' ? 'ends' : 'next' }} {{ formatDate(r.next) }}<template v-if="r.category"> · {{ r.category }}</template>
                  </span>
                  <span class="meta fine">
                    <template v-if="r.status !== 'expired' && r.days > 0">in {{ r.countdown.text }}</template>
                    <template v-if="rowEquivalent(r)"> · {{ rowEquivalent(r) }}</template>
                  </span>
                </div>
                <span class="links">
                  <!-- A repeating event from the next renewal, so every future charge is in the calendar -->
                  <CalendarAdd
                    v-if="r.status !== 'expired'"
                    :title="`${r.name} ${r.cycle === 'once' ? 'ends' : 'renews'}`"
                    :date="r.next"
                    :repeat="r.cycle"
                    :details="`${formatMoney(r.price, r.currency)} ${cycleLabel(r.cycle)}. From Renewals in Ousa’s Apps.`"
                    label="Calendar"
                  />
                  <button type="button" class="link" @click="edit(r)">Edit</button>
                  <ConfirmDelete text :name="r.name" @confirm="del(r)" />
                </span>
              </li>
            </TransitionGroup>
          </template>

          <div v-else-if="ready" class="panel">
            <EmptyState title="No renewals yet" icon="renewals" action="+ Add renewal" @action="openAdd">
              Track subscriptions and recurring payments, like streaming, cloud storage or your phone plan, so you never forget an upcoming charge.
            </EmptyState>
          </div>
          <SkeletonList v-else label="Loading your renewals" />
          <template #fallback><SkeletonList label="Loading your renewals" /></template>
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
  /* Side by side when there's room, stacked on narrow phones so the date never spills out */
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
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
  grid-template-columns: minmax(0, 2.4fr) repeat(auto-fit, minmax(7rem, 1fr));
  gap: 1rem 1.5rem;
}

.total {
  gap: 0.45rem;
}

.periods {
  width: fit-content;
  max-width: 100%;
  overflow-x: auto;
  font-size: var(--text-sm);
}

.periods label {
  padding-inline: 0.65rem;
  white-space: nowrap;
}

.total-figure {
  overflow-wrap: anywhere;
}

.total-note {
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.show-in {
  display: inline-flex;
  gap: 0.4rem;
  margin-left: 0.4rem;
}

.show-in .link[aria-pressed='true'] {
  color: var(--ink);
  font-weight: 700;
  text-decoration: none;
}

@media (max-width: 640px) {
  .summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .total {
    grid-column: 1 / -1;
  }
}

.icon-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.icon-row > :last-child {
  flex: 1;
  min-width: 0;
}

.summary > div {
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

.head-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 0.5rem 0 -0.25rem;
}

.list-head h3 {
  font-size: 1rem;
  color: var(--ink-2);
}

.list-head .sort {
  width: 12rem;
}

.renewals {
  position: relative;
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

.when strong.word {
  font-size: 1rem;
}

/* Expired: everything steps back */
.is-expired {
  opacity: 0.7;
}

.is-expired .when {
  color: var(--ink-3);
}

.title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2rem 0.5rem;
}

.meta.fine {
  font-size: var(--text-xs);
  color: var(--ink-3);
}

.when span {
  font-size: 0.75rem;
  color: var(--ink-2);
}

/* Renewing within a week: the countdown tile takes the tool colour */
.soon .when {
  color: #fff;
  background: var(--accent-btn, var(--accent));
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
