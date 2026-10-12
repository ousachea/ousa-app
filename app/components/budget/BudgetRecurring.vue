<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { BudgetRecurring, Currency, Cycle } from '~/utils/budget/types'
import { CYCLES, billStatus, categoryPath, dueDates, perMonth, total } from '~/utils/budget/calc'
import { addDays, daysBetween, formatDay, today } from '~/utils/budget/dates'

// Recurring bills. A due date is only "paid" once you confirm a payment, which records an expense;
// nothing is marked paid by itself. Overdue dates stay until you pay or skip them.
const store = useBudget()
const { recurring, transactions, settings, conv, money, topCategories, subsOf, categoryById } = store
const { play } = useSound()
useBudgetHighlight()
const day = today()

const STATE = {
  overdue: { label: 'Overdue', badge: 'bad' },
  today: { label: 'Due today', badge: 'warn' },
  soon: { label: 'Due soon', badge: 'warn' },
  upcoming: { label: 'Upcoming', badge: 'info' },
  paused: { label: 'Paused', badge: '' }
} as const

const rows = computed(() => recurring.items.value
  .map(r => ({ r, s: billStatus(r, transactions.items.value, day) }))
  .sort((a, b) => Number(a.r.active === false) - Number(b.r.active === false) || (a.s.overdue[0] ?? a.s.next ?? '9').localeCompare(b.s.overdue[0] ?? b.s.next ?? '9')))

const monthly = computed(() => total(recurring.items.value.filter(r => r.active).map(r => ({ amount: r.amount * perMonth(r), currency: r.currency })), conv.value))

// The next 30 days: what's expected, and what's already been confirmed paid
const schedule = computed(() => {
  const range = { from: day, to: addDays(day, 30) }
  return recurring.items.value.filter(r => r.active).flatMap((r) => {
    const st = billStatus(r, transactions.items.value, day)
    return dueDates(r, range, 40).map(d => ({ r, date: d, paid: st.paid.get(d), skipped: r.skipped.includes(d) }))
  }).sort((a, b) => a.date.localeCompare(b.date))
})


// ---------- Pay ----------
const payOpen = ref(false)
const paying = reactive({ r: undefined as BudgetRecurring | undefined, occurrence: '', amount: 0, currency: 'USD' as Currency, date: day, method: '' })
const busy = ref(false)
function openPay(r: BudgetRecurring, occurrence: string) {
  Object.assign(paying, { r, occurrence, amount: r.amount, currency: r.currency, date: day, method: r.method })
  payOpen.value = true
  play('open')
}
async function confirmPay() {
  const r = paying.r
  if (!r || busy.value || !(paying.amount > 0)) return
  busy.value = true
  const rec = await store.recordBillPayment(r, paying.occurrence, { amount: paying.amount, currency: paying.currency, date: paying.date, method: paying.method })
  busy.value = false
  payOpen.value = false
  if (!rec) {
    toast('Already paid', { description: `${r.name} for ${formatDay(paying.occurrence)} was recorded before.` })
    return
  }
  play('success')
  toast.success(`${r.name} paid`, {
    description: `${formatMoney(rec.amount, rec.currency)} for ${formatDay(paying.occurrence)}, logged as an expense.`,
    action: { label: 'Undo', onClick: () => transactions.remove(rec.id, { undoAdd: true }) }
  })
}

function skip(r: BudgetRecurring, occurrence: string) {
  const before = recurring.update(r.id, { skipped: [...r.skipped, occurrence].slice(-60) })
  play('select')
  toast(`Skipped ${formatDay(occurrence)}`, { description: `${r.name} won’t show as overdue for that date.`, action: { label: 'Undo', onClick: () => before && recurring.replace(before) } })
}

function togglePause(r: BudgetRecurring) {
  recurring.update(r.id, { active: !r.active })
  play(r.active ? 'toggle-off' : 'toggle-on')
}

function del(r: BudgetRecurring) {
  const removed = recurring.remove(r.id)
  play('delete')
  toastDeleted(r.name, () => removed && recurring.restore(removed))
  formOpen.value = false
}

// ---------- Add / edit ----------
const formOpen = ref(false)
const editingId = ref<string>()
const blank = () => ({ name: '', amount: null as number | null, currency: settings.value.primaryCurrency as Currency, categoryId: '', subcategoryId: '', method: 'qr', cycle: 'monthly' as Cycle, every: 14, startDate: day, note: '', active: true })
const form = reactive(blank())
function openForm(r?: BudgetRecurring) {
  editingId.value = r?.id
  Object.assign(form, r ? { name: r.name, amount: r.amount, currency: r.currency, categoryId: r.categoryId, subcategoryId: r.subcategoryId, method: r.method, cycle: r.cycle, every: r.every, startDate: r.startDate, note: r.note, active: r.active } : blank())
  formOpen.value = true
  play('open')
}
const catOptions = computed(() => topCategories.value.filter(c => c.kind === 'expense' && !c.archived).map(c => ({ value: c.id, label: `${c.icon} ${c.name}` })))
const subOptions = computed(() => [{ value: '', label: 'No subcategory' }, ...(form.categoryId ? subsOf(form.categoryId).filter(s => !s.archived).map(s => ({ value: s.id, label: s.name })) : [])])
watch(() => form.categoryId, () => {
  if (!subOptions.value.some(s => s.value === form.subcategoryId)) form.subcategoryId = ''
})
const methodOptions = computed(() => settings.value.methods.filter(m => !m.archived).map(m => ({ value: m.id, label: m.name })))

function save() {
  if (!form.name.trim() || !(Number(form.amount) > 0) || !form.categoryId) return
  const rec = { ...form, name: form.name.trim(), note: form.note.trim(), amount: Number(form.amount), every: Math.max(1, Math.round(form.every)), skipped: [] as string[] }
  if (editingId.value) {
    const existing = recurring.items.value.find(r => r.id === editingId.value)!
    const before = recurring.update(editingId.value, { ...rec, skipped: existing.skipped })
    toastSaved(before && (() => recurring.replace(before)))
  } else {
    const added = recurring.add(rec)
    toast.success(`${rec.name} added`, { description: `First due ${formatDay(rec.startDate)}`, action: { label: 'Undo', onClick: () => recurring.remove(added.id, { undoAdd: true }) } })
  }
  play('success')
  formOpen.value = false
}

const cycleLabel = (r: BudgetRecurring) => (r.cycle === 'custom' ? `Every ${r.every} days` : CYCLES.find(c => c.value === r.cycle)!.label)
const when = (d: string) => {
  const n = daysBetween(day, d)
  return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : n > 0 ? `in ${n} days` : `${-n} days ago`
}
</script>

<template>
  <div>
    <div class="b-head">
      <h2>Recurring bills</h2>
      <button type="button" class="btn" @click="openForm()">+ Bill</button>
    </div>

    <p v-if="recurring.items.value.length" class="b-muted intro">
      Active bills cost about <strong class="b-num">{{ money(monthly.value) }}</strong> a month.
      Bills are only marked paid when you confirm a payment, which logs it as an expense.
    </p>

    <div v-if="!recurring.items.value.length" class="panel">
      <EmptyState title="No bills yet" icon="renewals" action="+ Bill" @action="openForm()">
        Add rent, electricity, internet, your phone plan or a gym membership, and see what’s due and what’s overdue. (Subscriptions you only want to watch can also live in the Renewals app.)
      </EmptyState>
    </div>

    <ul class="bills">
      <li v-for="{ r, s } in rows" :data-item-id="r.id" :key="r.id" class="panel bill" :class="{ paused: !r.active }">
        <div class="top">
          <span class="icon" :class="`slot-${categoryById.get(r.categoryId)?.color ?? 'gray'}`" aria-hidden="true">{{ categoryById.get(r.subcategoryId || r.categoryId)?.icon ?? '🧾' }}</span>
          <div class="main">
            <strong>{{ r.name }}</strong>
            <span class="b-muted">{{ formatMoney(r.amount, r.currency) }} · {{ cycleLabel(r) }} · {{ categoryPath(r.subcategoryId || r.categoryId, store.categories.items.value) }}</span>
          </div>
          <span class="badge" :class="STATE[s.state].badge">{{ STATE[s.state].label }}</span>
        </div>

        <ul v-if="r.active && s.overdue.length" class="due-list">
          <li v-for="d in s.overdue" :key="d">
            <span class="due-date bad-ink">Due {{ formatDay(d) }} <span class="b-muted">({{ when(d) }})</span></span>
            <button type="button" class="btn btn-sm" @click="openPay(r, d)">Mark paid</button>
            <button type="button" class="link quiet" @click="skip(r, d)">Skip</button>
          </li>
        </ul>
        <div v-if="r.active && s.next" class="due-list">
          <span class="due-date">Next: {{ formatDay(s.next) }} <span class="b-muted">({{ when(s.next) }}) · expected, not paid yet</span></span>
          <button type="button" class="btn btn-quiet btn-sm" @click="openPay(r, s.next)">Mark paid</button>
          <button type="button" class="link quiet" @click="skip(r, s.next)">Skip</button>
        </div>

        <div class="foot">
          <span class="b-muted">{{ s.paid.size }} {{ s.paid.size === 1 ? 'payment' : 'payments' }} recorded</span>
          <span class="b-row">
            <button type="button" class="link" @click="openForm(r)">Edit</button>
            <button type="button" class="link quiet" @click="togglePause(r)">{{ r.active ? 'Pause' : 'Resume' }}</button>
          </span>
        </div>
      </li>
    </ul>

    <section v-if="schedule.length" class="panel b-panel b-gap">
      <h3>Next 30 days</h3>
      <ul class="schedule">
        <li v-for="x in schedule" :key="`${x.r.id}-${x.date}`">
          <span class="b-num date">{{ formatDay(x.date, { weekday: 'short', day: 'numeric', month: 'short' }) }}</span>
          <span class="nm">{{ x.r.name }}</span>
          <span class="b-num">{{ formatMoney(x.r.amount, x.r.currency) }}</span>
          <span v-if="x.paid" class="badge good">✓ Paid</span>
          <span v-else-if="x.skipped" class="badge">Skipped</span>
          <span v-else class="badge info">Expected</span>
        </li>
      </ul>
    </section>

    <Modal :open="payOpen" :title="`Pay ${paying.r?.name ?? ''}`" @close="payOpen = false">
      <form v-validate class="b-form" @submit.prevent="confirmPay">
        <p class="b-muted">For the bill due {{ paying.occurrence ? formatDay(paying.occurrence) : '' }}. This logs an expense; you can change the amount if this one was different.</p>
        <div class="field">
          <span class="field-head">Amount paid</span>
          <div class="b-amount">
            <input v-model.number="paying.amount" class="input" type="number" inputmode="decimal" min="0" step="any" required aria-label="Amount paid" v-check="paying.amount > 0 ? '' : 'Enter an amount'">
            <span class="segmented" role="radiogroup" aria-label="Currency">
              <label v-for="c in (['USD', 'KHR'] as const)" :key="c" :class="{ active: paying.currency === c }"><input v-model="paying.currency" type="radio" name="pay-cur" :value="c">{{ c === 'USD' ? '$' : '៛' }}</label>
            </span>
          </div>
        </div>
        <div class="row">
          <label class="field">
            <span class="field-head">Paid on</span>
            <DatePicker v-model="paying.date" aria-label="Paid on" :max="day" required />
          </label>
          <label class="field">
            <span class="field-head">Paid with</span>
            <AppSelect v-model="paying.method" aria-label="Paid with" :options="methodOptions" />
          </label>
        </div>
        <div class="actions">
          <button type="submit" class="btn" :disabled="busy">Confirm payment</button>
          <button type="button" class="btn btn-quiet" @click="payOpen = false">Cancel</button>
        </div>
      </form>
    </Modal>

    <Modal :open="formOpen" :title="editingId ? 'Edit bill' : 'Add a bill'" @close="formOpen = false">
      <form v-validate class="b-form" @submit.prevent="save">
        <label class="field">
          <span class="field-head">Name</span>
          <input v-model="form.name" class="input" required autocomplete="off" placeholder="Rent, EDC electricity, Smart plan…" data-keys="text" data-error="Give it a name">
        </label>
        <div class="field">
          <span class="field-head">Amount</span>
          <div class="b-amount">
            <input v-model.number="form.amount" class="input" type="number" inputmode="decimal" min="0" step="any" required aria-label="Amount" v-check="Number(form.amount) > 0 ? '' : 'Enter an amount'" :data-keys="form.currency === 'KHR' ? 'riel' : 'money'">
            <span class="segmented" role="radiogroup" aria-label="Currency">
              <label v-for="c in (['USD', 'KHR'] as const)" :key="c" :class="{ active: form.currency === c }"><input v-model="form.currency" type="radio" name="bill-cur" :value="c">{{ c === 'USD' ? '$' : '៛' }}</label>
            </span>
          </div>
        </div>
        <div class="row">
          <label class="field">
            <span class="field-head">Category</span>
            <span data-validate-target class="sel">
              <AppSelect v-model="form.categoryId" aria-label="Category" :options="catOptions" placeholder="Choose…" searchable />
              <input class="ghost" tabindex="-1" aria-hidden="true" :value="form.categoryId" required data-error="Choose a category">
            </span>
          </label>
          <label class="field">
            <span class="field-head">Subcategory</span>
            <AppSelect v-model="form.subcategoryId" aria-label="Subcategory" :options="subOptions" searchable />
          </label>
        </div>
        <div class="row">
          <label class="field">
            <span class="field-head">Repeats</span>
            <AppSelect v-model="form.cycle" aria-label="Repeats" :options="CYCLES.map(c => ({ value: c.value, label: c.label }))" />
          </label>
          <label v-if="form.cycle === 'custom'" class="field">
            <span class="field-head">Every how many days</span>
            <input v-model.number="form.every" class="input" type="number" inputmode="numeric" min="1" max="365" step="1" required aria-label="Days between payments">
          </label>
          <label class="field">
            <span class="field-head">{{ editingId ? 'First due date' : 'Next due date' }}</span>
            <DatePicker v-model="form.startDate" aria-label="Due date" required />
          </label>
        </div>
        <label class="field">
          <span class="field-head">Paid with</span>
          <AppSelect v-model="form.method" aria-label="Paid with" :options="methodOptions" />
        </label>
        <label class="field">
          <span class="field-head">Note <span class="optional">Optional</span></span>
          <input v-model="form.note" class="input" autocomplete="off" data-keys="text">
        </label>
        <div class="actions">
          <button type="submit" class="btn">{{ editingId ? 'Save changes' : 'Add bill' }}</button>
          <button type="button" class="btn btn-quiet" @click="formOpen = false">Cancel</button>
          <ConfirmDelete v-if="editingId" text name="this bill" @confirm="del(recurring.items.value.find(x => x.id === editingId)!)" />
        </div>
      </form>
    </Modal>
  </div>
</template>

<style scoped>
.intro {
  margin: -0.25rem 0 1rem;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.bills {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 24rem), 1fr));
  gap: 0.75rem;
}

.bill {
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  scroll-margin: 6rem;
}


.bill.paused {
  opacity: 0.65;
}

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
  border-radius: 10px;
  background: color-mix(in srgb, var(--slot) 16%, var(--surface));
}

.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.due-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.due-list li,
div.due-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.75rem;
  font-size: var(--text-sm);
}

div.due-list {
  flex-direction: row;
}

.due-date {
  flex: 1 1 12rem;
}

.bad-ink {
  color: var(--bad-ink);
  font-weight: 600;
}

.quiet {
  color: var(--ink-2);
}

.foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.6rem;
  border-top: 1px solid var(--line);
  font-size: var(--text-sm);
}

.schedule li {
  padding: 0.45rem 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-bottom: 1px solid color-mix(in srgb, var(--line) 60%, transparent);
  font-size: var(--text-sm);
}

.date {
  width: 7.5rem;
  color: var(--ink-2);
}

.nm {
  flex: 1;
  min-width: 0;
  font-weight: 600;
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
</style>
