<script setup lang="ts">
// How to use Budget: six numbered steps that tick themselves off as you do them, each with a button
// that takes you there. Hidden while the example data is on, since that would tick everything.
const store = useBudget()
const { play } = useSound()
const emit = defineEmits<{ hide: [] }>()

const reportsSeen = useRemembered<boolean>('budget-guide-reports', false, v => typeof v === 'boolean')
const has = (kind: 'expense' | 'income') => store.transactions.items.value.some(t => t.kind === kind)

const steps = computed(() => [
  {
    title: 'Log your first expense',
    text: 'Tap + Expense, pick a category and subcategory (like Food & Drinks › Lunch), type the amount and save. Next time, your recent picks are one tap away.',
    done: has('expense'),
    action: 'Add expense',
    run: () => store.openEntry()
  },
  {
    title: 'Add your income',
    text: 'Log your salary or any money coming in, so you can see what you keep each month.',
    done: has('income'),
    action: 'Add income',
    run: () => store.openEntry({ kind: 'income' })
  },
  {
    title: 'Set a monthly budget',
    text: 'Give everything you spend a monthly limit, or just the categories you want to watch. You’ll get a warning before you reach it.',
    done: store.limits.items.value.length > 0,
    action: 'Set a budget',
    run: () => store.go('budgets')
  },
  {
    title: 'Add your regular bills',
    text: 'Rent, electricity, internet or your phone plan. See what’s due and overdue, and mark each one paid when you pay it.',
    done: store.recurring.items.value.length > 0,
    action: 'Add a bill',
    run: () => store.go('recurring')
  },
  {
    title: 'Start a savings goal',
    text: 'Save toward an emergency fund, a trip or a new phone, and add money as you put it aside.',
    done: store.goals.items.value.length > 0,
    action: 'Add a goal',
    run: () => store.go('savings')
  },
  {
    title: 'See where your money goes',
    text: 'Reports show spending by category, day by day and month by month, and how you did against your budgets.',
    done: reportsSeen.value,
    action: 'Open reports',
    run: () => {
      reportsSeen.value = true
      store.go('reports')
    }
  }
])
const doneCount = computed(() => steps.value.filter(s => s.done).length)
const next = computed(() => steps.value.findIndex(s => !s.done))

function go(s: { run: () => void }) {
  play('select')
  s.run()
}
</script>

<template>
  <section class="panel guide" aria-labelledby="guide-title">
    <div class="guide-head">
      <div>
        <h3 id="guide-title">How to use Budget</h3>
        <p class="b-muted">{{ doneCount === steps.length ? 'All done. You’re set up.' : `${doneCount} of ${steps.length} done` }}</p>
      </div>
      <button type="button" class="link quiet" @click="emit('hide')">Hide guide</button>
    </div>
    <div class="progress" role="progressbar" aria-label="Guide progress" aria-valuemin="0" :aria-valuemax="steps.length" :aria-valuenow="doneCount">
      <span :style="{ width: `${(doneCount / steps.length) * 100}%` }" />
    </div>
    <ol class="steps">
      <li v-for="(s, i) in steps" :key="s.title" class="step" :class="{ done: s.done, next: i === next }">
        <span class="num" :aria-label="s.done ? `Step ${i + 1}, done` : `Step ${i + 1}`">
          <AppIcon v-if="s.done" name="check" />
          <template v-else>{{ i + 1 }}</template>
        </span>
        <div class="body">
          <strong>{{ s.title }}</strong>
          <p>{{ s.text }}</p>
        </div>
        <button type="button" class="btn btn-sm" :class="{ 'btn-quiet': i !== next }" @click="go(s)">{{ s.done ? 'Open' : s.action }}</button>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.guide {
  padding: 1.1rem 1.25rem;
  margin-bottom: 1rem;
}

.guide-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.guide-head h3 {
  margin: 0;
  font-size: 1.05rem;
}

.guide-head p {
  margin: 0.15rem 0 0;
}

.quiet {
  color: var(--ink-2);
  white-space: nowrap;
}

.progress {
  height: 6px;
  margin: 0.75rem 0 0.5rem;
  border-radius: var(--radius-pill);
  background: var(--surface-2);
  overflow: hidden;
}

.progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width var(--dur-slow) var(--ease-out);
}

.steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
  gap: 0 1.5rem;
}

.step {
  padding: 0.75rem 0;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  border-bottom: 1px solid color-mix(in srgb, var(--line) 60%, transparent);
}

/* The same numbered sticker as the app's step headings */
.num {
  flex: none;
  width: 1.75rem;
  height: 1.75rem;
  display: grid;
  place-items: center;
  font-size: 0.95rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--ink-2);
  background: var(--surface-2);
  border-radius: 7px;
  box-shadow: 0 0 0 1px var(--line);
}

.next .num {
  color: var(--on-accent, #fff);
  background: var(--accent);
  box-shadow: 0 0 0 2px var(--plastic), inset 0 -3px 0 rgb(0 0 0 / 0.12);
}

.done .num {
  color: var(--on-accent, #fff);
  background: var(--budget-ok);
  box-shadow: none;
}

.num svg {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.body {
  flex: 1;
  min-width: 0;
}

.body p {
  margin: 0.15rem 0 0;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.done .body strong {
  color: var(--ink-2);
  text-decoration: line-through;
  text-decoration-color: var(--ink-3);
}

.step .btn {
  flex: none;
  align-self: center;
}

@media (max-width: 520px) {
  .step {
    flex-wrap: wrap;
  }

  /* The text takes the row; the button drops under it, lined up with the text */
  .body {
    flex-basis: calc(100% - 2.5rem);
  }

  .step .btn {
    margin-left: 2.5rem;
    align-self: flex-start;
  }
}
</style>
