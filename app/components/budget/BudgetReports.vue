<script setup lang="ts">
import type { RangeMode } from './BudgetRangePicker.vue'
import type { BudgetTransaction } from '~/utils/budget/types'
import { budgetStatus, cashFlow, categoryPath, dailyTotals, expensesIn, groupTotals, monthlyFlow, total } from '~/utils/budget/calc'
import { addDays, formatDay, formatMonth, monthOf, monthRange, previousRange, rangeDays, today, weekRange, type DateRange } from '~/utils/budget/dates'

// Reports from stored data only, through the same calculations as the dashboard and budgets.
// Comparisons need something to compare with: they say so instead of guessing.
const store = useBudget()
const { transactions, settings, conv, money, categoryById, methodName, go } = store
const day = today()

// Opening Reports ticks the last step of the how-to guide
const reportsSeen = useRemembered<boolean>('budget-guide-reports', false, v => typeof v === 'boolean')
onMounted(() => nextTick(() => (reportsSeen.value = true)))

const mode = ref<RangeMode>('month')
const range = ref<DateRange>(monthRange(day))
const all = computed(() => transactions.items.value)
const spent = computed(() => expensesIn(all.value, range.value))
const flow = computed(() => cashFlow(all.value, range.value, conv.value))
const prev = computed(() => {
  const r = mode.value === 'month' ? monthRange(addDays(range.value.from, -1)) : previousRange(range.value)
  return { r, flow: cashFlow(all.value, r, conv.value) }
})
const change = (now?: number, before?: number) => (now === undefined || !before ? undefined : (now - before) / before)
const pctText = (v?: number) => (v === undefined ? '' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v * 100))}%`)

// Days in the range that have already happened, and whether there's enough to average
const daysSoFar = computed(() => {
  const to = range.value.to > day ? day : range.value.to
  return to < range.value.from ? 0 : rangeDays({ from: range.value.from, to })
})
const perDay = computed(() => (daysSoFar.value >= 7 && flow.value.expenses.value !== undefined ? flow.value.expenses.value / daysSoFar.value : undefined))

// ---------- Categories, with a drill-down into one ----------
const drill = ref('')
const byCategory = computed(() => groupTotals(spent.value, t => t.categoryId, conv.value).map((s) => {
  const c = categoryById.value.get(s.key)
  return { key: s.key, label: c?.name ?? 'Deleted category', icon: c?.icon, color: c?.color, value: s.total.value, detail: `${s.total.count} ${s.total.count === 1 ? 'payment' : 'payments'}` }
}))
const bySub = computed(() => groupTotals(drill.value ? spent.value.filter(t => t.categoryId === drill.value) : spent.value, t => t.subcategoryId || `none:${t.categoryId}`, conv.value).map((s) => {
  const c = categoryById.value.get(s.key)
  const parent = c?.parentId ? categoryById.value.get(c.parentId) : categoryById.value.get(s.key.replace('none:', ''))
  return { key: s.key.startsWith('none:') ? '' : s.key, label: c ? (drill.value ? c.name : `${c.name}`) : 'No subcategory', icon: c?.icon ?? parent?.icon, color: parent?.color ?? c?.color, value: s.total.value, detail: drill.value ? undefined : parent?.name }
}))

// ---------- Trends ----------
const daily = computed(() => dailyTotals(all.value, range.value, conv.value))
const dailyPoints = computed(() => daily.value.map(d => ({ key: d.date, label: daily.value.length > 40 ? formatDay(d.date, { day: 'numeric', month: 'short' }) : String(Number(d.date.slice(8))), title: formatDay(d.date), values: [d.total.value] })))

const WEEKS = 8
const weeks = computed(() => {
  const end = weekRange(range.value.to > day ? day : range.value.to, settings.value.weekStart)
  return Array.from({ length: WEEKS }, (_, i) => {
    const from = addDays(end.from, -7 * (WEEKS - 1 - i))
    const r = { from, to: addDays(from, 6) }
    return { r, total: total(expensesIn(all.value, r), conv.value) }
  })
})
const weekPoints = computed(() => weeks.value.map(w => ({ key: w.r.from, label: formatDay(w.r.from, { day: 'numeric', month: 'short' }), title: `Week of ${formatDay(w.r.from, { day: 'numeric', month: 'short' })}`, values: [w.total.value] })))
const lastTwoWeeks = computed(() => weeks.value.slice(-2))

const MONTHS = 6
const months = computed(() => monthlyFlow(all.value, MONTHS, range.value.to > day ? day : range.value.to, conv.value))
const monthsWithData = computed(() => months.value.filter(m => m.flow.expenses.count || m.flow.income.count).length)
const monthPoints = computed(() => months.value.map(m => ({ key: m.month, label: formatMonth(m.month).slice(0, 3), title: formatMonth(m.month), values: [m.flow.income.value, m.flow.expenses.value] })))

// ---------- Budget vs actual (monthly budgets, for the month the range starts in) ----------
const budgetRows = computed(() => store.limits.items.value
  .filter(l => l.period === 'month')
  .map(l => ({ l, s: budgetStatus(l, all.value, range.value.from, conv.value, { weekStart: settings.value.weekStart, alerts: settings.value.alerts, overAlert: settings.value.overAlert, today: day }) }))
  .sort((a, b) => Number(b.l.scope === 'overall') - Number(a.l.scope === 'overall') || (b.s.share ?? 0) - (a.s.share ?? 0)))

// ---------- Other splits ----------
const recurringSplit = computed(() => {
  const rec = spent.value.filter(t => t.recurringId)
  const one = spent.value.filter(t => !t.recurringId)
  return [
    { key: 'recurring', label: 'Recurring bills', color: 'c7', value: total(rec, conv.value).value, detail: `${rec.length} payments` },
    { key: 'other', label: 'Everything else', color: 'c2', value: total(one, conv.value).value, detail: `${one.length} payments` }
  ].filter(r => r.value)
})
const METHOD_COLORS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8']
const byMethod = computed(() => groupTotals(spent.value, t => t.method || 'other', conv.value).map(s => ({
  key: s.key, label: methodName(s.key) || 'Not set',
  color: (METHOD_COLORS[settings.value.methods.findIndex(m => m.id === s.key)] ?? 'gray') as string,
  value: s.total.value, detail: `${s.total.count} payments`
})))
const topDays = computed(() => daily.value.filter(d => d.total.count).sort((a, b) => (b.total.value ?? 0) - (a.total.value ?? 0)).slice(0, 5))
const topSpends = computed(() => [...spent.value].sort((a, b) => (conv.value(b.amount, b.currency) ?? 0) - (conv.value(a.amount, a.currency) ?? 0)).slice(0, 5))

const goalsProgress = computed(() => store.goals.items.value.filter(g => !g.archived).map((g) => {
  const saved = store.contributions.items.value.filter(c => c.goalId === g.id).reduce((n, c) => n + (c.type === 'deposit' ? c.amount : -c.amount), 0)
  return { g, saved, share: g.target ? saved / g.target : 0 }
}))

const titleOf = (t: BudgetTransaction) => t.note || categoryById.value.get(t.subcategoryId || t.categoryId)?.name || 'Expense'
const showTxs = (extra: Record<string, string>) => go('transactions', { from: range.value.from, to: range.value.to, kind: 'expense', ...extra })
</script>

<template>
  <div>
    <div class="b-head">
      <h2>Reports</h2>
      <BudgetRangePicker v-model="range" v-model:mode="mode" :week-start="settings.weekStart" :modes="['month', 'custom']" />
    </div>

    <div v-if="!all.length" class="panel">
      <EmptyState title="No data to report on yet" icon="budget" action="Add expense" @action="store.openEntry()">
        Reports fill in as you log spending and income.
      </EmptyState>
    </div>

    <template v-else>
      <section class="panel b-panel summary">
        <div>
          <span class="lbl">Spent</span>
          <strong class="b-num">{{ money(flow.expenses.value) }}</strong>
          <span v-if="change(flow.expenses.value, prev.flow.expenses.value) !== undefined" class="b-muted">{{ pctText(change(flow.expenses.value, prev.flow.expenses.value)) }} vs {{ mode === 'month' ? formatMonth(prev.r.from) : 'the period before' }}</span>
        </div>
        <div>
          <span class="lbl">Income</span>
          <strong class="b-num income">{{ money(flow.income.value) }}</strong>
          <span v-if="change(flow.income.value, prev.flow.income.value) !== undefined" class="b-muted">{{ pctText(change(flow.income.value, prev.flow.income.value)) }} vs before</span>
        </div>
        <div>
          <span class="lbl">Net cash flow</span>
          <strong class="b-num" :class="{ over: (flow.net ?? 0) < 0 }">{{ money(flow.net, { signed: true }) }}</strong>
          <span class="b-muted">{{ flow.savingsRate !== undefined ? `Savings rate ${Math.round(flow.savingsRate * 100)}%` : 'No income logged' }}</span>
        </div>
        <div>
          <span class="lbl">Average a day</span>
          <strong class="b-num">{{ perDay !== undefined ? money(perDay) : '—' }}</strong>
          <span class="b-muted">{{ perDay !== undefined ? `over ${daysSoFar} days` : 'Needs a week of data' }}</span>
        </div>
      </section>
      <BudgetRateNote :totals="[flow.expenses, flow.income]" />

      <div class="b-grid b-gap">
        <section class="panel b-panel">
          <h3>Spending by category</h3>
          <BudgetShareList v-if="byCategory.length" :rows="byCategory" :format="v => money(v)" @pick="k => (drill = drill === k ? '' : k)" />
          <p v-else class="b-muted">Nothing spent in this period.</p>
          <p v-if="byCategory.length" class="b-muted hint">Pick a category to see its subcategories.</p>
        </section>
        <section class="panel b-panel">
          <div class="h-row">
            <h3>{{ drill ? `${categoryById.get(drill)?.name} by subcategory` : 'Top subcategories' }}</h3>
            <button v-if="drill" type="button" class="link" @click="drill = ''">All</button>
          </div>
          <BudgetShareList v-if="bySub.length" :rows="bySub" :format="v => money(v)" :limit="drill ? 0 : 8" @pick="k => showTxs({ cat: categoryById.get(k)?.parentId ?? '', sub: k })" />
          <p v-else class="b-muted">Nothing spent here in this period.</p>
        </section>
      </div>

      <section v-if="daily.length > 1 && daily.length <= 92" class="panel b-panel b-gap">
        <h3>Daily spending</h3>
        <BudgetBars :points="dailyPoints" :series="[{ name: 'Spent', color: 'var(--budget-expense)' }]" :format="v => money(v)" :label-every="daily.length > 16 ? 5 : 1" caption="Spending per day" @pick="d => go('transactions', { from: d, to: d })" />
      </section>

      <div class="b-grid b-gap">
        <section class="panel b-panel">
          <h3>Week over week</h3>
          <BudgetBars :points="weekPoints" :series="[{ name: 'Spent', color: 'var(--budget-expense)' }]" :format="v => money(v)" :label-every="2" caption="Spending per week, last 8 weeks" @pick="k => go('transactions', { from: k, to: addDays(k, 6), kind: 'expense' })" />
          <p v-if="lastTwoWeeks[0]!.total.value && lastTwoWeeks[1]!.total.value !== undefined" class="b-muted">
            {{ lastTwoWeeks[1]!.r.from <= day && day <= lastTwoWeeks[1]!.r.to ? 'This week so far' : 'The latest week' }}: {{ money(lastTwoWeeks[1]!.total.value) }},
            {{ pctText(change(lastTwoWeeks[1]!.total.value, lastTwoWeeks[0]!.total.value)) }} vs the week before.
          </p>
        </section>
        <section class="panel b-panel">
          <h3>Income vs expenses</h3>
          <template v-if="monthsWithData >= 2">
            <BudgetBars :points="monthPoints" :series="[{ name: 'Income', color: 'var(--budget-income)' }, { name: 'Expenses', color: 'var(--budget-expense)' }]" :format="v => money(v)" caption="Income and expenses per month, last 6 months" />
          </template>
          <p v-else class="b-muted">Month-over-month comparisons appear once there are at least two months of data.</p>
        </section>
      </div>

      <section v-if="monthsWithData >= 2" class="panel b-panel b-gap">
        <h3>Month over month</h3>
        <table class="tbl">
          <thead><tr><th>Month</th><th class="r">Spent</th><th class="r">Change</th><th class="r">Income</th><th class="r">Net</th></tr></thead>
          <tbody>
            <tr v-for="(m, i) in months" :key="m.month">
              <td>{{ formatMonth(m.month) }}<span v-if="monthOf(m.month) === monthOf(day)" class="b-muted"> (so far)</span></td>
              <td class="r b-num">{{ m.flow.expenses.count ? money(m.flow.expenses.value) : '—' }}</td>
              <td class="r b-num b-muted">{{ i && months[i - 1]!.flow.expenses.count && m.flow.expenses.count ? pctText(change(m.flow.expenses.value, months[i - 1]!.flow.expenses.value)) : '' }}</td>
              <td class="r b-num">{{ m.flow.income.count ? money(m.flow.income.value) : '—' }}</td>
              <td class="r b-num" :class="{ over: (m.flow.net ?? 0) < 0 }">{{ m.flow.expenses.count || m.flow.income.count ? money(m.flow.net, { signed: true }) : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="budgetRows.length" class="panel b-panel b-gap">
        <h3>Budget vs actual · {{ formatMonth(range.from) }}</h3>
        <table class="tbl">
          <thead><tr><th>Budget</th><th class="r">Limit</th><th class="r">Actual</th><th class="r">Difference</th><th>Status</th></tr></thead>
          <tbody>
            <tr v-for="{ l, s } in budgetRows" :key="l.id">
              <td>{{ l.scope === 'overall' ? 'Overall' : categoryPath(l.targetId, store.categories.items.value) }}</td>
              <td class="r b-num">{{ money(s.limit) }}</td>
              <td class="r b-num">{{ money(s.spent.value) }}</td>
              <td class="r b-num" :class="{ over: (s.remaining ?? 0) < 0 }">{{ s.remaining === undefined ? '…' : s.remaining < 0 ? `${money(-s.remaining)} over` : `${money(s.remaining)} under` }}</td>
              <td><span class="badge" :class="s.level === 'over' ? 'bad' : s.level === 'ok' ? 'good' : 'warn'">{{ s.share === undefined ? '…' : `${Math.round(s.share * 100)}%` }}</span></td>
            </tr>
          </tbody>
        </table>
      </section>

      <div class="b-grid b-gap">
        <section class="panel b-panel">
          <h3>Recurring vs one-off</h3>
          <BudgetShareList v-if="recurringSplit.length" :rows="recurringSplit" :format="v => money(v)" :clickable="false" />
          <p v-else class="b-muted">Nothing spent in this period.</p>
        </section>
        <section class="panel b-panel">
          <h3>Payment methods</h3>
          <BudgetShareList v-if="byMethod.length" :rows="byMethod" :format="v => money(v)" @pick="k => showTxs({ method: k })" />
          <p v-else class="b-muted">Nothing spent in this period.</p>
        </section>
        <section class="panel b-panel">
          <h3>Highest spending days</h3>
          <ol v-if="topDays.length" class="rank">
            <li v-for="d in topDays" :key="d.date">
              <button type="button" class="link" @click="go('transactions', { from: d.date, to: d.date })">{{ formatDay(d.date) }}</button>
              <span class="b-num">{{ money(d.total.value) }}</span>
            </li>
          </ol>
          <p v-else class="b-muted">Nothing spent in this period.</p>
          <h3 v-if="topSpends.length" class="sub-h">Biggest single expenses</h3>
          <ol v-if="topSpends.length" class="rank">
            <li v-for="t in topSpends" :key="t.id">
              <button type="button" class="link" @click="store.openEntry(undefined, t)">{{ titleOf(t) }}</button>
              <span class="b-num">{{ formatMoney(t.amount, t.currency) }}</span>
            </li>
          </ol>
        </section>
        <section v-if="goalsProgress.length" class="panel b-panel">
          <h3>Savings progress</h3>
          <ul class="goals">
            <li v-for="x in goalsProgress" :key="x.g.id">
              <span class="g-top"><strong>{{ x.g.name }}</strong><span class="b-num">{{ formatMoney(x.saved, x.g.currency) }} / {{ formatMoney(x.g.target, x.g.currency) }}</span></span>
              <span class="g-bar" role="meter" :aria-label="`${x.g.name}`" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="Math.min(100, Math.round(x.share * 100))"><span :style="{ width: `${Math.min(100, x.share * 100)}%` }" /></span>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));
  gap: 1rem;
}

.summary div {
  display: flex;
  flex-direction: column;
}

.lbl {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-2);
}

.summary strong {
  font-size: clamp(1.35rem, 2.5vw, 1.7rem);
  letter-spacing: -0.02em;
}

.income {
  color: var(--budget-income-ink);
}

.over {
  color: var(--bad-ink);
}

.hint {
  margin: 0.5rem 0 0;
  font-size: var(--text-xs);
}

.h-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.tbl th,
.tbl td {
  padding: 0.45rem 0.4rem;
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

section:has(> .tbl) {
  overflow-x: auto;
}

.rank {
  margin: 0;
  padding-left: 1.2rem;
}

.rank li {
  padding: 0.25rem 0;
}

.rank li {
  display: list-item;
}

.rank li .b-num {
  float: right;
  font-weight: 700;
}

.sub-h {
  margin-top: 1rem !important;
}

.goals {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.g-top {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: var(--text-sm);
}

.g-bar {
  display: block;
  height: 8px;
  margin-top: 0.3rem;
  border-radius: var(--radius-pill);
  background: var(--surface-2);
  overflow: hidden;
}

.g-bar span {
  display: block;
  height: 100%;
  background: var(--budget-c3);
  border-radius: inherit;
}
</style>
