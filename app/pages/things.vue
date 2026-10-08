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

useAddAction(() => openAdd())
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
// Share of the price an item still holds, for the bar on each card (over 100% when it went up in value)
const kept = (t: Thing) => (t.price ? worth(t) / t.price : 0)
const pct = (n: number) => `${n < 0 ? '−' : '+'}${Math.abs(Math.round(n * 100))}%`

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
  toastDeleted(t.name, () => removed && restore(removed))
}
</script>

<template>
  <ToolPage header="band">
    <template #actions>
      <button type="button" class="btn add-btn" @click="openAdd">+ Add item</button>
    </template>

    <Modal :open="formOpen" :title="editingId ? 'Edit item' : 'Add something you own'" @close="cancel">
      <form v-validate class="form" @submit.prevent="save">
        <label class="field">
          <span class="field-head">What is it?</span>
          <input v-model="form.name" class="input" placeholder="iPhone 16 Pro Max" required data-error="Give it a name, like iPhone 16 Pro">
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
          <DatePicker v-model="form.purchaseDate" aria-label="Bought on" :max="today()" required />
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
          <button type="submit" class="btn">{{ editingId ? 'Save changes' : 'Add item' }}</button>
          <button type="button" class="btn btn-quiet" @click="cancel">Cancel</button>
        </div>
      </form>
    </Modal>

        <ClientOnly>
          <template v-if="ready && items.length">
            <section class="panel summary">
              <div class="totals">
                <span class="label">Worth now</span>
                <strong class="worth">{{ rate ? formatMoney(totals.now, 'USD') : '…' }}</strong>
                <dl class="stats">
                  <div><dt>Paid</dt><dd>{{ formatMoney(totals.paid, 'USD') }}</dd></div>
                  <div>
                    <dt>{{ totals.now >= totals.paid ? 'Gained' : 'Lost to age' }}</dt>
                    <dd :class="totals.change < 0 ? 'down' : 'up'">
                      {{ totals.now >= totals.paid ? '+' : '−' }}{{ formatMoney(Math.abs(totals.now - totals.paid), 'USD') }}
                      <small>{{ pct(totals.change) }}</small>
                    </dd>
                  </div>
                  <div><dt>Items</dt><dd>{{ items.length }}</dd></div>
                </dl>
                <p v-if="totals.estimates" class="note">
                  {{ totals.estimates === items.length ? 'All values are estimates' : `${totals.estimates} of ${items.length} values are estimates` }} from age and category. Edit an item to enter its real value.
                </p>
              </div>

              <!-- Where the value is: one bar split by category, then each category with its share -->
              <div class="breakdown">
                <span class="label">Where the value is</span>
                <div class="stack" role="img" :aria-label="byCategory.map(c => `${c.category} ${Math.round((c.usd / (totals.now || 1)) * 100)}%`).join(', ')">
                  <span
                    v-for="c in byCategory"
                    :key="c.category"
                    :style="{ ...categoryStyle(c.category), flexGrow: c.usd || 0.0001 }"
                    :title="`${c.category}: ${formatMoney(c.usd, 'USD')}`"
                  />
                </div>
                <ul class="cats">
                  <li v-for="c in byCategory" :key="c.category" :style="categoryStyle(c.category)">
                    <span class="cat-dot" aria-hidden="true"><CategoryIcon :name="c.category" /></span>
                    <span class="cat-name">{{ c.category }}<small>{{ c.count }} {{ c.count === 1 ? 'item' : 'items' }}</small></span>
                    <span class="cat-share">{{ Math.round((c.usd / (totals.now || 1)) * 100) }}%</span>
                    <b>{{ formatMoney(c.usd, 'USD') }}</b>
                  </li>
                </ul>
              </div>
            </section>

            <div v-sticky-bar class="toolbar">
              <DataSource :sync="sync" />
              <input v-model="query" class="input search" type="search" placeholder="Search your things" aria-label="Search your things">
              <AppSelect v-model="sort" class="sort" aria-label="Sort by" :options="SORTS" />
            </div>

            <!-- One card per thing: what it is, what you paid → what it's worth now, and how much of its price it keeps -->
            <TransitionGroup tag="ul" name="list" class="things">
              <li v-for="t in visible" :key="t.id" class="thing" :class="{ editing: editingId === t.id }" :style="categoryStyle(t.category)">
                <header class="thing-head">
                  <span class="thing-icon" aria-hidden="true"><CategoryIcon :name="t.category" /></span>
                  <span class="thing-title">
                    <strong>{{ t.name }}</strong>
                    <span>{{ t.category }} · {{ owned(t.purchaseDate) }}</span>
                  </span>
                </header>

                <div class="compare">
                  <div class="col">
                    <span class="k">Paid</span>
                    <b>{{ formatMoney(t.price, t.currency) }}</b>
                    <small>{{ formatDate(t.purchaseDate) }}</small>
                  </div>
                  <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
                  <div class="col end">
                    <span class="k">Worth now<span v-if="isEstimate(t)" class="est" title="Estimated from age and category">est.</span></span>
                    <b>{{ formatMoney(worth(t), t.currency) }}</b>
                    <small class="delta" :class="change(t) < 0 ? 'down' : 'up'">{{ pct(change(t)) }}</small>
                  </div>
                </div>

                <div class="kept">
                  <span class="kept-bar" role="img" :aria-label="`Keeps ${Math.round(kept(t) * 100)}% of what you paid`">
                    <span :style="{ width: `${Math.min(kept(t), 1) * 100}%` }" />
                  </span>
                  <span class="kept-text">Keeps {{ Math.round(kept(t) * 100) }}%</span>
                </div>

                <p v-if="t.notes" class="thing-notes">{{ t.notes }}</p>

                <footer class="links">
                  <button type="button" class="link" @click="edit(t)">Edit</button>
                  <ConfirmDelete text :name="t.name" @confirm="del(t)" />
                </footer>
              </li>
            </TransitionGroup>
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
/* ---------- Summary: totals on the left, where the value is on the right ---------- */
.summary {
  padding: 1.4rem 1.5rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
  gap: 1.5rem 2.5rem;
  align-items: start;
}

.label {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.worth {
  display: block;
  margin-top: 0.2rem;
  font-size: clamp(2.2rem, 4.5vw, 3rem);
  letter-spacing: -0.035em;
  line-height: 1.05;
  font-variant-numeric: tabular-nums;
}

.stats {
  margin: 1.1rem 0 0;
  display: grid;
  grid-template-columns: repeat(3, auto);
  justify-content: start;
  gap: 0.5rem 2rem;
}

.stats dt {
  font-size: 0.8rem;
  color: var(--ink-2);
}

.stats dd {
  margin: 0.1rem 0 0;
  font-size: 1.05rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.stats dd small {
  margin-left: 0.2rem;
  font-size: 0.8rem;
}

.stats .down { color: var(--bad-ink); }
.stats .up { color: var(--good-ink); }

.note {
  margin: 1rem 0 0;
  font-size: 0.8rem;
  color: var(--ink-3);
}

.stack {
  margin-top: 0.6rem;
  height: 0.85rem;
  display: flex;
  gap: 2px;
  overflow: hidden;
  border-radius: 999px;
}

.stack span {
  min-width: 4px;
  background: var(--cat);
}

.cats {
  list-style: none;
  margin: 0.9rem 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
  gap: 0.15rem 1.5rem;
}

.cats li {
  padding: 0.4rem 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.9rem;
  border-bottom: 1px solid var(--line);
}

.cat-dot {
  width: 1.5rem;
  height: 1.5rem;
  display: grid;
  place-items: center;
  font-size: 0.9rem;
  color: var(--cat-ink);
  background: var(--cat);
  border-radius: 7px;
}

.cat-name {
  display: flex;
  flex-direction: column;
  font-weight: 600;
  line-height: 1.2;
}

.cat-name small {
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--ink-3);
}

.cat-share {
  font-size: 0.8rem;
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}

.cats b {
  font-variant-numeric: tabular-nums;
}

/* ---------- Toolbar ---------- */
.toolbar {
  margin: 0.75rem -0.5rem 0.4rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.toolbar .search {
  flex: 1;
}

.sort {
  flex: none;
  width: 12.5rem;
}

/* ---------- Cards ---------- */
.things {
  position: relative;
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 17.5rem), 1fr));
  gap: 0.9rem;
}

.thing {
  position: relative;
  padding: 1rem 1.1rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 18px;
  /* A thin band of the category colour along the top */
  box-shadow: inset 0 4px 0 var(--cat);
  transition: translate 0.15s, box-shadow 0.15s;
}

.thing:hover {
  translate: 0 -2px;
  box-shadow: inset 0 4px 0 var(--cat), 0 14px 28px -18px rgb(var(--shadow) / 0.45);
}

.thing.editing {
  outline: 2px solid var(--cat);
  outline-offset: 3px;
}

.thing-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.thing-icon {
  flex: none;
  width: 2.4rem;
  height: 2.4rem;
  display: grid;
  place-items: center;
  font-size: 1.25rem;
  color: var(--cat-ink);
  background: var(--cat);
  border-radius: 12px;
  box-shadow: inset 0 -3px 0 rgb(0 0 0 / 0.12);
}

.thing-title {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.thing-title strong {
  font-size: 1.05rem;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.thing-title span {
  font-size: 0.8rem;
  color: var(--ink-2);
}

/* Paid → worth now, side by side */
.compare {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 0.85rem;
  background: var(--surface-2);
  border-radius: 12px;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.col.end {
  text-align: right;
  align-items: flex-end;
}

.k {
  display: flex;
  align-items: center;
  white-space: nowrap;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.col b {
  font-size: 1.1rem;
  font-variant-numeric: tabular-nums;
}

.col small {
  font-size: 0.75rem;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}

.col .delta {
  margin: 0;
  font-weight: 700;
}

.arrow {
  width: 1.05rem;
  height: 1.05rem;
  fill: none;
  stroke: var(--ink-3);
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.kept {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.kept-bar {
  flex: 1;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--surface-2);
}

.kept-bar span {
  display: block;
  height: 100%;
  background: var(--cat);
  border-radius: inherit;
}

.kept-text {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}

.thing-notes {
  margin: 0;
  font-size: 0.8rem;
  color: var(--ink-2);
}

.thing .links {
  margin-top: auto;
}

@media (max-width: 760px) {
  .summary {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 480px) {
  .toolbar {
    flex-wrap: wrap;
  }

  .toolbar .search {
    flex-basis: 100%;
    order: -1;
  }

  .sort {
    flex: 1;
    width: auto;
  }
}

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

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
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

.links {
  display: flex;
  gap: 0.75rem;
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
  .thing,
  .thing:hover { translate: none; transition: none; }
}
</style>
