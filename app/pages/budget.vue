<script setup lang="ts">
import type { BudgetTab } from '~/utils/budget/types'
import { billStatus, budgetStatus } from '~/utils/budget/calc'
import { today } from '~/utils/budget/dates'

// Budget planner: one route, nine sections in the URL (?tab=…), all sharing one store (useBudget)
const route = useRoute()
const store = useBudgetStore()
const { play } = useSound()

const TABS: { value: BudgetTab, label: string, icon: string }[] = [
  { value: 'dashboard', label: 'Dashboard', icon: 'M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z' },
  { value: 'transactions', label: 'Transactions', icon: 'M5 7h14M5 12h14M5 17h9' },
  { value: 'budgets', label: 'Budgets', icon: 'M12 3a9 9 0 1 0 9 9h-9z M15 3.5A9 9 0 0 1 20.5 9H15z' },
  { value: 'categories', label: 'Categories', icon: 'M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z' },
  { value: 'recurring', label: 'Recurring', icon: 'M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4' },
  { value: 'income', label: 'Income', icon: 'M12 19V5M6 11l6-6 6 6' },
  { value: 'savings', label: 'Savings goals', icon: 'M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6L12 16.4 6.6 19.3l1.3-6L3.3 9.2l6.1-.6z' },
  { value: 'reports', label: 'Reports', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { value: 'settings', label: 'Settings', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 15H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.6 4.4V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5.3z' }
]

// App settings (the gear in the header): which section opens first
const { prefs: pagePrefs } = useAppPrefs('budget', { tab: 'dashboard' as BudgetTab })
const tab = computed<BudgetTab>(() => {
  const q = route.query.tab
  return TABS.some(t => t.value === q) ? (q as BudgetTab) : 'dashboard'
})
onMounted(() => {
  if (!route.query.tab && pagePrefs.tab !== 'dashboard') store.go(pagePrefs.tab)
})


function selectTab(value: BudgetTab) {
  if (value === tab.value && Object.keys(route.query).length <= 1) return
  viewTransition(() => store.go(value))
  play('select')
}

// Things that need attention, as counts on the section buttons
const overdue = computed(() => store.recurring.items.value.filter(r => billStatus(r, store.transactions.items.value, today()).state === 'overdue').length)
const overBudget = computed(() => {
  const s = store.settings.value
  return store.limits.items.value.filter(l => ['reached', 'over'].includes(budgetStatus(l, store.transactions.items.value, today(), store.conv.value, { weekStart: s.weekStart, alerts: s.alerts, overAlert: s.overAlert, today: today() }).level)).length
})
const badge = (t: BudgetTab) => (t === 'recurring' ? overdue.value : t === 'budgets' ? overBudget.value : 0)

// Quick Add from the keyboard shortcut and the header's Add button
useAddAction(() => store.openEntry())

// Pull down on a phone to sync again (CHECKLIST.md #26)
usePullToRefresh(async () => {
  await store.sync.retry()
})
</script>

<template>
  <ToolPage header="bar">
    <template #settings>
      <SettingChoice v-model="pagePrefs.tab" title="Open on" :options="TABS.map(t => ({ value: t.value, label: t.label }))" />
    </template>
    <template #actions>
      <div class="head-buttons">
        <button type="button" class="btn btn-quiet" @click="store.openEntry({ kind: 'income' })">+ Income</button>
        <button type="button" class="btn" @click="store.openEntry()">+ Expense</button>
      </div>
    </template>

    <div class="budget-app">
      <nav class="budget-nav" aria-label="Budget sections">
        <button
          v-for="t in TABS"
          :key="t.value"
          type="button"
          class="nav-item"
          :aria-current="tab === t.value ? 'page' : undefined"
          @click="selectTab(t.value)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="t.icon" /></svg>
          <span>{{ t.label }}</span>
          <ClientOnly><span v-if="badge(t.value)" class="count" :aria-label="`${badge(t.value)} need attention`">{{ badge(t.value) }}</span></ClientOnly>
        </button>
        <div class="nav-foot"><ClientOnly><DataSource :sync="store.sync" /></ClientOnly></div>
      </nav>

      <section class="budget-main" :aria-label="TABS.find(t => t.value === tab)?.label">
        <ClientOnly>
          <template v-if="store.ready.value">
            <BudgetDashboard v-if="tab === 'dashboard'" />
            <BudgetTransactions v-else-if="tab === 'transactions'" />
            <BudgetBudgets v-else-if="tab === 'budgets'" />
            <BudgetCategories v-else-if="tab === 'categories'" />
            <BudgetRecurring v-else-if="tab === 'recurring'" />
            <BudgetIncome v-else-if="tab === 'income'" />
            <BudgetSavings v-else-if="tab === 'savings'" />
            <BudgetReports v-else-if="tab === 'reports'" />
            <BudgetSettings v-else-if="tab === 'settings'" />
          </template>
          <SkeletonList v-else variant="cards" :count="3" label="Loading your budget" />
          <template #fallback><SkeletonList variant="cards" :count="3" label="Loading your budget" /></template>
        </ClientOnly>
      </section>

      <!-- Phones: Quick Add stays in reach of the thumb on every section -->
      <button type="button" class="quick-add" aria-label="Add expense" @click="store.openEntry()">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        <span>Expense</span>
      </button>

      <ClientOnly>
        <BudgetEntryForm :open="store.entry.open" :editing="store.entry.editing" :preset="store.entry.preset" @close="store.entry.open = false" />
      </ClientOnly>
    </div>
  </ToolPage>
</template>

<style scoped>
.head-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.budget-app {
  display: grid;
  grid-template-columns: 13rem minmax(0, 1fr);
  align-items: start;
  gap: 2rem;
}

.budget-nav {
  position: sticky;
  top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.nav-item {
  min-height: 2.6rem;
  padding: 0.5rem 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  font: inherit;
  font-weight: 600;
  color: var(--ink-2);
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: var(--radius);
  cursor: pointer;
  transition: background-color var(--dur-fast), color var(--dur-fast);
}

.nav-item:hover {
  color: var(--ink);
  background: var(--surface-2);
}

.nav-item[aria-current='page'] {
  color: var(--ink);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.nav-item svg {
  flex: none;
  width: 1.15rem;
  height: 1.15rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.nav-item[aria-current='page'] svg {
  color: var(--accent);
}

.count {
  margin-left: auto;
  min-width: 1.4rem;
  padding: 0 0.4rem;
  font-size: var(--text-xs);
  line-height: 1.4rem;
  text-align: center;
  color: #fff;
  background: var(--budget-over);
  border-radius: var(--radius-pill);
}

.nav-foot {
  margin-top: 1rem;
  padding-left: 0.5rem;
}

.budget-main {
  min-width: 0;
}

.quick-add {
  display: none;
}

/* Tablets and phones: the sections become one scrolling row, and Quick Add floats bottom right */
@media (max-width: 900px) {
  .budget-app {
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
  }

  .budget-nav {
    position: static;
    flex-direction: row;
    gap: 0.35rem;
    margin-inline: -1rem;
    padding: 0.25rem 1rem;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .budget-nav::-webkit-scrollbar {
    display: none;
  }

  .nav-item {
    flex: none;
    min-height: 2.5rem;
    padding: 0.45rem 0.85rem;
    background: var(--surface-2);
    border-radius: var(--radius-pill);
  }

  .count {
    margin-left: 0.15rem;
  }

  .nav-foot {
    display: none;
  }

  .quick-add {
    position: fixed;
    right: max(1rem, env(safe-area-inset-right));
    bottom: max(1rem, env(safe-area-inset-bottom));
    z-index: 50;
    min-height: 3.25rem;
    padding: 0 1.2rem 0 1rem;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font: inherit;
    font-weight: 700;
    color: var(--on-accent);
    background: var(--accent-btn, var(--accent));
    border: 0;
    border-radius: var(--radius-pill);
    box-shadow: 0 10px 24px -8px rgb(var(--shadow) / 0.55);
    cursor: pointer;
  }

  .quick-add svg {
    width: 1.25rem;
    height: 1.25rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.4;
    stroke-linecap: round;
  }

  /* Leave room so the button never covers the last row */
  .budget-main {
    padding-bottom: 4.5rem;
  }
}
</style>

<style>
/* Budget planner tokens, scoped to the app. Category colours are slots with their own dark shades
   (the validated reference palette), so a category keeps its identity in both themes. */
.budget-app {
  --budget-c1: #2a78d6;
  --budget-c2: #eb6834;
  --budget-c3: #1baf7a;
  --budget-c4: #eda100;
  --budget-c5: #e87ba4;
  --budget-c6: #008300;
  --budget-c7: #6250d6;
  --budget-c8: #e34948;
  --budget-gray: #8a8f98;
  --budget-income: var(--budget-c1);
  --budget-expense: var(--budget-c2);
  --budget-ok: #0f8a53;
  --budget-warn: #d98a00;
  --budget-over: #d03b3b;
  --budget-income-ink: #1f6fc7;
  --budget-save-ink: #0f7a4a;
}

:root[data-theme='dark'] .budget-app {
  --budget-c1: #3987e5;
  --budget-c2: #d95926;
  --budget-c3: #199e70;
  --budget-c4: #c98500;
  --budget-c5: #d55181;
  --budget-c6: #008300;
  --budget-c7: #9085e9;
  --budget-c8: #e66767;
  --budget-gray: #6f7680;
  --budget-ok: #22a865;
  --budget-warn: #e0a128;
  --budget-over: #e05555;
  --budget-income-ink: #6aa8f0;
  --budget-save-ink: #4cc48a;
}

.budget-app .slot-c1 { --slot: var(--budget-c1); }
.budget-app .slot-c2 { --slot: var(--budget-c2); }
.budget-app .slot-c3 { --slot: var(--budget-c3); }
.budget-app .slot-c4 { --slot: var(--budget-c4); }
.budget-app .slot-c5 { --slot: var(--budget-c5); }
.budget-app .slot-c6 { --slot: var(--budget-c6); }
.budget-app .slot-c7 { --slot: var(--budget-c7); }
.budget-app .slot-c8 { --slot: var(--budget-c8); }
.budget-app .slot-gray { --slot: var(--budget-gray); }

/* Shared by the sections */
.budget-app .b-head {
  margin: 0 0 1rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.budget-app .b-head h2 {
  margin: 0;
  font-size: 1.35rem;
}

.budget-app .b-panel {
  padding: 1.1rem 1.25rem;
}

.budget-app .b-panel + .b-panel,
.budget-app .b-gap {
  margin-top: 1rem;
}

.budget-app .b-panel h3 {
  margin: 0 0 0.75rem;
  font-size: 1rem;
}

.budget-app .b-muted {
  color: var(--ink-2);
  font-size: var(--text-sm);
}

.budget-app .b-num {
  font-variant-numeric: tabular-nums;
}

.budget-app .b-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.budget-app .b-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));
  gap: 1rem;
}

.budget-app .b-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.budget-app .b-form .row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));
  gap: 0.75rem;
}

.budget-app .b-form .actions {
  display: flex;
  gap: 0.5rem;
}

.budget-app .b-form .actions .btn:first-child {
  flex: 1;
}

.budget-app .b-amount {
  display: flex;
  gap: 0.5rem;
}

.budget-app .b-amount .input {
  flex: 1;
  min-width: 0;
  font-variant-numeric: tabular-nums;
}

.budget-app .b-amount .segmented label {
  padding: 0.45rem 0.8rem;
}

.budget-app .b-warn {
  color: var(--warn-ink);
}

.budget-app .b-swatch {
  display: inline-block;
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 3px;
  background: var(--slot, var(--budget-gray));
}
</style>
