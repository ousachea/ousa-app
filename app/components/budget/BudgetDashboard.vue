<script setup lang="ts">
import type { RangeMode } from './BudgetRangePicker.vue'
import { billStatus, budgetStatus, cashFlow, categoryPath, dailyTotals, expensesIn, groupTotals, total } from '~/utils/budget/calc'
import { addDays, daysInMonth, formatDay, inRange, monthRange, today, weekRange, type DateRange } from '~/utils/budget/dates'

const store = useBudget()
const { transactions, settings, conv, money, categoryById, go } = store

// The how-to guide: shown until hidden (starts hidden so it never flashes for people who closed it)
const guideHidden = useRemembered<boolean>('budget-guide-hidden', true, v => typeof v === 'boolean', () => false)
const showGuide = computed(() => !guideHidden.value && !store.demo.value)

const mode = ref<RangeMode>('month')
const range = ref<DateRange>(monthRange(today()))
const all = computed(() => transactions.items.value)
const day = today()

// ---------- Totals ----------
const todayTotal = computed(() => total(expensesIn(all.value, { from: day, to: day }), conv.value))
const weekR = computed(() => weekRange(day, settings.value.weekStart))
const weekTotal = computed(() => total(expensesIn(all.value, weekR.value), conv.value))
const flow = computed(() => cashFlow(all.value, range.value, conv.value))
const opts = computed(() => ({ weekStart: settings.value.weekStart, alerts: settings.value.alerts, overAlert: settings.value.overAlert, today: day }))

// The overall monthly budget, for the month this range sits in
const overall = computed(() => store.limits.items.value.find(l => l.scope === 'overall' && l.period === 'month'))
const overallStatus = computed(() => overall.value && budgetStatus(overall.value, all.value, range.value.from, conv.value, opts.value))

// Saved into goals in this range: a transfer, shown beside cash flow rather than inside it
const movedToGoals = computed(() => {
  const list = store.contributions.items.value.filter(c => inRange(c.date, range.value))
  const dep = total(list.filter(c => c.type === 'deposit'), conv.value).value
  const wd = total(list.filter(c => c.type === 'withdrawal'), conv.value).value
  return dep === undefined || wd === undefined ? undefined : dep - wd
})

const pct = (v: number | undefined) => (v === undefined ? '…' : `${Math.round(v * 100)}%`)

// ---------- Alerts ----------
const alerts = computed(() => store.limits.items.value
  .map(l => ({ l, s: budgetStatus(l, all.value, day, conv.value, opts.value) }))
  .filter(x => x.s.level !== 'ok')
  .sort((a, b) => (b.s.share ?? 0) - (a.s.share ?? 0)))
const limitName = (scope: string, id: string) => (scope === 'overall' ? 'Overall budget' : categoryPath(id, store.categories.items.value))
const PERIOD = { month: 'this month', week: 'this week', day: 'today' } as const

// ---------- Trend ----------
const days = computed(() => dailyTotals(all.value, range.value, conv.value))
const trendPoints = computed(() => days.value.map(d => ({
  key: d.date,
  label: String(Number(d.date.slice(8))),
  title: formatDay(d.date),
  values: [d.total.value]
})))
const dailyGuide = computed(() => {
  const s = overallStatus.value
  if (!s?.limit || days.value.length > 31) return undefined
  return { value: s.limit / daysInMonth(range.value.from), label: `${money(s.limit / daysInMonth(range.value.from))}/day budget` }
})

// ---------- Categories ----------
const byCategory = computed(() => groupTotals(expensesIn(all.value, range.value), t => t.categoryId, conv.value).map(s => {
  const c = categoryById.value.get(s.key)
  return { key: s.key, label: c?.name ?? 'Deleted category', icon: c?.icon, color: c?.color, value: s.total.value, detail: `${s.total.count} ${s.total.count === 1 ? 'payment' : 'payments'}` }
}))

// ---------- Bills ----------
const bills = computed(() => store.recurring.items.value
  .filter(r => r.active)
  .map(r => ({ r, s: billStatus(r, all.value, day) }))
  .filter(x => x.s.state === 'overdue' || (x.s.next && x.s.next <= addDays(day, 14)))
  .sort((a, b) => (a.s.overdue[0] ?? a.s.next ?? '').localeCompare(b.s.overdue[0] ?? b.s.next ?? ''))
  .slice(0, 6))

const recent = computed(() => [...all.value].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 6))
const w = computed(() => settings.value.widgets)
const showTxs = (r: DateRange, extra: Record<string, string> = {}) => go('transactions', { from: r.from, to: r.to, ...extra })
</script>

<template>
  <div class="dash">
    <div class="b-head">
      <h2>Dashboard</h2>
      <button v-if="guideHidden && !store.demo.value" type="button" class="btn btn-quiet btn-sm how" @click="guideHidden = false">How to use</button>
      <BudgetRangePicker v-model="range" v-model:mode="mode" :week-start="settings.weekStart" />
    </div>

    <BudgetGuide v-if="showGuide" @hide="guideHidden = true" />

    <div v-if="!all.length && !showGuide" class="panel">
      <EmptyState title="Nothing logged yet" icon="budget" action="Add your first expense" @action="store.openEntry()">
        Log what you spend as it happens, add your income, and set a monthly budget to see what’s left. Tap the app icon to try it with example data first.
      </EmptyState>
    </div>

    <template v-else-if="all.length">
      <section v-if="w.totals" class="cards" aria-label="Totals">
        <button type="button" class="panel card" @click="showTxs({ from: day, to: day }, { kind: 'expense' })">
          <span class="label">Spent today</span>
          <strong class="b-num">{{ money(todayTotal.value) }}</strong>
          <span class="sub">{{ todayTotal.count }} {{ todayTotal.count === 1 ? 'payment' : 'payments' }}</span>
        </button>
        <button type="button" class="panel card" @click="showTxs(weekR, { kind: 'expense' })">
          <span class="label">This week</span>
          <strong class="b-num">{{ money(weekTotal.value) }}</strong>
          <span class="sub">{{ formatDay(weekR.from, { day: 'numeric', month: 'short' }) }} – {{ formatDay(weekR.to, { day: 'numeric', month: 'short' }) }}</span>
        </button>
        <button type="button" class="panel card" @click="showTxs(range, { kind: 'expense' })">
          <span class="label">Spent {{ mode === 'month' ? 'this month' : 'in this period' }}</span>
          <strong class="b-num">{{ money(flow.expenses.value) }}</strong>
          <span class="sub">{{ flow.expenses.count }} {{ flow.expenses.count === 1 ? 'payment' : 'payments' }}</span>
        </button>
        <button type="button" class="panel card" @click="showTxs(range, { kind: 'income' })">
          <span class="label">Income</span>
          <strong class="b-num income">{{ money(flow.income.value) }}</strong>
          <span class="sub">{{ flow.income.count ? `${flow.income.count} ${flow.income.count === 1 ? 'payment' : 'payments'}` : 'None logged' }}</span>
        </button>
        <button type="button" class="panel card" @click="go('budgets')">
          <span class="label">{{ overallStatus && (overallStatus.remaining ?? 0) < 0 ? 'Over budget by' : 'Left in budget' }}</span>
          <strong v-if="overallStatus" class="b-num" :class="{ over: (overallStatus.remaining ?? 0) < 0 }">{{ money(overallStatus.remaining === undefined ? undefined : Math.abs(overallStatus.remaining)) }}</strong>
          <strong v-else class="none">No budget</strong>
          <span class="sub">{{ overallStatus ? `${pct(overallStatus.share)} of ${money(overallStatus.limit)} used` : 'Set a monthly budget' }}</span>
        </button>
        <button type="button" class="panel card" @click="go('reports')">
          <span class="label">Net cash flow</span>
          <strong class="b-num" :class="{ over: (flow.net ?? 0) < 0, saved: (flow.net ?? 0) > 0 }">{{ money(flow.net, { signed: true }) }}</strong>
          <span class="sub">
            <template v-if="flow.savingsRate !== undefined">Kept {{ pct(flow.savingsRate) }} of income</template>
            <template v-else>Income minus spending</template>
            <template v-if="movedToGoals"> · {{ money(movedToGoals) }} to goals</template>
          </span>
        </button>
      </section>
      <BudgetRateNote :totals="[flow.expenses, flow.income]" />

      <BudgetGauges v-if="w.gauges" class="b-gap" :range="range" />

      <div class="b-grid b-gap">
        <section v-if="w.alerts && alerts.length" class="panel b-panel alerts">
          <h3>Budget alerts</h3>
          <ul>
            <li v-for="a in alerts" :key="a.l.id">
              <button type="button" class="alert" @click="go('budgets', { hl: a.l.id })">
                <span class="alert-name">{{ limitName(a.l.scope, a.l.targetId) }} <span class="b-muted">{{ PERIOD[a.l.period] }}</span></span>
                <BudgetMeter :share="a.s.share" :level="a.s.level" :label="limitName(a.l.scope, a.l.targetId)" />
                <span class="b-muted b-num">{{ money(a.s.spent.value) }} of {{ money(a.s.limit) }}</span>
              </button>
            </li>
          </ul>
        </section>

        <section v-if="w.categories" class="panel b-panel">
          <h3>Top categories</h3>
          <BudgetShareList v-if="byCategory.length" :rows="byCategory" :format="v => money(v)" :limit="6" @pick="k => showTxs(range, { cat: k })" />
          <p v-else class="b-muted">Nothing spent in this period.</p>
        </section>

        <section v-if="w.bills" class="panel b-panel">
          <h3>Upcoming bills</h3>
          <ul v-if="bills.length" class="bills">
            <li v-for="b in bills" :key="b.r.id">
              <button type="button" class="bill" @click="go('recurring', { hl: b.r.id })">
                <span>{{ categoryById.get(b.r.subcategoryId || b.r.categoryId)?.icon ?? '🧾' }}</span>
                <span class="bill-name">{{ b.r.name }}
                <span class="badge" :class="b.s.state === 'overdue' ? 'bad' : b.s.state === 'today' || b.s.state === 'soon' ? 'warn' : 'info'">
                  {{ b.s.state === 'overdue' ? `Overdue since ${formatDay(b.s.overdue[0]!, { day: 'numeric', month: 'short' })}` : b.s.state === 'today' ? 'Due today' : `Due ${formatDay(b.s.next!, { weekday: 'short', day: 'numeric', month: 'short' })}` }}
                </span></span>
                <span class="b-num amt">{{ formatMoney(b.r.amount, b.r.currency) }}</span>
              </button>
            </li>
          </ul>
          <p v-else class="b-muted">No bills due in the next two weeks. <button type="button" class="link" @click="go('recurring')">Add a bill</button></p>
        </section>
      </div>

      <section v-if="w.trend && days.length > 1 && days.length <= 92" class="panel b-panel b-gap">
        <h3>Daily spending</h3>
        <BudgetBars
          :points="trendPoints"
          :series="[{ name: 'Spent', color: 'var(--budget-expense)' }]"
          :format="v => money(v)"
          :label-every="days.length > 16 ? 5 : 1"
          :guide="dailyGuide"
          caption="Spending per day"
          @pick="d => showTxs({ from: d, to: d })"
        />
      </section>

      <section v-if="w.recent" class="panel b-panel b-gap">
        <div class="b-head" style="margin-bottom: 0.25rem">
          <h3 style="margin: 0">Recent transactions</h3>
          <button type="button" class="link" @click="go('transactions')">See all</button>
        </div>
        <BudgetTxList :items="recent" compact />
      </section>
    </template>
  </div>
</template>

<style scoped>
.how {
  margin-right: auto;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 12.5rem), 1fr));
  gap: 0.75rem;
}

/* Phones: two totals a row, so the month fits on one screen */
@media (max-width: 640px) {
  .cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .card {
    padding: 0.8rem 0.85rem !important;
  }

  .card strong {
    font-size: 1.25rem !important;
  }
}

.card {
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  font: inherit;
  color: inherit;
  text-align: left;
  border: 0;
  cursor: pointer;
  transition: box-shadow var(--dur-fast), transform var(--dur-fast) var(--ease-out);
}

.card:hover {
  box-shadow: var(--shadow-md);
}

.card:active {
  transform: scale(0.99);
}

.label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-2);
}

.card strong {
  font-size: clamp(1.4rem, 2.6vw, 1.75rem);
  line-height: 1.15;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
}

.card strong.none {
  font-size: var(--text-title);
  color: var(--ink-3);
}

.income {
  color: var(--budget-income-ink);
}

.over {
  color: var(--bad-ink);
}

.saved {
  color: var(--budget-save-ink);
}

.sub {
  font-size: var(--text-xs);
  color: var(--ink-2);
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.alerts ul {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.alert,
.bill {
  width: 100%;
  padding: 0.5rem;
  margin-inline: -0.5rem;
  box-sizing: content-box;
  font: inherit;
  color: inherit;
  text-align: left;
  background: none;
  border: 0;
  border-radius: var(--radius);
  cursor: pointer;
}

.alert:hover,
.bill:hover {
  background: var(--surface-2);
}

.alert {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.alert-name {
  font-weight: 600;
}

.bill {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.bill-name {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2rem 0.5rem;
  font-weight: 600;
}

.amt {
  font-weight: 700;
}
</style>
