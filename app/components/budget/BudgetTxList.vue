<script setup lang="ts">
import type { BulkSelect } from '~/composables/useBulkSelect'
import type { BudgetTransaction } from '~/utils/budget/types'
import { formatDay } from '~/utils/budget/dates'
import { total } from '~/utils/budget/calc'

// Transactions as rows, optionally grouped by day with each day's total. Tapping a row edits it.
const props = withDefaults(defineProps<{ items: BudgetTransaction[], grouped?: boolean, select?: BulkSelect, compact?: boolean }>(), { grouped: false, select: undefined, compact: false })
const store = useBudget()
const { categoryById, methodName, conv, money } = store
const { play } = useSound()

const days = computed(() => {
  if (!props.grouped) return [{ date: '', list: props.items }]
  const out: { date: string, list: BudgetTransaction[] }[] = []
  for (const t of props.items) {
    const last = out.at(-1)
    if (last?.date === t.date) last.list.push(t)
    else out.push({ date: t.date, list: [t] })
  }
  return out
})

const dayTotal = (list: BudgetTransaction[]) => total(list.filter(t => t.kind === 'expense'), conv.value).value

function titleOf(t: BudgetTransaction) {
  if (t.note) return t.note
  const c = categoryById.value.get(t.subcategoryId || t.categoryId)
  return c?.name ?? (t.kind === 'income' ? 'Income' : 'Expense')
}

function detailOf(t: BudgetTransaction) {
  const cat = categoryById.value.get(t.categoryId)
  const sub = categoryById.value.get(t.subcategoryId)
  const where = t.kind === 'income' ? cat?.name ?? 'Income' : [cat?.name ?? 'Deleted category', sub?.name].filter(Boolean).join(' › ')
  return [where, t.merchant, methodName(t.method), t.recurringId ? 'Bill' : '', ...t.tags.map(x => `#${x}`)].filter(Boolean).join(' · ')
}

function del(t: BudgetTransaction) {
  const removed = store.transactions.remove(t.id)
  play('delete')
  toastDeleted(t.note || formatMoney(t.amount, t.currency), () => removed && store.transactions.restore(removed))
}
</script>

<template>
  <div class="tx-list" :class="{ compact }">
    <section v-for="d in days" :key="d.date || 'all'" class="day">
      <h4 v-if="grouped" class="day-head">
        <span>{{ formatDay(d.date, { weekday: 'long', day: 'numeric', month: 'short' }) }}</span>
        <span v-if="dayTotal(d.list)" class="day-total">−{{ money(dayTotal(d.list)) }}</span>
      </h4>
      <TransitionGroup tag="ul" name="list">
        <li
          v-for="t in d.list"
          :key="t.id"
          :data-item-id="t.id"
          class="tx bulk-row"
          :class="{ 'bulk-picked': select?.has(t.id) }"
          :data-bulk="select?.selecting || undefined"
          v-swipe-delete="() => del(t)"
          @click.capture="select?.onRowClick($event, t.id)"
        >
          <BulkCheck v-if="select?.selecting" inline :checked="select.has(t.id)" :label="`Select ${titleOf(t)}`" @pick="select.pick(t.id, $event)" />
          <span class="icon" :class="`slot-${categoryById.get(t.categoryId)?.color ?? 'gray'}`" aria-hidden="true">{{ categoryById.get(t.subcategoryId || t.categoryId)?.icon ?? '🧾' }}</span>
          <button type="button" class="what" :aria-label="`Edit ${titleOf(t)}, ${formatMoney(t.amount, t.currency)}`" @click="store.openEntry(undefined, t)">
            <strong>{{ titleOf(t) }}</strong>
            <span class="detail">{{ grouped ? '' : `${formatDay(t.date, { day: 'numeric', month: 'short' })} · ` }}{{ detailOf(t) }}</span>
          </button>
          <span class="amount" :class="t.kind">{{ t.kind === 'income' ? '+' : '−' }}{{ formatMoney(t.amount, t.currency) }}</span>
          <span v-if="!compact" class="row-actions"><ConfirmDelete :name="titleOf(t)" @confirm="del(t)" /></span>
        </li>
      </TransitionGroup>
    </section>
  </div>
</template>

<style scoped>
.day + .day {
  margin-top: 0.5rem;
}

.day-head {
  position: sticky;
  top: 0;
  z-index: 1;
  margin: 0;
  padding: 0.5rem 0 0.35rem;
  display: flex;
  justify-content: space-between;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--ink-3);
  background: var(--surface);
  border-bottom: 1px solid var(--line);
}

.day-total {
  font-variant-numeric: tabular-nums;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.tx {
  min-height: 3.25rem;
  padding: 0.35rem 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.tx + .tx {
  border-top: 1px solid color-mix(in srgb, var(--line) 60%, transparent);
}

.icon {
  flex: none;
  width: 2.25rem;
  height: 2.25rem;
  display: grid;
  place-items: center;
  font-size: 1.1rem;
  border-radius: 10px;
  background: color-mix(in srgb, var(--slot) 16%, var(--surface));
}

.what {
  flex: 1;
  min-width: 0;
  padding: 0.2rem 0;
  display: flex;
  flex-direction: column;
  text-align: left;
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}

.what strong,
.what .detail {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.what:hover strong {
  text-decoration: underline;
}

.detail {
  font-size: var(--text-xs);
  color: var(--ink-2);
}

.amount {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.amount.income {
  color: var(--budget-income-ink);
}

.row-actions {
  flex: none;
  color: var(--ink-2);
}

.compact .tx {
  min-height: 2.75rem;
}
</style>
