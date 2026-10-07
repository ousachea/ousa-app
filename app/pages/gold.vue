<script setup lang="ts">
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
const HISTORY_KEY = 'ousa-app:gold-history'

const { play } = useSound()
// Demo: a few purchases over two years, mostly in chi, bought when gold was cheaper
const DEMO = (): Omit<Purchase, 'id'>[] => [
  { weight: 1, unit: 'chi', price: 255, date: isoDaysAgo(720) },
  { weight: 2, unit: 'chi', price: 560, date: isoDaysAgo(500) },
  { weight: 5, unit: 'chi', price: 1650, date: isoDaysAgo(330) },
  { weight: 1, unit: 'damlung', price: 3900, date: isoDaysAgo(150) },
  { weight: 0.5, unit: 'chi', price: 262, date: isoDaysAgo(20) }
]
const { items: purchases, ready, sync, add, addMany, update, remove, restore } = useCollection<Purchase>('gold', undefined, { demo: DEMO })

// ---------- Words (English / Khmer) ----------
const WORDS = {
  en: {
    li: 'Li', hun: 'Hun', chi: 'Chi', gram: 'Gram', damlung: 'Damlung', troyOz: 'Troy oz',
    spot: 'Gold spot price', perOz: 'per troy ounce', live: 'Live', custom: 'My price', refresh: 'Refresh',
    byUnit: 'Price by unit', convert: 'Convert units', myGold: 'My gold', add: '+ Add purchase',
    invested: 'Paid', worth: 'Worth now', gainLoss: 'Gain or loss', weight: 'Weight', paid: 'Paid', date: 'Date',
    step1: 'Check today’s price', step1Hint: 'Live from the world market. Switch to “My price” to use a shop’s quote.',
    step2: 'Choose your gold’s purity', step2Hint: 'Jewellery is often 22K or 18K, so it’s worth less than pure 24K gold.',
    step3: 'Add the gold you own', step3Hint: 'Enter what you bought and paid to see what it’s worth today.'
  },
  km: {
    li: 'លី', hun: 'ហុន', chi: 'ជី', gram: 'ក្រាម', damlung: 'ដំឡឹង', troyOz: 'អោន',
    spot: 'តម្លៃមាសទីផ្សារ', perOz: 'ក្នុងមួយអោន', live: 'បន្តផ្ទាល់', custom: 'តម្លៃខ្ញុំ', refresh: 'ធ្វើបច្ចុប្បន្នភាព',
    byUnit: 'តម្លៃតាមឯកតា', convert: 'បម្លែងឯកតា', myGold: 'មាសរបស់ខ្ញុំ', add: '+ បន្ថែមការទិញ',
    invested: 'បានបង់', worth: 'តម្លៃឥឡូវ', gainLoss: 'ចំណេញ ឬខាត', weight: 'ទម្ងន់', paid: 'បានបង់', date: 'កាលបរិច្ឆេទ',
    step1: 'មើលតម្លៃថ្ងៃនេះ', step1Hint: 'តម្លៃផ្ទាល់ពីទីផ្សារពិភពលោក។ ប្តូរទៅ «តម្លៃខ្ញុំ» ដើម្បីប្រើតម្លៃហាង។',
    step2: 'ជ្រើសរើសភាពសុទ្ធនៃមាស', step2Hint: 'គ្រឿងអលង្ការជាញឹកញាប់ 22K ឬ 18K ដូច្នេះតម្លៃទាបជាងមាសសុទ្ធ 24K។',
    step3: 'បន្ថែមមាសដែលអ្នកមាន', step3Hint: 'បញ្ចូលអ្វីដែលអ្នកបានទិញ និងតម្លៃដែលបានបង់ ដើម្បីដឹងតម្លៃថ្ងៃនេះ។'
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
const sort = ref<'date-desc' | 'date-asc' | 'gl-desc' | 'gl-asc' | 'weight-desc'>('date-desc')

const w = computed(() => WORDS[lang.value])

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

async function fetchQuote() {
  if (loading.value) return
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
    toast.error('Couldn’t get a live price', { description: 'Showing the last price saved on this device.' })
    play('error')
  } else {
    toast.error('Couldn’t get a live price', { description: 'Check your connection, or enter your own price.' })
    play('error')
  }
}

function refresh() {
  play('press')
  fetchQuote()
}

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

// ---------- History chart (prices seen on this device) ----------
interface Point { price: number, time: number }
const history = ref<Point[]>([])

function pushHistory(price: number) {
  history.value = [...history.value, { price, time: Date.now() }].slice(-500)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value))
  } catch {}
}

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
const totals = computed(() => {
  const paid = purchases.value.reduce((s, p) => s + p.price, 0)
  const worth = purchases.value.reduce((s, p) => s + valueOf(p), 0)
  const g = purchases.value.reduce((s, p) => s + grams(p.weight, p.unit), 0)
  return { paid, worth, gain: worth - paid, pct: paid ? (worth - paid) / paid * 100 : 0, grams: g, chi: g / UNIT_GRAMS.chi }
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

const today = () => new Date().toISOString().slice(0, 10)
const formOpen = ref(false)
const editingId = ref<string>()
const form = reactive({ weight: null as number | null, unit: 'chi' as Unit, price: null as number | null, date: today() })
const canSave = computed(() => (form.weight ?? 0) > 0 && (form.price ?? 0) > 0)

function openAdd() {
  editingId.value = undefined
  Object.assign(form, { weight: null, unit: 'chi', price: null, date: today() })
  formOpen.value = true
  play('open')
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
    update(editingId.value, entry)
    toast.success('Changes saved')
  } else {
    add(entry)
    toast.success('Purchase saved', { description: `${entry.weight} ${w.value[entry.unit]} for ${money(entry.price)}` })
  }
  play('success')
  formOpen.value = false
}

function del(p: Purchase) {
  const removed = remove(p.id)
  play('delete')
  toast(`${p.weight} ${w.value[p.unit]} deleted`, { action: { label: 'Undo', onClick: () => removed && restore(removed) } })
}

// CSV with Weight, Unit, Paid, Date columns (the same format Export writes)
const fileInput = ref<HTMLInputElement>()
async function importCSV(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const lines = (await file.text()).trim().split(/\r?\n/).filter(l => l.trim())
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
  addMany(rows)
  play('success')
  toast.success(`${rows.length} ${rows.length === 1 ? 'purchase' : 'purchases'} imported`)
}

function exportCSV() {
  const csv = ['Weight,Unit,Paid,Date', ...purchases.value.map(p => `${p.weight},${p.unit},${p.price.toFixed(2)},${p.date}`)].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = `gold-${today()}.csv`
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
  if (sec) refreshTimer = setInterval(() => source.value === 'api' && fetchQuote(), sec * 1000)
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
    history.value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch {}
  if (source.value === 'api') fetchQuote()
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
      <div class="workspace">
        <!-- ===== Market ===== -->
        <div class="market">
          <!-- The quote: one gold bar of a card -->
          <Step :n="1" :title="w.step1" :hint="w.step1Hint">
            <section class="panel quote" aria-live="polite">
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
                  <svg viewBox="0 0 24 24" aria-hidden="true" :class="{ spinning: loading }"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" /></svg>
                  {{ loading ? 'Loading…' : w.refresh }}
                </button>
              </div>
  
              <div v-if="source === 'custom'" class="custom-price">
                <label class="field">
                  <span class="field-head">Price you were quoted</span>
                  <span class="money input">
                    <span class="unit" aria-hidden="true">$</span>
                    <input v-model.number="customPrice" type="number" inputmode="decimal" min="0" step="0.01" aria-label="Your gold price in dollars">
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

          <Step title="Price over time" hint="Prices this device has seen.">
            <div class="panel pad">
              <div class="segmented ranges" role="radiogroup" aria-label="Time range">
                <label v-for="r in (['1H', '1D', '1W', '1M'] as const)" :key="r" :class="{ active: range === r }">
                  <input type="radio" name="gold-range" :checked="range === r" @change="range = r">
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
                  <div v-if="hover" class="tip" :style="{ left: `${(hover.x / CHART_W) * 100}%` }">
                    <strong>{{ money(hover.price) }}</strong>
                    <span>{{ new Date(hover.time).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }}</span>
                  </div>
                </div>
                <div class="chart-scale">
                  <span>Low {{ money(chart.min, 0) }}</span>
                  <span>High {{ money(chart.max, 0) }}</span>
                </div>
              </template>
              <p v-else class="muted">Refresh the price a few times and the chart fills in.</p>
            </div>
          </Step>

          <details class="panel settings">
            <summary>Price settings</summary>
            <div class="settings-body">
              <label class="field">
                <span class="field-head">Refresh automatically</span>
                <select v-model.number="autoRefresh" class="input">
                  <option :value="0">Off</option>
                  <option :value="30">Every 30 seconds</option>
                  <option :value="60">Every minute</option>
                  <option :value="300">Every 5 minutes</option>
                </select>
              </label>
              <label class="field">
                <span class="field-head">goldapi.io key <span class="optional">Optional backup</span></span>
                <input v-model="apiKey" class="input" type="text" autocomplete="off" spellcheck="false" placeholder="Only used if the free price fails">
              </label>
              <label v-if="showKHR" class="field">
                <span class="field-head">Riel per dollar</span>
                <input v-model.number="khrRate" class="input" type="number" min="1000" step="10">
              </label>
              <p class="muted">Spot price only. Shops add their own premium, workmanship and buy/sell spread.</p>
            </div>
          </details>
        </div>

        <!-- ===== Units and ledger ===== -->
        <div class="side">
          <Step :n="3" :title="w.step3" :hint="w.step3Hint" class="ledger-step">
            <template #aside><DataSource :sync="sync" /></template>

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

            <div class="ledger-bar">
              <button type="button" class="btn" @click="openAdd">{{ w.add }}</button>
              <select v-if="purchases.length > 1" v-model="sort" class="input sort" aria-label="Sort purchases">
                <option value="date-desc">Newest first</option>
                <option value="date-asc">Oldest first</option>
                <option value="gl-desc">Biggest gain</option>
                <option value="gl-asc">Biggest loss</option>
                <option value="weight-desc">Heaviest</option>
              </select>
            </div>

            <ul v-if="purchases.length" class="purchases">
              <li v-for="p in sorted" :key="p.id" class="purchase">
                <span class="p-weight"><strong>{{ p.weight }}</strong> {{ w[p.unit] }}</span>
                <span class="p-meta">{{ formatDate(p.date) }} · {{ w.paid }} {{ money(p.price) }}</span>
                <span class="p-now">{{ spot ? money(valueOf(p)) : '—' }}</span>
                <span v-if="spot" class="p-gain" :class="gainOf(p) >= 0 ? 'up' : 'down'">
                  {{ signed(gainOf(p)) }} · {{ p.price ? ((gainOf(p) / p.price) * 100).toFixed(1) : '0' }}%
                </span>
                <span class="p-actions">
                  <button type="button" class="link" @click="openEdit(p)">Edit</button>
                  <button type="button" class="link danger" @click="del(p)">Delete</button>
                </span>
              </li>
            </ul>

            <div v-else-if="ready" class="panel empty">
              <h3>No gold yet</h3>
              <p>Add what you bought and what you paid to see what it’s worth today.</p>
            </div>

            <p class="csv">
              <button type="button" class="link" @click="fileInput?.click()">Import CSV</button>
              <button v-if="purchases.length" type="button" class="link" @click="exportCSV">Export CSV</button>
              <input ref="fileInput" type="file" accept=".csv,text/csv" hidden @change="importCSV">
            </p>
          </Step>

          <Step :title="w.byUnit">
            <ul v-if="spot" class="units">
              <li v-for="u in UNITS" :key="u" :class="{ lead: u === 'chi' || u === 'damlung' }">
                <span class="u-name">{{ w[u] }}</span>
                <span class="u-grams">{{ fmtQty(UNIT_GRAMS[u]) }} g</span>
                <strong>{{ money(priceOf(u), priceOf(u) < 1 ? 4 : 2) }}</strong>
              </li>
            </ul>
            <p v-else class="panel pad muted">Waiting for a price…</p>
          </Step>

          <Step :title="w.convert">
            <div class="panel pad convert">
              <div class="convert-row">
                <input v-model.number="convAmount" class="input" type="number" min="0" step="any" inputmode="decimal" aria-label="Amount to convert">
                <select v-model="convUnit" class="input" aria-label="Unit">
                  <option v-for="u in UNITS" :key="u" :value="u">{{ w[u] }}</option>
                </select>
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

      <Modal :open="formOpen" :title="editingId ? 'Edit purchase' : 'Add a purchase'" @close="formOpen = false">
        <form class="form" @submit.prevent="savePurchase">
          <div class="form-row">
            <label class="field">
              <span class="field-head">{{ w.weight }}</span>
              <input v-model.number="form.weight" class="input" type="number" min="0" step="any" inputmode="decimal" required>
            </label>
            <label class="field">
              <span class="field-head">Unit</span>
              <select v-model="form.unit" class="input">
                <option v-for="u in UNITS" :key="u" :value="u">{{ w[u] }}</option>
              </select>
            </label>
          </div>
          <div class="form-row">
            <label class="field">
              <span class="field-head">{{ w.paid }} (USD)</span>
              <input v-model.number="form.price" class="input" type="number" min="0" step="0.01" inputmode="decimal" required>
            </label>
            <label class="field">
              <span class="field-head">{{ w.date }}</span>
              <input v-model="form.date" class="input" type="date">
            </label>
          </div>
          <p v-if="spot && form.weight" class="form-note">
            Worth about {{ money(priceOf(form.unit, form.weight)) }} today.
            <button type="button" class="link" @click="useTodayPrice">Use today’s price</button>
          </p>
          <div class="form-actions">
            <button type="submit" class="btn" :disabled="!canSave">{{ editingId ? 'Save changes' : 'Add purchase' }}</button>
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
  font-size: 0.85rem;
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
  font-size: 0.875rem;
  color: var(--ink-2);
}

.optional {
  font-weight: 400;
  color: var(--ink-3);
}

/* ---------- The quote: a gold bar of a card ---------- */
.quote {
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

.quote-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.label {
  font-size: 0.85rem;
  font-weight: 700;
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.6rem;
  font-size: 0.78rem;
  font-weight: 700;
  background: rgb(255 255 255 / 0.45);
  border-radius: 999px;
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
  font-size: clamp(2.6rem, 6vw, 3.75rem);
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
  font-size: 0.9rem;
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
  border-radius: 12px;
}

.local span {
  font-size: 0.8rem;
  font-weight: 600;
  opacity: 0.8;
}

.local strong {
  font-size: 1.35rem;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.observed {
  margin: 0.8rem 0 0;
  font-size: 0.8rem;
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
  font-size: 0.9rem;
  font-weight: 700;
  color: #fff;
  background: #1b1f2a;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  transition: background-color 0.15s, scale 0.15s;
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

.spinning { animation: spin 0.9s linear infinite; }
@keyframes spin { to { rotate: 360deg; } }

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
  font-size: 1.1rem;
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

.tip {
  position: absolute;
  top: -0.4rem;
  translate: -50% -100%;
  padding: 0.35rem 0.6rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  white-space: nowrap;
  font-size: 0.78rem;
  color: var(--ink-2);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 9px;
  box-shadow: 0 6px 16px rgb(var(--shadow) / 0.15);
  pointer-events: none;
}

.tip strong {
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.chart-scale {
  display: flex;
  justify-content: space-between;
  margin-top: 0.3rem;
  font-size: 0.8rem;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}

/* ---------- Settings ---------- */
.settings summary {
  padding: 1rem 1.1rem;
  font-weight: 700;
  cursor: pointer;
}

.settings-body {
  padding: 0 1.1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
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
  border-radius: 14px;
}

.units li.lead {
  border-color: color-mix(in srgb, var(--gold) 55%, var(--line));
  background: color-mix(in srgb, var(--gold) 9%, var(--surface));
}

.u-name {
  font-weight: 700;
}

.u-grams {
  font-size: 0.78rem;
  color: var(--ink-3);
}

.units strong {
  width: 100%;
  font-size: 1.15rem;
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
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ink-2);
}

.summary strong {
  font-size: 1.2rem;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.summary .up strong { color: var(--good-ink); }
.summary .down strong { color: var(--bad-ink); }

.summary small {
  font-size: 0.8rem;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}

.ledger-bar {
  margin-top: 1rem;
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}

.sort {
  width: auto;
}

.purchases {
  list-style: none;
  margin: 1rem 0 0;
  padding: 0;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 18px;
}

.purchase {
  padding: 0.85rem 1.1rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.15rem 1rem;
  align-items: baseline;
}

.purchase + .purchase {
  border-top: 1px solid var(--line);
}

.p-weight strong {
  font-size: 1.2rem;
  font-variant-numeric: tabular-nums;
}

.p-meta {
  grid-column: 1;
  font-size: 0.85rem;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}

.p-now {
  grid-column: 2;
  grid-row: 1;
  text-align: right;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.p-gain {
  grid-column: 2;
  grid-row: 2;
  text-align: right;
  font-size: 0.85rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.p-actions {
  grid-column: 1 / -1;
  display: flex;
  gap: 0.9rem;
  margin-top: 0.3rem;
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

.link:hover { color: var(--ink); }
.link.danger { color: var(--bad-ink); }

.empty {
  margin-top: 1rem;
  padding: 2rem 1.5rem;
  text-align: center;
  color: var(--ink-2);
}

.empty h3 {
  font-size: 1.15rem;
  color: var(--ink);
}

.empty p {
  margin: 0.4rem 0 0;
}

.csv {
  margin: 0.9rem 0 0;
  display: flex;
  gap: 1rem;
}

/* ---------- Form ---------- */
.form {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.form-note {
  margin: 0;
  font-size: 0.9rem;
  color: var(--ink-2);
}

.form-actions {
  display: flex;
  gap: 0.5rem;
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

@media (max-width: 1000px) {
  .workspace { grid-template-columns: 1fr; }
}

@media (max-width: 560px) {
  .units { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .summary { grid-template-columns: 1fr 1fr; }
  .form-row { grid-template-columns: 1fr; }
  .convert-row { grid-template-columns: 1fr 7.5rem; }
}

@media (prefers-reduced-motion: reduce) {
  .spinning { animation: none; }
}
</style>
