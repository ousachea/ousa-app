<script setup lang="ts">
import type { BulkAction } from '~/composables/useBulkSelect'
import { toast } from 'vue-sonner'
import type { Renewal } from '~/utils/calendar'
import type { Countdown, Cycle, Period } from '~/utils/renewals'
import type { CsvColumn } from '~/utils/transfer'
import type { MenuEntry } from '~/composables/useContextMenu'

const { play } = useSound()
// Calendar's Renewals tab: your subscriptions, plus your dates and the holidays for the 30-day timeline (useCalendar)
const { items, ready, sync, add, addMany, update, replace, remove, restore } = useRenewals()
const dates = useDates()
const calPrefs = useCalendarPrefs().prefs
// Today's rate, the last one saved here, or (if neither ever loaded) a typical rate that's labelled
const rateInfo = useMarketRateInfo()
const rate = computed(() => rateInfo.value.rate)

// Pull down on a phone to sync again (CHECKLIST.md #26)
usePullToRefresh(async () => {
  await sync.retry()
  toast(sync.signedIn.value ? 'Up to date with your account' : 'Refreshed', { duration: 1800 })
})

const isoToday = () => localIsoDate()
// New subscriptions start with the currency and billing cycle used last time (CHECKLIST.md #14)
const lastCurrency = useRemembered<Renewal['currency']>('renewals-currency', 'USD', v => v === 'USD' || v === 'KHR')
const lastCycle = useRemembered<Renewal['cycle']>('renewals-cycle', 'monthly', v => CYCLES.some(c => c.value === v))
const blank = (): Omit<Renewal, 'id'> => ({ name: '', price: 0, currency: lastCurrency.value, cycle: lastCycle.value, nextDate: isoToday(), category: '', icon: '' })

// Icon (#54): type a service to look like it, "Letter only", or paste an image link; empty = automatic
const ICON_OPTIONS = [{ value: 'Letter only' }, ...SERVICES.map(s => ({ value: s.name, logo: s.brand ? brandLogoUrl(s.brand) : siteLogo(s.domain) }))]
const iconText = ref('')
const iconFrom = (text: string) => {
  const t = text.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  if (t.toLowerCase() === 'letter only') return 'letter'
  const lib = /^icon:\s*([a-z0-9-]+)$/i.exec(t)
  if (lib) return `${ICON_LIBRARY_PREFIX}lucide:${lib[1]!.toLowerCase()}`
  const svc = SERVICES.find(s => s.name.toLowerCase() === t.toLowerCase())
  return svc ? `svc:${svc.name}` : ''
}
const textFromIcon = (icon?: string) => (!icon
  ? ''
  : icon === 'letter'
    ? 'Letter only'
    : icon.startsWith('svc:')
      ? icon.slice(4)
      : icon.startsWith(ICON_LIBRARY_PREFIX) ? `Icon: ${icon.split(':').pop()}` : icon)
watch(iconText, t => (form.icon = iconFrom(t)))
// The icon library, for names with no logo of their own: open by default for those, or on request
const libraryOpen = ref(false)
const noLogo = computed(() => form.name.trim().length > 1 && !form.icon && !knownService.value)
const libraryIcon = computed({
  get: () => form.icon.startsWith(ICON_LIBRARY_PREFIX) ? form.icon.slice(ICON_LIBRARY_PREFIX.length) : '',
  set: (id: string) => (iconText.value = textFromIcon(id ? ICON_LIBRARY_PREFIX + id : ''))
})

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
// Step 1's quick picks: the form opens with the name filled in, so its category and icon follow
const QUICK_SERVICES = ['Netflix', 'Spotify', 'YouTube Premium', 'iCloud+', 'Google One', 'ChatGPT Plus', 'Smart', 'Cellcard', 'Metfone', 'Microsoft 365']
function openAddAs(name: string) {
  openAdd()
  form.name = name
}

// Conversions go through the shared helpers in utils/exchange.ts (#57)
const usdOf = (r: Pick<Renewal, 'price' | 'currency'>) => toUsd(r.price, r.currency, rate.value)
const perMonth = (r: Renewal) => CYCLES.find(c => c.value === r.cycle)!.perMonth

// Calendar's clock for the countdowns (#55): every second while something is under an hour away, else every 30 s
const nowMs = useNow(() => upcoming.value.some(r => r.countdown.live))
const now = computed(() => new Date(nowMs.value))
const { holidays } = useHolidays(nowMs)

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
// A monthly limit for everything that renews (0 = none), on this device; the dial (components/gauge)
// shows the monthly total against it
const limitUsd = useRemembered<number>('renewals-limit', 0, v => typeof v === 'number' && v >= 0)
const limitShare = computed(() => (limitUsd.value && monthlyUsd.value !== undefined ? monthlyUsd.value / limitUsd.value : 0))
const limitTone = computed(() => (limitShare.value > 1 ? 'var(--red)' : limitShare.value >= 0.8 ? 'var(--orange)' : 'var(--green)'))
const limitDraft = ref('')
const editingLimit = ref(false)
function editLimit() {
  limitDraft.value = limitUsd.value ? String(limitUsd.value) : ''
  editingLimit.value = true
}
function saveLimit() {
  const v = Number(limitDraft.value.replace(/[$,\s]/g, ''))
  if (!Number.isFinite(v) || v < 0) return
  limitUsd.value = Math.round(v * 100) / 100
  editingLimit.value = false
  play(v ? 'success' : 'toggle-off')
}

// The chosen period's total, in dollars (converted for riel below)
const periodUsd = computed(() => monthlyUsd.value === undefined ? undefined : monthlyUsd.value * PERIODS.find(p => p.value === period.value)!.perMonth)
const totalText = (usd: number) => showIn.value === 'KHR' && rate.value
  ? formatMoney(usd * rate.value, 'KHR')
  : showIn.value === 'both' ? formatBoth(usd, 'USD', rate.value) : formatMoney(usd, 'USD')

// ---------- Next charge: one renewal counted down to the second, beside each row's own countdown ----------
// The soonest by default; pick another and it's remembered on this device. A one-off that has ended stays
// chosen and shows that it has ended, rather than swapping silently to something else.
const featuredId = useRemembered<string>('renewals-featured', '', v => typeof v === 'string')
const soonest = computed(() => active.value.reduce<(typeof active.value)[number] | undefined>((best, r) => (!best || r.days < best.days ? r : best), undefined))
const featured = computed(() => upcoming.value.find(r => r.id === featuredId.value) ?? soonest.value)
const featuredOptions = computed(() => [
  { value: '', label: 'The soonest' },
  ...upcoming.value.map(r => ({ value: r.id, label: r.name }))
])
// How far through its billing period it is, from the charge before (the ring round its icon)
const featuredCycle = computed(() => {
  const r = featured.value
  if (!r || r.status === 'expired') return undefined
  const start = cycleStart(r.nextDate, r.cycle, r.next)
  if (!start) return undefined
  const from = renewalMoment(start).getTime()
  const to = renewalMoment(r.next).getTime()
  return { start, share: to > from ? Math.min(1, Math.max(0, (nowMs.value - from) / (to - from))) : 1 }
})

const dueSoon = computed(() => upcoming.value.filter(r => r.status === 'due' || r.status === 'soon'))
const expired = computed(() => upcoming.value.filter(r => r.status === 'expired'))

// "≈ $0.50 a day" under each subscription, unless it's already billed that often
const SAME_PERIOD: Partial<Record<Cycle, Period>> = { weekly: 'week', monthly: 'month', quarterly: 'quarter', halfyearly: 'half', yearly: 'year' }
const rowEquivalent = (r: Renewal) => {
  if (r.cycle === 'once' || SAME_PERIOD[r.cycle] === period.value) return ''
  return `≈ ${formatMoney(equivalent(r.price, r.cycle, period.value), r.currency)} a ${periodLabel.value}`
}

// The day's heads-up for renewals, dates and holidays due today or tomorrow, shared with the Dates tab
useDueReminder(() => ready.value && dates.ready.value && sync.state.value !== 'demo'
  ? { renewals: items.value, dates: dates.items.value, holidays: calPrefs.holidays ? holidays.value : [] }
  : undefined)

// ---------- The next 30 days: renewals, your dates and the holidays on one track ----------
const marks = computed(() => upcomingMarks({ renewals: items.value, dates: dates.items.value, holidays: calPrefs.holidays ? holidays.value : [] }, now.value))

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
  // The form shows the next renewal, rolled forward. Left as it was, keep the date first entered: it holds
  // the billing day, which a short month or a non-leap year clamps (31 Jan → 28 Feb would bill on the 28th
  // from then on, and a 29 Feb yearly plan on the 28th)
  if (editingId.value && shownEdit && record.nextDate === shownEdit.next && record.cycle === shownEdit.cycle) record.nextDate = shownEdit.anchor
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
  { label: r.favorite ? 'Remove from favourites' : 'Add to favourites', icon: 'star', run: () => toggleFavourite(items.value.find(x => x.id === r.id)!, r.name, update, replace) },
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

// What the edit form opened with, so an untouched date keeps its billing day (see save)
let shownEdit: { next: string, anchor: string, cycle: Cycle } | undefined
function edit(r: Renewal) {
  editingId.value = r.id
  const next = nextRenewal(r.nextDate, r.cycle)
  shownEdit = { next, anchor: r.nextDate, cycle: r.cycle }
  Object.assign(form, { name: r.name, price: r.price, currency: r.currency, cycle: r.cycle, nextDate: next, category: r.category ?? '', icon: r.icon ?? '' })
  iconText.value = textFromIcon(r.icon)
  libraryOpen.value = !!r.icon?.startsWith(ICON_LIBRARY_PREFIX)
  formOpen.value = true
  play('open')
}

function cancel() {
  editingId.value = undefined
  shownEdit = undefined
  formOpen.value = false
  Object.assign(form, blank())
  iconText.value = ''
  libraryOpen.value = false
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

// ---------- Select several (useBulkSelect) ----------
const bulkText = (n: number) => `${n} ${n === 1 ? 'renewal' : 'renewals'}`
const sel = useBulkSelect({ items, shown: upcoming, onDelete: () => deleteSelected() })
function deleteSelected() {
  sel.guard(`Delete ${bulkText(sel.selected.size)}?`, () => bulkRemove(sel.selectedItems as Renewal[], remove, restore, bulkText))
}
const bulkActions = computed<BulkAction[]>(() => [
  { label: allFavourite(sel.selectedItems as Renewal[]) ? 'Unfavourite' : 'Favourite', icon: 'star', run: () => bulkFavourite(sel.selectedItems as Renewal[], update, replace, bulkText) },
  { label: 'Delete', icon: 'delete', danger: true, run: deleteSelected }
])

function del(r: Renewal) {
  const removed = remove(r.id)
  if (editingId.value === r.id) cancel()
  play('delete')
  toastDeleted(r.name, () => removed && restore(removed))
}
</script>

<template>
  <ToolPage header="band">
    <template #settings>
      <SettingChoice v-model="sort" title="Sort by" :options="SORTS" />
      <SettingChoice v-model="period" title="Show what it costs per" description="The totals and the “≈ … a month” under each subscription." :options="PERIODS.map(p => ({ value: p.value, label: p.label }))" />
      <SettingChoice v-model="showIn" title="Show totals in" :options="[{ value: 'both', label: 'Both' }, { value: 'USD', label: 'Dollars' }, { value: 'KHR', label: 'Riel' }]" />
      <SettingChoice v-model="lastCurrency" title="New subscriptions in" :options="[{ value: 'USD', label: 'Dollars' }, { value: 'KHR', label: 'Riel' }]" />
      <SettingChoice v-model="lastCycle" title="New subscriptions are billed" :options="CYCLES.map(c => ({ value: c.value, label: c.label }))" />
    </template>
    <template #transfer>
      <button type="button" class="btn btn-quiet btn-sm" @click="transferOpen = true">More formats…</button>
      <span>CSV for spreadsheets, or JSON.</span>
    </template>
    <template #actions>
      <div class="head-buttons">
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
          <input v-model="form.name" class="input" list="renewal-services" autocomplete="off" placeholder="Netflix, iCloud, phone plan…" required data-error="Give it a name, like Netflix">
          <!-- Known services as suggestions while typing (#13, #54); anything else can still be typed -->
          <datalist id="renewal-services">
            <option v-for="s in SERVICES" :key="s.name" :value="s.name" />
          </datalist>
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
          <button type="button" class="link library-toggle" :aria-expanded="libraryOpen" @click="libraryOpen = !libraryOpen">
            {{ libraryOpen ? 'Hide icon library' : noLogo ? 'No logo for this name. Choose an icon instead' : 'Choose from the icon library' }}
          </button>
          <IconLibrary v-if="libraryOpen" v-model="libraryIcon" />
        </div>
        <div class="actions">
          <button type="submit" class="btn">{{ editingId ? 'Save changes' : 'Add subscription' }}</button>
          <button type="button" class="btn btn-quiet" @click="cancel">Cancel</button>
        </div>
      </form>
    </Modal>

    <!-- Read like a billing statement: one centred column -->
    <div class="statement">
      <!-- Three numbered steps, the way every app here walks you through it -->
      <ClientOnly><DataSource :sync="sync" /></ClientOnly>
      <!-- In a card, since it overlaps the coloured band at the top of the page (as in Dates and Things) -->
      <Step :n="1" title="Add what you pay for" hint="Streaming, cloud storage, your phone plan: anything that renews. Tap one, or add your own." class="panel add-step">
        <div class="quick-add" role="group" aria-label="Add a subscription">
          <button v-for="name in QUICK_SERVICES" :key="name" type="button" class="quick-service" @click="openAddAs(name)">
            <RenewalIcon :name="name" />
            <span :title="name">{{ name }}</span>
          </button>
          <button type="button" class="quick-service other" @click="openAdd">
            <span v-ants class="plus" aria-hidden="true">+</span>
            <span>Something else</span>
          </button>
        </div>
      </Step>

      <Step :n="2" title="See what it all costs" hint="Spread over a day, a month or a year, and what renews in the next 30 days." class="cost-step">
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
                <span v-if="rateInfo.from === 'fallback'" class="total-note warn-note">
                  Couldn’t get today’s exchange rate, so riel is counted at about {{ FALLBACK_RATE.toLocaleString('en-US') }} ៛ to the dollar.
                </span>
                <span class="total-note">
                  An equivalent per {{ periodLabel }}, not what you’re charged on any one day.
                  <span class="show-in">Show in
                    <button v-for="c in (['both', 'USD', 'KHR'] as const)" :key="c" type="button" class="link" :aria-pressed="showIn === c" @click="showIn = c">{{ c === 'both' ? 'both' : c === 'USD' ? '$' : '៛' }}</button>
                  </span>
                </span>
              </div>
              <div class="limit">
                <span class="label">Monthly limit</span>
                <form v-if="!limitUsd || editingLimit" class="limit-form" @submit.prevent="saveLimit">
                  <label class="limit-input"><span aria-hidden="true">$</span><input v-model="limitDraft" class="input" inputmode="decimal" placeholder="50" aria-label="Monthly limit in US dollars" autocomplete="off"></label>
                  <button type="submit" class="btn btn-sm">Set</button>
                  <button v-if="editingLimit" type="button" class="link" @click="editingLimit = false">Cancel</button>
                </form>
                <button v-else type="button" class="limit-view" :title="`${Math.round(limitShare * 100)}% of $${limitUsd} a month. Click to change.`" @click="editLimit">
                  <span class="limit-dial" aria-hidden="true">
                    <Gauge :value="Math.min(limitShare, 1)" :min="0" :max="1" :start-angle="60" :end-angle="300" :radius="200" :padding="22" fit="content" transition :initial-value="0">
                      <GaugeTrack :width="34" color="var(--ink)" :opacity="0.08" />
                      <GaugeArc :width="34" :color="limitTone" />
                      <GaugeText :y="-10" :font-size="92" weight="bold" color="var(--ink)">{{ Math.round(limitShare * 100) }}%</GaugeText>
                    </Gauge>
                  </span>
                  <span class="total-note">of ${{ limitUsd.toLocaleString('en-US') }}</span>
                </button>
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

            <UpcomingTimeline class="timeline" :marks="marks" empty="Nothing renews or comes up in the next 30 days." />
          </template>
          <p v-else-if="ready" class="panel step-empty">Your total, and a timeline of what’s coming up, show here once you add something.</p>
          <SkeletonList v-else label="Loading your renewals" />
          <template #fallback><SkeletonList label="Loading your renewals" /></template>
        </ClientOnly>
      </Step>

      <Step :n="3" title="Know what’s due next" hint="Soonest first, counting down to each charge. Add one to your calendar, or long-press it for more." class="list-step">
        <template #aside><ClientOnly><BulkToggle v-if="items.length" :select="sel" /></ClientOnly></template>
        <ClientOnly>
          <template v-if="ready && items.length">
            <!-- Next charge: a second countdown to the second, for the one that matters most right now -->
            <section v-if="featured" class="panel next-up" :class="`is-${featured.status}`" aria-label="Next charge">
              <div class="next-ring">
                <Gauge :value="featuredCycle?.share ?? 0" :min="0" :max="1" :start-angle="0" :end-angle="360" :radius="200" :padding="20" transition :initial-value="0">
                  <GaugeTrack :width="26" color="var(--ink)" :opacity="0.08" />
                  <GaugeArc v-if="featuredCycle" :width="26" color="var(--accent)" />
                </Gauge>
                <RenewalIcon :name="featured.name" :icon="featured.icon" />
              </div>
              <div class="next-main">
                <div class="next-head">
                  <span class="label"><AnimatedIcon v-if="featured.status !== 'expired'" class="label-icon" name="hourglass" trigger="loop" />{{ featured.status === 'expired' ? 'Ended' : featured.cycle === 'once' ? 'Ends' : 'Next charge' }}</span>
                  <AppSelect v-model="featuredId" class="next-pick" aria-label="Count down to" :options="featuredOptions" />
                </div>
                <strong class="next-name">{{ featured.name }} <span>{{ formatBoth(featured.price, featured.currency, rate) }}</span></strong>
                <RenewalClock :key="featured.id" class="next-clock" :target="renewalMoment(featured.next).getTime()" :done-text="featured.status === 'expired' ? `Ended ${formatDate(featured.next)}` : `${featured.cycle === 'once' ? 'Ends' : 'Renews'} today`" />
                <p class="next-note">
                  {{ formatDate(featured.next) }}, at midnight your time<template v-if="featuredCycle"> · {{ Math.floor(featuredCycle.share * 100) }}% of this {{ featured.cycle === 'weekly' ? 'week' : 'billing period' }} gone since {{ formatDate(featuredCycle.start) }}</template>
                </p>
              </div>
            </section>

            <div class="list-head">
              <h3>{{ items.length }} {{ items.length === 1 ? 'subscription' : 'subscriptions' }}</h3>
              <AppSelect v-model="sort" class="sort" aria-label="Sort by" :options="SORTS" />
            </div>
            <TransitionGroup tag="ul" name="list" class="renewals">
              <li v-for="r in upcoming" :key="r.id" :data-item-id="r.id" class="panel renewal bulk-row" v-bind="menuFor(() => renewalMenu(r), r.name)" v-swipe-delete="() => del(r)" :data-bulk="sel.selecting || undefined" @click.capture="sel.onRowClick($event, r.id)" :class="[`is-${r.status}`, { soon: r.status === 'soon' || r.status === 'due', editing: editingId === r.id, 'bulk-picked': sel.has(r.id) }]">
                <BulkCheck v-if="sel.selecting" :checked="sel.has(r.id)" :label="`Select ${r.name}`" @pick="sel.pick(r.id, $event)" />
                <!-- Countdown (#55): bigger units far away, down to seconds in the last hour -->
                <div class="when" role="timer" :aria-label="whenText(r)" :title="whenText(r)">
                  <template v-if="r.status === 'expired'"><strong>✕</strong><span>ended</span></template>
                  <template v-else-if="r.days === 0"><strong class="word">Today</strong><span>renews</span></template>
                  <template v-else><strong>{{ r.countdown.value }}</strong><span>{{ r.countdown.unit }}</span></template>
                </div>
                <RenewalIcon :name="r.name" :icon="r.icon" />
                <div class="main">
                  <span class="title-row">
                    <strong>{{ r.name }}<span v-if="r.favorite" class="fav" title="Favourite" aria-label="Favourite"> ★</span></strong>
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
                  <span class="menu-dup"><button type="button" class="link" @click="edit(r)">Edit</button>
                    <ConfirmDelete text :name="r.name" @confirm="del(r)" /></span>
                </span>
              </li>
            </TransitionGroup>
          </template>

          <p v-else-if="ready" class="panel step-empty">Each subscription shows here with a countdown to its next charge.</p>
        </ClientOnly>
      </Step>
    </div>
    <BulkBar :select="sel" :actions="bulkActions" label="Selected renewals" noun="renewals" />
  </ToolPage>
</template>

<style scoped>
.statement {
  max-width: 880px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.step-empty {
  margin: 0;
  padding: 1rem 1.25rem;
  font-size: var(--text-base);
  color: var(--ink-2);
}

/* Step 1: well-known services, one tap each. Compact chips that wrap, so none is ever cut off at the edge */
.add-step {
  padding: 1.25rem;
}

.quick-add {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 10.5rem), 1fr));
  gap: 0.4rem;
}

.quick-service {
  padding: 0.45rem 0.7rem 0.45rem 0.45rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  text-align: left;
  color: var(--ink-2);
  background: var(--surface-2);
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: border-color var(--dur-fast), color var(--dur-fast), transform var(--dur-fast);
}

.quick-service > span:last-child {
  min-width: 0;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.quick-service :deep(.renewal-icon),
.quick-service .plus {
  width: 2.1rem;
  height: 2.1rem;
  border-radius: var(--radius-sm);
}

.quick-service :deep(.renewal-icon img) {
  width: 1.35rem;
  height: 1.35rem;
}

.quick-service:hover {
  color: var(--ink);
  border-color: var(--line);
}

.quick-service:active {
  transform: scale(0.96);
}

.quick-service .plus {
  flex: none;
  display: grid;
  place-items: center;
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--accent);
  border: 1.5px dashed color-mix(in srgb, var(--accent) 50%, var(--line));
}

@media (max-width: 419.98px) {
  .quick-add {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
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

/* Phones: all six periods on two rows, rather than Year hidden off the edge */
@media (max-width: 480px) {
  .periods {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    width: 100%;
    overflow-x: visible;
  }
}

.total-figure {
  overflow-wrap: anywhere;
}

.warn-note {
  color: var(--warn-ink);
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

.library-toggle {
  align-self: flex-start;
  margin-top: 0.15rem;
  font-size: var(--text-sm);
}

.icon-row > :last-child {
  flex: 1;
  min-width: 0;
}

.summary > div {
  display: flex;
  flex-direction: column;
}

.limit-form {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.5rem;
  margin-top: 0.3rem;
}

.limit-input {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--ink-2);
}

.limit-input .input {
  width: 5rem;
}

.limit-view {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  margin-top: 0.3rem;
  padding: 0;
  font: inherit;
  color: inherit;
  text-align: left;
  background: none;
  border: 0;
  cursor: pointer;
}

.limit-dial {
  width: 4.75rem;
}

.label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-2);
}

.summary strong {
  font-size: clamp(1.4rem, 3vw, 1.9rem);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

/* The 30-day timeline (UpcomingTimeline), under the totals */
.timeline {
  margin-top: 1rem;
}

.head-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

/* Next charge: the ring of the billing period round the service's icon, the clock beside it */
.next-up {
  margin-top: 0.25rem;
  padding: 1.1rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.next-ring {
  position: relative;
  flex: none;
  width: 5.5rem;
  display: grid;
  place-items: center;
}

.next-ring :deep(.renewal-icon) {
  position: absolute;
  width: 2.6rem;
  height: 2.6rem;
}

.next-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.next-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.next-head .label {
  font-size: var(--text-sm);
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.next-head .label-icon {
  margin-right: 0.35rem;
  vertical-align: -0.15em;
}

.next-pick {
  width: 11rem;
  font-size: var(--text-sm);
}

.next-name {
  font-size: var(--text-lg);
  overflow-wrap: anywhere;
}

.next-name span {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-2);
}

.next-clock {
  margin-top: 0.15rem;
  font-size: clamp(0.85rem, 0.7rem + 0.9vw, 1.05rem);
}

.next-note {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--ink-3);
}

.next-up.is-expired .next-ring {
  opacity: 0.5;
}

@media (max-width: 520px) {
  .next-up {
    flex-direction: column;
    align-items: stretch;
    text-align: left;
  }

  .next-ring {
    position: absolute;
    top: 1rem;
    right: 1.1rem;
    width: 3.6rem;
  }

  .next-up {
    position: relative;
  }

  .next-ring :deep(.renewal-icon) {
    width: 1.7rem;
    height: 1.7rem;
  }

  .next-head {
    padding-right: 4.5rem;
    flex-wrap: wrap;
  }
}

.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 0.5rem 0 -0.25rem;
}

.list-head h3 {
  font-size: var(--text-md);
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
  border-radius: var(--radius);
  background: var(--surface-2);
  line-height: 1.1;
}

.when strong {
  font-size: var(--text-xl);
  font-variant-numeric: tabular-nums;
}

.when strong.word {
  font-size: var(--text-md);
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
  font-size: var(--text-xs);
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
  font-size: var(--text-sm);
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


.empty {
  padding: 2.5rem 1.5rem;
  text-align: center;
  color: var(--ink-2);
}

.empty h2 {
  font-size: var(--text-lg);
  color: var(--ink);
}

.empty p {
  margin: 0.5rem 0 1rem;
}



@media (max-width: 640px) {
  .summary { grid-template-columns: 1fr 1fr; }
  .renewal { flex-wrap: wrap; }
  .links { width: 100%; justify-content: flex-end; }
}
</style>
