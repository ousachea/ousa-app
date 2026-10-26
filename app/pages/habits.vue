<script setup lang="ts">
import { toast } from 'vue-sonner'

// Small daily habits, ticked off day by day. Each habit keeps the days it was done, so the streak, the
// week row and the 12-week grid all read from one list. Synced like every tracker (useCollection).
interface Habit {
  id: string
  name: string
  done: string[] // yyyy-mm-dd, the days it was done
  createdAt: string
}

const { play } = useSound()
const DAY = 86_400_000
const dayIso = (offset: number, from = new Date()) => localIsoDate(new Date(from.getTime() + offset * DAY))

// Demo: three habits kept up for a few weeks with the odd day missed
const DEMO = (): Omit<Habit, 'id'>[] => {
  const days = (keep: (i: number) => boolean) => Array.from({ length: 60 }, (_, i) => i).filter(keep).map(i => dayIso(-i))
  return [
    { name: 'Drink 2 litres of water', done: days(i => i % 5 !== 3), createdAt: new Date(Date.now() - 60 * DAY).toISOString() },
    { name: 'Walk 30 minutes', done: days(i => i > 0 && i % 3 !== 0), createdAt: new Date(Date.now() - 60 * DAY).toISOString() },
    { name: 'Read 10 pages', done: days(i => i < 12 && i !== 4), createdAt: new Date(Date.now() - 20 * DAY).toISOString() }
  ]
}
const { items, ready, sync, add, update, remove, restore } = useCollection<Habit>('habits', undefined, { demo: DEMO, label: h => h.name })

usePullToRefresh(async () => {
  await sync.retry()
  toast(sync.signedIn.value ? 'Up to date with your account' : 'Refreshed', { duration: 1800 })
})

// The day turns over at midnight while the page is open
const nowMs = useNow()
const today = computed(() => localIsoDate(new Date(nowMs.value)))
const habits = computed(() => [...items.value].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '')))

// ---------- Adding ----------
const newName = ref('')
const nameField = ref<HTMLInputElement>()
useAddAction(() => focusField(nameField.value))
function addHabit() {
  const name = newName.value.trim()
  if (!name) return
  const added = add({ name, done: [], createdAt: new Date().toISOString() })
  newName.value = ''
  play('success')
  toast.success(`Added “${name}”`, { action: { label: 'Undo', onClick: () => remove(added.id, { undoAdd: true }) } })
}

// ---------- Ticking off ----------
const isDone = (h: Habit, day: string) => h.done.includes(day)
function toggle(h: Habit, day = today.value) {
  const on = !isDone(h, day)
  update(h.id, { done: on ? [...h.done, day] : h.done.filter(d => d !== day) }, { quiet: true })
  play(on ? 'success' : 'select')
}

/** Days in a row up to today, or up to yesterday while today isn't ticked yet (the streak is still alive) */
function streak(h: Habit) {
  const set = new Set(h.done)
  const start = set.has(today.value) ? 0 : -1
  let n = 0
  while (set.has(dayIso(start - n, new Date(nowMs.value)))) n++
  return n
}
function best(h: Habit) {
  const days = [...new Set(h.done)].sort()
  let run = 0
  let top = 0
  let prev = ''
  for (const d of days) {
    run = prev && Date.parse(`${d}T00:00`) - Date.parse(`${prev}T00:00`) <= DAY * 1.5 ? run + 1 : 1
    top = Math.max(top, run)
    prev = d
  }
  return top
}

// The last seven days, oldest first, for the week row under each habit
const week = computed(() => Array.from({ length: 7 }, (_, i) => {
  const date = dayIso(i - 6, new Date(nowMs.value))
  return { date, label: new Date(`${date}T00:00`).toLocaleDateString('en-GB', { weekday: 'narrow' }), long: new Date(`${date}T00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }) }
}))

// Twelve weeks as a grid, a column a week, Monday at the top
const WEEKS = 12
const grid = computed(() => {
  const now = new Date(nowMs.value)
  const back = (now.getDay() + 6) % 7 // days since Monday
  const start = -(back + (WEEKS - 1) * 7)
  return Array.from({ length: WEEKS }, (_, w) => Array.from({ length: 7 }, (_, d) => {
    const offset = start + w * 7 + d
    return offset > 0 ? undefined : dayIso(offset, now)
  }))
})

const doneToday = computed(() => habits.value.filter(h => isDone(h, today.value)).length)

// ---------- Renaming and deleting ----------
const editing = ref<string>()
const editName = ref('')
function startRename(h: Habit) {
  editing.value = h.id
  editName.value = h.name
}
function saveRename(h: Habit) {
  const name = editName.value.trim()
  if (name && name !== h.name) update(h.id, { name })
  editing.value = undefined
}
function del(h: Habit) {
  const removed = remove(h.id)
  play('delete')
  toastDeleted(h.name, () => removed && restore(removed))
}
const fmtDay = (d: string) => new Date(`${d}T00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
</script>

<template>
  <ToolPage header="bar">
    <div class="workspace">
      <Step :n="1" title="Add a habit" hint="Something small you want to do every day. Keep it easy enough to do on a bad day.">
        <form class="panel add" @submit.prevent="addHabit">
          <input ref="nameField" v-model="newName" class="input" placeholder="Drink water, walk 30 minutes, read 10 pages…" aria-label="New habit" maxlength="80">
          <button type="submit" class="btn" :disabled="!newName.trim()">Add habit</button>
        </form>
      </Step>

      <Step :n="2" title="Tick off today" :hint="habits.length ? `${doneToday} of ${habits.length} done today. Tap a day in the week row to fill in one you forgot.` : 'Your habits show up here with a box to tick each day.'">
        <template #aside><ClientOnly><DataSource :sync="sync" /></ClientOnly></template>
        <ClientOnly>
          <ul v-if="ready && habits.length" class="habits">
            <li v-for="h in habits" :key="h.id" class="panel habit" :class="{ done: isDone(h, today) }">
              <div class="top">
                <button type="button" class="tick" :aria-pressed="isDone(h, today)" :aria-label="`${h.name}: ${isDone(h, today) ? 'done today' : 'not done yet today'}`" @click="toggle(h)">
                  <AppIcon v-if="isDone(h, today)" name="check" />
                </button>
                <form v-if="editing === h.id" class="rename" @submit.prevent="saveRename(h)">
                  <input v-model="editName" class="input" aria-label="Habit name" maxlength="80" @keydown.esc="editing = undefined">
                  <button type="submit" class="btn btn-sm">Save</button>
                </form>
                <div v-else class="name">
                  <strong>{{ h.name }}</strong>
                  <span class="meta">
                    <span class="streak" :class="{ hot: streak(h) >= 3 }">{{ streak(h) }} {{ streak(h) === 1 ? 'day' : 'days' }} in a row</span>
                    · best {{ best(h) }}
                  </span>
                </div>
                <span class="actions">
                  <button v-if="editing !== h.id" type="button" class="icon-btn" :aria-label="`Rename ${h.name}`" title="Rename" @click="startRename(h)"><AppIcon name="pencil" /></button>
                  <ConfirmDelete :name="h.name" @confirm="del(h)" />
                </span>
              </div>
              <div class="week" role="group" :aria-label="`${h.name}, the last 7 days`">
                <button
                  v-for="d in week"
                  :key="d.date"
                  type="button"
                  class="day"
                  :class="{ on: isDone(h, d.date), today: d.date === today }"
                  :aria-pressed="isDone(h, d.date)"
                  :aria-label="`${d.long}: ${isDone(h, d.date) ? 'done' : 'not done'}`"
                  @click="toggle(h, d.date)"
                >
                  <span>{{ d.label }}</span>
                </button>
              </div>
            </li>
          </ul>
          <div v-else-if="ready" class="panel">
            <EmptyState title="No habits yet" icon="habits" action="Add your first habit" @action="focusField(nameField)">
              Add one small thing to do every day. Tick it off here, and the streak keeps you going.
            </EmptyState>
          </div>
          <SkeletonList v-else :count="3" label="Loading your habits" />
          <template #fallback><SkeletonList :count="3" label="Loading your habits" /></template>
        </ClientOnly>
      </Step>

      <Step :n="3" title="See the last 12 weeks" hint="Each square is a day, a column a week. The darker, the more habits you kept that day.">
        <ClientOnly>
          <div v-if="ready && habits.length" class="panel heat">
            <div class="heat-grid" role="img" :aria-label="`The last ${WEEKS} weeks of habits`">
              <div v-for="(col, w) in grid" :key="w" class="heat-col">
                <span
                  v-for="(d, i) in col"
                  :key="i"
                  class="cell"
                  :class="{ future: !d }"
                  :style="d ? { '--share': habits.filter(h => isDone(h, d)).length / habits.length } : undefined"
                  :title="d ? `${fmtDay(d)}: ${habits.filter(h => isDone(h, d)).length} of ${habits.length}` : undefined"
                />
              </div>
            </div>
            <p class="legend"><span>Less</span><span class="cell" style="--share: 0" /><span class="cell" style="--share: 0.34" /><span class="cell" style="--share: 0.67" /><span class="cell" style="--share: 1" /><span>More</span></p>
          </div>
          <p v-else class="panel step-empty">Your last 12 weeks show here once you add a habit.</p>
        </ClientOnly>
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

/* From a tablet held upright: the habits on the left, the 12 weeks beside them */
@media (min-width: 760px) {
  .workspace {
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
    align-items: start;
  }

  .workspace > :first-child {
    grid-column: 1 / -1;
  }
}

.add {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 1rem;
}

.add .input {
  flex: 1 1 260px;
  min-width: 0;
}

.habits {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.habit {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1rem 1.1rem;
  transition: border-color var(--dur);
}

.habit.done {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--line));
}

.top {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.tick {
  flex: none;
  width: 2.6rem;
  height: 2.6rem;
  display: grid;
  place-items: center;
  font-size: var(--text-lg);
  color: var(--on-accent, #fff);
  background: var(--surface);
  border: 2px solid var(--line);
  border-radius: 50%;
  cursor: pointer;
  transition: background-color var(--dur-fast), border-color var(--dur-fast), transform var(--dur-fast);
}

.tick:active {
  transform: scale(0.92);
}

.tick[aria-pressed='true'] {
  background: var(--accent);
  border-color: var(--accent);
}

.name {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.name strong {
  overflow-wrap: anywhere;
}

.meta {
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.streak.hot {
  font-weight: 700;
  color: color-mix(in srgb, var(--accent) 75%, var(--ink));
}

.rename {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 0.5rem;
}

.rename .input {
  flex: 1;
  min-width: 0;
}

.actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.week {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.35rem;
}

.day {
  height: 2.2rem;
  display: grid;
  place-items: center;
  font: inherit;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--ink-2);
  background: var(--surface-2);
  border: 1px solid transparent;
  border-radius: var(--radius);
  cursor: pointer;
}

.day.today {
  border-color: var(--ink-3);
}

.day.on {
  color: var(--on-accent, #fff);
  background: var(--accent);
}

.heat {
  padding: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.heat-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 4px;
}

.heat-col {
  display: grid;
  grid-template-rows: repeat(7, 1fr);
  gap: 4px;
}

.cell {
  display: block;
  aspect-ratio: 1;
  min-width: 0.7rem;
  border-radius: 3px;
  background: color-mix(in srgb, var(--accent) calc(var(--share, 0) * 100%), var(--surface-2));
}

.cell.future {
  background: transparent;
}

.legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  margin: 0;
  font-size: var(--text-xs);
  color: var(--ink-3);
}

.legend .cell {
  width: 0.8rem;
  min-width: 0;
}

.step-empty {
  margin: 0;
  padding: 1rem 1.25rem;
  color: var(--ink-2);
}
</style>
