import type { InjectionKey } from 'vue'
import type {
  BudgetTab, BudgetCategory, BudgetContribution, BudgetGoal, BudgetLimit, BudgetRecurring, BudgetSettings, BudgetTransaction, Draft, Stamped
} from '~/utils/budget/types'
import { converter, type Rate } from '~/utils/budget/calc'
import { addDays, monthOf, today } from '~/utils/budget/dates'
import { DEFAULTS_VERSION, SETTINGS_ID, defaultCategories, defaultSettings, missingDefaults, subIconUpdates } from '~/utils/budget/defaults'

// The budget planner's data: one synced collection per kind of record, all named budget-*, kept on this
// device and in step with Firestore through the shared sync engine (useCollection / utils/sync.ts).
// The page creates it once with useBudgetStore() and its components read it with useBudget().

const stamp = () => new Date().toISOString()

function stamped<T extends Stamped>(name: string, seed?: () => T[], options: { demo?: () => Omit<T, 'id'>[], label?: (item: T) => string } = {}) {
  const c = useCollection<T>(name, seed, { app: '/budget', ...options })
  return {
    ...c,
    add: (item: Draft<T>) => {
      const now = stamp()
      return c.add({ ...item, createdAt: now, updatedAt: now } as unknown as Omit<T, 'id'>)
    },
    addMany: (list: Draft<T>[]) => {
      const now = stamp()
      return c.addMany(list.map(item => ({ ...item, createdAt: now, updatedAt: now }) as unknown as Omit<T, 'id'>))
    },
    update: (id: string, patch: Partial<Draft<T>>, opts?: { quiet?: boolean }) => c.update(id, { ...patch, updatedAt: stamp() } as Partial<T>, opts)
  }
}

// ---------- Demo: a believable month, only while the demo is switched on ----------
const demoNow = '2000-01-01T00:00:00.000Z'
const ago = (n: number) => addDays(today(), -n)
// A day of this month, or '' if it hasn't happened yet (the demo never logs the future)
const thisMonth = (day: number) => {
  const d = new Date().getDate()
  return day > d ? '' : ago(d - day)
}
function demoTransactions(): Omit<BudgetTransaction, 'id'>[] {
  const e = (amount: number, cat: string, sub: string, date: string, note = '', method = 'cash', currency: 'USD' | 'KHR' = 'USD', extra: Partial<BudgetTransaction> = {}) =>
    ({ kind: 'expense' as const, amount, currency, categoryId: `exp.${cat}`, subcategoryId: `exp.${cat}.${sub}`, date, note, method, merchant: '', tags: [], createdAt: demoNow, updatedAt: demoNow, ...extra })
  const i = (amount: number, src: string, date: string, note: string) =>
    ({ kind: 'income' as const, amount, currency: 'USD' as const, categoryId: `inc.${src}`, subcategoryId: '', date, note, method: 'bank', merchant: '', tags: [], createdAt: demoNow, updatedAt: demoNow })
  const out: Omit<BudgetTransaction, 'id'>[] = []
  // Last month and this month, so comparisons have something to compare
  for (const back of [1, 0]) {
    const day = (d: number) => (back ? `${monthOf(addDays(today(), -new Date().getDate()))}-${String(Math.min(d, 28)).padStart(2, '0')}` : thisMonth(d))
    out.push(i(950, 'salary', day(1), 'Monthly salary'))
    out.push(e(180, 'housing', 'rent', day(1), 'Apartment', 'bank'))
    out.push(e(25, 'housing', 'home-internet', day(5), 'Fiber 50 Mbps', 'qr', 'USD', { recurringId: 'demo-internet', occurrence: day(5) || undefined }))
    out.push(e(5, 'tech', 'phone-top-up', day(3), 'Smart top-up', 'qr'))
    for (let d = 1; d <= 28; d += 1) {
      if (!back && !day(d)) break
      if (d % 2) out.push(e(2.5, 'food-drinks', 'breakfast', day(d), 'Bai sach chrouk', 'cash'))
      out.push(e(d % 3 ? 3.5 : 6, 'food-drinks', 'lunch', day(d), d % 3 ? 'Lok lak' : 'Lunch with team', d % 3 ? 'cash' : 'qr'))
      if (d % 2 === 0) out.push(e(1.75, 'food-drinks', 'coffee', day(d), 'Iced latte', 'qr'))
      if (d % 4 === 0) out.push(e(12_000, 'transport', 'motorcycle-gasoline', day(d), 'Fuel', 'cash', 'KHR'))
      if (d % 7 === 0) out.push(e(18, 'food-drinks', 'dinner', day(d), 'Dinner out', 'card'))
    }
    out.push(e(12, 'fun', 'movies-events', day(9), 'Cinema', 'card'))
    out.push(e(32, 'fitness', 'gym-membership', day(2), 'Gym', 'card', 'USD', { recurringId: 'demo-gym', occurrence: day(2) || undefined }))
    out.push(e(40_000, 'housing', 'electricity', day(12), 'EDC bill', 'qr', 'KHR'))
    out.push(e(4, 'personal', 'haircut', day(14), '', 'cash'))
    if (back) out.push(i(150, 'freelance', day(20), 'Logo design'))
  }
  return out.filter(t => t.date)
}
const demoLimits = (): Omit<BudgetLimit, 'id'>[] => [
  { scope: 'overall', targetId: '', period: 'month', amount: 600, currency: 'USD', createdAt: demoNow, updatedAt: demoNow },
  { scope: 'category', targetId: 'exp.food-drinks', period: 'month', amount: 150, currency: 'USD', createdAt: demoNow, updatedAt: demoNow },
  { scope: 'subcategory', targetId: 'exp.food-drinks.coffee', period: 'week', amount: 8, currency: 'USD', createdAt: demoNow, updatedAt: demoNow },
  { scope: 'category', targetId: 'exp.fun', period: 'month', amount: 40, currency: 'USD', createdAt: demoNow, updatedAt: demoNow }
]
const demoRecurring = (): (Omit<BudgetRecurring, 'id'> & { id: string })[] => [
  { id: 'demo-internet', name: 'Home internet', amount: 25, currency: 'USD', categoryId: 'exp.housing', subcategoryId: 'exp.housing.home-internet', method: 'qr', cycle: 'monthly', every: 1, startDate: thisMonth(5) || ago(25), active: true, skipped: [], note: '', createdAt: demoNow, updatedAt: demoNow },
  { id: 'demo-gym', name: 'Gym', amount: 32, currency: 'USD', categoryId: 'exp.fitness', subcategoryId: 'exp.fitness.gym-membership', method: 'card', cycle: 'monthly', every: 1, startDate: thisMonth(2) || ago(28), active: true, skipped: [], note: '', createdAt: demoNow, updatedAt: demoNow },
  { id: 'demo-netflix', name: 'Netflix', amount: 9.99, currency: 'USD', categoryId: 'exp.fun', subcategoryId: 'exp.fun.streaming-services', method: 'card', cycle: 'monthly', every: 1, startDate: addDays(today(), 3), active: true, skipped: [], note: '', createdAt: demoNow, updatedAt: demoNow },
  { id: 'demo-water', name: 'Water bill', amount: 15_000, currency: 'KHR', categoryId: 'exp.housing', subcategoryId: 'exp.housing.water-bill', method: 'qr', cycle: 'monthly', every: 1, startDate: ago(4), active: true, skipped: [], note: '', createdAt: demoNow, updatedAt: demoNow }
]
const demoGoals = (): (Omit<BudgetGoal, 'id'> & { id: string })[] => [
  { id: 'demo-emergency', name: 'Emergency fund', target: 1500, currency: 'USD', targetDate: addDays(today(), 300), note: 'Three months of rent and food', createdAt: demoNow, updatedAt: demoNow },
  { id: 'demo-trip', name: 'Trip to Kampot', target: 200, currency: 'USD', targetDate: addDays(today(), 60), note: '', createdAt: demoNow, updatedAt: demoNow }
]
const demoContributions = (): Omit<BudgetContribution, 'id'>[] => [
  { goalId: 'demo-emergency', type: 'deposit', amount: 400, currency: 'USD', date: ago(70), note: 'Start', createdAt: demoNow, updatedAt: demoNow },
  { goalId: 'demo-emergency', type: 'deposit', amount: 150, currency: 'USD', date: ago(35), note: '', createdAt: demoNow, updatedAt: demoNow },
  { goalId: 'demo-emergency', type: 'withdrawal', amount: 60, currency: 'USD', date: ago(20), note: 'Moto repair', createdAt: demoNow, updatedAt: demoNow },
  { goalId: 'demo-emergency', type: 'deposit', amount: 150, currency: 'USD', date: ago(4), note: '', createdAt: demoNow, updatedAt: demoNow },
  { goalId: 'demo-trip', type: 'deposit', amount: 85, currency: 'USD', date: ago(10), note: '', createdAt: demoNow, updatedAt: demoNow }
]

function createStore() {
  const demo = useDemo().active
  const transactions = stamped<BudgetTransaction>('budget-transactions', undefined, {
    demo: demoTransactions,
    label: t => `${formatMoney(t.amount, t.currency)}${t.note ? ` · ${t.note}` : ''}`
  })
  // Built-ins on a brand-new account; fixed ids keep two devices from making two sets
  const categories = stamped<BudgetCategory>('budget-categories', () => defaultCategories(), {
    demo: () => defaultCategories(demoNow),
    label: c => c.name
  })
  const limits = stamped<BudgetLimit>('budget-limits', undefined, { demo: demoLimits, label: () => 'Budget' })
  const recurring = stamped<BudgetRecurring>('budget-recurring', undefined, { demo: demoRecurring, label: r => r.name })
  const goals = stamped<BudgetGoal>('budget-goals', undefined, { demo: demoGoals, label: g => g.name })
  const contributions = stamped<BudgetContribution>('budget-contributions', undefined, {
    demo: demoContributions,
    label: c => `${c.type === 'deposit' ? 'Saved' : 'Took out'} ${formatMoney(c.amount, c.currency)}`
  })
  const settingsList = stamped<BudgetSettings>('budget-settings', () => [defaultSettings()], {
    demo: () => [defaultSettings(demoNow)],
    label: () => 'Budget settings'
  })

  const ready = computed(() => [transactions, categories, limits, recurring, goals, contributions, settingsList].every(c => c.ready.value))

  // One settings record; if two devices ever made one each, the fixed id (or else the oldest) wins
  const settingsRecord = computed(() => {
    const list = settingsList.items.value
    return list.find(s => s.id === SETTINGS_ID) ?? [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
  })
  const settings = computed<BudgetSettings>(() => ({ ...defaultSettings(), ...settingsRecord.value }))
  function updateSettings(patch: Partial<Draft<BudgetSettings>>) {
    const rec = settingsRecord.value
    if (rec) settingsList.update(rec.id, patch, { quiet: true })
    else settingsList.add({ ...defaultSettings(), ...patch })
  }

  // Built-in categories added in a later version reach existing accounts once, by id, so they're never doubled
  watch(ready, (ok) => {
    if (!ok || demo.value) return
    // Categories from the first, simpler Budget page (no kind or parent) are set aside in the
    // Recycle Bin, and the built-ins take their place
    const legacy = categories.items.value.filter(c => !c.kind)
    if (legacy.length) {
      const valid = categories.items.value.filter(c => c.kind)
      void replaceCollection('budget-categories', '/budget', [...valid, ...missingDefaults(valid)], r => String(r.name ?? 'Category'))
      return
    }
    if ((settingsRecord.value?.defaultsVersion ?? 0) >= DEFAULTS_VERSION) return
    const missing = missingDefaults(categories.items.value)
    if (missing.length) void writeToCollection('budget-categories', missing)
    for (const u of subIconUpdates(categories.items.value)) categories.update(u.id, { icon: u.icon }, { quiet: true })
    updateSettings({ defaultsVersion: DEFAULTS_VERSION })
  }, { immediate: true })

  // Exchange rate for totals: today's market rate, or the user's own fixed rate and its date
  const market = useMarketRateInfo()
  const rate = computed<Rate>(() => {
    const s = settings.value
    if (s.rateMode === 'fixed' && s.fixedRate > 0) return { rate: s.fixedRate, source: 'fixed', date: s.fixedRateDate }
    const m = market.value
    return { rate: m.rate, source: m.from, date: m.from === 'live' ? today() : undefined }
  })
  const conv = computed(() => converter(settings.value.primaryCurrency, rate.value))
  const money = (v: number | undefined, opts: { signed?: boolean } = {}) => (v === undefined ? '…' : formatMoney(v, settings.value.primaryCurrency, opts))

  // Lookups
  const categoryById = computed(() => new Map(categories.items.value.map(c => [c.id, c])))
  const topCategories = computed(() => categories.items.value.filter(c => !c.parentId).sort((a, b) => a.order - b.order))
  const subsOf = (id: string) => categories.items.value.filter(c => c.parentId === id).sort((a, b) => a.order - b.order)
  const methodName = (id: string) => settings.value.methods.find(m => m.id === id)?.name ?? (id ? 'Other' : '')

  /**
   * A bill payment gets a stable id from the bill and its due date, so paying the same bill twice
   * (a double tap, a retry, or two devices at once) lands on one record instead of two.
   */
  async function recordBillPayment(r: BudgetRecurring, occurrence: string, patch: Partial<BudgetTransaction> = {}) {
    const id = `bill.${r.id}.${occurrence}`
    if (transactions.items.value.some(t => t.id === id || (t.recurringId === r.id && t.occurrence === occurrence))) return undefined
    const now = stamp()
    const record: BudgetTransaction = {
      id, createdAt: now, updatedAt: now, kind: 'expense', amount: r.amount, currency: r.currency, categoryId: r.categoryId,
      subcategoryId: r.subcategoryId, date: occurrence <= today() ? today() : occurrence, note: r.name, method: r.method, merchant: '',
      tags: [], recurringId: r.id, occurrence, ...patch
    }
    if (demo.value) {
      transactions.items.value = [...transactions.items.value, record]
      return record
    }
    logActivity('added', '/budget', `${r.name} paid`)
    await writeToCollection('budget-transactions', [record])
    return record
  }

  // Quick Add, from any screen
  const entry = reactive<{ open: boolean, editing?: BudgetTransaction, preset?: Partial<BudgetTransaction> }>({ open: false })
  function openEntry(preset?: Partial<BudgetTransaction>, editing?: BudgetTransaction) {
    entry.editing = editing
    entry.preset = preset
    entry.open = true
  }

  // Sections live in the URL (?tab=transactions&cat=…), so filters survive a reload and work with Back
  const router = useRouter()
  function go(tab: BudgetTab, query: Record<string, string> = {}) {
    void router.push({ query: { ...(tab === 'dashboard' ? {} : { tab }), ...query } })
  }

  return {
    demo, entry, openEntry, go,
    transactions, categories, limits, recurring, goals, contributions, settingsList,
    ready, settings, updateSettings, rate, conv, money,
    categoryById, topCategories, subsOf, methodName, recordBillPayment,
    sync: transactions.sync
  }
}

export type BudgetStore = ReturnType<typeof createStore>
const KEY: InjectionKey<BudgetStore> = Symbol('budget')

/** Call once, in pages/budget.vue */
export function useBudgetStore() {
  const store = createStore()
  provide(KEY, store)
  return store
}

/** Any component inside the budget page */
export function useBudget() {
  const store = inject(KEY)
  if (!store) throw new Error('useBudget() needs useBudgetStore() in the page')
  return store
}

/**
 * Bring the record named in ?hl=<id> into view and flash it with the app's .found highlight, then drop
 * hl from the address. The budget app links its own records this way (dashboard alerts, bills, search).
 */
export function useBudgetHighlight() {
  const route = useRoute()
  const router = useRouter()
  let tries = 0
  function run() {
    const id = route.query.hl
    if (typeof id !== 'string' || !id) return
    const el = document.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(id)}"]`)
    if (!el) {
      if (tries++ < 40) requestAnimationFrame(run)
      return
    }
    tries = 0
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    el.classList.remove('found')
    void el.offsetWidth
    el.classList.add('found')
    setTimeout(() => el.classList.remove('found'), 2200)
    const { hl: _, ...rest } = route.query
    void router.replace({ query: rest })
  }
  onMounted(() => nextTick(run))
  watch(() => route.query.hl, v => v && nextTick(run))
}

/** Every budget collection, for backup sections and import/export */
export const BUDGET_COLLECTIONS = [
  'budget-transactions', 'budget-categories', 'budget-limits', 'budget-recurring', 'budget-goals', 'budget-contributions', 'budget-settings'
] as const
