<script setup lang="ts">
import type { BudgetLimit, BudgetRecurring, BudgetSettings, BudgetTransaction } from '~/utils/budget/types'
import type { CountdownEvent, Renewal } from '~/utils/calendar'
import { billStatus, budgetStatus, converter, LEVELS, total, type Rate } from '~/utils/budget/calc'
import { monthRange, today as budgetToday } from '~/utils/budget/dates'
import { defaultSettings, SETTINGS_ID } from '~/utils/budget/defaults'

// The home page's look at the day, under the cube: today's prices, what's coming up, this month's
// spending and today's focus. Everything is read from what the apps keep on this device (and sync), so
// it shows instantly and works offline; each card links to its app. Nothing is saved here.
const COLLECTIONS = ['countdown', 'renewals', 'gold-prices', 'budget-transactions', 'budget-limits', 'budget-recurring', 'budget-settings'] as const
type Name = typeof COLLECTIONS[number]
const data = ref<Partial<Record<Name, Record<string, any>[]>>>({})
const loaded = ref(false)
const list = <T>(name: Name) => (data.value[name] ?? []) as unknown as T[]

function load() {
  data.value = Object.fromEntries(COLLECTIONS.map(n => [n, readCollection(n)]))
  loaded.value = true
}
const onStorage = (e: StorageEvent) => {
  if (!e.key || COLLECTIONS.some(n => e.key === `ousa-app:${n}`)) load()
}
let stopSync: (() => void) | undefined
onMounted(async () => {
  load()
  window.addEventListener('storage', onStorage)
  stopSync = onSyncChange(names => names.some(n => (COLLECTIONS as readonly string[]).includes(n)) && load())
  // Signed in: catch up with the other devices, then read again
  await syncReady()
  load()
})
onBeforeUnmount(() => {
  window.removeEventListener('storage', onStorage)
  stopSync?.()
})

// The shared clock: "in 3 days" stays right if the page is left open overnight
const nowMs = useNow()
const now = computed(() => new Date(nowMs.value))
const hydrated = useHydrated()

const greeting = computed(() => {
  const h = now.value.getHours()
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
})
const dateLine = computed(() => now.value.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))

// ---------- Prices ----------
const market = useMarketRateInfo()
const rateText = computed(() => (market.value.rate ? `${Math.round(market.value.rate).toLocaleString('en-US')} ៛` : '…'))
const RATE_FROM = { live: 'Live mid-market rate', saved: 'Last rate saved here', fallback: 'Typical rate, no live rate yet', loading: 'Getting today’s rate…' }

// Gold: the live world price as the Gold app gets it, else the last price it saved
const TROY = 31.1034768
const CHI = 3.75
const DAMLUNG = 37.5
const goldLive = ref<number>()
const goldSaved = ref<number>()
const goldLoading = ref(false)
onMounted(async () => {
  try {
    goldSaved.value = Number(JSON.parse(localStorage.getItem('ousa-app:gold-settings') || 'null')?.quote?.price) || undefined
  } catch {}
  goldLoading.value = true
  try {
    const r = await fetch('https://api.gold-api.com/price/XAU', { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    const price = Number((await r.json())?.price)
    if (r.ok && price >= 100 && price <= 20000) goldLive.value = price
  } catch {}
  goldLoading.value = false
})
const ounce = computed(() => goldLive.value ?? goldSaved.value)
const perChi = computed(() => (ounce.value ? ounce.value / TROY * CHI : undefined))
const perDamlung = computed(() => (ounce.value ? ounce.value / TROY * DAMLUNG : undefined))
// Change since about a day ago, from the price history the Gold app keeps
const goldChange = computed(() => {
  if (!ounce.value) return undefined
  const dayAgo = nowMs.value - 20 * 3_600_000
  const before = list<{ price: number, time: number }>('gold-prices')
    .filter(p => p.time <= dayAgo)
    .sort((a, b) => b.time - a.time)[0]
  if (!before?.price) return undefined
  return (ounce.value - before.price) / before.price * 100
})
const usd = (v?: number) => (v === undefined ? '…' : formatMoney(v, 'USD'))

// ---------- Coming up: the next two weeks ----------
const WINDOW = 14
const { holidays } = useHolidays(nowMs)
const calPrefs = useCalendarPrefs().prefs

interface Upcoming { id: string, name: string, day: number, kind: 'date' | 'renewal' | 'holiday' | 'bill', detail?: string, to: string }
const upcoming = computed<Upcoming[]>(() => {
  if (!loaded.value) return []
  const marks = upcomingMarks({
    dates: list<CountdownEvent>('countdown'),
    renewals: list<Renewal>('renewals'),
    holidays: calPrefs.holidays ? holidays.value.map(h => ({ name: h.name, start: h.start })) : []
  }, now.value)
    .filter(m => m.day <= WINDOW)
    .map(m => ({ ...m, to: m.kind === 'renewal' ? '/renewals' : '/countdown' }))
  // Budget bills waiting to be paid in the same two weeks, and any overdue ones first
  const txs = list<BudgetTransaction>('budget-transactions')
  const day = budgetToday()
  const bills: Upcoming[] = list<BudgetRecurring>('budget-recurring')
    .filter(r => r.active)
    .flatMap((r) => {
      const s = billStatus(r, txs, day)
      if (s.state === 'overdue') return [{ id: `b-${r.id}`, name: r.name, day: -1, kind: 'bill' as const, detail: formatMoney(r.amount, r.currency), to: `/budget?tab=recurring&hl=${r.id}` }]
      const d = s.next ? daysUntil(s.next, now.value) : Infinity
      return d <= WINDOW ? [{ id: `b-${r.id}`, name: r.name, day: d, kind: 'bill' as const, detail: formatMoney(r.amount, r.currency), to: `/budget?tab=recurring&hl=${r.id}` }] : []
    })
  return [...marks, ...bills].sort((a, b) => a.day - b.day).slice(0, 8)
})
const KIND_LABEL = { date: 'Date', renewal: 'Renews', holiday: 'Holiday', bill: 'Bill' }
const whenText = (d: number) => (d < 0 ? 'Overdue' : d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`)
const whenBadge = (d: number) => (d < 0 ? 'bad' : d <= 1 ? 'warn' : d <= 7 ? 'info' : '')

// ---------- This month's spending ----------
const budgetSettings = computed<BudgetSettings>(() => ({ ...defaultSettings(), ...(list<BudgetSettings>('budget-settings').find(s => s.id === SETTINGS_ID) ?? {}) }))
const budgetRate = computed<Rate>(() => {
  const s = budgetSettings.value
  if (s.rateMode === 'fixed' && s.fixedRate > 0) return { rate: s.fixedRate, source: 'fixed' }
  return { rate: market.value.rate, source: market.value.from }
})
const currency = computed(() => budgetSettings.value.primaryCurrency)
const conv = computed(() => converter(currency.value, budgetRate.value))
const money = (v?: number) => (v === undefined ? '…' : formatMoney(v, currency.value))

const spending = computed(() => {
  const txs = list<BudgetTransaction>('budget-transactions')
  if (!txs.length && !list('budget-limits').length) return undefined
  const day = budgetToday()
  const month = monthRange(day)
  const expenses = txs.filter(t => t.kind === 'expense')
  const spentMonth = total(expenses.filter(t => t.date >= month.from && t.date <= month.to), conv.value)
  const spentToday = total(expenses.filter(t => t.date === day), conv.value)
  const limit = list<BudgetLimit>('budget-limits').find(l => l.scope === 'overall' && l.period === 'month')
  const s = budgetSettings.value
  const status = limit ? budgetStatus(limit, txs, day, conv.value, { weekStart: s.weekStart, alerts: s.alerts, overAlert: s.overAlert, today: day }) : undefined
  return { month: spentMonth.value, today: spentToday.value, todayCount: spentToday.count, status }
})
const monthName = computed(() => now.value.toLocaleDateString('en-GB', { month: 'long' }))

// ---------- Focus ----------
const focusToday = ref(0)
onMounted(() => {
  try {
    const f = JSON.parse(localStorage.getItem('ousa-app:remember:focus-today') || 'null')
    focusToday.value = f?.date === localIsoDate() ? Number(f.count) || 0 : 0
  } catch {}
})

const toolColor = (path: string) => ({ '--c': pageFor(path)?.color, '--on-c': pageFor(path)?.onColor ?? '#fff' })
</script>

<template>
  <section class="today" aria-labelledby="today-hello">
      <header class="hello">
        <h2 id="today-hello">{{ hydrated ? greeting : 'Today' }}</h2>
        <p>{{ dateLine }}</p>
      </header>

      <div class="cards">
        <!-- Prices -->
        <section class="panel card prices" aria-labelledby="today-prices">
          <header><h3 id="today-prices">Prices today</h3></header>
          <NuxtLink to="/exchange" class="price" :style="toolColor('/exchange')">
            <span class="dot" aria-hidden="true"><ToolIcon name="exchange" /></span>
            <span class="text">
              <span class="label">1 US dollar</span>
              <strong class="figure">{{ rateText }}</strong>
              <span class="note">{{ RATE_FROM[market.from] }}</span>
            </span>
          </NuxtLink>
          <NuxtLink to="/gold" class="price" :style="toolColor('/gold')">
            <span class="dot" aria-hidden="true"><ToolIcon name="gold" /></span>
            <span class="text">
              <span class="label">Gold, 1 chi (24K)</span>
              <strong class="figure">{{ usd(perChi) }}</strong>
              <span class="note">
                {{ usd(perDamlung) }} a damlung
                <template v-if="goldChange !== undefined">
                  · <span :class="goldChange >= 0 ? 'up' : 'down'">{{ goldChange >= 0 ? '▲' : '▼' }} {{ Math.abs(goldChange).toFixed(1) }}%</span> since yesterday
                </template>
                <template v-else-if="!goldLive && goldSaved && !goldLoading"> · last saved price</template>
              </span>
            </span>
          </NuxtLink>
        </section>

        <!-- Coming up -->
        <section class="panel card upcoming" aria-labelledby="today-upcoming">
          <header>
            <h3 id="today-upcoming">Coming up</h3>
            <NuxtLink to="/countdown" class="link">Countdown</NuxtLink>
          </header>
          <SkeletonList v-if="!loaded" :count="3" />
          <ul v-else-if="upcoming.length">
            <li v-for="u in upcoming" :key="u.id">
              <NuxtLink :to="u.to" class="row">
                <span class="when badge" :class="whenBadge(u.day)">{{ whenText(u.day) }}</span>
                <span class="text">
                  <strong>{{ u.name }}</strong>
                  <span>{{ KIND_LABEL[u.kind] }}<template v-if="u.detail"> · {{ u.detail }}</template></span>
                </span>
              </NuxtLink>
            </li>
          </ul>
          <p v-else class="empty">
            Nothing in the next two weeks. Add a date in <NuxtLink to="/countdown">Countdown</NuxtLink> or a subscription in <NuxtLink to="/renewals">Renewals</NuxtLink>.
          </p>
        </section>

        <!-- This month -->
        <section class="panel card spending" aria-labelledby="today-spending">
          <header>
            <h3 id="today-spending">Spending in {{ monthName }}</h3>
            <NuxtLink to="/budget" class="link">Budget</NuxtLink>
          </header>
          <SkeletonList v-if="!loaded" :count="2" />
          <template v-else-if="spending">
            <p class="big">{{ money(spending.month) }}</p>
            <template v-if="spending.status">
              <div class="meter" role="meter" :aria-valuenow="Math.round((spending.status.share ?? 0) * 100)" aria-valuemin="0" aria-valuemax="100" :aria-label="`${Math.round((spending.status.share ?? 0) * 100)}% of the monthly budget`">
                <span :class="LEVELS[spending.status.level].badge" :style="{ width: `${Math.min(100, (spending.status.share ?? 0) * 100)}%` }" />
              </div>
              <p class="sub">
                <span class="badge" :class="LEVELS[spending.status.level].badge">{{ LEVELS[spending.status.level].word }}</span>
                <template v-if="spending.status.remaining !== undefined">
                  {{ spending.status.remaining >= 0 ? `${money(spending.status.remaining)} left of ${money(spending.status.limit)}` : `${money(-spending.status.remaining)} over ${money(spending.status.limit)}` }}
                </template>
              </p>
            </template>
            <p class="sub">Today: {{ spending.todayCount ? `${money(spending.today)} on ${spending.todayCount} ${spending.todayCount === 1 ? 'thing' : 'things'}` : 'nothing logged yet' }}</p>
            <NuxtLink to="/budget?add=1" class="btn btn-sm" :style="toolColor('/budget')">Log an expense</NuxtLink>
          </template>
          <p v-else class="empty">
            Log what you spend in <NuxtLink to="/budget">Budget</NuxtLink> and this month’s total shows here.
          </p>
        </section>

        <!-- Focus -->
        <section class="panel card focus" aria-labelledby="today-focus">
          <header>
            <h3 id="today-focus">Focus</h3>
            <NuxtLink to="/focus" class="link">Timer</NuxtLink>
          </header>
          <p class="big">{{ focusToday }} <small>{{ focusToday === 1 ? 'session' : 'sessions' }} today</small></p>
          <p class="sub">{{ focusToday ? `About ${focusToday * 25} minutes of focused work.` : 'Start a 25-minute session to get going.' }}</p>
          <NuxtLink to="/focus" class="btn btn-sm" :style="toolColor('/focus')">{{ focusToday ? 'Another session' : 'Start focusing' }}</NuxtLink>
        </section>
      </div>
  </section>
</template>

<style scoped>
.today {
  width: 100%;
  max-width: var(--page-width);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  text-align: left;
}

.hello h2 {
  font-size: var(--text-2xl);
  letter-spacing: -0.02em;
}

.hello p {
  margin-top: 0.15rem;
  color: var(--ink-2);
}

/* One column on phones, two on a tablet held upright (about 800px wide), three across a landscape
   tablet or a laptop. Coming up is the longest card, so it spans two rows once there's room, and Focus
   tucks in under whichever card beside it is shorter */
.cards {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-auto-flow: row dense;
  gap: 1rem;
  align-items: start;
}

.card p {
  margin: 0;
}

@media (min-width: 700px) {
  .cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .upcoming {
    grid-row: span 2;
  }
}

@media (min-width: 1100px) {
  .cards {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.1rem 1.15rem 1.2rem;
}

.card > header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.card h3 {
  font-size: var(--text-title);
  letter-spacing: -0.01em;
}

.link {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-2);
}

.price {
  display: flex;
  align-items: flex-start;
  gap: 0.8rem;
  padding: 0.8rem;
  color: inherit;
  text-decoration: none;
  background: var(--surface-2);
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  transition: border-color var(--dur-fast);
}

.price:hover {
  border-color: var(--c);
}

.dot {
  flex: none;
  width: 2.4rem;
  height: 2.4rem;
  display: grid;
  place-items: center;
  font-size: var(--text-lg);
  color: var(--on-c);
  background: var(--c);
  border-radius: var(--radius);
}

.text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.label,
.note,
.text > span {
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.figure,
.big {
  font-size: var(--text-2xl);
  font-weight: 800;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.big small {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--ink-2);
  letter-spacing: 0;
}

.up {
  color: var(--good-ink);
  font-weight: 600;
}

.down {
  color: var(--bad-ink);
  font-weight: 600;
}

.upcoming ul {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.upcoming li + li {
  border-top: 1px solid var(--line);
}

.row {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.6rem 0.15rem;
  color: inherit;
  text-decoration: none;
}

.row:hover strong {
  text-decoration: underline;
}

.when {
  flex: none;
  min-width: 5.5rem;
  justify-content: center;
  text-align: center;
}

.row strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meter {
  height: 0.6rem;
  overflow: hidden;
  background: color-mix(in srgb, var(--ink) 8%, transparent);
  border-radius: var(--radius-pill);
}

.meter span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--green);
  transition: width var(--dur);
}

.meter span.warn {
  background: var(--orange);
}

.meter span.bad {
  background: var(--red);
}

.sub {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  color: var(--ink-2);
}

.card .btn {
  align-self: flex-start;
  color: var(--on-c);
  background: var(--c);
  border-color: transparent;
}

.empty {
  color: var(--ink-2);
}
</style>
