<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { BudgetLimit, BudgetPeriod, BudgetScope, Currency } from '~/utils/budget/types'
import { budgetStatus, categoryPath } from '~/utils/budget/calc'
import { formatRange, today } from '~/utils/budget/dates'

// Budgets at any level: the overall monthly limit, a category, or one subcategory, by month, week or day.
// Each one counts its own expenses, so a subcategory budget never adds to its category's or the overall total.
const store = useBudget()
const { limits, transactions, settings, conv, money, topCategories, subsOf, categoryById, go } = store
const { play } = useSound()
useBudgetHighlight()

const day = today()
const opts = computed(() => ({ weekStart: settings.value.weekStart, alerts: settings.value.alerts, overAlert: settings.value.overAlert, today: day }))
const nameOf = (l: Pick<BudgetLimit, 'scope' | 'targetId'>) => (l.scope === 'overall' ? 'Everything you spend' : categoryPath(l.targetId, store.categories.items.value))
const PERIOD_LABEL: Record<BudgetPeriod, string> = { month: 'a month', week: 'a week', day: 'a day' }

const rows = computed(() => limits.items.value
  .map(l => ({ l, s: budgetStatus(l, transactions.items.value, day, conv.value, opts.value) }))
  .sort((a, b) => Number(b.l.scope === 'overall') - Number(a.l.scope === 'overall') || (b.s.share ?? 0) - (a.s.share ?? 0)))
const overallRows = computed(() => rows.value.filter(r => r.l.scope === 'overall'))
const otherRows = computed(() => rows.value.filter(r => r.l.scope !== 'overall'))


// ---------- Add / edit ----------
const formOpen = ref(false)
const editingId = ref<string>()
const form = reactive({ scope: 'category' as BudgetScope, category: '', sub: '', period: 'month' as BudgetPeriod, amount: null as number | null, currency: 'USD' as Currency })

function openForm(l?: BudgetLimit, preset?: Partial<typeof form>) {
  editingId.value = l?.id
  const parent = l?.scope === 'subcategory' ? categoryById.value.get(l.targetId)?.parentId ?? '' : ''
  Object.assign(form, l
    ? { scope: l.scope, category: l.scope === 'category' ? l.targetId : parent, sub: l.scope === 'subcategory' ? l.targetId : '', period: l.period, amount: l.amount, currency: l.currency }
    : { scope: 'category', category: '', sub: '', period: 'month', amount: null, currency: settings.value.primaryCurrency, ...preset })
  formOpen.value = true
  play('open')
}

const catOptions = computed(() => topCategories.value.filter(c => c.kind === 'expense' && !c.archived).map(c => ({ value: c.id, label: c.name })))
const subOptions = computed(() => (form.category ? subsOf(form.category).filter(s => !s.archived).map(s => ({ value: s.id, label: s.name })) : []))
watch(() => form.category, () => {
  if (!subOptions.value.some(s => s.value === form.sub)) form.sub = ''
})
const targetId = computed(() => (form.scope === 'overall' ? '' : form.scope === 'category' ? form.category : form.sub))
const clash = computed(() => limits.items.value.find(l => l.id !== editingId.value && l.scope === form.scope && l.targetId === targetId.value && l.period === form.period))

function save() {
  if (!(Number(form.amount) > 0) || (form.scope !== 'overall' && !targetId.value) || clash.value) return
  const record = { scope: form.scope, targetId: targetId.value, period: form.period, amount: Number(form.amount), currency: form.currency }
  if (editingId.value) {
    const before = limits.update(editingId.value, record)
    toastSaved(before && (() => limits.replace(before)))
  } else {
    const added = limits.add(record)
    toast.success('Budget added', { description: `${nameOf(record)}: ${formatMoney(record.amount, record.currency)} ${PERIOD_LABEL[record.period]}`, action: { label: 'Undo', onClick: () => limits.remove(added.id, { undoAdd: true }) } })
  }
  play('success')
  formOpen.value = false
}

function del(l: BudgetLimit) {
  const removed = limits.remove(l.id)
  play('delete')
  toastDeleted(`${nameOf(l)} budget`, () => removed && limits.restore(removed))
  formOpen.value = false
}

const showSpending = (l: BudgetLimit, range: { from: string, to: string }) =>
  go('transactions', { from: range.from, to: range.to, kind: 'expense', ...(l.scope === 'category' ? { cat: l.targetId } : l.scope === 'subcategory' ? { cat: categoryById.value.get(l.targetId)?.parentId ?? '', sub: l.targetId } : {}) })
</script>

<template>
  <div>
    <div class="b-head">
      <h2>Budgets</h2>
      <button type="button" class="btn" @click="openForm()">+ Budget</button>
    </div>

    <p class="b-muted intro">
      Each budget counts its own spending: a coffee in Food &amp; Drinks › Coffee counts once toward a Coffee budget, once toward a Food &amp; Drinks budget and once toward your overall budget, never twice in the same one.
      Warnings at {{ settings.alerts.map(a => `${a}%`).join(', ') }} and 100%. <button type="button" class="link" @click="go('settings')">Change</button>
    </p>

    <section v-if="!overallRows.length" class="panel b-panel overall-empty">
      <div>
        <h3>Overall monthly budget</h3>
        <p class="b-muted">One limit for everything you spend in a month. Income and savings goals stay separate.</p>
      </div>
      <button type="button" class="btn" @click="openForm(undefined, { scope: 'overall' })">Set a monthly budget</button>
    </section>

    <TransitionGroup tag="div" name="list" class="list">
      <article v-for="{ l, s } in [...overallRows, ...otherRows]" :data-item-id="l.id" :key="l.id" class="panel b-panel budget" :class="{ overall: l.scope === 'overall' }">
        <div class="top">
          <span class="icon" :class="`slot-${categoryById.get(l.targetId)?.color ?? 'gray'}`" aria-hidden="true">{{ l.scope === 'overall' ? '💰' : categoryById.get(l.targetId)?.icon ?? '🧾' }}</span>
          <div class="name">
            <strong>{{ nameOf(l) }}</strong>
            <span class="b-muted">{{ formatMoney(l.amount, l.currency) }} {{ PERIOD_LABEL[l.period] }} · {{ formatRange(s.range) }}</span>
          </div>
          <button type="button" class="link" @click="openForm(l)">Edit</button>
        </div>
        <!-- The overall budget also gets a dial (components/gauge): how much is used, and a mark where the month
             is heading when that's still under the limit -->
        <div v-if="l.scope === 'overall'" class="overall-dial" :class="`is-${s.level}`" aria-hidden="true">
          <Gauge :value="Math.min(s.share ?? 0, 1)" :min="0" :max="1" :start-angle="60" :end-angle="300" :radius="200" :padding="24" fit="content" transition :initial-value="0">
            <GaugeTrack :width="28" color="var(--ink)" :opacity="0.08" />
            <GaugeArc :width="28" color="var(--dial)" />
            <GaugeMarks v-if="s.projected !== undefined && s.limit && s.projected < s.limit" :values="[s.projected / s.limit]" :length="44" :width="5" color="var(--ink-2)" />
            <GaugeText :y="-12" :font-size="76" weight="bold" color="var(--ink)">{{ s.share === undefined ? '…' : `${Math.round(s.share * 100)}%` }}</GaugeText>
            <GaugeText :y="58" :font-size="26" weight="semibold" color="var(--ink-2)">used</GaugeText>
          </Gauge>
        </div>
        <BudgetMeter :share="s.share" :level="s.level" :label="`${nameOf(l)} budget`" :pace="s.projected !== undefined && s.limit ? s.projected / s.limit : undefined" />
        <div class="figures">
          <button type="button" class="link spent" @click="showSpending(l, s.range)">Spent <strong class="b-num">{{ money(s.spent.value) }}</strong></button>
          <span v-if="s.remaining !== undefined && s.remaining >= 0">Left <strong class="b-num">{{ money(s.remaining) }}</strong></span>
          <span v-else-if="s.remaining !== undefined" class="over">Over by <strong class="b-num">{{ money(-s.remaining) }}</strong></span>
          <span v-if="s.projected !== undefined" :class="{ over: s.limit !== undefined && s.projected > s.limit }">
            Heading for <strong class="b-num">{{ money(s.projected) }}</strong> by month end
          </span>
        </div>
        <p v-if="s.level === 'over' || s.level === 'reached'" class="warn-line" role="status">
          {{ s.level === 'over' ? 'Over budget.' : 'Limit reached.' }} You can still log spending; this is just a heads-up.
        </p>
      </article>
    </TransitionGroup>

    <div v-if="!limits.items.value.length" class="panel b-gap">
      <EmptyState title="No budgets yet" icon="budget" action="+ Budget" @action="openForm()">
        Set a monthly limit for everything, or for the categories you want to keep an eye on, like Food &amp; Drinks or Entertainment.
      </EmptyState>
    </div>

    <Modal :open="formOpen" :title="editingId ? 'Edit budget' : 'Add a budget'" @close="formOpen = false">
      <form v-validate class="b-form" @submit.prevent="save">
        <div class="field">
          <span class="field-head">Budget for</span>
          <div class="segmented" role="radiogroup" aria-label="Budget for">
            <label v-for="o in [{ v: 'overall', l: 'Everything' }, { v: 'category', l: 'A category' }, { v: 'subcategory', l: 'A subcategory' }]" :key="o.v" :class="{ active: form.scope === o.v }">
              <input v-model="form.scope" type="radio" name="scope" :value="o.v">{{ o.l }}
            </label>
          </div>
        </div>
        <div v-if="form.scope !== 'overall'" class="row">
          <label class="field">
            <span class="field-head">Category</span>
            <span data-validate-target class="sel">
              <AppSelect v-model="form.category" aria-label="Category" :options="catOptions" placeholder="Choose…" searchable />
              <input class="ghost" tabindex="-1" aria-hidden="true" :value="form.category" required data-error="Choose a category">
            </span>
          </label>
          <label v-if="form.scope === 'subcategory'" class="field">
            <span class="field-head">Subcategory</span>
            <span data-validate-target class="sel">
              <AppSelect v-model="form.sub" aria-label="Subcategory" :options="subOptions" placeholder="Choose…" searchable />
              <input class="ghost" tabindex="-1" aria-hidden="true" :value="form.sub" required data-error="Choose a subcategory">
            </span>
          </label>
        </div>
        <div class="field">
          <span class="field-head">Limit</span>
          <div class="b-amount">
            <input v-model.number="form.amount" class="input" type="number" inputmode="decimal" min="0" step="any" placeholder="0" aria-label="Limit" required v-check="Number(form.amount) > 0 ? '' : 'Enter a limit above 0'" :data-keys="form.currency === 'KHR' ? 'riel' : 'money'">
            <span class="segmented" role="radiogroup" aria-label="Currency">
              <label v-for="c in (['USD', 'KHR'] as const)" :key="c" :class="{ active: form.currency === c }"><input v-model="form.currency" type="radio" name="b-currency" :value="c">{{ c === 'USD' ? '$' : '៛' }}</label>
            </span>
          </div>
        </div>
        <div class="field">
          <span class="field-head">Every</span>
          <div class="segmented" role="radiogroup" aria-label="Period">
            <label v-for="p in [{ v: 'month', l: 'Month' }, { v: 'week', l: 'Week' }, { v: 'day', l: 'Day' }]" :key="p.v" :class="{ active: form.period === p.v }">
              <input v-model="form.period" type="radio" name="period" :value="p.v">{{ p.l }}
            </label>
          </div>
        </div>
        <p v-if="clash" class="err" role="alert">There’s already a {{ form.period }}ly budget for this. Edit that one instead.</p>
        <div class="actions">
          <button type="submit" class="btn" :disabled="!!clash">{{ editingId ? 'Save changes' : 'Add budget' }}</button>
          <button type="button" class="btn btn-quiet" @click="formOpen = false">Cancel</button>
          <ConfirmDelete v-if="editingId" text name="this budget" @confirm="del(limits.items.value.find(x => x.id === editingId)!)" />
        </div>
      </form>
    </Modal>
  </div>
</template>

<style scoped>
.intro {
  margin: -0.25rem 0 1rem;
  max-width: 60rem;
}

.overall-empty {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.overall-empty h3,
.overall-empty p {
  margin: 0;
}

.list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
  gap: 0.75rem;
}

.budget {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  scroll-margin: 6rem;
}

.budget.overall {
  grid-column: 1 / -1;
}

/* Wide enough: the dial on the left, the name, bar and figures beside it */
@media (min-width: 640px) {
  .budget.overall {
    display: grid;
    grid-template-columns: 11rem 1fr;
    align-content: center;
    gap: 0.75rem 1.75rem;
  }

  .budget.overall > * {
    grid-column: 2;
  }

  .budget.overall > .overall-dial {
    grid-column: 1;
    grid-row: 1 / span 4;
    align-self: center;
  }
}

.overall-dial {
  --dial: var(--budget-ok);
  width: min(100%, 11rem);
  margin-inline: auto;
}

.overall-dial.is-warn,
.overall-dial.is-reached { --dial: var(--budget-warn); }
.overall-dial.is-over { --dial: var(--budget-over); }


.top {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.icon {
  flex: none;
  width: 2.25rem;
  height: 2.25rem;
  display: grid;
  place-items: center;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--slot) 16%, var(--surface));
}

.name {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.figures {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1.25rem;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.figures strong {
  color: var(--ink);
}

.spent {
  color: var(--ink-2);
}

.over,
.over strong {
  color: var(--bad-ink);
}

.warn-line {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--bad-ink);
}

.sel {
  position: relative;
  display: block;
}

.ghost {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.err {
  margin: 0;
  color: var(--bad-ink);
  font-size: var(--text-sm);
}
</style>
