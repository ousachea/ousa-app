<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { Currency } from '~/utils/exchange'

interface Thing {
  id: string
  name: string
  category: string
  purchaseDate: string // yyyy-mm-dd
  price: number
  currency: Currency
  // What it would sell for today, in the same currency; empty means "use an estimate"
  currentValue?: number | null
  notes: string
}

const CATEGORIES = ['Phone', 'Computer', 'Tablet', 'Camera', 'Gaming', 'Audio', 'Watch', 'Home', 'Vehicle', 'Other']

// Each category gets its own tag colour, so a glance tells phones from vehicles
const CATEGORY_COLORS: Record<string, string> = {
  Phone: '#1f5bd8',
  Computer: '#3949ab',
  Tablet: '#1479b0',
  Camera: '#7448d1',
  Gaming: '#d43d78',
  Audio: '#0f9488',
  Watch: '#ef7d16',
  Home: '#179a54',
  Vehicle: '#d7263d',
  Other: '#8d5f33'
}
const categoryStyle = (category: string) => {
  const color = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.Other!
  // White label text where it reads well, dark ink on lighter colours like orange
  return { '--cat': color, '--cat-ink': contrastRatio(color, '#ffffff') < 3 ? '#1b1f2a' : '#ffffff' }
}
const SORTS = [
  { value: 'value', label: 'Highest value' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name', label: 'Name' }
] as const

const { play } = useSound()
// Demo (the app icon switches it on): a typical set of gadgets, a vehicle and something bought in riel
const DEMO = (): Omit<Thing, 'id'>[] => [
  { name: 'iPhone 15 Pro', category: 'Phone', purchaseDate: isoDaysAgo(420), price: 1099, currency: 'USD', currentValue: null, notes: '256 GB, natural titanium' },
  { name: 'MacBook Air M2', category: 'Computer', purchaseDate: isoDaysAgo(760), price: 1299, currency: 'USD', currentValue: null, notes: 'For work' },
  { name: 'iPad (10th gen)', category: 'Tablet', purchaseDate: isoDaysAgo(300), price: 449, currency: 'USD', currentValue: null, notes: '' },
  { name: 'Sony A7 III', category: 'Camera', purchaseDate: isoDaysAgo(1500), price: 1999, currency: 'USD', currentValue: 1100, notes: 'With 28–70 mm kit lens' },
  { name: 'PlayStation 5', category: 'Gaming', purchaseDate: isoDaysAgo(900), price: 499, currency: 'USD', currentValue: null, notes: '' },
  { name: 'AirPods Pro', category: 'Audio', purchaseDate: isoDaysAgo(200), price: 249, currency: 'USD', currentValue: null, notes: '' },
  { name: 'Honda Dream 125', category: 'Vehicle', purchaseDate: isoDaysAgo(1100), price: 2350, currency: 'USD', currentValue: 1800, notes: 'Plate 2AB-1234' },
  { name: 'Rice cooker', category: 'Home', purchaseDate: isoDaysAgo(60), price: 180000, currency: 'KHR', currentValue: null, notes: '' }
]
const { items, ready, sync, add, update, remove, restore } = useCollection<Thing>('things', undefined, { demo: DEMO })
const rate = useMarketRate()

const today = () => new Date().toISOString().slice(0, 10)
const blank = (): Omit<Thing, 'id'> => ({ name: '', category: 'Phone', purchaseDate: today(), price: 0, currency: 'USD', currentValue: null, notes: '' })
const form = reactive(blank())
const editingId = ref<string>()
// Adding and editing happen in a popup
const formOpen = ref(false)

function openAdd() {
  cancel()
  formOpen.value = true
  play('open')
}
const query = ref('')
const sort = ref<(typeof SORTS)[number]['value']>('value')

// Today's value: what the owner entered, otherwise an age-and-category estimate
const isEstimate = (t: Thing) => t.currentValue == null
const worth = (t: Thing) => t.currentValue ?? estimateValue(t.price, t.category, t.purchaseDate)
const change = (t: Thing) => (t.price ? worth(t) / t.price - 1 : 0)

// Compare different currencies by their dollar value
const usd = (amount: number, currency: Currency) => (currency === 'USD' ? amount : amount / (rate.value ?? 4000))
const worthUsd = (t: Thing) => usd(worth(t), t.currency)
const paidUsd = (t: Thing) => usd(t.price, t.currency)

// Live estimate shown in the popup while typing
const formEstimate = computed(() => (form.price > 0 ? estimateValue(form.price, form.category, form.purchaseDate) : 0))

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = items.value.filter(t => !q || `${t.name} ${t.category} ${t.notes}`.toLowerCase().includes(q))
  return [...list].sort((a, b) => {
    if (sort.value === 'value') return worthUsd(b) - worthUsd(a)
    if (sort.value === 'newest') return b.purchaseDate.localeCompare(a.purchaseDate)
    if (sort.value === 'oldest') return a.purchaseDate.localeCompare(b.purchaseDate)
    return a.name.localeCompare(b.name)
  })
})

const totals = computed(() => {
  const now = items.value.reduce((n, t) => n + worthUsd(t), 0)
  const paid = items.value.reduce((n, t) => n + paidUsd(t), 0)
  return { now, paid, change: paid ? now / paid - 1 : 0, estimates: items.value.filter(isEstimate).length }
})

const byCategory = computed(() => {
  const map = new Map<string, { count: number, usd: number }>()
  for (const t of items.value) {
    const entry = map.get(t.category) ?? { count: 0, usd: 0 }
    entry.count++
    entry.usd += worthUsd(t)
    map.set(t.category, entry)
  }
  return [...map.entries()].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.usd - a.usd)
})

function owned(date: string) {
  const start = new Date(date)
  const now = new Date()
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (now.getDate() < start.getDate()) months--
  if (months < 0) return 'Not bought yet'
  if (months === 0) {
    const days = Math.floor((now.getTime() - start.getTime()) / 86_400_000)
    return days <= 0 ? 'Bought today' : `${days} day${days === 1 ? '' : 's'}`
  }
  const y = Math.floor(months / 12)
  const m = months % 12
  return [y && `${y} year${y === 1 ? '' : 's'}`, m && `${m} month${m === 1 ? '' : 's'}`].filter(Boolean).join(', ')
}

const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

const canSave = computed(() => form.name.trim() && form.price >= 0 && form.purchaseDate)

function save() {
  if (!canSave.value) return
  const record = {
    ...form,
    name: form.name.trim(),
    notes: form.notes.trim(),
    // An empty field means "estimate it"; keep 0 as a real value (worth nothing)
    currentValue: typeof form.currentValue === 'number' ? form.currentValue : null
  }
  if (editingId.value) {
    update(editingId.value, record)
    toast.success('Changes saved')
  } else {
    add(record)
    toast.success(`${record.name} added`)
  }
  play('success')
  cancel()
}

function edit(t: Thing) {
  editingId.value = t.id
  Object.assign(form, { name: t.name, category: t.category, purchaseDate: t.purchaseDate, price: t.price, currency: t.currency, currentValue: t.currentValue ?? null, notes: t.notes })
  formOpen.value = true
  play('open')
}

function cancel() {
  editingId.value = undefined
  formOpen.value = false
  Object.assign(form, blank())
}

function del(t: Thing) {
  const removed = remove(t.id)
  if (editingId.value === t.id) cancel()
  play('delete')
  toast(`${t.name} deleted`, {
    action: { label: 'Undo', onClick: () => removed && restore(removed) }
  })
}
</script>

<template>
  <ToolPage header="band">
    <template #actions>
      <button type="button" class="btn add-btn" @click="openAdd">+ Add item</button>
    </template>

    <Modal :open="formOpen" :title="editingId ? 'Edit item' : 'Add something you own'" @close="cancel">
      <form class="form" @submit.prevent="save">
        <label class="field">
          <span class="field-head">What is it?</span>
          <input v-model="form.name" class="input" placeholder="iPhone 16 Pro Max" required>
        </label>
        <div class="field">
          <span class="field-head">Category</span>
          <!-- Pick a category by its icon -->
          <div class="cat-grid" role="radiogroup" aria-label="Category">
            <label
              v-for="c in CATEGORIES"
              :key="c"
              class="cat-option"
              :class="{ active: form.category === c }"
              :style="categoryStyle(c)"
            >
              <input v-model="form.category" type="radio" name="category" :value="c">
              <span class="cat-option-icon"><CategoryIcon :name="c" /></span>
              {{ c }}
            </label>
          </div>
        </div>
        <label class="field">
          <span class="field-head">Bought on</span>
          <input v-model="form.purchaseDate" class="input" type="date" :max="today()" required>
        </label>
        <div class="field">
          <span class="field-head">Price paid</span>
          <div class="price">
            <input v-model.number="form.price" class="input" type="number" inputmode="decimal" min="0" step="any" aria-label="Price paid" required>
            <div class="segmented" role="radiogroup" aria-label="Currency">
              <label v-for="c in (['USD', 'KHR'] as const)" :key="c" :class="{ active: form.currency === c }">
                <input v-model="form.currency" type="radio" name="currency" :value="c">
                {{ c === 'USD' ? '$' : '៛' }}
              </label>
            </div>
          </div>
        </div>
        <div class="field">
          <span class="field-head">What it’s worth now <span class="optional">Optional</span></span>
          <div class="price">
            <input v-model.number="form.currentValue" class="input" type="number" inputmode="decimal" min="0" step="any" aria-label="What it’s worth now" :placeholder="formEstimate ? `About ${Math.round(formEstimate).toLocaleString('en-US')} if left empty` : 'Leave empty to estimate'">
            <span class="unit">{{ form.currency === 'USD' ? '$' : '៛' }}</span>
          </div>
          <small class="hint">Leave it empty and we’ll estimate it from the age and category. Enter a resale price for something more exact.</small>
        </div>
        <label class="field">
          <span class="field-head">Notes <span class="optional">Optional</span></span>
          <input v-model="form.notes" class="input" placeholder="Daily driver, warranty until 2027…">
        </label>
        <div class="actions">
          <button type="submit" class="btn" :disabled="!canSave">{{ editingId ? 'Save changes' : 'Add item' }}</button>
          <button type="button" class="btn btn-quiet" @click="cancel">Cancel</button>
        </div>
      </form>
    </Modal>

        <ClientOnly>
          <template v-if="ready && items.length">
            <section class="panel summary">
              <div class="hero">
                <span class="label">Worth now</span>
                <strong>{{ rate ? formatMoney(totals.now, 'USD') : '…' }}</strong>
                <span class="sub">
                  Paid {{ formatMoney(totals.paid, 'USD') }}
                  <span class="delta" :class="totals.change < 0 ? 'down' : 'up'">{{ totals.change < 0 ? '−' : '+' }}{{ Math.abs(Math.round(totals.change * 100)) }}%</span>
                  across {{ items.length }} {{ items.length === 1 ? 'item' : 'items' }}
                </span>
                <span v-if="totals.estimates" class="sub quiet">
                  {{ totals.estimates === items.length ? 'All values are estimates' : `${totals.estimates} of ${items.length} values are estimates` }} from age and category. Edit an item to enter its real value.
                </span>
              </div>
              <table class="cats">
                <caption class="sr-only">Value now by category</caption>
                <thead class="sr-only"><tr><th>Category</th><th>Items</th><th>Value</th></tr></thead>
                <tbody>
                  <tr v-for="c in byCategory" :key="c.category" :style="categoryStyle(c.category)">
                    <th scope="row"><span class="cat-dot" aria-hidden="true"><CategoryIcon :name="c.category" /></span>{{ c.category }}</th>
                    <td class="count">{{ c.count }}</td>
                    <td class="val">{{ formatMoney(c.usd, 'USD') }}</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <div class="toolbar">
              <DataSource :sync="sync" />
              <input v-model="query" class="input" type="search" placeholder="Search your things" aria-label="Search your things">
              <select v-model="sort" class="input sort" aria-label="Sort by">
                <option v-for="s in SORTS" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
            </div>

            <!-- Each item is a price tag: punched hole and string on the left, price as the headline -->
            <ul class="tags">
              <li v-for="t in visible" :key="t.id" class="tag" :class="{ editing: editingId === t.id }" :style="categoryStyle(t.category)">
                <span class="hole" aria-hidden="true" />
                <div class="tag-body">
                  <span class="tag-top">
                    <span class="tag-cat">{{ t.category }}</span>
                    <span class="tag-icon" aria-hidden="true"><CategoryIcon :name="t.category" /></span>
                  </span>
                  <strong class="tag-price">
                    {{ formatMoney(worth(t), t.currency) }}
                    <span v-if="isEstimate(t)" class="est" title="Estimated from age and category">est.</span>
                  </strong>
                  <span class="tag-paid">
                    Paid {{ formatMoney(t.price, t.currency) }}
                    <span class="delta" :class="change(t) < 0 ? 'down' : 'up'">{{ change(t) < 0 ? '−' : '+' }}{{ Math.abs(Math.round(change(t) * 100)) }}%</span>
                  </span>
                  <span class="tag-name">{{ t.name }}</span>
                  <span class="tag-meta">Bought {{ formatDate(t.purchaseDate) }} · {{ owned(t.purchaseDate) }}</span>
                  <span v-if="t.notes" class="tag-notes">{{ t.notes }}</span>
                  <span class="links">
                    <button type="button" class="link" @click="edit(t)">Edit</button>
                    <button type="button" class="link danger" @click="del(t)">Delete</button>
                  </span>
                </div>
              </li>
            </ul>
            <p v-if="!visible.length" class="empty-search">Nothing matches “{{ query }}”.</p>
          </template>

          <div v-else-if="ready" class="panel empty">
            <h2>Nothing here yet</h2>
            <p>Add your phone, laptop or anything valuable to see what it’s all worth.</p>
            <button type="button" class="btn" @click="openAdd">+ Add your first item</button>
          </div>
        </ClientOnly>
  </ToolPage>
</template>

<style scoped>
.add-btn {
  color: var(--accent);
  background: var(--surface);
}

.add-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--surface) 88%, var(--accent));
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.price {
  display: flex;
  gap: 0.5rem;
}

.price .input {
  flex: 1;
  font-variant-numeric: tabular-nums;
}

.price .segmented label {
  padding: 0.45rem 0.8rem;
}

.unit {
  align-self: center;
  font-weight: 700;
  color: var(--ink-3);
}

.hint {
  font-weight: 400;
  color: var(--ink-3);
}

.delta {
  margin-left: 0.25rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.delta.down { color: var(--bad-ink); }
.delta.up { color: var(--good-ink); }

.quiet {
  color: var(--ink-3);
}

.est {
  margin-left: 0.2rem;
  padding: 0.05rem 0.35rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0;
  vertical-align: middle;
  color: var(--ink-2);
  background: var(--surface-2);
  border-radius: 6px;
}

.tag-paid {
  font-size: 0.8rem;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}

.optional {
  font-weight: 400;
  color: var(--ink-3);
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.actions .btn:first-child {
  flex: 1;
}

.summary {
  padding: 1.4rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 1.5rem;
  align-items: start;
}

.hero {
  display: flex;
  flex-direction: column;
}

.label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ink-2);
}

.hero strong {
  font-size: clamp(2rem, 4vw, 2.75rem);
  letter-spacing: -0.03em;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.sub {
  margin-top: 0.3rem;
  font-size: 0.875rem;
  color: var(--ink-2);
}

.cats {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.cats th,
.cats td {
  padding: 0.35rem 0;
  border-bottom: 1px solid var(--line);
  text-align: left;
  font-weight: 500;
}

.cats .count {
  color: var(--ink-3);
  text-align: right;
  padding-right: 1rem;
  font-variant-numeric: tabular-nums;
}

.cats .val {
  text-align: right;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.toolbar {
  margin: 1.25rem 0 0.75rem;
  display: flex;
  gap: 0.5rem;
}

.toolbar .input:first-child {
  flex: 1;
}

.sort {
  width: auto;
}

.tags {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 230px), 1fr));
  gap: 1rem 0.9rem;
}

/* Price tag: angled left end, a punched hole, and a short string */
.tag {
  position: relative;
  display: flex;
  min-height: 11rem;
  padding-left: 2.6rem;
  /* Tinted card stock in the category colour */
  background: color-mix(in srgb, var(--cat, var(--accent)) 11%, var(--surface));
  clip-path: polygon(1.6rem 0, 100% 0, 100% 100%, 1.6rem 100%, 0 50%);
  border-radius: 4px 16px 16px 4px;
  filter: drop-shadow(0 1px 1px rgb(var(--shadow) / 0.12)) drop-shadow(0 6px 14px rgb(var(--shadow) / 0.08));
  transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.tag:hover {
  transform: rotate(-0.6deg) translateY(-2px);
}

.tag.editing {
  background: color-mix(in srgb, var(--cat, var(--accent)) 24%, var(--surface));
}

.hole {
  position: absolute;
  top: 50%;
  left: 1.05rem;
  width: 0.75rem;
  height: 0.75rem;
  margin-top: -0.375rem;
  border-radius: 50%;
  background: var(--bg);
  box-shadow: inset 0 1px 2px rgb(var(--shadow) / 0.35);
}

/* The string, tucked behind the tag and looping out of the hole */
.hole::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 50%;
  width: 1.4rem;
  height: 1px;
  background: var(--cat, var(--accent));
  transform: rotate(-24deg);
  transform-origin: right center;
}

.tag-body {
  flex: 1;
  min-width: 0;
  padding: 1rem 1.1rem 0.9rem 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  border-left: 1px dashed color-mix(in srgb, var(--cat, var(--accent)) 35%, var(--line));
  padding-left: 0.9rem;
}

.tag-cat {
  align-self: flex-start;
  padding: 0.1rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--cat-ink, #fff);
  background: var(--cat, var(--accent));
  border-radius: 999px;
}

.cat-dot {
  display: inline-grid;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  margin-right: 0.55rem;
  vertical-align: middle;
  font-size: 0.95rem;
  color: var(--cat-ink);
  background: var(--cat);
  border-radius: 7px;
}

/* Category label on the left, its icon badge on the right */
.tag-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.tag-icon {
  flex: none;
  width: 2.5rem;
  height: 2.5rem;
  display: grid;
  place-items: center;
  font-size: 1.35rem;
  color: var(--cat-ink);
  background: var(--cat);
  border-radius: 50%;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--cat) 18%, transparent);
}

/* Icon picker in the popup: five per row */
.cat-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.4rem;
}

.cat-option {
  position: relative;
  padding: 0.55rem 0.25rem 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ink-2);
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s, color 0.15s;
}

.cat-option:hover {
  border-color: var(--cat);
}

.cat-option.active {
  color: var(--ink);
  background: color-mix(in srgb, var(--cat) 14%, var(--surface));
  border-color: var(--cat);
  box-shadow: 0 0 0 1px var(--cat);
}

.cat-option:has(input:focus-visible) {
  outline: 3px solid color-mix(in srgb, var(--cat) 55%, transparent);
  outline-offset: 2px;
}

.cat-option input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.cat-option-icon {
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  font-size: 1.1rem;
  color: var(--cat);
  border-radius: 50%;
  transition: background-color 0.15s, color 0.15s;
}

.cat-option.active .cat-option-icon {
  color: var(--cat-ink);
  background: var(--cat);
}

.tag-price {
  margin-top: 0.2rem;
  font-size: 1.6rem;
  letter-spacing: -0.02em;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.tag-name {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.tag-meta,
.tag-notes {
  font-size: 0.8rem;
  color: var(--ink-2);
}

.tag-notes {
  color: var(--ink-3);
}

.links {
  display: flex;
  gap: 0.75rem;
}

.tag .links {
  margin-top: auto;
  padding-top: 0.6rem;
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

.link.danger {
  color: var(--bad-ink);
}

.empty,
.empty-search {
  text-align: center;
  color: var(--ink-2);
}

.empty {
  padding: 2.5rem 1.5rem;
}

.empty .btn {
  margin-top: 1rem;
}

.empty h2 {
  font-size: 1.2rem;
  color: var(--ink);
}

.empty p {
  margin: 0.5rem 0 0;
}

@media (prefers-reduced-motion: reduce) {
  .tag:hover { transform: none; }
}



@media (max-width: 560px) {
  .summary { grid-template-columns: 1fr; }
}
</style>
