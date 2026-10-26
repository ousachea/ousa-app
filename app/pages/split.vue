<script setup lang="ts">
import { toast } from 'vue-sonner'

// Split a bill after a meal or a trip: who was there, what each thing cost and who shared it, plus service,
// VAT and a tip, in dollars or riel. Everyone's share shows in both currencies at today's rate. The bill
// you're working on stays on this device until you start a new one; nothing is synced.
type Currency = 'USD' | 'KHR'
interface Item { id: string, name: string, price: number | null, people: string[] }
interface Bill { currency: Currency, people: { id: string, name: string }[], items: Item[], service: number, vat: number, tip: number }

const { play } = useSound()
const uid = () => Math.random().toString(36).slice(2, 9)
const blank = (): Bill => {
  const a = uid()
  const b = uid()
  return { currency: 'USD', people: [{ id: a, name: 'Me' }, { id: b, name: '' }], items: [{ id: uid(), name: '', price: null, people: [a, b] }], service: 0, vat: 0, tip: 0 }
}
const isBill = (v: unknown) => !!v && typeof v === 'object' && Array.isArray((v as Bill).people) && Array.isArray((v as Bill).items)
const bill = useRemembered<Bill>('split-bill', blank(), isBill)

const market = useMarketRateInfo()
const rate = computed(() => market.value.rate ?? FALLBACK_RATE)
const money = (v: number, c: Currency = bill.value.currency) => formatMoney(v, c)
const other = computed<Currency>(() => (bill.value.currency === 'USD' ? 'KHR' : 'USD'))
const convert = (v: number) => (bill.value.currency === 'USD' ? v * rate.value : v / rate.value)

// ---------- People ----------
const nameOf = (id: string, i = bill.value.people.findIndex(p => p.id === id)) => bill.value.people[i]?.name.trim() || `Person ${i + 1}`
function addPerson() {
  const id = uid()
  bill.value.people.push({ id, name: '' })
  // Someone who joins is sharing everything entered so far, until you say otherwise
  for (const item of bill.value.items) item.people.push(id)
  nextTick(() => document.querySelector<HTMLInputElement>('.people li:last-child input')?.focus())
}
function removePerson(id: string) {
  if (bill.value.people.length <= 1) return
  bill.value.people = bill.value.people.filter(p => p.id !== id)
  for (const item of bill.value.items) item.people = item.people.filter(p => p !== id)
}

// ---------- Items ----------
function addItem() {
  bill.value.items.push({ id: uid(), name: '', price: null, people: bill.value.people.map(p => p.id) })
  nextTick(() => document.querySelector<HTMLInputElement>('.items li:last-child .item-name')?.focus())
}
const removeItem = (id: string) => (bill.value.items = bill.value.items.filter(i => i.id !== id))
function toggleShare(item: Item, id: string) {
  item.people = item.people.includes(id) ? item.people.filter(p => p !== id) : [...item.people, id]
}
const everyone = (item: Item) => (item.people = bill.value.people.map(p => p.id))

// ---------- The split ----------
// Service and VAT go on the food, then the tip on top, each shared in proportion to what you had
const subtotal = computed(() => bill.value.items.reduce((n, i) => n + (Number(i.price) || 0), 0))
const extras = computed(() => {
  const service = subtotal.value * (bill.value.service || 0) / 100
  const vat = (subtotal.value + service) * (bill.value.vat || 0) / 100
  const tip = (subtotal.value + service + vat) * (bill.value.tip || 0) / 100
  return { service, vat, tip }
})
const grand = computed(() => subtotal.value + extras.value.service + extras.value.vat + extras.value.tip)
const unshared = computed(() => bill.value.items.filter(i => (Number(i.price) || 0) > 0 && !i.people.length))
const shares = computed(() => {
  const own = new Map(bill.value.people.map(p => [p.id, 0]))
  for (const item of bill.value.items) {
    const price = Number(item.price) || 0
    if (!price || !item.people.length) continue
    for (const id of item.people) own.set(id, (own.get(id) ?? 0) + price / item.people.length)
  }
  const factor = subtotal.value ? grand.value / subtotal.value : 0
  return bill.value.people.map((p, i) => ({ id: p.id, name: nameOf(p.id, i), food: own.get(p.id) ?? 0, total: (own.get(p.id) ?? 0) * factor }))
})

// Riel bills round to the nearest 100, the smallest note anyone hands over
const round = (v: number, c: Currency) => (c === 'KHR' ? Math.round(v / 100) * 100 : Math.round(v * 100) / 100)
const summary = computed(() => [
  `Bill: ${money(round(grand.value, bill.value.currency))}`,
  ...shares.value.map(s => `${s.name}: ${money(round(s.total, bill.value.currency))} (${money(round(convert(s.total), other.value), other.value)})`)
].join('\n'))
async function copySummary() {
  try {
    await navigator.clipboard.writeText(summary.value)
    play('copy')
    toast.success('Copied who owes what', { description: 'Paste it in your group chat.' })
  } catch {
    toast.error('Couldn’t copy', { description: 'Your browser blocked the clipboard.' })
  }
}
function startOver() {
  const before = structuredClone(toRaw(bill.value))
  bill.value = blank()
  play('delete')
  toast('Started a new bill', { action: { label: 'Undo', onClick: () => (bill.value = before) } })
}
const EXTRAS = [
  { key: 'service', label: 'Service charge', quick: [0, 5, 10] },
  { key: 'vat', label: 'VAT', quick: [0, 10] },
  { key: 'tip', label: 'Tip', quick: [0, 5, 10] }
] as const
</script>

<template>
  <ToolPage header="bar">
    <div class="workspace">
      <div class="inputs">
        <Step :n="1" title="Who’s splitting?" hint="Everyone who shares the bill. Names are optional.">
          <template #aside>
            <div class="segmented currency" role="radiogroup" aria-label="Bill currency">
              <label v-for="c in (['USD', 'KHR'] as const)" :key="c" :class="{ active: bill.currency === c }">
                <input v-model="bill.currency" type="radio" name="split-currency" :value="c">{{ c === 'USD' ? '$ Dollars' : '៛ Riel' }}
              </label>
            </div>
          </template>
          <div class="panel">
            <ul class="people">
              <li v-for="(p, i) in bill.people" :key="p.id">
                <input v-model="p.name" class="input" :placeholder="`Person ${i + 1}`" :aria-label="`Name of person ${i + 1}`" maxlength="30">
                <button v-if="bill.people.length > 1" type="button" class="icon-btn" :aria-label="`Remove ${nameOf(p.id, i)}`" title="Remove" @click="removePerson(p.id)"><AppIcon name="x" /></button>
              </li>
            </ul>
            <button type="button" class="btn btn-quiet btn-sm" @click="addPerson"><AppIcon name="plus" /> Add a person</button>
          </div>
        </Step>

        <Step :n="2" title="What did you have?" hint="Each thing and its price. Tap names to say who shared it; everyone does at first.">
          <div class="panel">
            <ul class="items">
              <li v-for="(item, i) in bill.items" :key="item.id" :class="{ unshared: (Number(item.price) || 0) > 0 && !item.people.length }">
                <div class="item-row">
                  <input v-model="item.name" class="input item-name" :placeholder="`Item ${i + 1}`" :aria-label="`Item ${i + 1}`" maxlength="40">
                  <span class="price input">
                    <span>{{ bill.currency === 'USD' ? '$' : '៛' }}</span>
                    <GroupedNumberInput v-model="item.price" min="0" :aria-label="`Price of ${item.name || `item ${i + 1}`}`" />
                  </span>
                  <button type="button" class="icon-btn" :aria-label="`Remove ${item.name || `item ${i + 1}`}`" title="Remove" @click="removeItem(item.id)"><AppIcon name="x" /></button>
                </div>
                <div class="sharers" role="group" :aria-label="`Who shared ${item.name || `item ${i + 1}`}`">
                  <button
                    v-for="(p, j) in bill.people"
                    :key="p.id"
                    type="button"
                    class="chip"
                    :class="{ active: item.people.includes(p.id) }"
                    :aria-pressed="item.people.includes(p.id)"
                    @click="toggleShare(item, p.id)"
                  >
                    {{ nameOf(p.id, j) }}
                  </button>
                  <button v-if="item.people.length < bill.people.length" type="button" class="link" @click="everyone(item)">Everyone</button>
                </div>
              </li>
            </ul>
            <button type="button" class="btn btn-quiet btn-sm" @click="addItem"><AppIcon name="plus" /> Add an item</button>
          </div>
        </Step>

        <Step :n="3" title="Service, VAT and tip" hint="As a percentage, if the bill adds them. They’re shared in proportion to what each person had.">
          <div class="panel extras">
            <div v-for="x in EXTRAS" :key="x.key" class="extra">
              <span class="field-head">{{ x.label }}</span>
              <div class="quick">
                <button v-for="v in x.quick" :key="v" type="button" class="chip" :class="{ active: bill[x.key] === v }" @click="bill[x.key] = v">{{ v ? `${v}%` : 'None' }}</button>
                <label class="pct input">
                  <input v-model.number="bill[x.key]" type="number" min="0" max="100" step="0.5" inputmode="decimal" :aria-label="`${x.label} percent`">
                  <span>%</span>
                </label>
              </div>
            </div>
          </div>
        </Step>
      </div>

      <Step :n="4" title="Who owes what" hint="Everyone’s share, with today’s rate for the other currency." class="result-step">
        <div class="panel receipt">
          <p v-if="unshared.length" class="warn">
            {{ unshared.length === 1 ? `“${unshared[0]!.name || 'An item'}” isn’t` : `${unshared.length} items aren’t` }} shared by anyone yet, so {{ unshared.length === 1 ? 'it’s' : 'they’re' }} left out.
          </p>
          <ul class="shares">
            <li v-for="s in shares" :key="s.id">
              <span class="who">{{ s.name }}</span>
              <span class="amounts">
                <strong>{{ money(round(s.total, bill.currency)) }}</strong>
                <small>{{ money(round(convert(s.total), other), other) }}</small>
              </span>
            </li>
          </ul>
          <dl class="totals">
            <div><dt>Food and drinks</dt><dd>{{ money(subtotal) }}</dd></div>
            <div v-if="extras.service"><dt>Service {{ bill.service }}%</dt><dd>{{ money(extras.service) }}</dd></div>
            <div v-if="extras.vat"><dt>VAT {{ bill.vat }}%</dt><dd>{{ money(extras.vat) }}</dd></div>
            <div v-if="extras.tip"><dt>Tip {{ bill.tip }}%</dt><dd>{{ money(extras.tip) }}</dd></div>
            <div class="grand"><dt>Bill</dt><dd>{{ money(round(grand, bill.currency)) }}</dd></div>
          </dl>
          <p class="rate">At {{ Math.round(rate).toLocaleString('en-US') }} ៛ to the dollar{{ market.from === 'live' ? ', today’s market rate' : market.from === 'saved' ? ', the last rate saved here' : ', a typical rate' }}.</p>
          <div class="buttons">
            <button type="button" class="btn" :disabled="!grand" @click="copySummary">Copy who owes what</button>
            <button type="button" class="btn btn-quiet" @click="startOver">Start a new bill</button>
          </div>
        </div>
      </Step>
    </div>
  </ToolPage>
</template>

<style scoped>
.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 2rem;
}

.inputs {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  min-width: 0;
}

/* From a tablet held upright: the inputs on the left, the receipt beside them, staying in view */
@media (min-width: 760px) {
  .workspace {
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
    align-items: start;
  }

  .result-step {
    position: sticky;
    top: var(--pin-top);
  }
}

.panel {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.panel > .btn {
  align-self: flex-start;
}

.people,
.items,
.shares {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.people li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.people .input {
  flex: 1;
  min-width: 0;
}

.items li {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--line);
}

.items li.unshared .sharers {
  outline: 2px dashed var(--orange);
  outline-offset: 3px;
  border-radius: var(--radius);
}

.item-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.item-name {
  flex: 1 1 auto;
  min-width: 0;
}

.price {
  flex: 0 1 9rem;
  min-width: 6rem;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.price span {
  color: var(--ink-3);
  font-weight: 600;
}

.price :deep(input) {
  min-width: 0;
  width: 100%;
  padding: 0;
  font: inherit;
  font-weight: 700;
  background: transparent;
  border: 0;
  outline: none;
}

.sharers,
.quick {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}

.currency label {
  white-space: nowrap;
}

.chip {
  padding: 0.35rem 0.7rem;
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-2);
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  cursor: pointer;
}

.chip.active {
  color: var(--on-accent);
  background: var(--accent);
  border-color: var(--accent);
}

.link {
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-2);
  background: none;
  border: 0;
  text-decoration: underline;
  cursor: pointer;
}

.extras {
  gap: 1rem;
}

.extra {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.pct {
  width: 5.5rem;
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.pct input {
  min-width: 0;
  width: 100%;
  padding: 0;
  font: inherit;
  background: transparent;
  border: 0;
  outline: none;
}

.shares li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px dashed var(--line);
}

.who {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.amounts {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-variant-numeric: tabular-nums;
}

.amounts strong {
  font-size: var(--text-xl);
}

.amounts small {
  color: var(--ink-2);
}

.totals {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.totals div {
  display: flex;
  justify-content: space-between;
  color: var(--ink-2);
}

.totals dd {
  margin: 0;
}

.totals .grand {
  padding-top: 0.4rem;
  font-weight: 800;
  color: var(--ink);
  border-top: 2px solid var(--ink);
}

.rate {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--ink-3);
}

.warn {
  margin: 0;
  padding: 0.6rem 0.75rem;
  font-size: var(--text-sm);
  color: var(--warn-ink);
  background: color-mix(in srgb, var(--orange) 12%, var(--surface));
  border-radius: var(--radius);
}

.buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
</style>
