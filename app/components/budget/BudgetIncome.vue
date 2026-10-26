<script setup lang="ts">
import type { RangeMode } from './BudgetRangePicker.vue'
import { cashFlow, groupTotals, incomeIn } from '~/utils/budget/calc'
import { monthRange, today, type DateRange } from '~/utils/budget/dates'

// Income on its own: by source, with what was kept after spending. Never mixed into expense totals.
const store = useBudget()
const { transactions, settings, conv, money, categoryById, go } = store

const mode = ref<RangeMode>('month')
const range = ref<DateRange>(monthRange(today()))
const list = computed(() => incomeIn(transactions.items.value, range.value).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? '').localeCompare(a.createdAt ?? '')))
const flow = computed(() => cashFlow(transactions.items.value, range.value, conv.value))
const bySource = computed(() => groupTotals(list.value, t => t.categoryId, conv.value).map((s) => {
  const c = categoryById.value.get(s.key)
  return { key: s.key, label: c?.name ?? 'Deleted source', icon: c?.icon, color: 'c1', value: s.total.value, detail: `${s.total.count} ${s.total.count === 1 ? 'payment' : 'payments'}` }
}))
const pct = (v?: number) => (v === undefined ? '…' : `${Math.round(v * 100)}%`)
</script>

<template>
  <div>
    <div class="b-head">
      <h2>Income</h2>
      <div class="b-row">
        <BudgetRangePicker v-model="range" v-model:mode="mode" :week-start="settings.weekStart" />
        <button type="button" class="btn" @click="store.openEntry({ kind: 'income' })">+ Income</button>
      </div>
    </div>

    <section class="panel b-panel stats">
      <div>
        <span class="lbl">Income</span>
        <strong class="b-num income">{{ money(flow.income.value) }}</strong>
      </div>
      <div>
        <span class="lbl">Spent</span>
        <strong class="b-num">{{ money(flow.expenses.value) }}</strong>
      </div>
      <div>
        <span class="lbl">{{ (flow.net ?? 0) < 0 ? 'Spent more than earned' : 'Kept' }}</span>
        <strong class="b-num" :class="{ over: (flow.net ?? 0) < 0 }">{{ money(flow.net === undefined ? undefined : Math.abs(flow.net)) }}</strong>
        <span class="b-muted">{{ flow.savingsRate !== undefined ? `${pct(flow.savingsRate)} of income` : '' }}</span>
      </div>
    </section>
    <BudgetRateNote :totals="[flow.income, flow.expenses]" />

    <div v-if="!list.length" class="panel b-gap">
      <EmptyState title="No income in this period" icon="budget" action="+ Income" @action="store.openEntry({ kind: 'income' })">
        Log your salary, freelance work, business income or gifts to see what you keep after spending. Moving money between your own accounts isn’t income, so there’s no need to log it.
      </EmptyState>
    </div>
    <div v-else class="b-grid b-gap">
      <section class="panel b-panel">
        <h3>By source</h3>
        <BudgetShareList :rows="bySource" :format="v => money(v)" @pick="k => go('transactions', { kind: 'income', cat: k, from: range.from, to: range.to })" />
      </section>
      <section class="panel b-panel">
        <h3>Payments</h3>
        <BudgetTxList :items="list" />
      </section>
    </div>
  </div>
</template>

<style scoped>
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));
  gap: 1rem;
}

.stats div {
  display: flex;
  flex-direction: column;
}

.lbl {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-2);
}

.stats strong {
  font-size: clamp(1.4rem, 2.6vw, 1.8rem);
  letter-spacing: -0.02em;
}

.income {
  color: var(--budget-income-ink);
}

.over {
  color: var(--bad-ink);
}
</style>
