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
  notes: string
}

const CATEGORIES = ['Phone', 'Computer', 'Tablet', 'Camera', 'Gaming', 'Audio', 'Watch', 'Home', 'Vehicle', 'Other']
const SORTS = [
  { value: 'value', label: 'Highest value' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name', label: 'Name' }
] as const

const { play } = useSound()
const { items, ready, sync, add, update, remove, restore } = useCollection<Thing>('things')
const rate = useMarketRate()

const today = () => new Date().toISOString().slice(0, 10)
const blank = (): Omit<Thing, 'id'> => ({ name: '', category: 'Phone', purchaseDate: today(), price: 0, currency: 'USD', notes: '' })
const form = reactive(blank())
const editingId = ref<string>()
const query = ref('')
const sort = ref<(typeof SORTS)[number]['value']>('value')

// Compare different currencies by their dollar value
const inUsd = (t: Pick<Thing, 'price' | 'currency'>) => (t.currency === 'USD' ? t.price : rate.value ? t.price / rate.value : t.price / 4000)

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = items.value.filter(t => !q || `${t.name} ${t.category} ${t.notes}`.toLowerCase().includes(q))
  return [...list].sort((a, b) => {
    if (sort.value === 'value') return inUsd(b) - inUsd(a)
    if (sort.value === 'newest') return b.purchaseDate.localeCompare(a.purchaseDate)
    if (sort.value === 'oldest') return a.purchaseDate.localeCompare(b.purchaseDate)
    return a.name.localeCompare(b.name)
  })
})

const totals = computed(() => totalsByCurrency(items.value.map(t => ({ amount: t.price, currency: t.currency })), rate.value))

const byCategory = computed(() => {
  const map = new Map<string, { count: number, usd: number }>()
  for (const t of items.value) {
    const entry = map.get(t.category) ?? { count: 0, usd: 0 }
    entry.count++
    entry.usd += inUsd(t)
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
  const record = { ...form, name: form.name.trim(), notes: form.notes.trim() }
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
  Object.assign(form, { name: t.name, category: t.category, purchaseDate: t.purchaseDate, price: t.price, currency: t.currency, notes: t.notes })
  play('select')
}

function cancel() {
  editingId.value = undefined
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
  <ToolPage>
    <div class="workspace">
      <Step :n="1" :title="editingId ? 'Edit this item' : 'Add something you own'" class="form-step">
        <form class="panel form" @submit.prevent="save">
          <label class="field">
            <span class="field-head">What is it?</span>
            <input v-model="form.name" class="input" placeholder="iPhone 16 Pro Max" required>
          </label>
          <div class="row">
            <label class="field">
              <span class="field-head">Category</span>
              <select v-model="form.category" class="input">
                <option v-for="c in CATEGORIES" :key="c">{{ c }}</option>
              </select>
            </label>
            <label class="field">
              <span class="field-head">Bought on</span>
              <input v-model="form.purchaseDate" class="input" type="date" :max="today()" required>
            </label>
          </div>
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
          <label class="field">
            <span class="field-head">Notes <span class="optional">Optional</span></span>
            <input v-model="form.notes" class="input" placeholder="Daily driver, warranty until 2027…">
          </label>
          <div class="actions">
            <button type="submit" class="btn" :disabled="!canSave">{{ editingId ? 'Save changes' : 'Add item' }}</button>
            <button v-if="editingId" type="button" class="btn btn-quiet" @click="cancel">Cancel</button>
          </div>
        </form>
      </Step>

      <Step :n="2" title="What you own" class="list-step">
        <template #aside><ClientOnly><DataSource :sync="sync" /></ClientOnly></template>
        <ClientOnly>
          <template v-if="ready && items.length">
            <section class="panel summary">
              <div class="hero">
                <span class="label">Total value</span>
                <strong>{{ totals.combinedUsd !== undefined ? formatMoney(totals.combinedUsd, 'USD') : '…' }}</strong>
                <span class="sub">
                  {{ items.length }} {{ items.length === 1 ? 'item' : 'items' }}
                  <template v-if="totals.usd && totals.khr"> · {{ formatMoney(totals.usd, 'USD') }} + {{ formatMoney(totals.khr, 'KHR') }} at today’s rate</template>
                </span>
              </div>
              <table class="cats">
                <caption class="sr-only">Value by category</caption>
                <thead class="sr-only"><tr><th>Category</th><th>Items</th><th>Value</th></tr></thead>
                <tbody>
                  <tr v-for="c in byCategory" :key="c.category">
                    <th scope="row">{{ c.category }}</th>
                    <td class="count">{{ c.count }}</td>
                    <td class="val">{{ formatMoney(c.usd, 'USD') }}</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <div class="toolbar">
              <input v-model="query" class="input" type="search" placeholder="Search your things" aria-label="Search your things">
              <select v-model="sort" class="input sort" aria-label="Sort by">
                <option v-for="s in SORTS" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
            </div>

            <!-- Each item is a price tag: punched hole and string on the left, price as the headline -->
            <ul class="tags">
              <li v-for="t in visible" :key="t.id" class="tag" :class="{ editing: editingId === t.id }">
                <span class="hole" aria-hidden="true" />
                <div class="tag-body">
                  <span class="tag-cat">{{ t.category }}</span>
                  <strong class="tag-price">{{ formatMoney(t.price, t.currency) }}</strong>
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
          </div>
        </ClientOnly>
      </Step>
    </div>
  </ToolPage>
</template>

<style scoped>
.workspace {
  display: grid;
  grid-template-columns: minmax(300px, 0.8fr) minmax(0, 1.2fr);
  gap: 2rem 2.5rem;
  align-items: start;
}

.form-step {
  position: sticky;
  top: 5.5rem;
}

.form {
  padding: 1.4rem;
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
  background: var(--surface);
  clip-path: polygon(1.6rem 0, 100% 0, 100% 100%, 1.6rem 100%, 0 50%);
  border-radius: 4px 16px 16px 4px;
  filter: drop-shadow(0 1px 1px rgb(var(--shadow) / 0.12)) drop-shadow(0 6px 14px rgb(var(--shadow) / 0.08));
  transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.tag:hover {
  transform: rotate(-0.6deg) translateY(-2px);
}

.tag.editing {
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
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
  background: var(--accent);
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
  border-left: 1px dashed var(--line);
  padding-left: 0.9rem;
}

.tag-cat {
  align-self: flex-start;
  padding: 0.1rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: #fff;
  background: var(--accent);
  border-radius: 999px;
}

.tag-price {
  margin-top: 0.4rem;
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

@media (max-width: 960px) {
  .workspace { grid-template-columns: 1fr; }
  .form-step { position: static; }
}

@media (max-width: 560px) {
  .summary { grid-template-columns: 1fr; }
}
</style>
