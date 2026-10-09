<script setup lang="ts">
import type { BulkAction } from '~/composables/useBulkSelect'
import { toast } from 'vue-sonner'
import type { Currency } from '~/utils/exchange'
import type { CsvColumn } from '~/utils/transfer'
import type { MenuEntry } from '~/composables/useContextMenu'

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
  // Device details (CHECKLIST.md #45, #46), all optional
  company?: string
  model?: string
  generation?: string
  year?: number | null // release year
  storage?: number | null // GB
  ram?: number | null // GB
  display?: number | null // inches
  createdAt?: string // when it was added here (ISO); older items fall back to the purchase date
  favorite?: boolean // starred: shown on the home page (#66)
}

// The kind of thing is the old `category` field; the list of kinds lives in utils/devices.ts (#44, #48, #49)
const CATEGORIES = THING_TYPES.map(t => t.key)
const typeLabel = (key: string) => typeOf(key).label

// Each kind gets its own tag colour, so a glance tells phones from vehicles
const categoryStyle = (category: string) => {
  const color = typeOf(category).color
  // White label text where it reads well, dark ink on lighter colours like orange
  return { '--cat': color, '--cat-ink': contrastRatio(color, '#ffffff') < 3 ? '#1b1f2a' : '#ffffff' }
}
const SORTS = [
  { value: 'value', label: 'Highest value' },
  { value: 'added', label: 'Recently added' },
  { value: 'newest', label: 'Newest purchase' },
  { value: 'oldest', label: 'Oldest purchase' },
  { value: 'company', label: 'Company' },
  { value: 'type', label: 'Type' },
  { value: 'year', label: 'Release year' },
  { value: 'name', label: 'Name' }
] as const

const { play } = useSound()
// Demo (the app icon switches it on): a typical set of gadgets, a vehicle and something bought in riel
const DEMO = (): Omit<Thing, 'id'>[] => [
  { name: 'Apple iPhone 15 Pro', category: 'Phone', company: 'Apple', model: 'iPhone 15 Pro', year: 2023, storage: 256, ram: 8, display: 6.1, purchaseDate: isoDaysAgo(420), price: 1099, currency: 'USD', currentValue: null, notes: 'Natural titanium' },
  { name: 'Apple MacBook Air 13-inch M2', category: 'Laptop', company: 'Apple', model: 'MacBook Air 13-inch', generation: 'M2', year: 2022, storage: 512, ram: 8, display: 13.6, purchaseDate: isoDaysAgo(760), price: 1299, currency: 'USD', currentValue: null, notes: 'For work' },
  { name: 'Lenovo Legion Y700 Gen 2', category: 'Tablet', company: 'Lenovo', model: 'Legion Y700', generation: 'Gen 2', year: 2023, storage: 256, display: 8.8, purchaseDate: isoDaysAgo(300), price: 380, currency: 'USD', currentValue: null, notes: '' },
  { name: 'Dell UltraSharp U2723QE', category: 'Monitor', company: 'Dell', model: 'UltraSharp U2723QE', year: 2022, display: 27, purchaseDate: isoDaysAgo(500), price: 580, currency: 'USD', currentValue: null, notes: '' },
  { name: 'Logitech MX Master 3S', category: 'Mouse', company: 'Logitech', model: 'MX Master 3S', year: 2022, purchaseDate: isoDaysAgo(200), price: 99, currency: 'USD', currentValue: null, notes: '' },
  { name: 'Sony WH-1000XM5', category: 'Headphones', company: 'Sony', model: 'WH-1000XM5', year: 2022, purchaseDate: isoDaysAgo(240), price: 399, currency: 'USD', currentValue: null, notes: '' },
  { name: 'Sony PlayStation 5 Slim', category: 'Gaming', company: 'Sony', model: 'PlayStation 5', generation: 'Slim', year: 2023, storage: 1000, purchaseDate: isoDaysAgo(330), price: 499, currency: 'USD', currentValue: null, notes: '' },
  { name: 'Honda Dream 125', category: 'Vehicle', company: 'Honda', purchaseDate: isoDaysAgo(1100), price: 2350, currency: 'USD', currentValue: 1800, notes: 'Plate 2AB-1234' },
  { name: 'Rice cooker', category: 'Home', purchaseDate: isoDaysAgo(60), price: 180000, currency: 'KHR', currentValue: null, notes: '' }
]
const { items, ready, sync, add, addMany, update, replace, remove, restore } = useCollection<Thing>('things', undefined, { demo: DEMO })
// Today's rate, the last one saved here, or a typical one (labelled) when none ever loaded (#69)
const rateInfo = useMarketRateInfo()
const rate = computed(() => rateInfo.value.rate)

// Pull down on a phone to sync again (CHECKLIST.md #26)
usePullToRefresh(async () => {
  await sync.retry()
  toast(sync.signedIn.value ? 'Up to date with your account' : 'Refreshed', { duration: 1800 })
})

const today = () => localIsoDate()
// New items start in the category and currency used last time (CHECKLIST.md #14)
const lastCategory = useRemembered('things-category', 'Phone', v => NEW_TYPES.some(t => t.key === v))
const lastCurrency = useRemembered<Currency>('things-currency', 'USD', v => v === 'USD' || v === 'KHR')
const blank = (): Omit<Thing, 'id'> => ({
  name: '', category: lastCategory.value, purchaseDate: today(), price: 0, currency: lastCurrency.value, currentValue: null, notes: '',
  company: '', model: '', generation: '', year: null, storage: null, ram: null, display: null
})
const form = reactive(blank())
const editingId = ref<string>()
// Adding and editing happen in a popup
const formOpen = ref(false)

const draft = useDraft('things', form, {
  active: () => formOpen.value && !editingId.value,
  isEmpty: f => !f.name.trim() && !f.price && !f.notes.trim() && !f.model?.trim(),
  summary: f => [f.name || [f.company, f.model].filter(Boolean).join(' '), typeLabel(f.category), f.price && `${f.price} ${f.currency}`]
})

// ---------- Type first, then details (CHECKLIST.md #44) ----------
const step = ref<'type' | 'details'>('type')
function chooseType(key: string) {
  form.category = key
  step.value = 'details'
  play('select')
}

useAddAction(() => openAdd())
function openAdd() {
  cancel()
  step.value = 'type'
  formOpen.value = true
  draft.check()
  play('open')
}
// Continuing a draft skips straight to its details
function resumeDraft() {
  draft.resume()
  step.value = 'details'
}

// ---------- Company / model / generation suggestions (#45) and details (#46) ----------
const formType = computed(() => typeOf(form.category))
const companyOptions = computed(() => companiesFor(form.category).map(name => ({ value: name, logo: companyLogo(name) })))
const modelOptions = computed(() => modelsFor(form.category, form.company ?? '').map(x => ({
  value: x.name,
  hint: [form.company ? '' : x.company, x.year].filter(Boolean).join(' · ')
})))
const currentModel = computed(() => findModel(form.category, form.company ?? '', form.model ?? '') ?? (form.company ? undefined : modelsFor(form.category, '').find(x => x.name.toLowerCase() === (form.model ?? '').trim().toLowerCase())))
const generationOptions = computed(() => (currentModel.value?.generations ?? []).map(g => ({ value: g.name, hint: g.year ? String(g.year) : undefined })))
function pickModel(name: string) {
  const found = modelsFor(form.category, form.company ?? '').find(x => x.name === name)
  if (found && !form.company) form.company = found.company
}

// The name writes itself from company, model and generation until you type your own
const nameTouched = ref(false)
const autoName = computed(() => [form.company, form.model, form.generation].map(x => x?.trim()).filter(Boolean).join(' '))
watch(autoName, (n) => {
  if (!nameTouched.value) form.name = n
})

const specSuggestion = computed(() => {
  const s = suggestSpecs(form.category, form.company || currentModel.value?.company || '', form.model ?? '', form.generation ?? '')
  if (!s) return undefined
  // Only what's missing and worth asking for this kind of thing
  const out = {
    year: formType.value.specs.includes('year') && !form.year ? s.year : undefined,
    ram: formType.value.specs.includes('ram') && !form.ram ? s.ram : undefined,
    display: formType.value.specs.includes('display') && !form.display ? s.display : undefined
  }
  return out.year || out.ram || out.display ? out : undefined
})
const specIgnored = ref(false)
watch(() => [form.model, form.generation], () => (specIgnored.value = false))
const specText = (x: { year?: number, ram?: number, display?: number }) =>
  [x.year && `Released ${x.year}`, x.ram && `${x.ram} GB RAM`, x.display && `${x.display}″ screen`].filter(Boolean).join(' · ')
function useSpecs() {
  const x = specSuggestion.value
  if (!x) return
  if (x.year) form.year = x.year
  if (x.ram) form.ram = x.ram
  if (x.display) form.display = x.display
  play('select')
}
const storageChoices = computed(() => currentModel.value?.storage ?? [])

// A short line of details for cards: "2023 · 256 GB · 8 GB RAM · 6.1″"
const specLine = (t: Thing) => [t.generation && t.model ? t.generation : '', t.year, t.storage && storageLabel(t.storage), t.ram && `${t.ram} GB RAM`, t.display && `${t.display}″`].filter(Boolean).join(' · ')

// Company logos (#50): the company's own site icon, the kind's icon if it can't load
const brokenLogos = ref(new Set<string>())
const logoOf = (t: Pick<Thing, 'company'>) => {
  const src = companyLogo(t.company)
  return src && !brokenLogos.value.has(src) ? src : undefined
}
const query = ref('')

// ---------- Filters (#47), remembered (#14) ----------
const filters = useRemembered('things-filters', { type: '', company: '', year: '', storage: '', generation: '' }, v => !!v && typeof v === 'object')
const filterOptions = computed(() => {
  const uniq = (xs: (string | number | null | undefined)[]) => [...new Set(xs.filter(x => x !== null && x !== undefined && x !== '').map(String))]
  return {
    type: uniq(items.value.map(t => t.category)).map(v => ({ value: v, label: typeLabel(v) })),
    company: uniq(items.value.map(t => t.company)).sort().map(v => ({ value: v, label: v })),
    year: uniq(items.value.map(t => t.year)).sort().reverse().map(v => ({ value: v, label: v })),
    storage: uniq(items.value.map(t => t.storage)).sort((a, b) => Number(a) - Number(b)).map(v => ({ value: v, label: storageLabel(Number(v)) })),
    generation: uniq(items.value.map(t => t.generation)).sort().map(v => ({ value: v, label: v }))
  }
})
const FILTER_LABELS = { type: 'All types', company: 'All companies', year: 'Any year', storage: 'Any storage', generation: 'Any generation' } as const
type FilterKey = keyof typeof FILTER_LABELS
const filterKeys = computed(() => (Object.keys(FILTER_LABELS) as FilterKey[]).filter(k => filterOptions.value[k].length > (k === 'type' ? 1 : 0) || filters.value[k]))
const activeFilters = computed(() => (Object.keys(FILTER_LABELS) as FilterKey[]).filter(k => filters.value[k]).length)
function clearFilters() {
  filters.value = { type: '', company: '', year: '', storage: '', generation: '' }
  play('select')
}
const matchesFilters = (t: Thing) => {
  const f = filters.value
  return (!f.type || t.category === f.type) && (!f.company || t.company === f.company) && (!f.year || String(t.year) === f.year)
    && (!f.storage || String(t.storage) === f.storage) && (!f.generation || t.generation === f.generation)
}

const filtersOpen = ref(false)

// Cards or a compact list (#15)
const view = useRemembered<'cards' | 'list'>('things-view', 'cards', v => v === 'cards' || v === 'list')

const sort = useRemembered<(typeof SORTS)[number]['value']>('things-sort', 'value', v => SORTS.some(s => s.value === v))

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
  const list = items.value.filter(t => matchesFilters(t) && (!q || [t.name, typeLabel(t.category), t.company, t.model, t.generation, t.notes].join(' ').toLowerCase().includes(q)))
  return [...list].sort((a, b) => {
    if (sort.value === 'value') return worthUsd(b) - worthUsd(a)
    if (sort.value === 'added') return (b.createdAt ?? b.purchaseDate).localeCompare(a.createdAt ?? a.purchaseDate)
    if (sort.value === 'newest') return b.purchaseDate.localeCompare(a.purchaseDate)
    if (sort.value === 'oldest') return a.purchaseDate.localeCompare(b.purchaseDate)
    // Things without a company or year go last
    if (sort.value === 'company') return (a.company || '\uffff').localeCompare(b.company || '\uffff') || a.name.localeCompare(b.name)
    if (sort.value === 'type') return typeLabel(a.category).localeCompare(typeLabel(b.category)) || a.name.localeCompare(b.name)
    if (sort.value === 'year') return (b.year ?? 0) - (a.year ?? 0) || a.name.localeCompare(b.name)
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

// Adding something with the same name as one you have asks first (CHECKLIST.md #29)
const duplicateOf = ref<Thing>()
const sameName = (a: string, b: string) => a.trim().toLowerCase().replace(/\s+/g, ' ') === b.trim().toLowerCase().replace(/\s+/g, ' ')
watch(() => form.name, () => (duplicateOf.value = undefined))
function openDuplicate() {
  const t = duplicateOf.value
  duplicateOf.value = undefined
  // The popup is already open: switch it to editing the one you have
  if (t) edit(t)
}

function save(force = false) {
  if (!canSave.value) return
  if (!editingId.value && !force) {
    // Same name, or the same device (company, model, generation and storage)
    const existing = items.value.find(t => sameName(t.name, form.name) || (!!form.model?.trim() && sameName(t.model ?? '', form.model) && sameName(t.company ?? '', form.company ?? '')
      && sameName(t.generation ?? '', form.generation ?? '') && (t.storage ?? null) === (form.storage || null)))
    if (existing) {
      duplicateOf.value = existing
      play('warning')
      nextTick(() => document.querySelector('dialog[open] .dup')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
      return
    }
  }
  duplicateOf.value = undefined
  // Number boxes left empty come back as '' — store them as "not given"
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)
  const record = {
    ...form,
    name: form.name.trim(),
    notes: form.notes.trim(),
    company: companyOf(form.company)?.name ?? form.company?.trim() ?? '',
    model: form.model?.trim() ?? '',
    generation: form.generation?.trim() ?? '',
    year: num(form.year),
    storage: num(form.storage),
    ram: num(form.ram),
    display: num(form.display),
    // An empty field means "estimate it"; keep 0 as a real value (worth nothing)
    currentValue: typeof form.currentValue === 'number' ? form.currentValue : null
  }
  if (editingId.value) {
    const before = update(editingId.value, record)
    toastSaved(before && (() => replace(before)))
  } else {
    const added = add({ ...record, createdAt: new Date().toISOString() })
    draft.clear()
    lastCategory.value = record.category
    lastCurrency.value = record.currency
    toast.success(`${record.name} added`, { action: { label: 'Undo', onClick: () => remove(added.id, { undoAdd: true }) } })
  }
  play('success')
  cancel()
}

// Right-click / long-press (CHECKLIST.md #27)
const menuFor = useRowMenu()
const thingMenu = (t: Thing): MenuEntry[] => [
  { label: 'Edit', icon: 'edit', run: () => edit(t) },
  { label: t.favorite ? 'Remove from favourites' : 'Add to favourites', icon: 'star', run: () => toggleFavourite(t, t.name, update, replace) },
  { label: 'Duplicate', icon: 'duplicate', run: () => {
    const { id: _, ...rest } = t
    const copy = add({ ...rest, name: `${t.name} (copy)` })
    play('success')
    toast.success('Duplicated', { description: copy.name, action: { label: 'Undo', onClick: () => remove(copy.id, { undoAdd: true }) } })
  } },
  '-',
  { label: 'Delete', icon: 'delete', danger: true, run: () => del(t) }
]

function edit(t: Thing) {
  editingId.value = t.id
  Object.assign(form, {
    name: t.name, category: t.category, purchaseDate: t.purchaseDate, price: t.price, currency: t.currency, currentValue: t.currentValue ?? null, notes: t.notes,
    company: t.company ?? '', model: t.model ?? '', generation: t.generation ?? '', year: t.year ?? null, storage: t.storage ?? null, ram: t.ram ?? null, display: t.display ?? null
  })
  nameTouched.value = true
  step.value = 'details'
  formOpen.value = true
  play('open')
}

function cancel() {
  editingId.value = undefined
  formOpen.value = false
  nameTouched.value = false
  Object.assign(form, blank())
}

// ---------- Import & export (CHECKLIST.md #18) ----------
const transferOpen = ref(false)
const THING_COLUMNS: CsvColumn<Thing>[] = [
  { header: 'Name', get: t => t.name },
  { header: 'Type', get: t => typeLabel(t.category) },
  { header: 'Company', get: t => t.company ?? '' },
  { header: 'Model', get: t => t.model ?? '' },
  { header: 'Generation', get: t => t.generation ?? '' },
  { header: 'Release year', get: t => t.year ?? '' },
  { header: 'Storage (GB)', get: t => t.storage ?? '' },
  { header: 'RAM (GB)', get: t => t.ram ?? '' },
  { header: 'Screen (in)', get: t => t.display ?? '' },
  { header: 'Bought on', get: t => t.purchaseDate },
  { header: 'Price', get: t => t.price },
  { header: 'Currency', get: t => t.currency },
  { header: 'Worth now', get: t => t.currentValue ?? '' },
  { header: 'Notes', get: t => t.notes }
]
// Type by key or label ("Game console" → Gaming); anything unknown is Other
const typeFrom = (s: string) => THING_TYPES.find(t => [t.key, t.label].some(x => x.toLowerCase() === s.trim().toLowerCase()))?.key ?? 'Other'
const positive = (n: number | undefined) => (n && n > 0 ? n : null)
function thingFrom(r: { name: string, type: string, date: string, price?: number, currency: string, worth?: number, notes: string, company?: string, model?: string, generation?: string, year?: number, storage?: number, ram?: number, display?: number }): Omit<Thing, 'id'> | undefined {
  const name = r.name.trim() || [r.company, r.model, r.generation].filter(Boolean).join(' ')
  if (!name) return undefined
  return {
    name,
    category: typeFrom(r.type),
    purchaseDate: toIsoDate(r.date) || today(),
    price: r.price && r.price > 0 ? r.price : 0,
    currency: r.currency.toUpperCase() === 'KHR' ? 'KHR' : 'USD',
    currentValue: positive(r.worth),
    notes: r.notes.trim(),
    company: r.company?.trim() ?? '',
    model: r.model?.trim() ?? '',
    generation: r.generation?.trim() ?? '',
    year: positive(r.year),
    storage: positive(r.storage),
    ram: positive(r.ram),
    display: positive(r.display),
    createdAt: new Date().toISOString()
  }
}
const thingFromRow = (r: Record<string, string>) => thingFrom({
  name: cellOf(r, 'name', 'item', 'device'), type: cellOf(r, 'type', 'category'), date: cellOf(r, 'bought on', 'purchase date', 'date'),
  price: toNumber(cellOf(r, 'price', 'paid', 'cost')), currency: cellOf(r, 'currency'), worth: toNumber(cellOf(r, 'worth now', 'value', 'current value')),
  notes: cellOf(r, 'notes', 'note'), company: cellOf(r, 'company', 'brand', 'manufacturer'), model: cellOf(r, 'model'), generation: cellOf(r, 'generation'),
  year: toNumber(cellOf(r, 'release year', 'year')), storage: toNumber(cellOf(r, 'storage (gb)', 'storage')), ram: toNumber(cellOf(r, 'ram (gb)', 'ram')), display: toNumber(cellOf(r, 'screen (in)', 'screen', 'display'))
})
const thingFromJSON = (r: Record<string, unknown>) => thingFrom({
  name: String(r.name ?? ''), type: String(r.category ?? r.type ?? ''), date: String(r.purchaseDate ?? ''), price: Number(r.price), currency: String(r.currency ?? ''),
  worth: r.currentValue == null ? undefined : Number(r.currentValue), notes: String(r.notes ?? ''), company: String(r.company ?? ''), model: String(r.model ?? ''),
  generation: String(r.generation ?? ''), year: Number(r.year) || undefined, storage: Number(r.storage) || undefined, ram: Number(r.ram) || undefined, display: Number(r.display) || undefined
})
const thingKey = (t: Omit<Thing, 'id'>) => `${t.name.toLowerCase()}|${t.purchaseDate}`

// ---------- Select several (useBulkSelect) ----------
const bulkText = (n: number) => `${n} ${n === 1 ? 'thing' : 'things'}`
const sel = useBulkSelect({ items, shown: visible, onDelete: () => deleteSelected() })
function deleteSelected() {
  sel.guard(`Delete ${bulkText(sel.selected.size)}?`, () => bulkRemove(sel.selectedItems as Thing[], remove, restore, bulkText))
}
const bulkActions = computed<BulkAction[]>(() => [
  { label: allFavourite(sel.selectedItems as Thing[]) ? 'Unfavourite' : 'Favourite', icon: 'star', run: () => bulkFavourite(sel.selectedItems as Thing[], update, replace, bulkText) },
  { label: 'Delete', icon: 'delete', danger: true, run: deleteSelected }
])

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
      <div class="head-buttons">
        <ClientOnly><button type="button" class="btn btn-quiet" @click="transferOpen = true">Import / Export</button></ClientOnly>
        <button type="button" class="btn add-btn" @click="openAdd">+ Add item</button>
      </div>
    </template>

    <TransferDialog
      :open="transferOpen"
      title="Things I own"
      collection="things"
      app="/things"
      :items="items"
      :columns="THING_COLUMNS"
      :from-row="thingFromRow"
      :from-json="thingFromJSON"
      :same-as="thingKey"
      :add-many="addMany"
      :remove="remove"
      @close="transferOpen = false"
    />

    <Modal :open="formOpen" :title="editingId ? 'Edit item' : 'Add something you own'" @close="cancel">
      <form v-validate class="form" @submit.prevent="save()">
        <DraftCard v-if="draft.offered.value" :lines="draft.lines.value" @resume="resumeDraft()" @discard="draft.discard()" />

        <!-- Step 1: what kind of thing (#44) -->
        <div v-if="step === 'type'" class="field">
          <span class="field-head">What are you adding?</span>
          <div class="type-grid" role="radiogroup" aria-label="Type">
            <button
              v-for="t in NEW_TYPES"
              :key="t.key"
              type="button"
              role="radio"
              class="type-option"
              :aria-checked="form.category === t.key"
              :autofocus="form.category === t.key || undefined"
              :style="categoryStyle(t.key)"
              @click="chooseType(t.key)"
            >
              <span class="cat-option-icon"><CategoryIcon :name="t.icon" /></span>
              {{ t.label }}
            </button>
          </div>
        </div>

        <template v-else>
          <DuplicateCard
            v-if="duplicateOf"
            :title="duplicateOf.name"
            :detail="[typeLabel(duplicateOf.category), specLine(duplicateOf), `bought ${formatDate(duplicateOf.purchaseDate)}`].filter(Boolean).join(' · ')"
            open-label="Open it"
            @open="openDuplicate"
            @keep="save(true)"
            @cancel="duplicateOf = undefined"
          />
          <div class="type-line">
            <span class="type-chip" :style="categoryStyle(form.category)"><CategoryIcon :name="formType.icon" />{{ formType.label }}</span>
            <button type="button" class="link" @click="step = 'type'">Change type</button>
          </div>

          <div class="device-row">
            <label class="field">
              <span class="field-head">Company <span class="optional">Optional</span></span>
              <ComboInput v-model="form.company" :options="companyOptions" placeholder="Apple, Samsung, Lenovo…" aria-label="Company" />
            </label>
            <label class="field">
              <span class="field-head">Model <span class="optional">Optional</span></span>
              <ComboInput v-model="form.model" :options="modelOptions" :placeholder="modelOptions[0]?.value ?? 'Model name'" aria-label="Model" @pick="pickModel" />
            </label>
            <label v-if="generationOptions.length || form.generation" class="field">
              <span class="field-head">Generation</span>
              <ComboInput v-model="form.generation" :options="generationOptions" placeholder="Gen 3, M2, 2nd generation…" aria-label="Generation" />
            </label>
          </div>
          <div v-if="specSuggestion && !specIgnored" class="spec-suggest" role="status">
            <span><strong>Suggested details:</strong> {{ specText(specSuggestion) }}</span>
            <button type="button" class="link" @click="useSpecs">Use</button>
            <button type="button" class="link" @click="specIgnored = true">Ignore</button>
          </div>

          <label class="field">
            <span class="field-head">Name</span>
            <input v-model="form.name" class="input" :placeholder="autoName || 'iPhone 16 Pro Max'" required data-error="Give it a name, like iPhone 16 Pro" @input="nameTouched = true">
          </label>
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
        <div v-if="formType.specs.length" class="specs">
          <label v-if="formType.specs.includes('year')" class="field">
            <span class="field-head">Release year <span class="optional">Optional</span></span>
            <input v-model.number="form.year" class="input" type="number" inputmode="numeric" min="1970" :max="new Date().getFullYear() + 1" placeholder="2024">
          </label>
          <div v-if="formType.specs.includes('storage')" class="field">
            <span class="field-head">Storage <span class="optional">GB</span></span>
            <input v-model.number="form.storage" class="input" type="number" inputmode="numeric" min="1" placeholder="256" aria-label="Storage in GB">
            <span v-if="storageChoices.length" class="quick-picks" aria-label="Sizes it came in">
              <button v-for="g in storageChoices" :key="g" type="button" class="pick" :aria-pressed="form.storage === g" @click="form.storage = g">{{ storageLabel(g) }}</button>
            </span>
          </div>
          <label v-if="formType.specs.includes('ram')" class="field">
            <span class="field-head">RAM <span class="optional">GB</span></span>
            <input v-model.number="form.ram" class="input" type="number" inputmode="numeric" min="1" placeholder="8">
          </label>
          <label v-if="formType.specs.includes('display')" class="field">
            <span class="field-head">Screen <span class="optional">inches</span></span>
            <input v-model.number="form.display" class="input" type="number" inputmode="decimal" min="1" step="0.1" placeholder="6.1">
          </label>
        </div>
        <MoreFields :filled="!!form.currentValue || !!form.notes">
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
        </MoreFields>
        </template>
        <div class="actions">
          <button v-if="step === 'details'" type="submit" class="btn">{{ editingId ? 'Save changes' : 'Add item' }}</button>
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
                <p v-if="rateInfo.from === 'fallback' && items.some(t => t.currency === 'KHR')" class="note">
                  Couldn’t get today’s exchange rate, so riel prices are counted at about {{ FALLBACK_RATE.toLocaleString('en-US') }} ៛ to the dollar.
                </p>
                <p v-if="totals.estimates" class="note">
                  {{ totals.estimates === items.length ? 'All values are estimates' : `${totals.estimates} of ${items.length} values are estimates` }} from age and category. Edit an item to enter its real value.
                </p>
              </div>

              <!-- Where the value is: one bar split by category, then each category with its share -->
              <div class="breakdown">
                <span class="label">Where the value is</span>
                <div class="stack" role="img" :aria-label="byCategory.map(c => `${typeLabel(c.category)} ${Math.round((c.usd / (totals.now || 1)) * 100)}%`).join(', ')">
                  <span
                    v-for="c in byCategory"
                    :key="c.category"
                    :style="{ ...categoryStyle(c.category), flexGrow: c.usd || 0.0001 }"
                    :title="`${typeLabel(c.category)}: ${formatMoney(c.usd, 'USD')}`"
                  />
                </div>
                <ul class="cats">
                  <li v-for="c in byCategory" :key="c.category" :style="categoryStyle(c.category)">
                    <span class="cat-dot" aria-hidden="true"><CategoryIcon :name="typeOf(c.category).icon" /></span>
                    <span class="cat-name">{{ typeLabel(c.category) }}<small>{{ c.count }} {{ c.count === 1 ? 'item' : 'items' }}</small></span>
                    <span class="cat-share">{{ Math.round((c.usd / (totals.now || 1)) * 100) }}%</span>
                    <b>{{ formatMoney(c.usd, 'USD') }}</b>
                  </li>
                </ul>
              </div>
            </section>

            <div v-sticky-bar class="toolbar">
              <DataSource :sync="sync" />
              <BulkToggle v-if="items.length" :select="sel" />
              <input v-model="query" class="input search" type="search" placeholder="Search your things" aria-label="Search your things">
              <AppSelect v-model="sort" class="sort" aria-label="Sort by" :options="SORTS" />
              <div class="views segmented" role="radiogroup" aria-label="View">
                <label :class="{ active: view === 'cards' }"><input v-model="view" type="radio" name="things-view" value="cards">Cards</label>
                <label :class="{ active: view === 'list' }"><input v-model="view" type="radio" name="things-view" value="list">List</label>
              </div>
              <!-- Filters (#47): only the ones your things have values for; folded away on phones -->
              <button v-if="filterKeys.length" type="button" class="btn btn-quiet btn-sm filters-toggle" :aria-expanded="filtersOpen" @click="filtersOpen = !filtersOpen">
                Filters<template v-if="activeFilters"> ({{ activeFilters }})</template>
              </button>
              <div v-if="filterKeys.length" class="filters" :class="{ open: filtersOpen }" role="group" aria-label="Filter">
                <AppSelect
                  v-for="k in filterKeys"
                  :key="k"
                  v-model="filters[k]"
                  class="filter-select"
                  :class="{ set: filters[k] }"
                  :aria-label="FILTER_LABELS[k]"
                  :options="[{ value: '', label: FILTER_LABELS[k] }, ...filterOptions[k]]"
                />
                <button v-if="activeFilters" type="button" class="link" @click="clearFilters">Clear filters</button>
              </div>
            </div>

            <!-- One card per thing: what it is, what you paid → what it's worth now, and how much of its price it keeps -->
            <TransitionGroup tag="ul" name="list" class="things" :class="view">
              <li v-for="t in visible" :key="t.id" :data-item-id="t.id" class="thing bulk-row" v-bind="menuFor(() => thingMenu(t), t.name)" v-swipe-delete="() => del(t)" :data-bulk="sel.selecting || undefined" @click.capture="sel.onRowClick($event, t.id)" :class="{ editing: editingId === t.id, 'bulk-picked': sel.has(t.id) }" :style="categoryStyle(t.category)">
                <BulkCheck v-if="sel.selecting" :checked="sel.has(t.id)" :label="`Select ${t.name}`" @pick="sel.pick(t.id, $event)" />
                <header class="thing-head">
                  <span class="thing-icon" :class="{ logo: logoOf(t) }" aria-hidden="true">
                    <img v-if="logoOf(t)" :src="logoOf(t)" alt="" loading="lazy" referrerpolicy="no-referrer" @error="brokenLogos.add(logoOf(t)!)">
                    <CategoryIcon v-else :name="typeOf(t.category).icon" />
                  </span>
                  <span class="thing-title">
                    <strong>{{ t.name }}<span v-if="t.favorite" class="fav" title="Favourite" aria-label="Favourite"> ★</span></strong>
                    <span>{{ [typeLabel(t.category), t.company && !t.name.toLowerCase().includes(t.company.toLowerCase()) ? t.company : ''].filter(Boolean).join(' · ') }} · {{ owned(t.purchaseDate) }}</span>
                    <span v-if="specLine(t)" class="spec-line">{{ specLine(t) }}</span>
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
            <p v-if="!visible.length" class="empty-search">
              Nothing matches{{ query ? ` “${query}”` : ' these filters' }}.
              <button type="button" class="link" @click="query = ''; clearFilters()">Show everything</button>
            </p>
          </template>

          <div v-else-if="ready" class="panel">
            <EmptyState title="Nothing here yet" icon="things" action="+ Add your first item" @action="openAdd">
              Add your phone, laptop or anything valuable to see what you paid, what it’s worth today, and where your money went.
            </EmptyState>
          </div>
          <SkeletonList v-else variant="cards" :count="3" label="Loading your things" />
          <template #fallback><SkeletonList variant="cards" :count="3" label="Loading your things" /></template>
        </ClientOnly>
    <BulkBar :select="sel" :actions="bulkActions" label="Selected things" noun="things" />
  </ToolPage>
</template>

<style scoped>
.head-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

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
  /* The app colour, nudged toward the text colour so it reads on light and dark surfaces */
  color: color-mix(in srgb, var(--accent) 55%, var(--ink));
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
/* ---------- Add: type first (#44) ---------- */
.type-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(6.25rem, 1fr));
  gap: 0.45rem;
}

.type-option {
  padding: 0.75rem 0.3rem 0.6rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--ink-2);
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 14px;
  cursor: pointer;
  transition: border-color var(--dur-fast), background-color var(--dur-fast), color var(--dur-fast), translate var(--dur-fast);
}

.type-option:hover {
  color: var(--ink);
  border-color: var(--cat);
  translate: 0 -1px;
}

.type-option[aria-checked='true'] {
  color: var(--ink);
  background: color-mix(in srgb, var(--cat) 12%, var(--surface));
  border-color: var(--cat);
}

.type-option .cat-option-icon {
  width: 2.4rem;
  height: 2.4rem;
  font-size: 1.3rem;
}

.type-line {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.type-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.75rem 0.25rem 0.5rem;
  font-weight: 700;
  color: var(--cat-ink);
  background: var(--cat);
  border-radius: 999px;
}

.device-row,
.specs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 9.5rem), 1fr));
  gap: 0.75rem;
}

.spec-suggest {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.75rem;
  padding: 0.6rem 0.8rem;
  font-size: var(--text-sm);
  color: var(--ink-2);
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
  border-radius: 12px;
}

.spec-suggest strong {
  color: var(--ink);
}

.quick-picks {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.pick {
  padding: 0.15rem 0.55rem;
  font: inherit;
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--ink-2);
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 999px;
  cursor: pointer;
}

.pick[aria-pressed='true'] {
  color: var(--on-accent);
  background: var(--accent-btn, var(--accent));
  border-color: transparent;
}

.spec-line {
  font-size: var(--text-sm);
  color: var(--ink-3);
}

/* Company logo (#50) on a white tile so any logo reads */
.thing-icon.logo {
  background: #fff;
  box-shadow: inset 0 0 0 1px var(--line);
}

.thing-icon.logo img {
  width: 1.5rem;
  height: 1.5rem;
  object-fit: contain;
}

/* ---------- Filters and view ---------- */
.toolbar {
  flex-wrap: wrap;
}

.views {
  flex: none;
  font-size: var(--text-sm);
}

.filters {
  flex-basis: 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.filter-select {
  width: 10rem;
}

.filter-select.set :deep(.trigger) {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
}

.filters-toggle {
  display: none;
}

@media (max-width: 640px) {
  .filters-toggle {
    display: inline-flex;
  }

  .filters {
    display: none;
  }

  .filters.open {
    display: flex;
  }

  .filter-select {
    flex: 1 1 9rem;
    width: auto;
  }

  /* Under the search box, on its own row */
  .toolbar .sort {
    flex: 1 1 100%;
    order: -1;
    width: auto;
  }

  .views {
    margin-left: auto;
  }
}

/* ---------- List view: one row per thing ---------- */
.things.list {
  grid-template-columns: minmax(0, 1fr);
  gap: 0.4rem;
}

.things.list .thing {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.5rem 1rem;
  padding: 0.6rem 0.9rem;
  box-shadow: inset 4px 0 0 var(--cat);
}

.things.list .thing:hover {
  translate: none;
  box-shadow: inset 4px 0 0 var(--cat), 0 8px 18px -14px rgb(var(--shadow) / 0.45);
}

.things.list .kept,
.things.list .thing-notes {
  display: none;
}

.things.list .compare {
  padding: 0;
  background: none;
}

.things.list .compare small {
  display: none;
}

@media (max-width: 640px) {
  .things.list .thing {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .things.list .compare {
    grid-column: 1 / -1;
    order: 3;
  }
}

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
