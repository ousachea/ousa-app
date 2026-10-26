<script setup lang="ts">
import type { BulkAction } from '~/composables/useBulkSelect'
import { toast } from 'vue-sonner'

/* Gold tracker: live XAU spot in Cambodian units (chi, damlung, hun, li) and a purchase ledger.
   Purchases are a normal synced collection: on this device, and in Firebase when signed in. */

interface Purchase {
  id: string
  weight: number
  unit: Unit
  price: number // USD paid
  date: string // yyyy-mm-dd
}

type Unit = 'li' | 'hun' | 'chi' | 'gram' | 'damlung' | 'troyOz'
type Lang = 'en' | 'km'
type Range = '1H' | '1D' | '1W' | '1M'
type Purity = 1 | 0.916 | 0.75 | 'custom'

// NIST precious-metals conversion factor: one troy ounce in grams
const TROY = 31.1034768
const UNIT_GRAMS: Record<Unit, number> = { li: 0.0375, hun: 0.375, chi: 3.75, gram: 1, damlung: 37.5, troyOz: TROY }
const UNITS = Object.keys(UNIT_GRAMS) as Unit[]

const SETTINGS_KEY = 'ousa-app:gold-settings'
// Where price history used to live (this device only); moved into the synced collection on first load
const LEGACY_HISTORY_KEY = 'ousa-app:gold-history'

const { play } = useSound()
// Demo: a few purchases over two years, mostly in chi, bought when gold was cheaper
const DEMO = (): Omit<Purchase, 'id'>[] => [
  { weight: 1, unit: 'chi', price: 255, date: isoDaysAgo(720) },
  { weight: 2, unit: 'chi', price: 560, date: isoDaysAgo(500) },
  { weight: 5, unit: 'chi', price: 1650, date: isoDaysAgo(330) },
  { weight: 1, unit: 'damlung', price: 3900, date: isoDaysAgo(150) },
  { weight: 0.5, unit: 'chi', price: 262, date: isoDaysAgo(20) },
  // Bought at a shop's high quote, so the demo shows a loss as well
  { weight: 1, unit: 'chi', price: 620, date: isoDaysAgo(6) }
]
const { items: purchases, ready, sync, add, addMany, update, replace, remove, restore } = useCollection<Purchase>('gold', undefined, { demo: DEMO, label: p => `${p.weight} ${p.unit} of gold` })
// Signed out: offer Google sign-in right here, so purchases sync without a trip to Settings
const signedOut = computed(() => sync.state.value === 'device')

// ---------- Words (English / Khmer) ----------
const WORDS = {
  en: {
    li: 'Li', hun: 'Hun', chi: 'Chi', gram: 'Gram', damlung: 'Damlung', troyOz: 'Troy oz',
    spot: 'Gold spot price', perOz: 'per troy ounce', live: 'Live', custom: 'My price', refresh: 'Refresh',
    byUnit: 'Price by unit', convert: 'Convert units', myGold: 'My gold', tabPrice: 'Price', tabUnits: 'Units', gained: 'Gained', lost: 'Lost', buys: 'buys', on: 'on', add: '+ Add purchase', noGold: 'No gold yet', noGoldText: 'Add the gold you bought and what you paid, and see what it’s worth at today’s price.',
    invested: 'Paid', worth: 'Worth now', gainLoss: 'Gain or loss', weight: 'Weight', paid: 'Paid', date: 'Date',
    step1: 'Check today’s price', step1Hint: 'Live from the world market. Switch to “My price” to use a shop’s quote.',
    step2: 'Choose your gold’s purity', step2Hint: 'Jewellery is often 22K or 18K, so it’s worth less than pure 24K gold.',
    step3: 'Add the gold you own', step3Hint: 'Enter what you bought and paid to see what it’s worth today.',
    boughtFor: 'You paid', gain: 'Gain', loss: 'Loss', each: 'each',
    signInTitle: 'Keep your gold safe', signInBody: 'Sign in to back up your purchases and see them on your phone and computer.'
  },
  km: {
    li: 'លី', hun: 'ហុន', chi: 'ជី', gram: 'ក្រាម', damlung: 'ដំឡឹង', troyOz: 'អោន',
    spot: 'តម្លៃមាសទីផ្សារ', perOz: 'ក្នុងមួយអោន', live: 'បន្តផ្ទាល់', custom: 'តម្លៃខ្ញុំ', refresh: 'ធ្វើបច្ចុប្បន្នភាព',
    byUnit: 'តម្លៃតាមឯកតា', convert: 'បម្លែងឯកតា', myGold: 'មាសរបស់ខ្ញុំ', tabPrice: 'តម្លៃ', tabUnits: 'ឯកតា', gained: 'ចំណេញ', lost: 'ខាត', buys: 'ការទិញ', on: 'លើ', add: '+ បន្ថែមការទិញ', noGold: 'មិនទាន់មានមាសនៅឡើយ', noGoldText: 'បន្ថែមមាសដែលអ្នកបានទិញ និងតម្លៃដែលអ្នកបានបង់ ដើម្បីមើលថាវាមានតម្លៃប៉ុន្មាននៅថ្ងៃនេះ។',
    invested: 'បានបង់', worth: 'តម្លៃឥឡូវ', gainLoss: 'ចំណេញ ឬខាត', weight: 'ទម្ងន់', paid: 'បានបង់', date: 'កាលបរិច្ឆេទ',
    step1: 'មើលតម្លៃថ្ងៃនេះ', step1Hint: 'តម្លៃផ្ទាល់ពីទីផ្សារពិភពលោក។ ប្តូរទៅ «តម្លៃខ្ញុំ» ដើម្បីប្រើតម្លៃហាង។',
    step2: 'ជ្រើសរើសភាពសុទ្ធនៃមាស', step2Hint: 'គ្រឿងអលង្ការជាញឹកញាប់ 22K ឬ 18K ដូច្នេះតម្លៃទាបជាងមាសសុទ្ធ 24K។',
    step3: 'បន្ថែមមាសដែលអ្នកមាន', step3Hint: 'បញ្ចូលអ្វីដែលអ្នកបានទិញ និងតម្លៃដែលបានបង់ ដើម្បីដឹងតម្លៃថ្ងៃនេះ។',
    boughtFor: 'អ្នកបានបង់', gain: 'ចំណេញ', loss: 'ខាត', each: 'ក្នុងមួយ',
    signInTitle: 'រក្សាទុកមាសរបស់អ្នកឱ្យមានសុវត្ថិភាព', signInBody: 'ចូលគណនី ដើម្បីបម្រុងទុកការទិញរបស់អ្នក និងមើលវានៅលើទូរស័ព្ទ និងកុំព្យូទ័ររបស់អ្នក។'
  }
} as const

// ---------- Settings (kept on this device) ----------
const lang = ref<Lang>('en')
const showKHR = ref(false)
const khrRate = ref(4100)
const source = ref<'api' | 'custom'>('api')
const customUnit = ref<'troyOz' | 'damlung' | 'chi'>('chi')
const customPrice = ref<number | null>(null)
const apiKey = ref('')
const autoRefresh = ref(0) // seconds, 0 = off
const purity = ref<Purity>(1)
const customPurity = ref(99.99)
const range = ref<Range>('1D')
// Picking a range cross-fades the chart
function pickRange(r: Range) {
  viewTransition(() => (range.value = r))
}
const SORTS = [
  { value: 'date-desc', label: 'Newest first' },
  { value: 'date-asc', label: 'Oldest first' },
  { value: 'gl-desc', label: 'Biggest gain' },
  { value: 'gl-asc', label: 'Biggest loss' },
  { value: 'weight-desc', label: 'Heaviest' }
] as const
const sort = useRemembered<(typeof SORTS)[number]['value']>('gold-sort', 'date-desc', v => SORTS.some(s => s.value === v))
const unitOptions = computed(() => UNITS.map(u => ({ value: u, label: w.value[u] })))

const w = computed(() => WORDS[lang.value])

// ---------- Phone tabs ----------
// On phones the page splits into three screens behind a tab bar, like a native app: the price,
// your gold, and the units. Wider screens show everything side by side and never see the bar
const TABS = ['price', 'gold', 'units'] as const
type Tab = typeof TABS[number]
const tab = useRemembered<Tab>('gold-tab', 'price', v => TABS.includes(v as Tab))
const workspace = ref<HTMLElement>()
function pickTab(t: Tab) {
  const el = workspace.value
  // Scrolled down into the screen: the next one starts from its top, as does tapping the open tab
  const past = el && el.getBoundingClientRect().top < 0
  const same = t === tab.value
  if (!same) {
    tab.value = t
    play('select')
  }
  if (past) nextTick(() => el.scrollIntoView({ block: 'start', behavior: same ? 'smooth' : 'instant' }))
}

// ---------- Price ----------
interface Quote { price: number, status: 'live' | 'cached' | 'custom' | 'none', provider: string, at: string | null }
const quote = ref<Quote>({ price: 0, status: 'none', provider: '', at: null })
const loading = ref(false)
const tick = ref<'up' | 'down' | null>(null)

const spot = computed(() => {
  if (source.value === 'custom') {
    const p = Number(customPrice.value)
    return p > 0 ? p / UNIT_GRAMS[customUnit.value] * TROY : 0
  }
  return quote.value.price
})
const purityFactor = computed(() => purity.value === 'custom'
  ? Math.min(100, Math.max(0, Number(customPurity.value) || 0)) / 100
  : purity.value)
const perGram = computed(() => spot.value / TROY * purityFactor.value)
const priceOf = (unit: Unit, qty = 1) => perGram.value * UNIT_GRAMS[unit] * qty

const online = useOnline()

// `quiet`: an automatic refresh; offline it just keeps the saved price instead of complaining every time
async function fetchQuote(quiet = false) {
  if (loading.value) return
  if (!online.value) {
    if (quote.value.price) quote.value = { ...quote.value, status: 'cached' }
    if (!quiet) toast('You’re offline', { description: quote.value.price ? 'Showing the last price saved on this device.' : 'Connect to get today’s gold price, or enter your own.' })
    return
  }
  loading.value = true
  const before = quote.value.price
  let next: Quote | undefined
  try {
    const r = await fetch('https://api.gold-api.com/price/XAU', { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    const d = await r.json()
    const price = Number(d?.price)
    if (r.ok && price >= 100 && price <= 20000) next = { price, status: 'live', provider: 'gold-api.com', at: d?.updatedAt ?? new Date().toISOString() }
  } catch {}
  // A goldapi.io key, if given, is the fallback
  if (!next && apiKey.value.trim()) {
    try {
      const r = await fetch('https://www.goldapi.io/api/XAU/USD', { headers: { 'x-access-token': apiKey.value.trim() }, signal: AbortSignal.timeout(8000) })
      const d = await r.json()
      const price = Number(d?.price)
      if (r.ok && price >= 100 && price <= 20000) next = { price, status: 'live', provider: 'goldapi.io', at: d?.timestamp ? new Date(d.timestamp * 1000).toISOString() : new Date().toISOString() }
    } catch {}
  }
  loading.value = false

  if (next) {
    quote.value = next
    if (before && before !== next.price) {
      tick.value = next.price > before ? 'up' : 'down'
      setTimeout(() => (tick.value = null), 1200)
    }
    pushHistory(next.price)
    saveSettings()
  } else if (quote.value.price) {
    quote.value = { ...quote.value, status: 'cached' }
    if (!quiet) {
      toast.error('Couldn’t get a live price', { description: 'Showing the last price saved on this device.', action: { label: 'Try again', onClick: () => fetchQuote() } })
      play('error')
    }
  } else if (!quiet) {
    toast.error('Couldn’t get a live price', { description: 'Check your connection, or enter your own price.', action: { label: 'Try again', onClick: () => fetchQuote() } })
    play('error')
  }
}

function refresh() {
  play('press')
  fetchQuote()
}
// Pull down on a phone for a fresh price (CHECKLIST.md #26)
usePullToRefresh(() => source.value === 'api' ? fetchQuote() : undefined)

const STATUS_LABEL = { live: 'Live', cached: 'Saved price', custom: 'Your price', none: 'No price yet' }
const status = computed(() => (source.value === 'custom' ? 'custom' : quote.value.status))

const now = ref(Date.now())
const observed = computed(() => {
  if (source.value === 'custom' || !quote.value.at) return ''
  const t = new Date(quote.value.at)
  const mins = Math.max(0, Math.floor((now.value - t.getTime()) / 60000))
  const age = mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : `${Math.floor(mins / 60)} h ago`
  return `${t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · ${age}`
})

// ---------- History chart (prices you've seen) ----------
// A synced collection like the purchases: kept on this device, and in Firebase when signed in,
// so every device adds to and shows the same history.
interface Point { id: string, price: number, time: number }
const HISTORY_MAX = 500
// A steady price is only recorded again after a while, so auto-refresh doesn't fill the log with repeats
const SAME_PRICE_GAP_MS = 5 * 60_000
const { items: priceLog, sync: historySync, add: addPoint, addMany: addPoints, remove: removePoint } = useCollection<Point>('gold-prices', undefined, { app: '/gold', trash: false })
const history = computed(() => [...priceLog.value].sort((a, b) => a.time - b.time))

// Prices fetched while the log is still loading wait, so the load doesn't overwrite them
const pending: Omit<Point, 'id'>[] = []
const historyLoading = computed(() => historySync.state.value === 'loading')

function recordPoint(point: Omit<Point, 'id'>) {
  const last = history.value.at(-1)
  if (last && last.price === point.price && point.time - last.time < SAME_PRICE_GAP_MS) return
  addPoint(point)
  // Keep the newest few hundred; the oldest drop off everywhere
  for (const old of history.value.slice(0, Math.max(0, history.value.length - HISTORY_MAX))) removePoint(old.id)
}

function pushHistory(price: number) {
  const point = { price, time: Date.now() }
  if (historyLoading.value) pending.push(point)
  else recordPoint(point)
}

watch(historyLoading, (loading) => {
  if (loading) return
  // One-time move of the old device-only history into the synced log, skipping times already there
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_HISTORY_KEY) || 'null') as { price: number, time: number }[] | null
    if (Array.isArray(legacy)) {
      const known = new Set(priceLog.value.map(p => p.time))
      const fresh = legacy.filter(p => p.price > 0 && p.time > 0 && !known.has(p.time)).slice(-HISTORY_MAX)
      if (fresh.length) addPoints(fresh)
      localStorage.removeItem(LEGACY_HISTORY_KEY)
    }
  } catch {}
  for (const point of pending.splice(0)) recordPoint(point)
})

const RANGE_MS: Record<Range, number> = { '1H': 3_600_000, '1D': 86_400_000, '1W': 604_800_000, '1M': 2_592_000_000 }
const chartPoints = computed(() => {
  const cutoff = now.value - RANGE_MS[range.value]
  const inRange = history.value.filter(p => p.time >= cutoff)
  return inRange.length >= 2 ? inRange : history.value.slice(-20)
})
const CHART_W = 600
const CHART_H = 120
const chart = computed(() => {
  const pts = chartPoints.value
  if (pts.length < 2) return null
  const prices = pts.map(p => p.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const span = max - min || 1
  const xy = pts.map((p, i) => ({
    x: (i / (pts.length - 1)) * CHART_W,
    y: CHART_H - 8 - ((p.price - min) / span) * (CHART_H - 16),
    ...p
  }))
  const line = 'M' + xy.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('L')
  const change = prices.at(-1)! - prices[0]!
  return { xy, line, area: `${line}L${CHART_W},${CHART_H}L0,${CHART_H}Z`, min, max, change, pct: change / prices[0]! * 100 }
})
const hover = ref<(Point & { x: number, y: number }) | null>(null)
function onChartMove(e: PointerEvent) {
  const c = chart.value
  if (!c) return
  const box = (e.currentTarget as SVGElement).getBoundingClientRect()
  const x = ((e.clientX - box.left) / box.width) * CHART_W
  hover.value = c.xy.reduce((best, p) => (Math.abs(p.x - x) < Math.abs(best.x - x) ? p : best))
}

// ---------- Money ----------
function money(usd: number, digits = 2) {
  if (showKHR.value) return `${Math.round(usd * khrRate.value).toLocaleString('en-US')} ៛`
  return `$${usd.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}
const signed = (usd: number) => `${usd >= 0 ? '+' : '−'}${money(Math.abs(usd))}`

// ---------- Converter ----------
const convAmount = ref<number | null>(1)
const convUnit = ref<Unit>('chi')
const grams = (qty: number, unit: Unit) => qty * UNIT_GRAMS[unit]
const fmtQty = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: n < 1 ? 4 : 3 })

// ---------- Ledger ----------
const valueOf = (p: Purchase) => perGram.value * grams(p.weight, p.unit)
const gainOf = (p: Purchase) => valueOf(p) - p.price
// A weight of gold the way it's counted here: chi, or damlung from 10 chi up
function asGold(g: number) {
  const chi = g / UNIT_GRAMS.chi
  const [n, unit] = chi >= 10 ? [chi / 10, w.value.damlung] : [chi, w.value.chi]
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${unit}`
}

// ---------- Cards catch the light ----------
// On the price card and each purchase, a shine follows the pointer and the card tilts a little towards it,
// like a gold bar turned in the hand. CSS turns --px/--py (-0.5 to 0.5) into the tilt, so each card picks
// its own strength. Mouse and pen only; touch, reduced motion and Lite effects keep the cards still.
let shineFrame = 0
function onShineMove(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement
  if (e.pointerType === 'touch' || !el) return
  cancelAnimationFrame(shineFrame)
  shineFrame = requestAnimationFrame(() => {
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`)
    el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`)
    el.style.setProperty('--px', (x - 0.5).toFixed(3))
    el.style.setProperty('--py', (0.5 - y).toFixed(3))
    el.classList.add('lit')
  })
}
function onShineLeave(e: PointerEvent) {
  cancelAnimationFrame(shineFrame)
  const el = e.currentTarget as HTMLElement
  el.classList.remove('lit')
  el.style.setProperty('--px', '0')
  el.style.setProperty('--py', '0')
}
const gainPct = (p: Purchase) => (p.price ? (gainOf(p) / p.price) * 100 : 0)
// What one unit cost then and costs now, so different-sized purchases compare at a glance
const paidPerUnit = (p: Purchase) => (p.weight ? p.price / p.weight : 0)
const totals = computed(() => {
  const paid = purchases.value.reduce((s, p) => s + p.price, 0)
  const worth = purchases.value.reduce((s, p) => s + valueOf(p), 0)
  const g = purchases.value.reduce((s, p) => s + grams(p.weight, p.unit), 0)
  // Gains and losses kept apart, so a loss on one purchase still shows when the whole lot is up
  // Gains and losses kept apart, with how much gold sits in each
  const up = purchases.value.filter(p => gainOf(p) > 0)
  const down = purchases.value.filter(p => gainOf(p) < 0)
  const sum = (list: Purchase[], f: (p: Purchase) => number) => list.reduce((s, p) => s + f(p), 0)
  const weight = (p: Purchase) => grams(p.weight, p.unit)
  return {
    paid, worth, gain: worth - paid, pct: paid ? (worth - paid) / paid * 100 : 0, grams: g, chi: g / UNIT_GRAMS.chi,
    up: sum(up, gainOf), upCount: up.length, upGrams: sum(up, weight),
    down: -sum(down, gainOf), downCount: down.length, downGrams: sum(down, weight)
  }
})

const sorted = computed(() => {
  const list = [...purchases.value]
  switch (sort.value) {
    case 'date-asc': return list.sort((a, b) => a.date.localeCompare(b.date))
    case 'gl-desc': return list.sort((a, b) => gainOf(b) - gainOf(a))
    case 'gl-asc': return list.sort((a, b) => gainOf(a) - gainOf(b))
    case 'weight-desc': return list.sort((a, b) => grams(b.weight, b.unit) - grams(a.weight, a.unit))
    default: return list.sort((a, b) => b.date.localeCompare(a.date))
  }
})

const today = () => localIsoDate()
const formOpen = ref(false)
const editingId = ref<string>()
const form = reactive({ weight: null as number | null, unit: 'chi' as Unit, price: null as number | null, date: today() })
const canSave = computed(() => (form.weight ?? 0) > 0 && (form.price ?? 0) > 0)

const draft = useDraft('gold', form, {
  active: () => formOpen.value && !editingId.value,
  isEmpty: f => !f.weight && !f.price,
  summary: f => [f.weight ? `${f.weight} ${w.value[f.unit]}` : '', f.price ? money(f.price) : '']
})

useAddAction(() => openAdd())
function openAdd() {
  editingId.value = undefined
  Object.assign(form, { weight: null, unit: 'chi', price: null, date: today() })
  formOpen.value = true
  draft.check()
  play('open')
}

// Enter or Space on a focused purchase card edits it (not when the key comes from a button inside)
function onCardKey(e: KeyboardEvent, p: Purchase) {
  if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
    e.preventDefault()
    openEdit(p)
  }
}

function openEdit(p: Purchase) {
  editingId.value = p.id
  Object.assign(form, { weight: p.weight, unit: p.unit, price: p.price, date: p.date })
  formOpen.value = true
  play('select')
}

function useTodayPrice() {
  form.price = Math.round(priceOf(form.unit, form.weight || 1) * 100) / 100
  play('select')
}

function savePurchase() {
  if (!canSave.value) return
  const entry = { weight: form.weight!, unit: form.unit, price: form.price!, date: form.date || today() }
  if (editingId.value) {
    const before = update(editingId.value, entry)
    toastSaved(before && (() => replace(before)))
  } else {
    const added = add(entry)
    draft.clear()
    toast.success('Purchase saved', { description: `${entry.weight} ${w.value[entry.unit]} for ${money(entry.price)}`, action: { label: 'Undo', onClick: () => remove(added.id, { undoAdd: true }) } })
  }
  play('success')
  formOpen.value = false
}

// ---------- Select several (useBulkSelect) ----------
const bulkText = (n: number) => `${n} ${n === 1 ? 'purchase' : 'purchases'}`
const sel = useBulkSelect({ items: purchases, shown: sorted, onDelete: () => deleteSelected() })
function deleteSelected() {
  sel.guard(`Delete ${bulkText(sel.selected.size)}?`, () => bulkRemove(sel.selectedItems as Purchase[], remove, restore, bulkText))
}
const bulkActions = computed<BulkAction[]>(() => [
  { label: 'Delete', icon: 'delete', danger: true, run: deleteSelected }
])

function del(p: Purchase) {
  const removed = remove(p.id)
  play('delete')
  toastDeleted(`${p.weight} ${w.value[p.unit]}`, () => removed && restore(removed))
}

// CSV with Weight, Unit, Paid, Date columns (the same format Export writes)
const fileInput = ref<HTMLInputElement>()
async function importCSV(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  let text: string
  try {
    text = await readTextFile(file)
  } catch (err) {
    toast.error('Couldn’t read that file', { description: err instanceof Error ? err.message : undefined })
    play('error')
    return
  }
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim())
  const head = (lines[0] ?? '').split(',').map(h => h.trim().toLowerCase())
  const [wi, ui, pi, di] = ['weight', 'unit', 'paid', 'date'].map(k => head.indexOf(k))
  if (wi === -1 || pi === -1) {
    toast.error('That file has no Weight and Paid columns')
    play('error')
    return
  }
  const rows = lines.slice(1).flatMap((line) => {
    const c = line.split(',').map(x => x.trim())
    const weight = Number.parseFloat(c[wi!] ?? '')
    const price = Number.parseFloat(c[pi!] ?? '')
    if (!(weight > 0) || !(price >= 0)) return []
    const unit = UNITS.includes(c[ui!] as Unit) ? c[ui!] as Unit : 'chi'
    return [{ weight, unit, price, date: (di !== -1 && c[di!]) || today() }]
  })
  if (!rows.length) {
    toast.error('No purchases found in that file')
    play('error')
    return
  }
  // Re-importing an export (say, on a second device or after signing in) shouldn't double the list:
  // skip rows that match a purchase already here on weight, unit, price and date
  const key = (p: Omit<Purchase, 'id'>) => `${p.weight}|${p.unit}|${p.price.toFixed(2)}|${p.date}`
  const existing = new Set(purchases.value.map(key))
  const fresh = rows.filter(r => !existing.has(key(r)))
  const skipped = rows.length - fresh.length
  const skippedNote = skipped ? `${skipped} already in your list ${skipped === 1 ? 'was' : 'were'} skipped.` : undefined
  formOpen.value = false
  if (!fresh.length) {
    toast('Nothing new to import', { description: skippedNote })
    return
  }
  const imported = addMany(fresh)
  play('success')
  const synced = sync.signedIn.value ? ' Saving to your account too.' : ''
  toast.success(`${fresh.length} ${fresh.length === 1 ? 'purchase' : 'purchases'} imported`, {
    description: [skippedNote, synced.trim()].filter(Boolean).join(' ') || undefined,
    action: { label: 'Undo', onClick: () => imported.forEach(p => remove(p.id, { undoAdd: true })) }
  })
}

function exportCSV() {
  const csv = ['Weight,Unit,Paid,Date', ...purchases.value.map(p => `${p.weight},${p.unit},${p.price.toFixed(2)},${p.date}`)].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = `gold-${today()}.csv`
  logActivity('exported', '/gold', `${purchases.value.length} purchases`)
  a.click()
  URL.revokeObjectURL(a.href)
  play('copy')
  toast.success('Purchases exported')
}

const formatDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

// ---------- Screensaver: a big price after a minute without input ----------
const screensaver = ref(false)
let idleTimer: ReturnType<typeof setTimeout> | undefined
const IDLE_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'scroll', 'touchstart'] as const
function resetIdle() {
  if (screensaver.value) return
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    if (spot.value && !document.querySelector('dialog[open]')) screensaver.value = true
  }, 60_000)
}
function wake() {
  screensaver.value = false
  play('wake')
  resetIdle()
}

// ---------- Persistence ----------
function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      lang: lang.value, showKHR: showKHR.value, khrRate: khrRate.value, source: source.value,
      customUnit: customUnit.value, customPrice: customPrice.value, apiKey: apiKey.value,
      autoRefresh: autoRefresh.value, purity: purity.value, customPurity: customPurity.value,
      range: range.value, sort: sort.value, quote: quote.value
    }))
  } catch {}
}
watch([lang, showKHR, khrRate, source, customUnit, customPrice, apiKey, autoRefresh, purity, customPurity, range, sort], saveSettings)

let refreshTimer: ReturnType<typeof setInterval> | undefined
let clock: ReturnType<typeof setInterval> | undefined
watch(autoRefresh, (sec) => {
  clearInterval(refreshTimer)
  if (sec) refreshTimer = setInterval(() => source.value === 'api' && fetchQuote(true), sec * 1000)
})

onMounted(() => {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null')
    if (s) {
      Object.assign(quote.value, s.quote ?? {})
      if (s.quote?.price) quote.value.status = 'cached'
      lang.value = s.lang === 'km' ? 'km' : 'en'
      showKHR.value = !!s.showKHR
      khrRate.value = s.khrRate || 4100
      source.value = s.source === 'custom' ? 'custom' : 'api'
      customUnit.value = s.customUnit ?? 'chi'
      customPrice.value = s.customPrice ?? null
      apiKey.value = s.apiKey ?? ''
      autoRefresh.value = s.autoRefresh ?? 0
      purity.value = s.purity ?? 1
      customPurity.value = s.customPurity ?? 99.99
      range.value = s.range ?? '1D'
      sort.value = s.sort ?? 'date-desc'
    }
  } catch {}
  if (source.value === 'api') fetchQuote(!online.value)
  clock = setInterval(() => (now.value = Date.now()), 30_000)
  IDLE_EVENTS.forEach(e => window.addEventListener(e, resetIdle, { passive: true }))
  resetIdle()
})

onBeforeUnmount(() => {
  clearInterval(refreshTimer)
  clearInterval(clock)
  clearTimeout(idleTimer)
  IDLE_EVENTS.forEach(e => window.removeEventListener(e, resetIdle))
})

const PURITIES: { value: Purity, label: string }[] = [
  { value: 1, label: '24K' },
  { value: 0.916, label: '22K' },
  { value: 0.75, label: '18K' },
  { value: 'custom', label: 'Other' }
]
</script>

<template>
  <ToolPage header="bar">
    <template #transfer>
      <button type="button" class="btn btn-quiet btn-sm" @click="fileInput?.click()">Import CSV</button>
      <button type="button" class="btn btn-quiet btn-sm" :disabled="!purchases.length" @click="exportCSV">Export CSV</button>
      <span>With Weight, Unit, Paid and Date columns, for spreadsheets.</span>
      <input ref="fileInput" type="file" accept=".csv,text/csv" hidden @change="importCSV">
    </template>
    <template #settings>
      <SettingChoice v-model="autoRefresh" title="Refresh the price" :options="[{ value: 0, label: 'Off' }, { value: 30, label: 'Every 30 seconds' }, { value: 60, label: 'Every minute' }, { value: 300, label: 'Every 5 minutes' }]" />
      <SettingChoice v-model="sort" title="Sort purchases by" :options="SORTS" />
      <label class="setting-field">
        <span class="title">Riel per dollar</span>
        <span class="desc">Used when prices show in riel.</span>
        <input v-model.number="khrRate" class="input" type="number" min="1000" step="10">
      </label>
      <label class="setting-field">
        <span class="title">goldapi.io key <span class="optional">Optional backup</span></span>
        <span class="desc">Only used if the free price fails. Spot price only: shops add their own premium and buy/sell spread.</span>
        <input v-model="apiKey" class="input" type="text" autocomplete="off" spellcheck="false" placeholder="Paste a key">
      </label>
    </template>
    <template #actions>
      <div class="toggles">
        <div class="segmented small" role="radiogroup" aria-label="Language">
          <label v-for="l in (['en', 'km'] as const)" :key="l" :class="{ active: lang === l }">
            <input type="radio" name="gold-lang" :checked="lang === l" @change="lang = l; play('select')">
            {{ l === 'en' ? 'EN' : 'ខ្មែរ' }}
          </label>
        </div>
        <div class="segmented small" role="radiogroup" aria-label="Currency">
          <label v-for="c in [false, true]" :key="String(c)" :class="{ active: showKHR === c }">
            <input type="radio" name="gold-currency" :checked="showKHR === c" @change="showKHR = c; play('select')">
            {{ c ? '៛ KHR' : '$ USD' }}
          </label>
        </div>
      </div>
    </template>

    <ClientOnly>
      <div ref="workspace" class="workspace" :data-tab="tab">
        <!-- ===== Market ===== -->
        <div v-sticky-fit class="market pane-price">
          <!-- The quote: one gold bar of a card -->
          <Step :n="1" :title="w.step1" :hint="w.step1Hint">
            <section class="panel quote shine" aria-live="polite" @pointermove="onShineMove" @pointerleave="onShineLeave">
              <div class="quote-top">
                <span class="label">{{ w.spot }}</span>
                <span class="status" :data-status="status"><i aria-hidden="true" />{{ STATUS_LABEL[status] }}</span>
              </div>
  
              <p class="big" :class="tick">
                <template v-if="spot">{{ money(spot * purityFactor) }}</template>
                <template v-else>—</template>
              </p>
              <p class="per">{{ w.perOz }}<template v-if="purityFactor !== 1"> · {{ (purityFactor * 100).toFixed(purityFactor === 0.916 ? 1 : 2).replace(/\.?0+$/, '') }}% gold</template></p>
  
              <!-- Cambodia buys gold by the chi and damlung, so those lead -->
              <div v-if="spot" class="local">
                <div><span>1 {{ w.chi }}</span><strong>{{ money(priceOf('chi')) }}</strong></div>
                <div><span>1 {{ w.damlung }}</span><strong>{{ money(priceOf('damlung')) }}</strong></div>
              </div>
  
              <p v-if="observed" class="observed">{{ quote.provider }} · {{ observed }}</p>
  
              <div class="quote-actions">
                <div class="segmented on-gold" role="radiogroup" aria-label="Price source">
                  <label :class="{ active: source === 'api' }">
                    <input type="radio" name="gold-source" :checked="source === 'api'" @change="source = 'api'; fetchQuote()">
                    {{ w.live }}
                  </label>
                  <label :class="{ active: source === 'custom' }">
                    <input type="radio" name="gold-source" :checked="source === 'custom'" @change="source = 'custom'">
                    {{ w.custom }}
                  </label>
                </div>
                <button v-if="source === 'api'" type="button" class="refresh" :disabled="loading" @click="refresh">
                  <AnimatedIcon name="rotate-cw" :spin="loading" />
                  {{ loading ? 'Loading…' : w.refresh }}
                </button>
              </div>
  
              <div v-if="source === 'custom'" class="custom-price">
                <label class="field">
                  <span class="field-head">Price you were quoted</span>
                  <span class="money input">
                    <span class="unit" aria-hidden="true">$</span>
                    <input v-model.number="customPrice" data-keys="price" type="number" inputmode="decimal" min="0" step="0.01" aria-label="Your gold price in dollars">
                  </span>
                </label>
                <div class="segmented" role="radiogroup" aria-label="Price is per">
                  <label v-for="u in (['chi', 'damlung', 'troyOz'] as const)" :key="u" :class="{ active: customUnit === u }">
                    <input type="radio" name="gold-custom-unit" :checked="customUnit === u" @change="customUnit = u">
                    per {{ w[u] }}
                  </label>
                </div>
              </div>
            </section>
          </Step>

          <Step :n="2" :title="w.step2" :hint="w.step2Hint">
            <div class="panel pad">
              <div class="segmented" role="radiogroup" aria-label="Gold purity">
                <label v-for="p in PURITIES" :key="String(p.value)" :class="{ active: purity === p.value }">
                  <input type="radio" name="gold-purity" :checked="purity === p.value" @change="purity = p.value; play('select')">
                  {{ p.label }}
                </label>
              </div>
              <label v-if="purity === 'custom'" class="field purity-custom">
                <span class="field-head">Fine gold</span>
                <span class="money input">
                  <input v-model.number="customPurity" type="number" min="0" max="100" step="0.01" aria-label="Fine gold percentage">
                  <span class="unit" aria-hidden="true">%</span>
                </span>
              </label>
            </div>
          </Step>

          <Step title="Price over time" hint="Prices you’ve seen here. Signed in, every device adds to the same history.">
            <template #aside><DataSource :sync="historySync" /></template>
            <div class="panel pad">
              <div class="segmented ranges" role="radiogroup" aria-label="Time range">
                <label v-for="r in (['1H', '1D', '1W', '1M'] as const)" :key="r" :class="{ active: range === r }">
                  <input type="radio" name="gold-range" :checked="range === r" @change="pickRange(r)">
                  {{ r }}
                </label>
              </div>
              <template v-if="chart">
                <p class="move" :class="chart.change >= 0 ? 'up' : 'down'">
                  {{ chart.change >= 0 ? '▲' : '▼' }} {{ signed(chart.change) }} ({{ chart.pct >= 0 ? '+' : '' }}{{ chart.pct.toFixed(2) }}%)
                </p>
                <div class="chart-wrap">
                  <svg
                    class="chart"
                    :viewBox="`0 0 ${CHART_W} ${CHART_H}`"
                    preserveAspectRatio="none"
                    role="img"
                    :aria-label="`Gold price from ${money(chart.min, 0)} to ${money(chart.max, 0)}`"
                    @pointermove="onChartMove"
                    @pointerleave="hover = null"
                  >
                    <path :d="chart.area" class="chart-area" />
                    <path :d="chart.line" class="chart-line" vector-effect="non-scaling-stroke" />
                    <line v-if="hover" :x1="hover.x" :x2="hover.x" y1="0" :y2="CHART_H" class="chart-cross" vector-effect="non-scaling-stroke" />
                  </svg>
                  <div v-if="hover" class="tip chart-tip" :style="{ left: `${(hover.x / CHART_W) * 100}%` }">
                    <strong>{{ money(hover.price) }}</strong>
                    <span>{{ new Date(hover.time).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }}</span>
                  </div>
                </div>
                <!-- Where the price sits between this range's low and high, on a dial (components/gauge) -->
                <div class="chart-scale">
                  <span>Low<br><strong>{{ money(chart.min, 0) }}</strong></span>
                  <span class="range-dial" role="img" :aria-label="`Now ${money(chart.xy.at(-1)!.price, 0)}, between ${money(chart.min, 0)} and ${money(chart.max, 0)}`">
                    <Gauge :value="chart.xy.at(-1)!.price" :min="chart.min" :max="chart.max === chart.min ? chart.min + 1 : chart.max" :start-angle="90" :end-angle="270" :radius="200" :padding="26" fit="content" transition>
                      <GaugeTrack :width="22" color="var(--ink)" :opacity="0.08" />
                      <GaugeArc :width="22" color="var(--gold)" />
                      <GaugeNeedle variant="pointer" :length="0.72" :width="16" :tail="0" color="var(--ink)" />
                      <GaugeHub :radius="12" color="var(--ink)" />
                    </Gauge>
                  </span>
                  <span class="high">High<br><strong>{{ money(chart.max, 0) }}</strong></span>
                </div>
              </template>
              <p v-else class="muted">Refresh the price a few times and the chart fills in.</p>
            </div>
          </Step>

        </div>

        <!-- ===== Units and ledger ===== -->
        <div v-sticky-fit class="side">
          <Step :n="3" :title="w.step3" :hint="w.step3Hint" class="ledger-step pane-gold">
            <template #aside><span class="aside-tools"><BulkToggle v-if="purchases.length" :select="sel" /><DataSource :sync="sync" /></span></template>

            <div v-if="purchases.length" class="panel summary">
              <div><span>{{ w.invested }}</span><strong>{{ money(totals.paid) }}</strong></div>
              <div><span>{{ w.worth }}</span><strong>{{ money(totals.worth) }}</strong></div>
              <div :class="totals.gain >= 0 ? 'up' : 'down'">
                <span>{{ w.gainLoss }}</span>
                <strong>{{ signed(totals.gain) }}</strong>
                <small>{{ totals.pct >= 0 ? '+' : '' }}{{ totals.pct.toFixed(1) }}%</small>
              </div>
              <div><span>{{ w.weight }}</span><strong>{{ fmtQty(totals.chi) }} {{ w.chi }}</strong><small>{{ fmtQty(totals.grams) }} g</small></div>
            </div>

            <!-- How much is up and how much is down, side by side on one bar -->
            <div v-if="purchases.length && spot" class="panel pl" :aria-label="`${w.gained} ${money(totals.up)} on ${asGold(totals.upGrams)}; ${w.lost} ${money(totals.down)} on ${asGold(totals.downGrams)}`">
              <div class="pl-bar" aria-hidden="true">
                <i class="pl-up" :style="{ flexGrow: totals.up }" />
                <i class="pl-down" :style="{ flexGrow: totals.down }" />
              </div>
              <div class="pl-legend">
                <span class="up">
                  <AppIcon name="arrow-up" />
                  {{ w.gained }} <strong>{{ money(totals.up) }}</strong><small>{{ w.on }}</small><em>{{ asGold(totals.upGrams) }}</em><small>· {{ totals.upCount }} {{ w.buys }}</small>
                </span>
                <span class="down" :class="{ none: !totals.downCount }">
                  <AppIcon name="arrow-down" />
                  {{ w.lost }} <strong>{{ money(totals.down) }}</strong><small>{{ w.on }}</small><em>{{ asGold(totals.downGrams) }}</em><small>· {{ totals.downCount }} {{ w.buys }}</small>
                </span>
              </div>
            </div>

            <!-- With nothing added yet, the empty card below has the one Add button -->
            <div v-if="purchases.length" class="ledger-bar">
              <button type="button" class="btn add-btn" @click="openAdd">{{ w.add }}</button>
              <AppSelect v-if="purchases.length > 1" v-model="sort" class="sort" aria-label="Sort purchases" :options="SORTS" />
            </div>

            <ClientOnly>
              <div v-if="signedOut" class="panel sign-in">
                <div>
                  <h3>{{ w.signInTitle }}</h3>
                  <p>{{ w.signInBody }}</p>
                </div>
                <VaultAuth purpose="account" />
              </div>
            </ClientOnly>

            <!-- One card per purchase: what you paid → what it's worth now → the gain or loss -->
            <ul v-if="purchases.length" class="purchases">
              <li
                v-for="p in sorted"
                :key="p.id"
                class="purchase shine bulk-row"
                :class="[spot ? (gainOf(p) >= 0 ? 'is-up' : 'is-down') : '', { 'bulk-picked': sel.has(p.id) }]"
                :data-bulk="sel.selecting || undefined"
                @click.capture="sel.onRowClick($event, p.id)"
                tabindex="0"
                title="Click to edit"
                :aria-label="`${fmtQty(p.weight)} ${w[p.unit]} bought ${formatDate(p.date)}. Press Enter to edit.`"
                @click="openEdit(p)"
                @keydown="onCardKey($event, p)"
                @pointermove="onShineMove"
                @pointerleave="onShineLeave"
              >
                <BulkCheck v-if="sel.selecting" :checked="sel.has(p.id)" :label="`Select ${fmtQty(p.weight)} ${w[p.unit]} bought ${formatDate(p.date)}`" @pick="sel.pick(p.id, $event)" />
                <header class="p-head">
                  <span class="p-weight"><strong>{{ fmtQty(p.weight) }}</strong> {{ w[p.unit] }}</span>
                  <span class="p-date">{{ formatDate(p.date) }}</span>
                </header>

                <div class="p-compare">
                  <div class="p-col">
                    <span class="p-label">{{ w.boughtFor }}</span>
                    <strong>{{ money(p.price) }}</strong>
                    <!-- Per-unit prices only add something when more than one unit was bought -->
                    <small v-if="p.weight !== 1">{{ money(paidPerUnit(p)) }} {{ w.each }} {{ w[p.unit] }}</small>
                  </div>
                  <AppIcon class="p-arrow" name="arrow-right" />
                  <div class="p-col">
                    <span class="p-label">{{ w.worth }}</span>
                    <strong>{{ spot ? money(valueOf(p)) : '—' }}</strong>
                    <small v-if="spot && p.weight !== 1">{{ money(priceOf(p.unit)) }} {{ w.each }} {{ w[p.unit] }}</small>
                  </div>
                </div>

                <footer class="p-foot">
                  <span v-if="spot" class="p-result">
                    <span class="p-badge">
                      <AppIcon :name="gainOf(p) >= 0 ? 'arrow-up' : 'arrow-down'" />
                      {{ gainOf(p) >= 0 ? w.gain : w.loss }}
                    </span>
                    <strong>{{ signed(gainOf(p)) }}</strong>
                    <span class="p-pct">{{ gainPct(p) >= 0 ? '+' : '−' }}{{ Math.abs(gainPct(p)).toFixed(1) }}%</span>
                  </span>
                  <span class="p-actions">
                    <button type="button" class="link" @click.stop="openEdit(p)">Edit</button>
                    <ConfirmDelete text name="this purchase" @confirm="del(p)" />
                  </span>
                </footer>
              </li>
            </ul>

            <div v-else-if="ready" class="panel empty-panel">
              <EmptyState :title="w.noGold" icon="gold" :action="w.add" @action="openAdd">{{ w.noGoldText }}</EmptyState>
            </div>
            <SkeletonList v-else variant="cards" :count="2" label="Loading your gold" />

          </Step>

          <Step :title="w.byUnit" class="pane-units">
            <ul v-if="spot" class="units">
              <li v-for="u in UNITS" :key="u" :class="{ lead: u === 'chi' || u === 'damlung' }">
                <span class="u-name">{{ w[u] }}</span>
                <span class="u-grams">{{ fmtQty(UNIT_GRAMS[u]) }} g</span>
                <strong>{{ money(priceOf(u), priceOf(u) < 1 ? 4 : 2) }}</strong>
              </li>
            </ul>
            <p v-else class="panel pad muted">Waiting for a price…</p>
          </Step>

          <Step :title="w.convert" class="pane-units">
            <div class="panel pad convert">
              <div class="convert-row">
                <input v-model.number="convAmount" class="input" type="number" min="0" step="any" inputmode="decimal" aria-label="Amount to convert">
                <AppSelect v-model="convUnit" aria-label="Unit" :options="unitOptions" />
              </div>
              <dl class="convert-out">
                <div v-for="u in UNITS.filter(x => x !== convUnit)" :key="u">
                  <dt>{{ w[u] }}</dt>
                  <dd>{{ fmtQty(grams(convAmount || 0, convUnit) / UNIT_GRAMS[u]) }}</dd>
                </div>
              </dl>
              <p v-if="spot && convAmount" class="convert-value">
                Worth about <strong>{{ money(priceOf(convUnit, convAmount)) }}</strong>
              </p>
            </div>
          </Step>
        </div>
      </div>

      <!-- Phones only (CSS): the bar of tabs at the foot of the screen; the bulk bar takes its place while selecting -->
      <nav v-if="!sel.selecting" class="tab-bar" aria-label="Gold">
        <button v-for="t in TABS" :key="t" type="button" :class="{ active: tab === t }" :aria-current="tab === t ? 'page' : undefined" @click="pickTab(t)">
          <AppIcon :name="t === 'price' ? 'trending-up' : t === 'gold' ? 'coins' : 'scale'" />
          <span>{{ t === 'price' ? w.tabPrice : t === 'gold' ? w.myGold : w.tabUnits }}</span>
          <i v-if="t === 'gold' && purchases.length" class="tab-count">{{ purchases.length }}</i>
        </button>
      </nav>

      <Modal :open="formOpen" :title="editingId ? 'Edit purchase' : 'Add a purchase'" @close="formOpen = false">
        <form v-validate class="form" @submit.prevent="savePurchase">
          <DraftCard v-if="draft.offered.value" :lines="draft.lines.value" @resume="draft.resume()" @discard="draft.discard()" />
          <div class="form-row amount-row">
            <label class="field">
              <span class="field-head">{{ w.weight }}</span>
              <input v-model.number="form.weight" class="input" type="number" min="0" step="any" inputmode="decimal" required v-check="Number(form.weight) > 0 ? '' : 'Enter how much gold'">
            </label>
            <label class="field">
              <span class="field-head">Unit</span>
              <AppSelect v-model="form.unit" aria-label="Unit" :options="unitOptions" />
            </label>
          </div>
          <div class="form-row">
            <label class="field">
              <span class="field-head">{{ w.paid }} (USD)</span>
              <input v-model.number="form.price" data-keys="price" class="input" type="number" min="0" step="any" inputmode="decimal" required v-check="Number(form.price) > 0 ? '' : 'Enter what you paid'">
            </label>
            <label class="field">
              <span class="field-head">{{ w.date }}</span>
              <DatePicker v-model="form.date" aria-label="Date" />
            </label>
          </div>
          <p v-if="spot && form.weight" class="form-note">
            Worth about {{ money(priceOf(form.unit, form.weight)) }} today.
            <button type="button" class="link" @click="useTodayPrice">Use today’s price</button>
          </p>
          <div class="form-actions">
            <button type="submit" class="btn">{{ editingId ? 'Save changes' : 'Add purchase' }}</button>
            <button type="button" class="btn btn-quiet" @click="formOpen = false">Cancel</button>
          </div>
        </form>
      </Modal>

      <Transition name="fade">
        <div v-if="screensaver" class="screensaver" role="button" tabindex="0" aria-label="Back to the gold tracker" @click="wake" @keydown="wake">
          <span class="label">{{ w.spot }}</span>
          <strong>{{ money(spot * purityFactor) }}</strong>
          <span>1 {{ w.chi }} {{ money(priceOf('chi')) }} · 1 {{ w.damlung }} {{ money(priceOf('damlung')) }}</span>
          <small>Tap anywhere to go back</small>
        </div>
      </Transition>
    </ClientOnly>
    <BulkBar :select="sel" :actions="bulkActions" label="Selected purchases" noun="purchases" />
  </ToolPage>
</template>

<style scoped>
.toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.segmented.small label {
  padding: 0.3rem 0.7rem;
  font-size: var(--text-sm);
}

.segmented label {
  white-space: nowrap;
}

.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
  gap: 2rem;
  align-items: start;
}

.market,
.side {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  min-width: 0;
}

.pad {
  padding: 1.1rem;
}

.muted {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.optional {
  font-weight: 400;
  color: var(--ink-3);
}

/* ---------- The quote: a gold bar of a card ---------- */
.quote {
  --tilt: 10deg;
  --glow: rgb(255 250 225 / 0.75);
  --glow-soft: rgb(255 240 190 / 0.25);
  --streak: rgb(255 255 255 / 0.45);
  position: relative;
  overflow: hidden;
  padding: 1.5rem;
  color: #1b1f2a;
  border: 0;
  background:
    linear-gradient(115deg, transparent 30%, rgb(255 255 255 / 0.35) 45%, transparent 60%),
    linear-gradient(160deg, #f2cf6a, var(--gold) 55%, #a87a12);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.5), 0 14px 30px -14px rgb(120 84 6 / 0.55);
}

.quote.lit {
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.6), 0 22px 44px -16px rgb(120 84 6 / 0.65);
}

/* ---------- Shine: the price card and each purchase catch the light ---------- */
.shine {
  --mx: 30%;
  --my: 20%;
  --px: 0;
  --py: 0;
  position: relative;
  transform: perspective(900px) rotateX(calc(var(--py) * var(--tilt) * 0.8)) rotateY(calc(var(--px) * var(--tilt)));
  transition: transform 0.6s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.4s;
}

/* Two layers of light: a soft glow right under the pointer, and a bright streak that slides across with it */
.shine::before,
.shine::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  opacity: 0;
  transition: opacity 0.4s;
}

.shine::before {
  background: radial-gradient(circle at var(--mx) var(--my), var(--glow), var(--glow-soft) 22%, transparent 50%);
  mix-blend-mode: soft-light;
}

.shine::after {
  background: linear-gradient(115deg, transparent 0%, transparent calc(var(--mx) - 18%), var(--streak) var(--mx), transparent calc(var(--mx) + 18%), transparent 100%);
  mix-blend-mode: overlay;
}

.shine.lit {
  transition: transform var(--dur-fast) ease-out, box-shadow 0.4s;
}

.shine.lit::before,
.shine.lit::after {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .shine { transform: none; transition: none; }
  .shine::before, .shine::after { display: none; }
}

:root[data-effects='lite'] .shine { transform: none; }
:root[data-effects='lite'] .shine::before,
:root[data-effects='lite'] .shine::after { display: none; }

.quote-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.label {
  font-size: var(--text-sm);
  font-weight: 700;
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.6rem;
  font-size: var(--text-xs);
  font-weight: 700;
  background: rgb(255 255 255 / 0.45);
  border-radius: var(--radius-pill);
}

.status i {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: #6b6b6b;
}

.status[data-status='live'] i { background: #127a43; }
.status[data-status='cached'] i { background: #b85a00; }
.status[data-status='custom'] i { background: #1f5bd8; }

.big {
  margin: 0.6rem 0 0;
  font-size: var(--text-hero);
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.035em;
  font-variant-numeric: tabular-nums;
  transition: color 0.4s;
}

.big.up { color: #0b5d31; }
.big.down { color: #8a1424; }

.per {
  margin: 0.3rem 0 0;
  font-size: var(--text-base);
  font-weight: 600;
  opacity: 0.75;
}

.local {
  margin-top: 1.1rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.local div {
  padding: 0.7rem 0.85rem;
  display: flex;
  flex-direction: column;
  background: rgb(255 255 255 / 0.4);
  border-radius: var(--radius);
}

.local span {
  font-size: var(--text-sm);
  font-weight: 600;
  opacity: 0.8;
}

.local strong {
  font-size: var(--text-xl);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.observed {
  margin: 0.8rem 0 0;
  font-size: var(--text-sm);
  font-weight: 500;
  opacity: 0.75;
}

.quote-actions {
  margin-top: 1rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}

.segmented.on-gold {
  background: rgb(255 255 255 / 0.3);
  border-color: rgb(0 0 0 / 0.1);
}

.segmented.on-gold label {
  color: #1b1f2a;
  padding-inline: 0.9rem;
}

.segmented.on-gold label.active {
  background: #fff;
}

.refresh {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2.4rem;
  padding: 0 0.9rem;
  font: inherit;
  font-size: var(--text-base);
  font-weight: 700;
  color: #fff;
  background: #1b1f2a;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color var(--dur-fast), scale var(--dur-fast);
}

.refresh:hover:not(:disabled) { background: #2d3344; }
.refresh:active:not(:disabled) { scale: 0.96; }
.refresh:disabled { opacity: 0.7; cursor: progress; }

.refresh svg {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.custom-price {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.custom-price .field { color: #1b1f2a; }

.money {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.money input {
  flex: 1;
  min-width: 0;
  font: inherit;
  font-size: var(--text-title);
  font-variant-numeric: tabular-nums;
  color: inherit;
  background: none;
  border: 0;
  outline: none;
}

.unit {
  color: var(--ink-2);
  font-weight: 600;
}

.purity-custom {
  margin-top: 0.75rem;
}

/* ---------- Chart ---------- */
.ranges {
  max-width: 16rem;
}

.move {
  margin: 0.9rem 0 0.4rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.up { color: var(--good-ink); }
.down { color: var(--bad-ink); }

.chart-wrap {
  position: relative;
}

.chart {
  display: block;
  width: 100%;
  height: 130px;
  touch-action: none;
}

.chart-line {
  fill: none;
  stroke: var(--gold);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.chart-area {
  fill: color-mix(in srgb, var(--gold) 14%, transparent);
}

.chart-cross {
  stroke: var(--ink-3);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}

/* The look is .chart-tip (main.css); this only places it over the crosshair */
.tip {
  position: absolute;
  top: -0.4rem;
  translate: -50% -100%;
  align-items: center;
}

.chart-scale {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1rem;
  margin-top: 0.6rem;
  font-size: var(--text-sm);
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}

.chart-scale strong {
  color: var(--ink);
}

.chart-scale .high {
  text-align: right;
}

.range-dial {
  width: 6rem;
}

/* ---------- Price by unit ---------- */
.units {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
}

.units li {
  padding: 0.85rem 0.9rem;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.15rem 0.5rem;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
}

.units li.lead {
  border-color: color-mix(in srgb, var(--gold) 55%, var(--line));
  background: color-mix(in srgb, var(--gold) 9%, var(--surface));
}

.u-name {
  font-weight: 700;
}

.u-grams {
  font-size: var(--text-xs);
  color: var(--ink-3);
}

.units strong {
  width: 100%;
  font-size: var(--text-title);
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
}

/* ---------- Converter ---------- */
.convert-row {
  display: grid;
  grid-template-columns: 1fr 9rem;
  gap: 0.5rem;
}

.convert-out {
  margin: 0.9rem 0 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
  gap: 0.4rem 1rem;
}

.convert-out div {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.35rem 0;
  border-bottom: 1px solid var(--line);
}

.convert-out dt {
  color: var(--ink-2);
}

.convert-out dd {
  margin: 0;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.convert-value {
  margin: 0.9rem 0 0;
  color: var(--ink-2);
}

.convert-value strong {
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

/* ---------- Ledger ---------- */
/* Gained against lost: one bar split green and red, with the two totals under it */
.pl {
  padding: 0.85rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.pl-bar {
  display: flex;
  gap: 3px;
  height: 0.5rem;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--line);
}

.pl-bar i {
  flex-basis: 0;
  min-width: 0;
  border-radius: var(--radius-pill);
  transition: flex-grow 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.pl-up { background: var(--good-ink); }
.pl-down { background: var(--bad-ink); }

.pl-legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.4rem 1rem;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.pl-legend span {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3rem;
}

.pl-legend svg {
  align-self: center;
  width: 0.95rem;
  height: 0.95rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.pl-legend .up svg,
.pl-legend .up strong { color: var(--good-ink); }
.pl-legend .down svg,
.pl-legend .down strong { color: var(--bad-ink); }
.pl-legend .down.none { opacity: 0.55; }

.pl-legend strong {
  font-variant-numeric: tabular-nums;
}

.pl-legend em {
  font-style: normal;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
}

.pl-legend small {
  color: var(--ink-3);
}

.summary {
  padding: 1rem 1.1rem;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}

.summary div {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.summary span {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-2);
}

.summary strong {
  font-size: var(--text-lg);
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.summary .up strong { color: var(--good-ink); }
.summary .down strong { color: var(--bad-ink); }

.summary small {
  font-size: var(--text-sm);
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}

.ledger-bar {
  margin-top: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

/* The same height as the sort dropdown beside it */
.ledger-bar .add-btn {
  min-height: 2.75rem;
}

.empty-panel {
  margin-top: 1rem;
}

.sort {
  width: auto;
}

.purchases {
  list-style: none;
  margin: 1.25rem 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr));
  gap: 0.75rem;
}

.purchase {
  --tone: var(--ink-3);
  --tone-ink: var(--ink-2);
  /* A gentler shine than the gold price card, tinted with the gain or loss colour */
  --tilt: 6deg;
  overflow: hidden;
  padding: 1rem 1.1rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  background: var(--surface);
  border: 1px solid var(--line);
  border-left: 4px solid var(--tone);
  border-radius: var(--radius-lg);
}

.purchase.is-up { --tone: var(--green); --tone-ink: var(--good-ink); }

/* The whole card opens the edit popup */
.purchase {
  cursor: pointer;
}

.purchase:focus-visible {
  outline: 2px solid var(--tone);
  outline-offset: 3px;
}
.purchase.is-down { --tone: var(--red); --tone-ink: var(--bad-ink); }

.purchase.lit {
  box-shadow: 0 16px 32px -18px rgb(var(--shadow) / 0.45);
}

/* On white, soft-light barely shows; let the glow pick up the card's gain/loss tint instead */
.purchase::before {
  background: radial-gradient(circle at var(--mx) var(--my), color-mix(in srgb, var(--tone) 16%, transparent), transparent 55%);
  mix-blend-mode: normal;
  z-index: -1; /* behind the text; the tilt transform keeps it inside the card's own layer */
}

/* The streak sits behind the text too, tinted rather than white, so it never washes out the numbers or the edge */
.purchase::after {
  background: linear-gradient(115deg, transparent calc(var(--mx) - 22%), color-mix(in srgb, var(--tone) 9%, transparent) var(--mx), transparent calc(var(--mx) + 22%));
  mix-blend-mode: normal;
  z-index: -1;
}

.p-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.p-weight {
  font-weight: 600;
}

.p-weight strong {
  font-size: var(--text-xl);
  font-weight: 800;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
}

.p-date {
  font-size: var(--text-sm);
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}

/* Paid → worth now, side by side */
.p-compare {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 0.85rem;
  background: var(--surface-2);
  border-radius: var(--radius);
}

.p-col {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.p-col:last-child {
  text-align: right;
}

.p-label {
  font-size: var(--text-2xs);
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.p-col strong {
  font-size: var(--text-title);
  font-variant-numeric: tabular-nums;
}

.p-col small {
  font-size: var(--text-xs);
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}

.p-arrow {
  width: 1.1rem;
  height: 1.1rem;
  fill: none;
  stroke: var(--tone);
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.p-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
}

/* The result reads as one line: [▲ Gain] +$12.00 +2.4% */
.p-result {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--tone-ink);
  font-variant-numeric: tabular-nums;
}

.p-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.15rem 0.5rem 0.15rem 0.35rem;
  font-size: var(--text-xs);
  font-weight: 700;
  background: color-mix(in srgb, var(--tone) 14%, transparent);
  border-radius: var(--radius-pill);
}

.p-badge svg {
  width: 0.85rem;
  height: 0.85rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.p-result strong {
  font-size: var(--text-title);
}

.p-pct {
  font-size: var(--text-sm);
  font-weight: 600;
}

.p-actions {
  display: flex;
  gap: 0.9rem;
}


.link:hover { color: var(--ink); }
.sign-in {
  margin-top: 1rem;
  padding: 1rem 1.25rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1.25rem;
}

.sign-in h3 {
  font-size: var(--text-md);
}

.sign-in p {
  margin: 0.2rem 0 0;
  max-width: 34rem;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.sign-in > div {
  flex: 1 1 18rem;
}

/* The sign-in component brings its own spacing for full forms; here it's just the button,
   styled as a plain Google button so it doesn't compete with "Add purchase" */
.sign-in :deep(.auth) {
  flex: none;
  margin: 0;
}

.sign-in :deep(.form) {
  margin-top: 0;
}

.sign-in :deep(.google) {
  color: var(--ink);
  background: var(--surface);
  box-shadow: 0 0 0 1px var(--line), 0 1px 2px rgb(var(--shadow) / 0.12);
}

.empty {
  margin-top: 1rem;
  padding: 2rem 1.5rem;
  text-align: center;
  color: var(--ink-2);
}

.empty h3 {
  font-size: var(--text-title);
  color: var(--ink);
}

.empty p {
  margin: 0.4rem 0 0;
}

/* ---------- Form ---------- */
.form {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.15rem 1rem;
}

/* Weight and its unit belong together, so they share a row even on a phone */
.form-row.amount-row {
  grid-template-columns: minmax(0, 1fr) 9rem;
}

.form-note {
  margin: 0;
  font-size: var(--text-base);
  color: var(--ink-2);
}

/* A little more room above the buttons than between fields, so they read as the end of the form */
.form-actions {
  display: flex;
  gap: 0.6rem;
  margin-top: 0.35rem;
}

/* ---------- Screensaver ---------- */
.screensaver {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  color: #f2cf6a;
  background: var(--plastic);
  cursor: pointer;
  text-align: center;
}

.screensaver strong {
  font-size: clamp(3.5rem, 13vw, 8rem);
  line-height: 1;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
}

.screensaver span {
  color: #d9c38a;
  font-variant-numeric: tabular-nums;
}

.screensaver small {
  margin-top: 1.5rem;
  color: #8a92a3;
}

.fade-enter-active,
.fade-leave-active { transition: opacity 0.4s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }

@media (max-width: 1100px) {
  .workspace { grid-template-columns: minmax(0, 1fr); }
}

/* Side by side, the shorter column stays in view while the other scrolls (v-sticky-fit handles tall ones) */
@media (min-width: 1101px) {
  .market,
  .side {
    position: sticky;
    top: var(--pin-top);
  }
}

@media (max-width: 640px) {
  .units { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .summary { grid-template-columns: 1fr 1fr; }
  .form-row { grid-template-columns: minmax(0, 1fr); }
  .form-row.amount-row { grid-template-columns: minmax(0, 1fr) 7.5rem; }
  .form-actions .btn[type='submit'] { flex: 1; }
  .convert-row { grid-template-columns: 1fr 7.5rem; }
}

/* The card clips its shine, so while selecting the badge sits just inside the corner and the heading makes room */
.purchase .bulk-check {
  top: 0.85rem;
  left: 0.85rem;
}

.purchase[data-bulk] .p-head {
  padding-left: 2.2rem;
}
/* ---------- Phones: a native-app layout ----------
   One screen at a time behind a floating tab bar, still walked through in numbered steps; the units
   and converter become grouped lists of rows */
.tab-bar {
  display: none;
}

@media (max-width: 719.98px) {
  .workspace {
    gap: 1.5rem;
    padding-bottom: calc(5.5rem + env(safe-area-inset-bottom) + var(--dock-lift));
    scroll-margin-top: var(--pin-top, 0px);
  }

  .workspace:not([data-tab='price']) .pane-price,
  .workspace:not([data-tab='gold']) .pane-gold,
  .workspace:not([data-tab='units']) .pane-units,
  .workspace[data-tab='price'] .side {
    display: none;
  }

  /* Each screen eases in as its tab opens (the animation restarts whenever it comes back into view) */
  .pane-price,
  .pane-gold,
  .pane-units {
    animation: tab-in 0.26s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  /* The heading and Select share one row, Select reading as a plain text button */
  .workspace :deep(.step-head) {
    flex-wrap: nowrap;
  }

  .workspace :deep(.step-main) {
    flex: 1 1 auto;
  }

  .aside-tools {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .workspace :deep(.bulk-toggle) {
    min-height: 2rem;
    padding: 0.25rem 0.5rem;
    font-weight: 700;
    color: color-mix(in srgb, var(--gold) 70%, var(--ink));
    background: none;
    border-color: transparent;
    box-shadow: none;
  }

  /* Price by unit: one card of rows, name and weight on the left, price on the right */
  .units {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
    overflow: hidden;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
  }

  .units li,
  .units li.lead {
    flex-wrap: nowrap;
    align-items: center;
    gap: 0.6rem;
    min-height: 3.1rem;
    padding: 0.6rem 1rem;
    border: 0;
    border-radius: 0;
  }

  .units li:not(.lead) {
    background: none;
  }

  .units li + li {
    box-shadow: inset 0 1px 0 var(--line);
  }

  .u-grams {
    margin-right: auto;
  }

  .units strong {
    width: auto;
    font-size: var(--text-title);
  }

  /* Converter: the results read as a list, one unit a row */
  .convert-out {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }

  .convert-out div {
    padding: 0.7rem 0;
  }

  /* The tab bar: a pane of frosted glass floating over the foot of the page */
  .tab-bar {
    position: fixed;
    z-index: 80;
    left: 0.75rem;
    right: 0.75rem;
    bottom: calc(max(0.75rem, env(safe-area-inset-bottom)) + var(--dock-lift));
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.25rem;
    padding: 0.35rem;
    background: color-mix(in srgb, var(--surface) 82%, transparent);
    border: 1px solid var(--line);
    border-radius: var(--radius-2xl);
    box-shadow: 0 12px 32px -14px rgb(0 0 0 / 0.4);
    backdrop-filter: blur(18px) saturate(1.6);
    -webkit-backdrop-filter: blur(18px) saturate(1.6);
  }

  .tab-bar button {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    padding: 0.45rem 0 0.4rem;
    font: inherit;
    font-size: var(--text-2xs);
    font-weight: 600;
    color: var(--ink-3);
    background: none;
    border: 0;
    border-radius: var(--radius-xl);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: color var(--dur), background-color var(--dur), transform var(--dur-fast);
  }

  .tab-bar button:active {
    transform: scale(0.94);
  }

  .tab-bar button.active {
    color: color-mix(in srgb, var(--gold) 70%, var(--ink));
    background: color-mix(in srgb, var(--gold) 15%, transparent);
  }

  .tab-bar svg {
    width: 1.45rem;
    height: 1.45rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .tab-count {
    position: absolute;
    top: 0.2rem;
    left: calc(50% + 0.5rem);
    min-width: 1.1rem;
    height: 1.1rem;
    padding: 0 0.3rem;
    display: grid;
    place-items: center;
    font-size: var(--text-2xs);
    font-style: normal;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: #1b1f2a;
    background: var(--gold);
    border-radius: var(--radius-pill);
    box-shadow: 0 0 0 2px var(--surface);
  }
}

@keyframes tab-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pane-price,
  .pane-gold,
  .pane-units {
    animation: none;
  }
}
</style>
