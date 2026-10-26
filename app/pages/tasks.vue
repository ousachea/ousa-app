<script setup lang="ts">
import { toast } from 'vue-sonner'

// A to-do list with due dates: what's due today (and overdue), what's coming up, things with no date, and
// what's done. A repeating task moves to its next date when you tick it, instead of being done for good.
type Repeat = 'none' | 'daily' | 'weekly' | 'monthly'
interface Task {
  id: string
  title: string
  due: string // yyyy-mm-dd, or '' for no date
  repeat: Repeat
  done: boolean
  doneAt?: string // ISO, when it was ticked
  createdAt: string
}

const REPEATS: { value: Repeat, label: string }[] = [
  { value: 'none', label: 'Doesn’t repeat' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' }
]

const { play } = useSound()
const DAY = 86_400_000
const dayIso = (offset: number) => localIsoDate(new Date(Date.now() + offset * DAY))

const DEMO = (): Omit<Task, 'id'>[] => {
  const t = (title: string, due: string, extra: Partial<Task> = {}): Omit<Task, 'id'> => ({ title, due, repeat: 'none', done: false, createdAt: new Date(Date.now() - 3 * DAY).toISOString(), ...extra })
  return [
    t('Pay the internet bill', dayIso(-1)),
    t('Call the bank about the card', dayIso(0)),
    t('Water the plants', dayIso(0), { repeat: 'daily' }),
    t('Book the bus to Kampot', dayIso(2)),
    t('Send the monthly report', dayIso(5), { repeat: 'monthly' }),
    t('Back up the laptop', dayIso(9), { repeat: 'weekly' }),
    t('Try the new noodle place', ''),
    t('Renew the motorbike tax', dayIso(-6), { done: true, doneAt: new Date(Date.now() - 6 * DAY).toISOString() })
  ]
}
const { items, ready, sync, add, update, replace, remove, restore } = useCollection<Task>('tasks', undefined, { demo: DEMO, label: t => t.title })

usePullToRefresh(async () => {
  await sync.retry()
  toast(sync.signedIn.value ? 'Up to date with your account' : 'Refreshed', { duration: 1800 })
})

const nowMs = useNow()
const today = computed(() => localIsoDate(new Date(nowMs.value)))

// ---------- Adding ----------
const QUICK_DUE = [
  { label: 'Today', offset: 0 },
  { label: 'Tomorrow', offset: 1 },
  { label: 'Next week', offset: 7 },
  { label: 'No date', offset: undefined }
]
const form = reactive({ title: '', due: localIsoDate(), repeat: 'none' as Repeat })
const titleField = ref<HTMLInputElement>()
useAddAction(() => focusField(titleField.value))
function addTask() {
  const title = form.title.trim()
  if (!title) return
  const added = add({ title, due: form.due, repeat: form.due ? form.repeat : 'none', done: false, createdAt: new Date().toISOString() })
  form.title = ''
  // The next task starts as a one-off again; a repeat is a choice for each task
  form.repeat = 'none'
  play('success')
  toast.success(`Added “${title}”`, { description: form.due ? `Due ${whenText(form.due)}` : 'No date', action: { label: 'Undo', onClick: () => remove(added.id, { undoAdd: true }) } })
}

// ---------- Due dates ----------
function addMonth(iso: string) {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  const last = new Date(y, m + 1, 0).getDate() // days in the month after
  return localIsoDate(new Date(y, m, Math.min(d, last)))
}
function step(iso: string, repeat: Repeat) {
  if (repeat === 'daily') return localIsoDate(new Date(Date.parse(`${iso}T00:00`) + DAY))
  if (repeat === 'weekly') return localIsoDate(new Date(Date.parse(`${iso}T00:00`) + 7 * DAY))
  return addMonth(iso)
}
/** The next date after ticking a repeating task: past its due date, and past today too if it was overdue */
function nextDue(t: Task) {
  let d = step(t.due, t.repeat)
  for (let guard = 0; d <= today.value && guard < 400; guard++) d = step(d, t.repeat)
  return d
}
const daysFrom = (iso: string) => Math.round((Date.parse(`${iso}T00:00`) - Date.parse(`${today.value}T00:00`)) / DAY)
function whenText(iso: string) {
  const n = daysFrom(iso)
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n === -1) return 'yesterday'
  if (n < 0) return `${-n} days ago`
  if (n < 7) return new Date(`${iso}T00:00`).toLocaleDateString('en-GB', { weekday: 'long' })
  return new Date(`${iso}T00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ---------- Ticking off ----------
function complete(t: Task) {
  if (t.done) {
    update(t.id, { done: false, doneAt: undefined })
    play('select')
    return
  }
  if (t.repeat !== 'none' && t.due) {
    const next = nextDue(t)
    const before = update(t.id, { due: next })
    play('success')
    toast.success(`Done. Next one ${whenText(next)}`, { action: { label: 'Undo', onClick: () => before && replace(before) } })
    return
  }
  const before = update(t.id, { done: true, doneAt: new Date().toISOString() })
  play('success')
  toast.success(`Done: ${t.title}`, { action: { label: 'Undo', onClick: () => before && replace(before) } })
}
function del(t: Task) {
  const removed = remove(t.id)
  play('delete')
  toastDeleted(t.title, () => removed && restore(removed))
}
function clearDone() {
  const done = items.value.filter(t => t.done)
  const removed = done.map(t => remove(t.id)).filter(Boolean)
  play('delete')
  toast(`Cleared ${done.length} done ${done.length === 1 ? 'task' : 'tasks'}`, { action: { label: 'Undo', onClick: () => removed.forEach(r => r && restore(r)) } })
}

// ---------- The lists ----------
const open = computed(() => items.value.filter(t => !t.done))
const byDue = (a: Task, b: Task) => a.due.localeCompare(b.due) || (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
const groups = computed(() => [
  { key: 'today', title: 'Today', hint: 'Due today, and anything overdue first.', list: open.value.filter(t => t.due && t.due <= today.value).sort(byDue) },
  { key: 'upcoming', title: 'Coming up', hint: 'The next few weeks, soonest first.', list: open.value.filter(t => t.due > today.value).sort(byDue) },
  { key: 'someday', title: 'No date', hint: 'Whenever you get to them.', list: open.value.filter(t => !t.due).sort(byDue) }
])
const done = computed(() => items.value.filter(t => t.done).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '')))
const dueToday = computed(() => groups.value[0]!.list.length)
const repeatLabel = (r: Repeat) => REPEATS.find(x => x.value === r)?.label.toLowerCase()
</script>

<template>
  <ToolPage header="bar">
    <div class="workspace">
      <Step :n="1" title="Add a task" hint="What needs doing, and when. Repeat it for chores that come round again.">
        <form class="panel add" @submit.prevent="addTask">
          <input ref="titleField" v-model="form.title" class="input title" placeholder="Pay the water bill, call Dara, buy rice…" aria-label="New task" maxlength="140">
          <div class="when">
            <div class="quick" role="group" aria-label="Due">
              <button
                v-for="q in QUICK_DUE"
                :key="q.label"
                type="button"
                class="chip"
                :class="{ active: q.offset === undefined ? !form.due : form.due === dayIso(q.offset) }"
                @click="form.due = q.offset === undefined ? '' : dayIso(q.offset)"
              >
                {{ q.label }}
              </button>
            </div>
            <DatePicker v-if="form.due" v-model="form.due" aria-label="Due date" />
            <AppSelect v-if="form.due" v-model="form.repeat" aria-label="Repeat" :options="REPEATS" />
          </div>
          <button type="submit" class="btn" :disabled="!form.title.trim()">Add task</button>
        </form>
      </Step>

      <Step :n="2" title="Get them done" :hint="ready && items.length ? (dueToday ? `${dueToday} for today. Tick one off when it’s done.` : 'Nothing due today.') : 'Your tasks show up here, today’s first.'">
        <template #aside><ClientOnly><DataSource :sync="sync" /></ClientOnly></template>
        <ClientOnly>
          <div v-if="ready && items.length" class="groups">
            <section v-for="g in groups" v-show="g.list.length || g.key === 'today'" :key="g.key" class="panel group" :aria-labelledby="`tasks-${g.key}`">
              <header>
                <h3 :id="`tasks-${g.key}`">{{ g.title }} <span class="count">{{ g.list.length }}</span></h3>
                <p>{{ g.hint }}</p>
              </header>
              <TransitionGroup v-if="g.list.length" tag="ul" name="list" class="list">
                <li v-for="t in g.list" :key="t.id" class="task">
                  <button type="button" class="tick" :aria-label="`Mark “${t.title}” done`" @click="complete(t)" />
                  <span class="text">
                    <strong>{{ t.title }}</strong>
                    <span v-if="t.due" class="due" :class="{ late: t.due < today, now: t.due === today }">
                      {{ t.due < today ? `Overdue, ${whenText(t.due)}` : `Due ${whenText(t.due)}` }}<template v-if="t.repeat !== 'none'"> · {{ repeatLabel(t.repeat) }}</template>
                    </span>
                  </span>
                  <ConfirmDelete :name="t.title" @confirm="del(t)" />
                </li>
              </TransitionGroup>
              <p v-else class="clear">All clear for today.</p>
            </section>

            <details v-if="done.length" class="panel group done-list">
              <summary>Done <span class="count">{{ done.length }}</span></summary>
              <ul class="list">
                <li v-for="t in done" :key="t.id" class="task is-done">
                  <button type="button" class="tick on" :aria-label="`Mark “${t.title}” not done`" @click="complete(t)"><AppIcon name="check" /></button>
                  <span class="text"><strong>{{ t.title }}</strong><span class="due">Done {{ t.doneAt ? whenText(localIsoDate(new Date(t.doneAt))) : '' }}</span></span>
                  <ConfirmDelete :name="t.title" @confirm="del(t)" />
                </li>
              </ul>
              <button type="button" class="btn btn-quiet btn-sm" @click="clearDone">Clear done tasks</button>
            </details>
          </div>
          <div v-else-if="ready" class="panel">
            <EmptyState title="Nothing to do yet" icon="tasks" action="Add your first task" @action="focusField(titleField)">
              Add what needs doing and when. Today’s tasks come first, and repeating chores move to their next date when you tick them.
            </EmptyState>
          </div>
          <SkeletonList v-else :count="4" label="Loading your tasks" />
          <template #fallback><SkeletonList :count="4" label="Loading your tasks" /></template>
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

.add {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
}

.add .title {
  flex: 1 1 100%;
}

.when {
  flex: 1 1 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.quick {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.chip {
  padding: 0.4rem 0.75rem;
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

/* From a tablet held upright, the lists sit side by side: today on the left, the rest beside it */
.groups {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

@media (min-width: 760px) {
  .groups {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1100px) {
  .groups {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.group {
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.group h3 {
  font-size: var(--text-title);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.group header p {
  margin: 0.15rem 0 0;
  font-size: var(--text-sm);
  color: var(--ink-3);
}

.count {
  padding: 0 0.45rem;
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--ink-2);
  background: var(--surface-2);
  border-radius: var(--radius-pill);
}

.list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.task {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0;
}

.task + .task {
  border-top: 1px solid var(--line);
}

.tick {
  flex: none;
  width: 1.6rem;
  height: 1.6rem;
  display: grid;
  place-items: center;
  font-size: var(--text-sm);
  color: var(--on-accent);
  background: var(--surface);
  border: 2px solid var(--ink-3);
  border-radius: 50%;
  cursor: pointer;
  transition: background-color var(--dur-fast), border-color var(--dur-fast);
}

.tick:hover {
  border-color: var(--accent);
}

.tick.on {
  background: var(--accent);
  border-color: var(--accent);
}

.text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.text strong {
  overflow-wrap: anywhere;
}

.is-done strong {
  color: var(--ink-3);
  text-decoration: line-through;
}

.due {
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.due.now {
  font-weight: 600;
  color: color-mix(in srgb, var(--accent) 75%, var(--ink));
}

.due.late {
  font-weight: 600;
  color: var(--bad-ink);
}

.clear {
  margin: 0;
  color: var(--ink-2);
}

.done-list summary {
  font-weight: 700;
  cursor: pointer;
}

.done-list .btn {
  align-self: flex-start;
}
</style>
