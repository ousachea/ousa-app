<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { BudgetContribution, BudgetGoal, Currency } from '~/utils/budget/types'
import { daysBetween, formatDay, today } from '~/utils/budget/dates'

// Savings goals. Putting money into a goal is a transfer between your own money, not an expense,
// so contributions never change spending totals or cash flow; they have their own history here.
const store = useBudget()
const { goals, contributions, settings } = store
const { play } = useSound()
const day = today()

const showArchived = ref(false)
const historyOf = (id: string) => contributions.items.value.filter(c => c.goalId === id).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
const savedOf = (id: string) => historyOf(id).reduce((n, c) => n + (c.type === 'deposit' ? c.amount : -c.amount), 0)

const cards = computed(() => goals.items.value
  .filter(g => showArchived.value || !g.archived)
  .map((g) => {
    const saved = savedOf(g.id)
    const left = Math.max(0, g.target - saved)
    const days = g.targetDate ? daysBetween(day, g.targetDate) : undefined
    // What it takes to get there on time, once there's a date and something left to save
    const perMonth = days !== undefined && days > 0 && left > 0 ? left / Math.max(1, days / 30.4375) : undefined
    return { g, saved, left, share: g.target ? saved / g.target : 0, days, perMonth }
  })
  .sort((a, b) => Number(!!a.g.archived) - Number(!!b.g.archived) || (a.g.targetDate || '9').localeCompare(b.g.targetDate || '9')))
const archivedCount = computed(() => goals.items.value.filter(g => g.archived).length)
const expanded = ref<string>()

// ---------- Goal form ----------
const goalOpen = ref(false)
const editingId = ref<string>()
const form = reactive({ name: '', target: null as number | null, currency: 'USD' as Currency, targetDate: '', note: '', start: null as number | null })
function openGoal(g?: BudgetGoal) {
  editingId.value = g?.id
  Object.assign(form, g ? { name: g.name, target: g.target, currency: g.currency, targetDate: g.targetDate, note: g.note, start: null } : { name: '', target: null, currency: settings.value.primaryCurrency, targetDate: '', note: '', start: null })
  goalOpen.value = true
  play('open')
}
function saveGoal() {
  if (!form.name.trim() || !(Number(form.target) > 0)) return
  const rec = { name: form.name.trim(), target: Number(form.target), currency: form.currency, targetDate: form.targetDate, note: form.note.trim() }
  if (editingId.value) {
    const before = goals.update(editingId.value, rec)
    toastSaved(before && (() => goals.replace(before)))
  } else {
    const g = goals.add(rec)
    if (Number(form.start) > 0) contributions.add({ goalId: g.id, type: 'deposit', amount: Number(form.start), currency: g.currency, date: day, note: 'Already saved' })
    toast.success(`${rec.name} added`, { action: { label: 'Undo', onClick: () => goals.remove(g.id, { undoAdd: true }) } })
  }
  play('success')
  goalOpen.value = false
}
function toggleArchive(g: BudgetGoal) {
  goals.update(g.id, { archived: !g.archived })
  play(g.archived ? 'success' : 'toggle-off')
  goalOpen.value = false
}
function delGoal(g: BudgetGoal) {
  const removedGoal = goals.remove(g.id)
  const removed = historyOf(g.id).map(c => contributions.remove(c.id)).filter(Boolean) as BudgetContribution[]
  play('delete')
  toastDeleted(g.name, () => {
    if (removedGoal) goals.restore(removedGoal)
    removed.forEach(c => contributions.restore(c))
  })
  goalOpen.value = false
}

// ---------- Contribute / withdraw ----------
const moveOpen = ref(false)
const move = reactive({ goal: undefined as BudgetGoal | undefined, type: 'deposit' as BudgetContribution['type'], amount: null as number | null, date: day, note: '' })
function openMove(g: BudgetGoal, type: BudgetContribution['type']) {
  Object.assign(move, { goal: g, type, amount: null, date: day, note: '' })
  moveOpen.value = true
  play('open')
}
const maxOut = computed(() => (move.goal ? savedOf(move.goal.id) : 0))
function saveMove() {
  const g = move.goal
  const amount = Number(move.amount)
  if (!g || !(amount > 0) || (move.type === 'withdrawal' && amount > maxOut.value + 1e-9)) return
  const c = contributions.add({ goalId: g.id, type: move.type, amount, currency: g.currency, date: move.date, note: move.note.trim() })
  play('success')
  toast.success(`${move.type === 'deposit' ? 'Added' : 'Took out'} ${formatMoney(amount, g.currency)}`, { description: g.name, action: { label: 'Undo', onClick: () => contributions.remove(c.id, { undoAdd: true }) } })
  moveOpen.value = false
}
function delContribution(c: BudgetContribution) {
  const removed = contributions.remove(c.id)
  play('delete')
  toastDeleted(`${c.type === 'deposit' ? 'Deposit' : 'Withdrawal'} of ${formatMoney(c.amount, c.currency)}`, () => removed && contributions.restore(removed))
}
</script>

<template>
  <div>
    <div class="b-head">
      <h2>Savings goals</h2>
      <div class="b-row">
        <label v-if="archivedCount" class="check"><input v-model="showArchived" type="checkbox"> Show {{ archivedCount }} archived</label>
        <button type="button" class="btn" @click="openGoal()">+ Goal</button>
      </div>
    </div>
    <p v-if="goals.items.value.length" class="b-muted intro">Money you put into a goal is moved, not spent, so it doesn’t count as an expense or change your cash flow.</p>

    <div v-if="!cards.length" class="panel">
      <EmptyState title="No savings goals yet" icon="budget" action="+ Goal" @action="openGoal()">
        Save toward an emergency fund, a trip or a new phone. Add money as you set it aside and see how close you are.
      </EmptyState>
    </div>

    <div class="goals">
      <article v-for="x in cards" :key="x.g.id" class="panel goal" :class="{ archived: x.g.archived }">
        <div class="top">
          <div class="nm">
            <strong>{{ x.g.name }}</strong>
            <span class="b-muted">
              {{ formatMoney(x.g.target, x.g.currency) }} goal<template v-if="x.g.targetDate"> · by {{ formatDay(x.g.targetDate, { day: 'numeric', month: 'short', year: 'numeric' }) }}</template><template v-if="x.g.archived"> · Archived</template>
            </span>
          </div>
          <button type="button" class="link" @click="openGoal(x.g)">Edit</button>
        </div>
        <div class="progress" role="meter" :aria-label="`${x.g.name} progress`" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="Math.min(100, Math.round(x.share * 100))">
          <span :style="{ width: `${Math.min(100, x.share * 100)}%` }" />
        </div>
        <div class="figs">
          <span><strong class="b-num saved">{{ formatMoney(x.saved, x.g.currency) }}</strong> saved · {{ Math.round(x.share * 100) }}%</span>
          <span v-if="x.left > 0" class="b-muted">{{ formatMoney(x.left, x.g.currency) }} to go</span>
          <span v-else class="badge good">✓ Reached</span>
        </div>
        <p v-if="x.perMonth !== undefined" class="b-muted pace">About {{ formatMoney(x.perMonth, x.g.currency) }} a month to get there on time.</p>
        <p v-else-if="x.days !== undefined && x.days < 0 && x.left > 0" class="pace b-warn">The target date has passed.</p>
        <p v-if="x.g.note" class="b-muted pace">{{ x.g.note }}</p>
        <div v-if="!x.g.archived" class="b-row">
          <button type="button" class="btn btn-sm" @click="openMove(x.g, 'deposit')">+ Add money</button>
          <button type="button" class="btn btn-quiet btn-sm" :disabled="x.saved <= 0" @click="openMove(x.g, 'withdrawal')">Take out</button>
          <button type="button" class="link history-btn" :aria-expanded="expanded === x.g.id" @click="expanded = expanded === x.g.id ? undefined : x.g.id">History ({{ historyOf(x.g.id).length }})</button>
        </div>
        <ul v-if="expanded === x.g.id" class="history">
          <li v-for="c in historyOf(x.g.id)" :key="c.id">
            <span class="b-muted b-num">{{ formatDay(c.date, { day: 'numeric', month: 'short', year: '2-digit' }) }}</span>
            <span class="note">{{ c.note || (c.type === 'deposit' ? 'Added' : 'Taken out') }}</span>
            <span class="b-num" :class="c.type === 'deposit' ? 'saved' : 'out'">{{ c.type === 'deposit' ? '+' : '−' }}{{ formatMoney(c.amount, c.currency) }}</span>
            <ConfirmDelete :name="c.note || 'this entry'" @confirm="delContribution(c)" />
          </li>
          <li v-if="!historyOf(x.g.id).length" class="b-muted">Nothing yet.</li>
        </ul>
      </article>
    </div>

    <Modal :open="goalOpen" :title="editingId ? 'Edit goal' : 'New savings goal'" @close="goalOpen = false">
      <form v-validate class="b-form" @submit.prevent="saveGoal">
        <label class="field">
          <span class="field-head">Name</span>
          <input v-model="form.name" class="input" required autocomplete="off" placeholder="Emergency fund, trip, new laptop…" data-keys="text" data-error="Give it a name">
        </label>
        <div class="field">
          <span class="field-head">Target</span>
          <div class="b-amount">
            <input v-model.number="form.target" class="input" type="number" inputmode="decimal" min="0" step="any" required aria-label="Target amount" v-check="Number(form.target) > 0 ? '' : 'Enter a target above 0'" :data-keys="form.currency === 'KHR' ? 'riel' : 'money'">
            <span class="segmented" role="radiogroup" aria-label="Currency">
              <label v-for="c in (['USD', 'KHR'] as const)" :key="c" :class="{ active: form.currency === c }"><input v-model="form.currency" type="radio" name="g-cur" :value="c" :disabled="!!editingId">{{ c === 'USD' ? '$' : '៛' }}</label>
            </span>
          </div>
        </div>
        <div class="row">
          <label class="field">
            <span class="field-head">Target date <span class="optional">Optional</span></span>
            <DatePicker v-model="form.targetDate" aria-label="Target date" :min="day" />
          </label>
          <label v-if="!editingId" class="field">
            <span class="field-head">Already saved <span class="optional">Optional</span></span>
            <input v-model.number="form.start" class="input" type="number" inputmode="decimal" min="0" step="any" placeholder="0" aria-label="Already saved">
          </label>
        </div>
        <label class="field">
          <span class="field-head">Note <span class="optional">Optional</span></span>
          <input v-model="form.note" class="input" autocomplete="off" data-keys="text">
        </label>
        <div class="actions">
          <button type="submit" class="btn">{{ editingId ? 'Save changes' : 'Add goal' }}</button>
          <button v-if="editingId" type="button" class="btn btn-quiet" @click="toggleArchive(goals.items.value.find(g => g.id === editingId)!)">
            {{ goals.items.value.find(g => g.id === editingId)?.archived ? 'Unarchive' : 'Archive' }}
          </button>
          <button v-else type="button" class="btn btn-quiet" @click="goalOpen = false">Cancel</button>
          <ConfirmDelete v-if="editingId" text name="this goal and its history" @confirm="delGoal(goals.items.value.find(g => g.id === editingId)!)" />
        </div>
      </form>
    </Modal>

    <Modal :open="moveOpen" :title="move.type === 'deposit' ? `Add to ${move.goal?.name ?? ''}` : `Take out of ${move.goal?.name ?? ''}`" @close="moveOpen = false">
      <form v-validate class="b-form" @submit.prevent="saveMove">
        <label class="field">
          <span class="field-head">Amount ({{ move.goal?.currency }})</span>
          <input
            v-model.number="move.amount"
            class="input"
            type="number"
            inputmode="decimal"
            min="0"
            step="any"
            required
            autofocus
            aria-label="Amount"
            v-check="!(Number(move.amount) > 0) ? 'Enter an amount' : move.type === 'withdrawal' && Number(move.amount) > maxOut + 1e-9 ? `Only ${formatMoney(maxOut, move.goal?.currency ?? 'USD')} is saved` : ''"
          >
        </label>
        <div class="row">
          <label class="field">
            <span class="field-head">Date</span>
            <DatePicker v-model="move.date" aria-label="Date" :max="day" required />
          </label>
          <label class="field">
            <span class="field-head">Note <span class="optional">Optional</span></span>
            <input v-model="move.note" class="input" autocomplete="off" data-keys="text">
          </label>
        </div>
        <div class="actions">
          <button type="submit" class="btn">{{ move.type === 'deposit' ? 'Add money' : 'Take out' }}</button>
          <button type="button" class="btn btn-quiet" @click="moveOpen = false">Cancel</button>
        </div>
      </form>
    </Modal>
  </div>
</template>

<style scoped>
.intro {
  margin: -0.25rem 0 1rem;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.goals {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
  gap: 0.75rem;
}

.goal {
  padding: 1rem 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.goal.archived {
  opacity: 0.65;
}

.top {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.nm {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.progress {
  height: 10px;
  border-radius: var(--radius-pill);
  background: var(--surface-2);
  box-shadow: inset 0 0 0 1px var(--line);
  overflow: hidden;
}

.progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--budget-c3);
  transition: width var(--dur-slow) var(--ease-out);
}

.figs {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: var(--text-sm);
}

.saved {
  color: var(--budget-save-ink);
}

.out {
  color: var(--ink-2);
}

.pace {
  margin: 0;
  font-size: var(--text-sm);
}

.history-btn {
  margin-left: auto;
  font-size: var(--text-sm);
}

.history {
  list-style: none;
  margin: 0;
  padding: 0.5rem 0 0;
  border-top: 1px solid var(--line);
}

.history li {
  padding: 0.3rem 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: var(--text-sm);
}

.history .note {
  flex: 1;
  min-width: 0;
}
</style>
