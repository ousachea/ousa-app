<script setup lang="ts">
import type { BulkAction } from '~/composables/useBulkSelect'
import type { BudgetTransaction } from '~/utils/budget/types'
import { total } from '~/utils/budget/calc'
import { addMonths, formatDay, formatMonth, formatRange, monthOf, monthRange, today, weekRange } from '~/utils/budget/dates'
import { transactionColumns } from '~/utils/budget/csv'

// Every transaction, with filters that combine and live in the URL (?tab=transactions&cat=…&from=…)
const store = useBudget()
const { transactions, settings, conv, money, categoryById, topCategories, subsOf } = store
const route = useRoute()
const router = useRouter()
const { play } = useSound()
useBudgetHighlight()

type Filter = 'q' | 'from' | 'to' | 'kind' | 'cat' | 'sub' | 'method' | 'sort'
const q = (k: Filter) => (typeof route.query[k] === 'string' ? (route.query[k] as string) : '')
function setFilter(k: Filter, v: string) {
  const query = { ...route.query, [k]: v || undefined }
  if (k === 'cat') query.sub = undefined
  void router.replace({ query })
}
const filter = (k: Filter) => computed({ get: () => q(k), set: (v: string) => setFilter(k, v) })
const search = filter('q')
const from = filter('from')
const to = filter('to')
const kind = filter('kind')
const cat = filter('cat')
const sub = filter('sub')
const method = filter('method')
const sort = filter('sort')
const active = computed(() => (['q', 'from', 'to', 'kind', 'cat', 'sub', 'method'] as Filter[]).filter(k => q(k)).length)
function resetFilters() {
  void router.replace({ query: { tab: 'transactions' } })
  play('select')
}

// Search box types freely; the URL catches up after a pause
const searchText = ref(search.value)
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(searchText, (v) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => (search.value = v.trim()), 250)
})
watch(search, v => (searchText.value = v))

const catOptions = computed(() => [
  { value: '', label: 'All categories' },
  ...topCategories.value.filter(c => c.kind === 'expense').map(c => ({ value: c.id, label: c.name })),
  ...topCategories.value.filter(c => c.kind === 'income').map(c => ({ value: c.id, label: `${c.name} (income)` }))
])
const subOptions = computed(() => [{ value: '', label: 'All subcategories' }, ...(cat.value ? subsOf(cat.value).map(s => ({ value: s.id, label: s.name })) : [])])
const methodOptions = computed(() => [{ value: '', label: 'Any payment method' }, ...settings.value.methods.map(m => ({ value: m.id, label: m.name }))])
const SORTS = [
  { value: '', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'high', label: 'Highest amount' },
  { value: 'low', label: 'Lowest amount' }
]

// Quick date presets
const presets = computed(() => {
  const d = today()
  return [
    { label: 'Today', r: { from: d, to: d } },
    { label: 'This week', r: weekRange(d, settings.value.weekStart) },
    { label: 'This month', r: monthRange(d) },
    { label: 'Last month', r: monthRange(addMonths(d, -1)) }
  ]
})
function applyPreset(r: { from: string, to: string }) {
  void router.replace({ query: { ...route.query, from: r.from, to: r.to } })
  play('select')
}

const filtered = computed(() => {
  const needle = search.value.toLowerCase()
  const list = transactions.items.value.filter((t) => {
    if (from.value && t.date < from.value) return false
    if (to.value && t.date > to.value) return false
    if (kind.value && t.kind !== kind.value) return false
    if (cat.value && t.categoryId !== cat.value) return false
    if (sub.value && t.subcategoryId !== sub.value) return false
    if (method.value && t.method !== method.value) return false
    if (needle) {
      const hay = [t.note, t.merchant, ...t.tags, categoryById.value.get(t.categoryId)?.name, categoryById.value.get(t.subcategoryId)?.name].join(' ').toLowerCase()
      if (!hay.includes(needle)) return false
    }
    return true
  })
  const amountOf = (t: BudgetTransaction) => conv.value(t.amount, t.currency) ?? 0
  const s = sort.value
  return list.sort((a, b) =>
    s === 'oldest' ? a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)
      : s === 'high' ? amountOf(b) - amountOf(a)
        : s === 'low' ? amountOf(a) - amountOf(b)
          : b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
})

const spentTotal = computed(() => total(filtered.value.filter(t => t.kind === 'expense'), conv.value))
const incomeTotal = computed(() => total(filtered.value.filter(t => t.kind === 'income'), conv.value))

// Views: grouped by day (default), a flat list, or a table; plus totals by day, week or month
const view = smoothRef(useRemembered<'days' | 'list' | 'table'>('budget-tx-view', 'days', v => v === 'days' || v === 'list' || v === 'table'))
const periodTotals = smoothRef(ref<'' | 'day' | 'week' | 'month'>(''))
const buckets = computed(() => {
  if (!periodTotals.value) return []
  const keyOf = (d: string) => periodTotals.value === 'month' ? monthOf(d) : periodTotals.value === 'week' ? weekRange(d, settings.value.weekStart).from : d
  const map = new Map<string, BudgetTransaction[]>()
  for (const t of filtered.value) {
    const k = keyOf(t.date)
    map.set(k, [...(map.get(k) ?? []), t])
  }
  return [...map].sort((a, b) => b[0].localeCompare(a[0])).map(([k, list]) => ({
    key: k,
    label: periodTotals.value === 'month' ? formatMonth(`${k}-01`) : periodTotals.value === 'week' ? `Week of ${formatDay(k, { day: 'numeric', month: 'short' })}` : formatDay(k),
    spent: total(list.filter(t => t.kind === 'expense'), conv.value),
    income: total(list.filter(t => t.kind === 'income'), conv.value)
  }))
})

// Long histories render in pages
const PAGE = 60
const shownCount = ref(PAGE)
watch(() => route.query, () => (shownCount.value = PAGE))
const page = computed(() => filtered.value.slice(0, shownCount.value))

// ---------- Select several ----------
const sel = useBulkSelect({ items: transactions.items, shown: page, onDelete: () => deleteSelected() })
const bulkText = (n: number) => `${n} ${n === 1 ? 'transaction' : 'transactions'}`
function deleteSelected() {
  sel.guard(`Delete ${bulkText(sel.selected.size)}?`, () => bulkRemove(sel.selectedItems as BudgetTransaction[], transactions.remove, transactions.restore, bulkText))
}
const bulkActions = computed<BulkAction[]>(() => [{ label: 'Delete', icon: 'delete', danger: true, run: deleteSelected }])

// ---------- Export what's filtered ----------
function exportCsv(which: 'all' | 'expense' | 'income') {
  const rows = which === 'all' ? filtered.value : filtered.value.filter(t => t.kind === which)
  if (!rows.length) return
  const name = which === 'income' ? 'budget-income' : which === 'expense' ? 'budget-expenses' : 'budget-transactions'
  downloadFile(dated(name, 'csv'), toCSV(rows, transactionColumns(categoryById.value, settings.value.methods)), 'text/csv;charset=utf-8')
  logActivity('exported', '/budget', `${rows.length} transactions as CSV`)
  play('copy')
}
const importOpen = ref(false)

const describe = computed(() => {
  const parts: string[] = []
  if (from.value || to.value) parts.push(formatRange({ from: from.value || '0000-01-01', to: to.value || today() }))
  if (kind.value) parts.push(kind.value === 'income' ? 'income' : 'expenses')
  if (cat.value) parts.push(categoryById.value.get(cat.value)?.name ?? '')
  if (sub.value) parts.push(categoryById.value.get(sub.value)?.name ?? '')
  return parts.filter(Boolean).join(' · ')
})
</script>

<template>
  <div>
    <div class="b-head">
      <h2>Transactions</h2>
      <div class="b-row">
        <button type="button" class="btn btn-quiet btn-sm" @click="importOpen = true">Import CSV</button>
        <button type="button" class="btn btn-quiet btn-sm" :disabled="!filtered.length" @click="exportCsv('all')">Export {{ active ? 'filtered' : 'all' }}</button>
        <BulkToggle v-if="filtered.length" :select="sel" />
      </div>
    </div>

    <section class="panel b-panel filters" aria-label="Filters">
      <div class="filter-row">
        <label class="search input">
          <AnimatedIcon name="search" />
          <input v-model="searchText" type="search" placeholder="Search notes, merchants, tags…" aria-label="Search transactions">
        </label>
        <div class="segmented kinds" role="radiogroup" aria-label="Type">
          <label v-for="k in [{ v: '', l: 'All' }, { v: 'expense', l: 'Expenses' }, { v: 'income', l: 'Income' }]" :key="k.v" :class="{ active: kind === k.v }">
            <input v-model="kind" type="radio" name="tx-kind" :value="k.v">{{ k.l }}
          </label>
        </div>
      </div>
      <div class="filter-grid">
        <AppSelect v-model="cat" aria-label="Category" :options="catOptions" searchable />
        <AppSelect v-if="cat && subOptions.length > 1" v-model="sub" aria-label="Subcategory" :options="subOptions" searchable />
        <AppSelect v-model="method" aria-label="Payment method" :options="methodOptions" />
        <AppSelect v-model="sort" aria-label="Sort" :options="SORTS" />
      </div>
      <div class="filter-row dates">
        <DatePicker v-model="from" aria-label="From date" placeholder="From" />
        <span aria-hidden="true">–</span>
        <DatePicker v-model="to" aria-label="To date" placeholder="To" />
        <span class="presets">
          <button v-for="p in presets" :key="p.label" type="button" class="link" :aria-pressed="from === p.r.from && to === p.r.to" @click="applyPreset(p.r)">{{ p.label }}</button>
        </span>
        <button v-if="active" type="button" class="btn btn-quiet btn-sm reset" @click="resetFilters">Reset {{ active }} {{ active === 1 ? 'filter' : 'filters' }}</button>
      </div>
    </section>

    <section class="totals b-gap" aria-live="polite">
      <div>
        <span class="b-muted">{{ filtered.length }} {{ filtered.length === 1 ? 'transaction' : 'transactions' }}<template v-if="describe"> · {{ describe }}</template></span>
      </div>
      <div class="sums">
        <span v-if="spentTotal.count">Spent <strong class="b-num">{{ money(spentTotal.value) }}</strong></span>
        <span v-if="incomeTotal.count">Income <strong class="b-num income">{{ money(incomeTotal.value) }}</strong></span>
      </div>
    </section>
    <BudgetRateNote :totals="[spentTotal, incomeTotal]" />

    <div class="b-row view-row b-gap">
      <div class="segmented" role="radiogroup" aria-label="View">
        <label v-for="v in [{ v: 'days', l: 'By day' }, { v: 'list', l: 'List' }, { v: 'table', l: 'Table' }]" :key="v.v" :class="{ active: view === v.v }">
          <input v-model="view" type="radio" name="tx-view" :value="v.v">{{ v.l }}
        </label>
      </div>
      <div class="segmented" role="radiogroup" aria-label="Totals by">
        <label v-for="p in [{ v: '', l: 'No totals' }, { v: 'day', l: 'Daily' }, { v: 'week', l: 'Weekly' }, { v: 'month', l: 'Monthly' }]" :key="p.v" :class="{ active: periodTotals === p.v }">
          <input v-model="periodTotals" type="radio" name="tx-totals" :value="p.v">{{ p.l }}
        </label>
      </div>
    </div>

    <section v-if="buckets.length" class="panel b-panel b-gap" aria-label="Totals by period">
      <table class="tbl">
        <thead><tr><th>Period</th><th class="r">Spent</th><th class="r">Income</th></tr></thead>
        <tbody>
          <tr v-for="b in buckets" :key="b.key"><td>{{ b.label }}</td><td class="r b-num">{{ b.spent.count ? money(b.spent.value) : '—' }}</td><td class="r b-num">{{ b.income.count ? money(b.income.value) : '—' }}</td></tr>
        </tbody>
      </table>
    </section>

    <div v-if="!filtered.length" class="panel b-gap">
      <EmptyState v-if="transactions.items.value.length" title="Nothing matches" icon="search" action="Reset filters" @action="resetFilters">
        No transactions match these filters.
      </EmptyState>
      <EmptyState v-else title="No transactions yet" icon="budget" action="Add expense" @action="store.openEntry()">
        Everything you log appears here, grouped by day, with search and filters.
      </EmptyState>
    </div>
    <section v-else-if="view !== 'table'" class="panel b-panel b-gap">
      <BudgetTxList :items="page" :grouped="view === 'days'" :select="sel" />
    </section>
    <section v-else class="panel b-panel b-gap table-wrap">
      <table class="tbl">
        <thead>
          <tr><th>Date</th><th>Category</th><th>Note</th><th>Method</th><th class="r">Amount</th><th><span class="sr-only">Actions</span></th></tr>
        </thead>
        <TransitionGroup tag="tbody" name="list">
          <tr v-for="t in page" :key="t.id" class="bulk-row" :class="{ 'bulk-picked': sel.has(t.id) }" :data-bulk="sel.selecting || undefined" @click.capture="sel.onRowClick($event, t.id)">
            <td class="nowrap"><span class="bulk-cell"><BulkCheck v-if="sel.selecting" inline :checked="sel.has(t.id)" :label="`Select ${t.note || 'transaction'}`" @pick="sel.pick(t.id, $event)" />{{ formatDay(t.date, { day: 'numeric', month: 'short', year: '2-digit' }) }}</span></td>
            <td>{{ categoryById.get(t.categoryId)?.name ?? '—' }}<span v-if="t.subcategoryId" class="b-muted"> › {{ categoryById.get(t.subcategoryId)?.name }}</span></td>
            <td>{{ t.note || t.merchant }}</td>
            <td class="b-muted">{{ store.methodName(t.method) }}</td>
            <td class="r b-num" :class="{ income: t.kind === 'income' }">{{ t.kind === 'income' ? '+' : '−' }}{{ formatMoney(t.amount, t.currency) }}</td>
            <td class="r"><button type="button" class="link" @click="store.openEntry(undefined, t)">Edit</button></td>
          </tr>
        </TransitionGroup>
      </table>
    </section>
    <div v-if="filtered.length > shownCount" class="more">
      <button type="button" class="btn btn-quiet" @click="shownCount += PAGE">Show {{ Math.min(PAGE, filtered.length - shownCount) }} more</button>
      <span class="b-muted">Showing {{ shownCount }} of {{ filtered.length }}</span>
    </div>

    <BudgetImport :open="importOpen" @close="importOpen = false" />
    <BulkBar :select="sel" :actions="bulkActions" label="Selected transactions" noun="transactions" />
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 0.75rem;
}

.search {
  flex: 1 1 16rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.search svg {
  width: 1.05rem;
  height: 1.05rem;
  flex: none;
  fill: none;
  stroke: var(--ink-3);
  stroke-width: 2;
  stroke-linecap: round;
}

.search input {
  flex: 1;
  min-width: 0;
  font: inherit;
  color: var(--ink);
  background: transparent;
  border: 0;
  outline: none;
}

.kinds label {
  padding-inline: 0.75rem;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));
  gap: 0.6rem;
}

.dates :deep(.date-picker),
.dates > :first-child,
.dates > :nth-child(3) {
  width: 11rem;
}

.presets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.presets .link[aria-pressed='true'] {
  color: var(--ink);
  font-weight: 700;
  text-decoration: none;
}

.reset {
  margin-left: auto;
}

.totals {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem 1rem;
}

.sums {
  display: flex;
  gap: 1.25rem;
}

.income {
  color: var(--budget-income-ink);
}

.view-row {
  justify-content: space-between;
}

.view-row .segmented label {
  padding-inline: 0.7rem;
  white-space: nowrap;
}

.table-wrap {
  overflow-x: auto;
}

.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.tbl th,
.tbl td {
  padding: 0.5rem 0.4rem;
  text-align: left;
  border-bottom: 1px solid var(--line);
}

.tbl th {
  font-size: var(--text-xs);
  color: var(--ink-2);
}

.r {
  text-align: right !important;
}

.nowrap {
  white-space: nowrap;
}

.more {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

@media (max-width: 640px) {
  .dates > :first-child,
  .dates > :nth-child(3) {
    width: calc(50% - 1rem);
  }

  .reset {
    margin-left: 0;
  }
}
</style>
