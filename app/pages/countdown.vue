<script setup lang="ts">
import { toast } from 'vue-sonner'

interface CountdownEvent {
  id: string
  title: string
  date: string // yyyy-mm-dd
  time: string // hh:mm, or '' for all day
  createdAt: string // ISO; the progress bar measures the wait from here
}

const { play } = useSound()
const { items, ready, sync, add, update, remove, restore } = useCollection<CountdownEvent>('countdown')

const isoToday = () => new Date().toISOString().slice(0, 10)
const blank = () => ({ title: '', date: '', time: '' })
const form = reactive(blank())
const editingId = ref<string>()

// Tick once a second so the featured countdown is live
const now = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | undefined
onMounted(() => (ticker = setInterval(() => (now.value = Date.now()), 1000)))
onBeforeUnmount(() => clearInterval(ticker))

const target = (e: CountdownEvent) => new Date(`${e.date}T${e.time || '00:00'}`).getTime()

const events = computed(() => items.value
  .map((e) => {
    const at = target(e)
    const start = new Date(e.createdAt).getTime()
    const span = Math.max(at - start, 1)
    return {
      ...e,
      at,
      left: at - now.value,
      // Share of the wait already behind you (0 when added, 1 on the day)
      progress: Math.min(Math.max((now.value - start) / span, 0), 1)
    }
  })
  .sort((a, b) => a.at - b.at))

const upcoming = computed(() => events.value.filter(e => e.left > 0))
const past = computed(() => events.value.filter(e => e.left <= 0).reverse())
const featured = computed(() => upcoming.value[0])

function parts(ms: number) {
  const s = Math.max(Math.floor(ms / 1000), 0)
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 }
}

function shortLeft(ms: number) {
  const { days, hours, minutes } = parts(ms)
  if (days >= 1) return { value: days, unit: days === 1 ? 'day' : 'days' }
  if (hours >= 1) return { value: hours, unit: hours === 1 ? 'hour' : 'hours' }
  return { value: Math.max(minutes, 1), unit: minutes <= 1 ? 'minute' : 'minutes' }
}

function agoText(ms: number) {
  const days = Math.floor(-ms / 86_400_000)
  if (days === 0) return 'Today'
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

const formatWhen = (e: CountdownEvent) =>
  new Date(target(e)).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', ...(e.time ? { hour: '2-digit', minute: '2-digit' } : {}) })

const at = (e: CountdownEvent) => new Date(target(e))
const monthOf = (e: CountdownEvent) => at(e).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
const dayOf = (e: CountdownEvent) => at(e).getDate()
const weekdayOf = (e: CountdownEvent) => at(e).toLocaleDateString('en-GB', { weekday: 'long' })

const canSave = computed(() => form.title.trim() && form.date)

function save() {
  if (!canSave.value) return
  if (editingId.value) {
    update(editingId.value, { title: form.title.trim(), date: form.date, time: form.time })
    toast.success('Changes saved')
  } else {
    add({ title: form.title.trim(), date: form.date, time: form.time, createdAt: new Date().toISOString() })
    toast.success(`Counting down to ${form.title.trim()}`)
  }
  play('success')
  cancel()
}

function edit(e: CountdownEvent) {
  editingId.value = e.id
  Object.assign(form, { title: e.title, date: e.date, time: e.time })
  play('select')
}

function cancel() {
  editingId.value = undefined
  Object.assign(form, blank())
}

function del(e: CountdownEvent) {
  const removed = remove(e.id)
  if (editingId.value === e.id) cancel()
  play('delete')
  toast(`${e.title} deleted`, { action: { label: 'Undo', onClick: () => removed && restore(removed) } })
}
</script>

<template>
  <ToolPage>
    <div class="workspace">
      <Step :n="1" :title="editingId ? 'Edit date' : 'Add a date'" class="form-step">
        <form class="panel form" @submit.prevent="save">
          <label class="field">
            <span class="field-head">What’s happening?</span>
            <input v-model="form.title" class="input" placeholder="Khmer New Year, trip to Siem Reap…" required>
          </label>
          <div class="row">
            <label class="field">
              <span class="field-head">Date</span>
              <input v-model="form.date" class="input" type="date" :min="editingId ? undefined : isoToday()" required>
            </label>
            <label class="field">
              <span class="field-head">Time <span class="optional">Optional</span></span>
              <input v-model="form.time" class="input" type="time">
            </label>
          </div>
          <div class="actions">
            <button type="submit" class="btn" :disabled="!canSave">{{ editingId ? 'Save changes' : 'Start countdown' }}</button>
            <button v-if="editingId" type="button" class="btn btn-quiet" @click="cancel">Cancel</button>
          </div>
        </form>
      </Step>

      <Step :n="2" title="Coming up" class="list-step">
        <template #aside><ClientOnly><DataSource :sync="sync" /></ClientOnly></template>
        <ClientOnly>
          <template v-if="ready && items.length">
            <section v-if="featured" class="panel featured" aria-live="off">
              <span class="label">Next up</span>
              <h2>{{ featured.title }}</h2>
              <p class="when-text">{{ formatWhen(featured) }}</p>
              <div class="clock" role="timer" :aria-label="`${parts(featured.left).days} days left`">
                <div v-for="(v, k) in parts(featured.left)" :key="k" class="unit">
                  <strong>{{ String(v).padStart(k === 'days' ? 1 : 2, '0') }}</strong>
                  <span>{{ k }}</span>
                </div>
              </div>
            </section>

            <!-- Each date is a page torn from a desk calendar -->
            <ul v-if="upcoming.length" class="pages">
              <li v-for="e in upcoming" :key="e.id" class="page" :class="{ editing: editingId === e.id }">
                <span class="rings" aria-hidden="true"><i /><i /></span>
                <span class="month">{{ monthOf(e) }}</span>
                <strong class="day">{{ dayOf(e) }}</strong>
                <span class="weekday">{{ weekdayOf(e) }}{{ e.time ? ` · ${e.time}` : '' }}</span>
                <span class="title">{{ e.title }}</span>
                <span class="togo">
                  <b>{{ shortLeft(e.left).value }}</b> {{ shortLeft(e.left).unit }} to go
                </span>
                <span class="progress" role="img" :aria-label="`${Math.round(e.progress * 100)}% of the wait has passed`">
                  <span :style="{ transform: `scaleX(${e.progress})` }" />
                </span>
                <span class="links">
                  <button type="button" class="link" @click="edit(e)">Edit</button>
                  <button type="button" class="link danger" @click="del(e)">Delete</button>
                </span>
              </li>
            </ul>
            <p v-else class="panel all-past">Everything has already happened. Add a new date to count down to.</p>

            <section v-if="past.length" class="past">
              <h3>Already happened</h3>
              <ul>
                <li v-for="e in past" :key="e.id">
                  <span>{{ e.title }}</span>
                  <span class="meta">{{ agoText(e.left) }}</span>
                  <button type="button" class="link danger" @click="del(e)">Delete</button>
                </li>
              </ul>
            </section>
          </template>

          <div v-else-if="ready" class="panel empty">
            <h2>No dates yet</h2>
            <p>Add a birthday, trip or deadline to start counting down.</p>
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

.featured {
  padding: 1.6rem;
  color: #fff;
  background: var(--accent);
  border: 0;
}

.featured .label {
  font-size: 0.85rem;
  font-weight: 600;
  opacity: 0.85;
}

.featured h2 {
  margin-top: 0.2rem;
  font-size: clamp(1.5rem, 3vw, 2rem);
  letter-spacing: -0.02em;
}

.when-text {
  margin: 0.25rem 0 0;
  opacity: 0.85;
}

.clock {
  margin-top: 1.25rem;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
}

/* Flip-clock tiles: a hinge line across the middle, darker lower half */
.unit {
  position: relative;
  padding: 0.7rem 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: linear-gradient(rgb(0 0 0 / 0.16) 0 50%, rgb(0 0 0 / 0.28) 50% 100%);
  border-radius: 12px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.15);
}

.unit::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: calc(0.7rem + clamp(1.6rem, 4vw, 2.4rem) * 0.55);
  height: 1px;
  background: rgb(0 0 0 / 0.35);
}

.unit strong {
  font-size: clamp(1.6rem, 4vw, 2.4rem);
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.unit span {
  font-size: 0.75rem;
  text-transform: capitalize;
  opacity: 0.85;
}

.pages {
  list-style: none;
  margin: 1.5rem 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 180px), 1fr));
  gap: 1.25rem 1rem;
}

/* A desk-calendar page: binding rings, a coloured month strip, a big day number */
.page {
  position: relative;
  padding: 0 0 0.9rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  background: var(--surface);
  border-radius: 6px 6px 14px 14px;
  box-shadow:
    0 1px 1px rgb(var(--shadow) / 0.1),
    0 8px 18px -6px rgb(var(--shadow) / 0.18),
    /* a second sheet peeking out underneath */
    0 5px 0 -2px var(--surface-2),
    0 5px 0 -1px var(--line);
}

.page.editing {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.rings {
  position: absolute;
  top: -0.45rem;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-around;
  padding: 0 22%;
}

.rings i {
  width: 0.5rem;
  height: 1rem;
  border-radius: 999px;
  background: var(--plastic);
  box-shadow: 0 0 0 2px var(--surface);
}

.month {
  width: 100%;
  padding: 0.7rem 0.5rem 0.45rem;
  font-size: 0.85rem;
  font-weight: 700;
  color: #fff;
  background: var(--accent);
  border-radius: 6px 6px 0 0;
}

.day {
  margin-top: 0.35rem;
  font-size: 3.4rem;
  line-height: 1;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
}

.weekday {
  font-size: 0.8rem;
  color: var(--ink-2);
}

.title {
  margin-top: 0.6rem;
  padding: 0 0.75rem;
  font-weight: 700;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.togo {
  margin-top: 0.35rem;
  font-size: 0.85rem;
  color: var(--ink-2);
}

.togo b {
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

/* How much of the wait has passed since the date was added */
.progress {
  width: calc(100% - 1.5rem);
  height: 4px;
  margin-top: 0.7rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--surface-2);
}

.progress span {
  display: block;
  height: 100%;
  background: var(--accent);
  transform-origin: left;
}

.page .links {
  margin-top: 0.7rem;
}

.links {
  flex: none;
  display: flex;
  gap: 0.75rem;
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

.all-past {
  margin: 1rem 0 0;
  padding: 1.25rem;
  text-align: center;
  color: var(--ink-2);
}

.past {
  margin-top: 2rem;
}

.past h3 {
  font-size: 1rem;
  color: var(--ink-2);
}

.past ul {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
}

.past li {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--line);
}

.past li span:first-child {
  flex: 1;
}

.empty {
  padding: 2.5rem 1.5rem;
  text-align: center;
  color: var(--ink-2);
}

.empty h2 {
  font-size: 1.2rem;
  color: var(--ink);
}

.empty p {
  margin: 0.5rem 0 0;
}

@media (max-width: 960px) {
  .workspace { grid-template-columns: 1fr; }
  .form-step { position: static; }
}


</style>
