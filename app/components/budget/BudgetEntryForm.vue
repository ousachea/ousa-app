<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { BudgetTransaction, Currency, Kind } from '~/utils/budget/types'
import { billStatus, categoryPath, sameTransaction } from '~/utils/budget/calc'
import { addDays, formatDay, today } from '~/utils/budget/dates'

// Quick Add: an expense or income in a few taps. Pick a recent combination (or a category and
// subcategory), type the amount, save. Everything else is optional and tucked under "More details".
const props = defineProps<{ open: boolean, editing?: BudgetTransaction, preset?: Partial<BudgetTransaction> }>()
const emit = defineEmits<{ close: [] }>()
const store = useBudget()
const { transactions, categories, settings, subsOf, categoryById } = store
const { play } = useSound()

interface Form {
  kind: Kind
  amount: number | null
  currency: Currency
  categoryId: string
  subcategoryId: string
  date: string
  note: string
  method: string
  merchant: string
  tags: string
  recurringId: string
}

const recent = computed(() => [...transactions.items.value].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')).slice(0, 80))

// Smart defaults: the currency and payment method used last time
function blank(kind: Kind = 'expense'): Form {
  const last = recent.value.find(t => t.kind === kind)
  return {
    kind,
    amount: null,
    currency: last?.currency ?? settings.value.primaryCurrency,
    categoryId: kind === 'income' ? (last?.categoryId ?? '') : '',
    subcategoryId: '',
    date: today(),
    note: '',
    method: last?.method ?? 'cash',
    merchant: '',
    tags: '',
    recurringId: ''
  }
}

const form = reactive<Form>(blank())
const moreOpen = ref(false)
const saving = ref(false)
const confirmDupe = ref(false)
const amountField = ref<{ $el: HTMLInputElement }>()
const formEl = ref<HTMLFormElement>()

// Picking a chip doesn't type into the hidden required inputs, so tell v-validate they changed
watch(() => [form.categoryId, form.subcategoryId], () => nextTick(() => {
  formEl.value?.querySelectorAll('.ghost').forEach(g => g.dispatchEvent(new Event('input', { bubbles: true })))
}))

watch(() => props.open, (open) => {
  if (!open) return
  confirmDupe.value = false
  saving.value = false
  const e = props.editing
  if (e) {
    Object.assign(form, {
      kind: e.kind, amount: e.amount, currency: e.currency, categoryId: e.categoryId, subcategoryId: e.subcategoryId, date: e.date,
      note: e.note, method: e.method, merchant: e.merchant, tags: e.tags.join(', '), recurringId: e.recurringId ?? ''
    })
    moreOpen.value = !!(e.note || e.merchant || e.tags.length || e.recurringId)
  } else {
    Object.assign(form, blank(props.preset?.kind ?? 'expense'), pick(props.preset))
    moreOpen.value = false
  }
}, { immediate: true })

function pick(p?: Partial<BudgetTransaction>): Partial<Form> {
  if (!p) return {}
  const out: Partial<Form> = {}
  if (p.categoryId) out.categoryId = p.categoryId
  if (p.subcategoryId) out.subcategoryId = p.subcategoryId
  if (p.date) out.date = p.date
  return out
}

// Switching between expense and income starts that kind's own defaults, keeping the amount
watch(() => form.kind, (kind, was) => {
  if (!was || props.editing) return
  const amount = form.amount
  Object.assign(form, blank(kind), { amount, date: form.date })
})

const visible = (id: string) => !categoryById.value.get(id)?.archived
const kindCategories = computed(() => categories.items.value
  .filter(c => !c.parentId && c.kind === form.kind && (visible(c.id) || c.id === form.categoryId))
  .sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite) || a.order - b.order))
const subs = computed(() => (form.categoryId ? subsOf(form.categoryId).filter(s => visible(s.id) || s.id === form.subcategoryId) : []))
const subGroups = computed(() => {
  const groups: { name: string, items: typeof subs.value }[] = []
  for (const s of subs.value) {
    const name = s.group ?? ''
    const g = groups.find(x => x.name === name)
    if (g) g.items.push(s)
    else groups.push({ name, items: [s] })
  }
  return groups
})

// A new category clears a subcategory that doesn't belong to it, and picks the one used most there
function chooseCategory(id: string) {
  if (form.categoryId === id) return
  form.categoryId = id
  if (!subs.value.some(s => s.id === form.subcategoryId)) {
    const counts = new Map<string, number>()
    for (const t of recent.value) if (t.categoryId === id && t.subcategoryId) counts.set(t.subcategoryId, (counts.get(t.subcategoryId) ?? 0) + 1)
    const best = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0]
    form.subcategoryId = best && visible(best) ? best : ''
  }
  play('select')
}

// One-tap combinations from recent expenses
const combos = computed(() => {
  if (form.kind !== 'expense' || props.editing) return []
  const seen = new Set<string>()
  const out: { categoryId: string, subcategoryId: string, label: string, icon: string }[] = []
  for (const t of recent.value) {
    if (t.kind !== 'expense' || !t.subcategoryId || seen.has(t.subcategoryId) || !visible(t.subcategoryId) || !categoryById.value.has(t.subcategoryId)) continue
    seen.add(t.subcategoryId)
    const sub = categoryById.value.get(t.subcategoryId)!
    out.push({ categoryId: t.categoryId, subcategoryId: t.subcategoryId, label: sub.name, icon: sub.icon })
    if (out.length === 6) break
  }
  return out
})
function useCombo(c: { categoryId: string, subcategoryId: string }) {
  form.categoryId = c.categoryId
  form.subcategoryId = c.subcategoryId
  play('select')
  focusField(amountField.value?.$el)
}

// Add a subcategory without leaving the form
const newSub = ref('')
const addingSub = ref(false)
function addSub() {
  const name = newSub.value.trim()
  if (!name || !form.categoryId) return
  const parent = categoryById.value.get(form.categoryId)!
  const existing = subs.value.find(s => s.name.toLowerCase() === name.toLowerCase())
  if (existing) {
    form.subcategoryId = existing.id
  } else {
    const created = categories.add({ kind: parent.kind, name, parentId: parent.id, icon: parent.icon, color: parent.color, order: subs.value.length })
    form.subcategoryId = created.id
    toast.success(`${name} added to ${parent.name}`)
  }
  newSub.value = ''
  addingSub.value = false
  play('success')
}

const methods = computed(() => settings.value.methods.filter(m => !m.archived || m.id === form.method))
const bills = computed(() => store.recurring.items.value.filter(r => r.active || r.id === form.recurringId).map(r => ({ value: r.id, label: r.name })))
const billOptions = computed(() => [{ value: '', label: 'Not a bill' }, ...bills.value])

const needsSub = computed(() => form.kind === 'expense' && subs.value.length > 0)

// Same amount, category and day as one already logged: ask before logging it again
const dupe = computed(() => {
  if (!form.amount || !form.categoryId) return undefined
  const draft = { kind: form.kind, amount: form.amount, currency: form.currency, categoryId: form.categoryId, subcategoryId: form.kind === 'income' ? '' : form.subcategoryId, date: form.date }
  return transactions.items.value.find(t => t.id !== props.editing?.id && sameTransaction(t, draft))
})
watch(dupe, () => (confirmDupe.value = false))

function record(): Omit<BudgetTransaction, 'id' | 'createdAt' | 'updatedAt'> {
  const tags = form.tags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean)
  const base = {
    kind: form.kind,
    amount: Math.round(Number(form.amount) * 100) / 100,
    currency: form.currency,
    categoryId: form.categoryId,
    subcategoryId: form.kind === 'income' ? '' : form.subcategoryId,
    date: form.date,
    note: form.note.trim(),
    method: form.method,
    merchant: form.merchant.trim(),
    tags: [...new Set(tags)]
  }
  // Linked to a bill: it pays the earliest due date still waiting, up to a week after this payment
  if (form.kind === 'expense' && form.recurringId) {
    const bill = store.recurring.items.value.find(r => r.id === form.recurringId)
    if (bill) {
      if (props.editing?.recurringId === bill.id && props.editing.occurrence) return { ...base, recurringId: bill.id, occurrence: props.editing.occurrence }
      const st = billStatus(bill, transactions.items.value, form.date)
      const occurrence = st.overdue[0] ?? (st.next && st.next <= addDays(form.date, 7) ? st.next : undefined)
      return { ...base, recurringId: bill.id, ...(occurrence ? { occurrence } : {}) }
    }
  }
  return { ...base, recurringId: undefined, occurrence: undefined }
}

function save() {
  if (saving.value) return
  if (!(Number(form.amount) > 0) || !form.categoryId || (needsSub.value && !form.subcategoryId)) return
  if (dupe.value && !confirmDupe.value) {
    confirmDupe.value = true
    play('warning')
    return
  }
  saving.value = true
  const rec = record()
  const label = form.kind === 'income' ? categoryById.value.get(rec.categoryId)?.name ?? 'Income' : categoryPath(rec.subcategoryId || rec.categoryId, categories.items.value)
  if (props.editing) {
    const before = transactions.update(props.editing.id, rec)
    toastSaved(before && (() => transactions.replace(before)))
  } else {
    const added = transactions.add(rec)
    toast.success(`${rec.kind === 'income' ? 'Income' : 'Spent'} ${formatMoney(rec.amount, rec.currency)}`, {
      description: rec.note ? `${rec.note} · ${label}` : label,
      action: { label: 'Undo', onClick: () => transactions.remove(added.id, { undoAdd: true }) }
    })
  }
  play('success')
  emit('close')
}

function del() {
  const e = props.editing
  if (!e) return
  const removed = transactions.remove(e.id)
  play('delete')
  toastDeleted(e.note || formatMoney(e.amount, e.currency), () => removed && transactions.restore(removed))
  emit('close')
}
</script>

<template>
  <Modal :open="open" :title="editing ? (editing.kind === 'income' ? 'Edit income' : 'Edit expense') : form.kind === 'income' ? 'Add income' : 'Add expense'" @close="emit('close')">
    <form ref="formEl" v-validate class="entry" @submit.prevent="save">
      <div v-if="!editing" class="segmented kind" role="radiogroup" aria-label="Expense or income">
        <label :class="{ active: form.kind === 'expense' }"><input v-model="form.kind" type="radio" name="kind" value="expense">Expense</label>
        <label :class="{ active: form.kind === 'income' }"><input v-model="form.kind" type="radio" name="kind" value="income">Income</label>
      </div>

      <div v-if="combos.length" class="combos" aria-label="Recent">
        <span class="mini-head">Recent</span>
        <div class="chips">
          <button v-for="c in combos" :key="c.subcategoryId" type="button" class="chip" :aria-pressed="form.subcategoryId === c.subcategoryId" @click="useCombo(c)">
            <span aria-hidden="true">{{ c.icon }}</span>{{ c.label }}
          </button>
        </div>
      </div>

      <label class="field">
        <span class="field-head">Amount</span>
        <span class="amount">
          <GroupedNumberInput
            ref="amountField"
            v-model="form.amount"
            class="input"
            min="0"
            placeholder="0"
            required
            autofocus
            :data-keys="form.currency === 'KHR' ? 'riel' : 'money'"
            v-check="Number(form.amount) > 0 ? '' : 'Enter an amount above 0'"
            data-error="Enter an amount"
          />
          <span class="segmented" role="radiogroup" aria-label="Currency">
            <label v-for="c in (['USD', 'KHR'] as const)" :key="c" :class="{ active: form.currency === c }">
              <input v-model="form.currency" type="radio" name="currency" :value="c">{{ c === 'USD' ? '$' : '៛' }}
            </label>
          </span>
        </span>
      </label>

      <div class="field">
        <span class="field-head">{{ form.kind === 'income' ? 'Source' : 'Category' }}</span>
        <div class="chips cats" data-validate-target>
          <button
            v-for="c in kindCategories"
            :key="c.id"
            type="button"
            class="chip cat"
            :aria-pressed="form.categoryId === c.id"
            @click="chooseCategory(c.id)"
          >
            <span aria-hidden="true">{{ c.icon }}</span>{{ c.name }}<span v-if="c.favorite" class="star" aria-label="Pinned">★</span>
          </button>
          <input class="ghost" tabindex="-1" aria-hidden="true" :value="form.categoryId" required :data-error="form.kind === 'income' ? 'Choose where it came from' : 'Choose a category'">
        </div>
      </div>

      <div v-if="form.kind === 'expense' && form.categoryId" class="field">
        <span class="field-head">Subcategory</span>
        <div class="subs" data-validate-target>
          <div v-for="g in subGroups" :key="g.name" class="sub-group">
            <span v-if="g.name" class="mini-head">{{ g.name }}</span>
            <div class="chips">
              <button v-for="s in g.items" :key="s.id" type="button" class="chip" :aria-pressed="form.subcategoryId === s.id" @click="form.subcategoryId = s.id; play('select')"><span aria-hidden="true">{{ s.icon }}</span>{{ s.name }}</button>
            </div>
          </div>
          <div class="chips">
            <button v-if="!addingSub" type="button" v-ants class="chip add" @click="addingSub = true">+ New subcategory</button>
            <span v-else class="new-sub">
              <input v-model="newSub" class="input" placeholder="Name" aria-label="New subcategory name" data-keys="text" @keydown.enter.prevent="addSub">
              <button type="button" class="btn btn-sm" @click="addSub">Add</button>
              <button type="button" class="btn btn-quiet btn-sm" @click="addingSub = false; newSub = ''">Cancel</button>
            </span>
          </div>
          <input v-if="needsSub" class="ghost" tabindex="-1" aria-hidden="true" :value="form.subcategoryId" required data-error="Choose a subcategory">
        </div>
      </div>

      <label class="field">
        <span class="field-head">Date</span>
        <DatePicker v-model="form.date" aria-label="Date" required />
      </label>

      <details class="more" :open="moreOpen" @toggle="moreOpen = ($event.target as HTMLDetailsElement).open">
        <summary>More details <span class="optional">Optional</span></summary>
        <div class="more-body">
          <div class="field">
            <span class="field-head">{{ form.kind === 'income' ? 'Paid into' : 'Paid with' }}</span>
            <div class="chips">
              <button v-for="m in methods" :key="m.id" type="button" class="chip" :aria-pressed="form.method === m.id" @click="form.method = m.id">{{ m.name }}</button>
            </div>
          </div>
          <label class="field">
            <span class="field-head">Note</span>
            <input v-model="form.note" class="input" autocomplete="off" :placeholder="form.kind === 'income' ? 'October salary' : 'Lunch with team'" data-keys="text">
          </label>
          <label v-if="form.kind === 'expense'" class="field">
            <span class="field-head">Merchant or place</span>
            <input v-model="form.merchant" class="input" autocomplete="off" placeholder="Brown Coffee, Aeon Mall…" data-keys="text">
          </label>
          <label class="field">
            <span class="field-head">Tags</span>
            <input v-model="form.tags" class="input" autocomplete="off" placeholder="work, trip" data-keys="text">
          </label>
          <label v-if="form.kind === 'expense' && bills.length" class="field">
            <span class="field-head">Pays a recurring bill</span>
            <AppSelect v-model="form.recurringId" aria-label="Recurring bill" :options="billOptions" />
          </label>
        </div>
      </details>

      <div v-if="confirmDupe && dupe" class="dupe" role="alert">
        <strong>Looks like you already logged this.</strong>
        {{ formatMoney(dupe.amount, dupe.currency) }}{{ dupe.note ? ` · ${dupe.note}` : '' }} on {{ formatDay(dupe.date) }}. Save it again anyway?
      </div>

      <div class="actions">
        <button type="submit" class="btn" :disabled="saving">
          {{ confirmDupe && dupe ? 'Yes, save again' : editing ? 'Save changes' : form.kind === 'income' ? 'Add income' : 'Add expense' }}
        </button>
        <button type="button" class="btn btn-quiet" @click="emit('close')">Cancel</button>
        <span v-if="editing" class="del"><ConfirmDelete text :name="editing.note || 'this entry'" @confirm="del" /></span>
      </div>
    </form>
  </Modal>
</template>

<style scoped>
.entry {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.kind {
  max-width: 280px;
}

.amount {
  display: flex;
  gap: 0.5rem;
}

.amount .input {
  flex: 1;
  min-width: 0;
  font-size: var(--text-lg);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.amount .segmented label {
  padding: 0.45rem 0.85rem;
}

.mini-head {
  display: block;
  margin-bottom: 0.3rem;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--ink-3);
}

.chips {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

/* Touch-friendly chips: at least 40px tall */
.chip {
  min-height: 2.5rem;
  padding: 0.4rem 0.8rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink);
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: background-color var(--dur-fast), border-color var(--dur-fast);
}

.chip:hover {
  border-color: var(--ink-3);
}

.chip[aria-pressed='true'] {
  color: var(--on-accent);
  background: var(--accent-btn, var(--accent));
  border-color: transparent;
}

.chip.add {
  color: var(--ink-2);
  background: transparent;
  border-style: dashed;
}

.star {
  font-size: 0.75em;
}

.subs {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.new-sub {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.new-sub .input {
  width: 12rem;
}

/* The hidden stand-in that lets v-validate require a chip choice */
.ghost {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.more summary {
  font-weight: 600;
  color: var(--ink-2);
  cursor: pointer;
}

.more-body {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dupe {
  padding: 0.75rem 1rem;
  font-size: var(--text-sm);
  color: var(--ink);
  background: color-mix(in srgb, var(--orange) 14%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--orange) 45%, transparent);
  border-radius: var(--radius);
}

.actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.actions .btn:first-child {
  flex: 1;
}

.del {
  margin-left: 0.25rem;
}
</style>
