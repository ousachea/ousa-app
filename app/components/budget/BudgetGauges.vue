<script setup lang="ts">
import { budgetStatus, cashFlow, expensesIn, groupTotals, LEVELS, total } from '~/utils/budget/calc'
import { daysBetween, formatDay, formatMonth, inRange, rangeDays, today, type DateRange } from '~/utils/budget/dates'

// The dashboard's dials: the period's numbers as gauges you switch between. Every figure comes from the
// same calc functions as the totals above, so a dial and a card never disagree. Only the dials the data
// can fill are offered (no monthly budget, no budget dials); the last one picked is remembered.
const props = defineProps<{ range: DateRange }>()

const store = useBudget()
const { transactions, settings, conv, money, categoryById, go } = store
const all = computed(() => transactions.items.value)
const day = today()

type View = 'progress' | 'remaining' | 'pace' | 'categories' | 'flow' | 'savings'
const VIEWS: { value: View, label: string }[] = [
  { value: 'progress', label: 'Budget' },
  { value: 'remaining', label: 'Left' },
  { value: 'pace', label: 'Month pace' },
  { value: 'categories', label: 'Categories' },
  { value: 'flow', label: 'In vs out' },
  { value: 'savings', label: 'Savings' }
]
const picked = useRemembered<View>('budget-gauge', 'progress', v => VIEWS.some(x => x.value === v))

// ---------- The overall monthly budget, for the month the range sits in ----------
const opts = computed(() => ({ weekStart: settings.value.weekStart, alerts: settings.value.alerts, overAlert: settings.value.overAlert, today: day }))
const overall = computed(() => store.limits.items.value.find(l => l.scope === 'overall' && l.period === 'month'))
const status = computed(() => overall.value && budgetStatus(overall.value, all.value, props.range.from, conv.value, opts.value))
const hasBudget = computed(() => !!status.value?.limit && status.value.share !== undefined)
// The first warning level, where the dial's colour turns
const warnAt = computed(() => Math.min(100, ...settings.value.alerts.filter(a => a > 0 && a < 100)) / 100)
const LEVEL_COLOR = { ok: 'var(--budget-ok)', warn: 'var(--budget-warn)', reached: 'var(--budget-warn)', over: 'var(--budget-over)' } as const
const LEVEL_SYMBOL = { ok: '✓', warn: '!', reached: '!', over: '✕' } as const

// Days into the budget's month, when it's the month we're in
const month = computed(() => {
  const r = status.value?.range
  if (!r || !inRange(day, r)) return undefined
  const days = rangeDays(r)
  const gone = daysBetween(r.from, day) + 1
  return { days, gone, left: days - gone + 1, share: gone / days }
})
const pace = computed(() => {
  const s = status.value?.share
  const m = month.value
  if (s === undefined || !m) return undefined
  // Within five points of the month gone counts as on pace, so a single coffee doesn't flip it
  if (s > m.share + 0.05) return { word: 'Spending faster than the month', badge: 'warn', symbol: '!' }
  if (s < m.share - 0.05) return { word: 'Spending slower than the month', badge: 'good', symbol: '✓' }
  return { word: 'On pace with the month', badge: 'info', symbol: '=' }
})

// ---------- Categories ----------
const byCategory = computed(() => groupTotals(expensesIn(all.value, props.range), t => t.categoryId, conv.value).map((s) => {
  const c = categoryById.value.get(s.key)
  return { key: s.key, label: `${c?.icon ?? ''} ${c?.name ?? 'Deleted category'}`.trim(), value: s.total.value ?? 0, color: `var(--budget-${c?.color ?? 'gray'})`, detail: `${s.total.count} ${s.total.count === 1 ? 'payment' : 'payments'}` }
}))
const categoriesKnown = computed(() => byCategory.value.length > 0 && byCategory.value.every(c => Number.isFinite(c.value)))

// ---------- Income against spending ----------
const flow = computed(() => cashFlow(all.value, props.range, conv.value))
const flowParts = computed(() => {
  const inc = flow.value.income.value
  const out = flow.value.expenses.value
  if (inc === undefined || out === undefined) return []
  // Spending within income, then what's left of it, or what went past it: they always add up to the larger
  if (out <= inc) {
    return [
      { key: 'spent', label: 'Spent', value: out, color: 'var(--budget-expense)', detail: `${flow.value.expenses.count} ${flow.value.expenses.count === 1 ? 'payment' : 'payments'}` },
      { key: 'kept', label: 'Kept', value: inc - out, color: 'var(--budget-ok)', detail: 'Income not spent' }
    ]
  }
  return [
    { key: 'covered', label: 'Paid from income', value: inc, color: 'var(--budget-expense)', detail: inc ? `All ${money(inc)} of income` : 'No income logged' },
    { key: 'beyond', label: 'Beyond income', value: out - inc, color: 'var(--budget-over)', detail: 'Spent more than came in' }
  ]
})

// ---------- Savings goals (transfers, not spending) ----------
const savings = computed(() => {
  const goals = store.goals.items.value.filter(g => !g.archived)
  const rows = goals.map((g, i) => {
    const saved = store.contributions.items.value.filter(c => c.goalId === g.id).reduce((n, c) => n + (c.type === 'deposit' ? c.amount : -c.amount), 0)
    return { g, saved: conv.value(Math.max(0, saved), g.currency), target: conv.value(g.target, g.currency), color: `var(--budget-c${(i % 8) + 1})` }
  })
  if (rows.some(r => r.saved === undefined || r.target === undefined)) return undefined
  const target = rows.reduce((n, r) => n + r.target!, 0)
  return {
    target,
    parts: rows.map(r => ({ key: r.g.id, label: r.g.name, value: r.saved!, color: r.color, detail: `of ${money(r.target)}${r.g.targetDate ? ` by ${formatDay(r.g.targetDate, { month: 'short', year: 'numeric' })}` : ''}` }))
  }
})

// ---------- Which dials there are ----------
const available = computed(() => VIEWS.filter((v) => {
  if (v.value === 'progress' || v.value === 'remaining') return hasBudget.value
  if (v.value === 'pace') return hasBudget.value && !!month.value
  if (v.value === 'categories') return categoriesKnown.value
  if (v.value === 'flow') return flowParts.value.some(p => p.value > 0)
  return !!savings.value?.parts.length
}))
const view = computed(() => (available.value.some(v => v.value === picked.value) ? picked.value : available.value[0]?.value))

const pct = (v: number) => `${Math.round(v * 100)}%`
const showTxs = (extra: Record<string, string>) => go('transactions', { from: props.range.from, to: props.range.to, ...extra })
const spentTotal = computed(() => total(expensesIn(all.value, props.range), conv.value))
</script>

<template>
  <section v-if="available.length" class="panel b-panel gauges">
    <div class="g-head">
      <h3>At a glance</h3>
      <div class="segmented g-views" role="radiogroup" aria-label="Gauge">
        <label v-for="v in available" :key="v.value" :class="{ active: view === v.value }">
          <input v-model="picked" type="radio" name="budget-gauge" :value="v.value">{{ v.label }}
        </label>
      </div>
    </div>

    <Transition name="g-swap" mode="out-in">
      <!-- Budget used: the share of the month's budget gone, the colour turning at the first alert -->
      <div v-if="view === 'progress' && status" key="progress" class="g-body">
        <div class="dial">
          <Gauge :value="Math.min(status.share ?? 0, 1)" :min="0" :max="1" :radius="200" :padding="30" transition :initial-value="0">
            <GaugeTrack :width="40" color="var(--ink)" :opacity="0.07" />
            <GaugeZones :zones="[{ to: warnAt, color: 'var(--budget-ok)' }, { to: 1, color: 'var(--budget-warn)' }]" :width="6" :offset="-36" :opacity="0.55" :gap="1" />
            <GaugeArc :width="40" :color="LEVEL_COLOR[status.level]" />
            <GaugeMarks v-if="status.projected !== undefined && status.limit" :values="[Math.min(status.projected / status.limit, 1)]" :length="58" :width="5" color="var(--ink-2)" />
          </Gauge>
          <div class="middle">
            <strong>{{ pct(status.share ?? 0) }}</strong>
            <span class="what">of {{ money(status.limit) }} used</span>
          </div>
        </div>
        <div class="facts">
          <span class="badge" :class="LEVELS[status.level].badge"><span aria-hidden="true">{{ LEVEL_SYMBOL[status.level] }}</span> {{ LEVELS[status.level].word }}</span>
          <dl>
            <div><dt>Spent</dt><dd>{{ money(status.spent.value) }}</dd></div>
            <div><dt>Budget for {{ formatMonth(status.range.from) }}</dt><dd>{{ money(status.limit) }}</dd></div>
            <div v-if="status.projected !== undefined"><dt>At this pace</dt><dd :class="{ over: status.limit !== undefined && status.projected > status.limit }">{{ money(status.projected) }}</dd></div>
          </dl>
          <p class="b-muted fine">The thin band marks your {{ Math.round(warnAt * 100) }}% alert<template v-if="status.projected !== undefined">; the tick is where the month ends at this pace</template>.</p>
        </div>
      </div>

      <!-- Left to spend: what remains, drawn back from the end of the arc -->
      <div v-else-if="view === 'remaining' && status && status.remaining !== undefined && status.limit" key="remaining" class="g-body">
        <div class="dial">
          <Gauge :value="Math.max(0, status.remaining / status.limit)" :min="0" :max="1" :radius="200" :padding="30" transition :initial-value="0">
            <GaugeTrack :width="40" color="var(--ink)" :opacity="0.07" />
            <GaugeArc :width="40" reverse :color="status.remaining <= 0 ? 'var(--budget-over)' : (status.share ?? 0) >= warnAt ? 'var(--budget-warn)' : 'var(--budget-ok)'" />
          </Gauge>
          <div class="middle">
            <strong :class="{ over: status.remaining < 0 }">{{ money(Math.abs(status.remaining)) }}</strong>
            <span class="what">{{ status.remaining < 0 ? 'over budget' : 'left to spend' }}</span>
          </div>
        </div>
        <div class="facts">
          <span class="badge" :class="LEVELS[status.level].badge"><span aria-hidden="true">{{ LEVEL_SYMBOL[status.level] }}</span> {{ status.remaining < 0 ? `Over by ${money(-status.remaining)}` : `${pct(Math.max(0, 1 - (status.share ?? 0)))} of the budget left` }}</span>
          <dl>
            <div><dt>Budget</dt><dd>{{ money(status.limit) }}</dd></div>
            <div><dt>Spent</dt><dd>{{ money(status.spent.value) }}</dd></div>
            <div v-if="month && status.remaining > 0"><dt>Per day for {{ month.left }} {{ month.left === 1 ? 'day' : 'days' }}</dt><dd>{{ money(status.remaining / month.left) }}</dd></div>
          </dl>
        </div>
      </div>

      <!-- Month pace: the outer ring is the month gone by, the inner one the budget spent -->
      <div v-else-if="view === 'pace' && status && month && pace" key="pace" class="g-body">
        <div class="dial">
          <Gauge :value="month.share" :min="0" :max="1" :radius="200" :padding="30" transition :initial-value="0">
            <GaugeTrack :width="18" color="var(--ink)" :opacity="0.07" />
            <GaugeArc :width="18" color="var(--ink-3)" />
            <GaugeInset :value="Math.min(status.share ?? 0, 1)" :min="0" :max="1" :scale="0.78" transition :initial-value="0">
              <GaugeTrack :width="42" color="var(--ink)" :opacity="0.07" />
              <GaugeArc :width="42" :color="LEVEL_COLOR[status.level]" />
            </GaugeInset>
          </Gauge>
          <div class="middle">
            <strong>Day {{ month.gone }}</strong>
            <span class="what">of {{ month.days }}</span>
          </div>
        </div>
        <div class="facts">
          <span class="badge" :class="pace.badge"><span aria-hidden="true">{{ pace.symbol }}</span> {{ pace.word }}</span>
          <ul class="key">
            <li><span class="swatch" style="background: var(--ink-3)" />Month gone<b>{{ pct(month.share) }}</b></li>
            <li><span class="swatch" :style="{ background: LEVEL_COLOR[status.level] }" />Budget spent<b>{{ pct(status.share ?? 0) }}</b></li>
          </ul>
          <p class="b-muted fine">When the inner ring stays behind the outer one, the budget lasts the month.</p>
        </div>
      </div>

      <!-- Spending by category: stacked parts, the legend opens that category's payments -->
      <div v-else-if="view === 'categories'" key="categories" class="g-body wide">
        <GaugeParts :parts="byCategory" :format="v => money(v)" caption="spent" label="Spending by category" :selectable="false" @pick="k => showTxs({ cat: k })">
          <template #center>
            <strong>{{ money(spentTotal.value) }}</strong>
            <span class="what">{{ byCategory.length }} {{ byCategory.length === 1 ? 'category' : 'categories' }}</span>
          </template>
        </GaugeParts>
      </div>

      <!-- Income against spending: spent and kept, or what went past income -->
      <div v-else-if="view === 'flow'" key="flow" class="g-body wide">
        <GaugeParts :parts="flowParts" :format="v => money(v)" caption="in vs out" label="Income against spending" :limit="0">
          <template #center>
            <strong :class="{ over: (flow.net ?? 0) < 0, saved: (flow.net ?? 0) > 0 }">{{ money(flow.net, { signed: true }) }}</strong>
            <span class="what">{{ (flow.net ?? 0) < 0 ? 'more out than in' : flow.savingsRate !== undefined ? `kept ${pct(flow.savingsRate)} of income` : 'net' }}</span>
          </template>
        </GaugeParts>
      </div>

      <!-- Savings goals: each goal's savings against all the targets together -->
      <div v-else-if="view === 'savings' && savings" key="savings" class="g-body wide">
        <GaugeParts :parts="savings.parts" :max="savings.target" :format="v => money(v)" caption="saved" label="Savings goals" :selectable="false" @pick="go('savings')">
          <template #center="{ total: saved }">
            <strong>{{ savings.target ? pct(Math.min(saved / savings.target, 1)) : '…' }}</strong>
            <span class="what">{{ money(saved) }} of {{ money(savings.target) }}</span>
          </template>
        </GaugeParts>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.g-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  margin-bottom: 1rem;
}

.g-head h3 {
  margin: 0;
}

/* Six dials on a phone: the switch scrolls sideways rather than squeezing */
.g-views {
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
  font-size: var(--text-sm);
}

.g-views::-webkit-scrollbar {
  display: none;
}

.g-views label {
  flex: none;
  padding: 0.3rem 0.75rem;
  white-space: nowrap;
}

.gauges {
  container-type: inline-size;
}

.g-body {
  display: grid;
  gap: 1rem 2rem;
  align-items: center;
}

/* The panel, not the window, decides: the dial beside its figures once there's room */
@container (min-width: 30rem) {
  .g-body:not(.wide) {
    grid-template-columns: minmax(10rem, 15rem) minmax(0, 1fr);
  }
}

.dial {
  position: relative;
  width: 100%;
  max-width: 15rem;
  justify-self: center;
  container-type: inline-size;
}

.middle {
  position: absolute;
  inset: 22% 18% 20%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  text-align: center;
  pointer-events: none;
}

.middle strong,
.g-body :deep(.readout strong) {
  font-size: clamp(1rem, 13cqi, 2.1rem);
  font-weight: 750;
  line-height: 1.05;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.what {
  font-size: clamp(0.7rem, 5.6cqi, 0.85rem);
  font-weight: 600;
  color: var(--ink-2);
  line-height: 1.2;
}

.facts {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.85rem;
  min-width: 0;
}

dl {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr));
  gap: 0.6rem 1.25rem;
  width: 100%;
}

dt {
  font-size: var(--text-sm);
  color: var(--ink-2);
}

dd {
  margin: 0.1rem 0 0;
  font-size: var(--text-title);
  font-weight: 700;
}

.key {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  width: 100%;
}

.key li {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 600;
}

.key b {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.swatch {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: var(--radius-pill);
}

.fine {
  margin: 0;
  font-size: var(--text-xs);
}

.over {
  color: var(--bad-ink);
}

.saved {
  color: var(--budget-save-ink);
}

.g-swap-enter-active,
.g-swap-leave-active {
  transition: opacity var(--dur), scale var(--dur) var(--ease-out);
}

.g-swap-enter-from,
.g-swap-leave-to {
  opacity: 0;
  scale: 0.98;
}

@media (prefers-reduced-motion: reduce) {
  .g-swap-enter-active,
  .g-swap-leave-active {
    transition: none;
  }
}
</style>
