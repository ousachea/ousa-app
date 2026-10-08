<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { Cached } from '~/utils/cache'
import type { MenuEntry } from '~/composables/useContextMenu'

interface CountdownEvent {
  id: string
  title: string
  date: string // yyyy-mm-dd
  time: string // hh:mm, or '' for all day
  createdAt: string // ISO; the progress bar measures the wait from here
}

const { play } = useSound()
const online = useOnline()
const { items, ready, sync, add, update, replace, remove, restore } = useCollection<CountdownEvent>('countdown')

// Pull down on a phone to sync again and fetch the holidays fresh (CHECKLIST.md #26)
usePullToRefresh(async () => {
  await Promise.all([sync.retry(), refreshHolidays()])
  toast('Refreshed', { duration: 1800 })
})

const isoToday = () => new Date().toISOString().slice(0, 10)
const blank = () => ({ title: '', date: '', time: '' })
const form = reactive(blank())

// Times every 15 minutes, plus whatever odd time an existing countdown already has
function timeOptionsFor(current: string) {
  const label = (t: string) => new Date(`2000-01-01T${t}`).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
  const times = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`)
  if (current && !times.includes(current)) times.push(current)
  return [{ value: '', label: 'Any time' }, ...times.sort().map(t => ({ value: t, label: label(t) }))]
}
const timeOptions = computed(() => timeOptionsFor(form.time))
const editingId = ref<string>()

// Tick once a second so the featured countdown is live
const now = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | undefined
onMounted(() => (ticker = setInterval(() => (now.value = Date.now()), 1000)))
onBeforeUnmount(() => clearInterval(ticker))

// Live clock in Cambodia time, whatever time zone this device is set to
const TZ = 'Asia/Phnom_Penh'
const clockFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit', second: '2-digit' })
const dateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const clock = computed(() => {
  const p = clockFmt.formatToParts(now.value)
  const get = (t: string) => p.find(x => x.type === t)?.value ?? ''
  return { time: `${get('hour')}:${get('minute')}`, seconds: get('second'), period: get('dayPeriod') }
})
const todayText = computed(() => dateFmt.format(now.value))

// Written out by hand: not every browser ships Khmer locale data for Intl
const KM_DAYS = ['អាទិត្យ', 'ច័ន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍']
const KM_MONTHS = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ']
const kmDigits = (n: number) => String(n).replace(/\d/g, d => '០១២៣៤៥៦៧៨៩'[+d]!)
const todayKhmer = computed(() => {
  // Shift to UTC+7 (Cambodia has no daylight saving) and read the fields in UTC
  const d = new Date(now.value + 7 * 3_600_000)
  return `ថ្ងៃ${KM_DAYS[d.getUTCDay()]} ទី${kmDigits(d.getUTCDate())} ខែ${KM_MONTHS[d.getUTCMonth()]} ឆ្នាំ${kmDigits(d.getUTCFullYear())}`
})

// Public holidays come from the server (Nager.Date); each one starts at midnight Cambodia time
const { data: liveHolidays, status: holidayStatus, refresh: refreshHolidays } = useFetch('/api/holidays', { server: false, lazy: true })
// The last list this device saw keeps the countdown working offline (CHECKLIST.md #19)
type HolidayData = NonNullable<typeof liveHolidays.value>
const cachedHolidays = ref<Cached<HolidayData>>()
onMounted(() => (cachedHolidays.value = readCached<HolidayData>('holidays')))
watch(liveHolidays, (d) => {
  if (d?.holidays?.length) writeCached('holidays', d)
})
const holidayData = computed(() => liveHolidays.value ?? (holidayStatus.value === 'error' ? cachedHolidays.value?.data : undefined))
const holidaysFromCache = computed(() => !liveHolidays.value && !!holidayData.value)
const DAY = 86_400_000
const khMidnight = (iso: string) => new Date(`${iso}T00:00:00+07:00`).getTime()

const holidays = computed(() => (holidayData.value?.holidays ?? [])
  .map((h) => {
    const startAt = khMidnight(h.start)
    const endAt = khMidnight(h.end) + DAY
    return { ...h, startAt, endAt, left: startAt - now.value, onNow: now.value >= startAt && now.value < endAt }
  })
  // Anything not yet over, up to a year ahead
  .filter(h => h.endAt > now.value && h.startAt < now.value + 365 * DAY))

const nextHoliday = computed(() => holidays.value[0])
const showAllHolidays = ref(false)
const laterHolidays = computed(() => holidays.value.slice(1, showAllHolidays.value ? undefined : 7))

const holidayDateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short' })
const holidayWeekdayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short' })
function holidayRange(h: { startAt: number, endAt: number, days: number }) {
  if (h.days === 1) return `${holidayWeekdayFmt.format(h.startAt)}, ${holidayDateFmt.format(h.startAt)}`
  return `${holidayDateFmt.format(h.startAt)} – ${holidayDateFmt.format(h.endAt - DAY)}`
}
const holidayDay = (h: { startAt: number }) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric' }).format(h.startAt)
const holidayMonth = (h: { startAt: number }) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, month: 'short' }).format(h.startAt)

// Calendar days between today and the holiday, both in Cambodia time
function holidayWhen(h: { start: string, onNow: boolean }) {
  if (h.onNow) return 'On now'
  const today = khMidnight(new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now.value))
  const days = Math.round((khMidnight(h.start) - today) / DAY)
  if (days === 1) return 'Tomorrow'
  if (days < 60) return `In ${days} days`
  return `In ${Math.round(days / 30.44)} months`
}

const isTracked = (h: { name: string, start: string }) => items.value.some(e => e.title === h.name && e.date === h.start)

function track(h: { name: string, start: string }) {
  if (isTracked(h)) return
  const added = add({ title: h.name, date: h.start, time: '', createdAt: new Date().toISOString() })
  play('success')
  toast.success(`Counting down to ${h.name}`, { action: { label: 'Undo', onClick: () => remove(added.id, { undoAdd: true }) } })
}

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
// The cards below the banner, so the next date isn't shown twice
const later = computed(() => upcoming.value.slice(1))

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
const titleInput = ref<HTMLInputElement>()
const draft = useDraft('countdown', form, {
  active: () => true,
  isEmpty: f => !f.title.trim() && !f.date,
  summary: f => [f.title, f.date && new Date(`${f.date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), f.time]
})
onMounted(() => draft.check())
useAddAction(() => focusField(titleInput.value))

function save() {
  if (!canSave.value) return
  const added = add({ title: form.title.trim(), date: form.date, time: form.time, createdAt: new Date().toISOString() })
  draft.clear()
  toast.success(`Counting down to ${form.title.trim()}`, { action: { label: 'Undo', onClick: () => remove(added.id, { undoAdd: true }) } })
  play('success')
  Object.assign(form, blank())
}

// ---------- Editing, in a popup ----------
const editForm = reactive(blank())
const canSaveEdit = computed(() => editForm.title.trim() && editForm.date)
const editTimeOptions = computed(() => timeOptionsFor(editForm.time))

// Right-click / long-press (CHECKLIST.md #27)
const menuFor = useRowMenu()
const countdownMenu = (e: CountdownEvent): MenuEntry[] => [
  { label: 'Edit', icon: 'edit', run: () => edit(e) },
  '-',
  { label: 'Delete', icon: 'delete', danger: true, run: () => del(e) }
]

function edit(e: CountdownEvent) {
  editingId.value = e.id
  Object.assign(editForm, { title: e.title, date: e.date, time: e.time })
  play('open')
}

function saveEdit() {
  if (!editingId.value || !canSaveEdit.value) return
  const before = update(editingId.value, { title: editForm.title.trim(), date: editForm.date, time: editForm.time })
  toastSaved(before && (() => replace(before)))
  play('success')
  cancel()
}

function cancel() {
  editingId.value = undefined
}

function del(e: CountdownEvent) {
  const removed = remove(e.id)
  if (editingId.value === e.id) cancel()
  play('delete')
  toastDeleted(e.title, () => removed && restore(removed))
}
</script>

<template>
  <ToolPage header="band">
    <template #actions>
      <ClientOnly>
        <div class="now" role="timer" aria-live="off" :aria-label="`Cambodia time ${clock.time} ${clock.period}, ${todayText}`">
          <span class="now-place">Phnom Penh time</span>
          <span class="now-time">{{ clock.time }}<small>:{{ clock.seconds }}</small> <span class="now-period">{{ clock.period }}</span></span>
          <span class="now-date">{{ todayText }}</span>
          <span class="now-date km" lang="km">{{ todayKhmer }}</span>
        </div>
      </ClientOnly>
    </template>

    <div class="workspace">
      <!-- One-row add bar resting on the band -->
      <div class="form-step">
        <form v-validate class="panel form" aria-label="Add a date" @submit.prevent="save">
          <DraftCard v-if="draft.offered.value" :lines="draft.lines.value" @resume="draft.resume()" @discard="draft.discard()" />
          <label class="field">
            <span class="field-head">What’s happening?</span>
            <input ref="titleInput" v-model="form.title" class="input" placeholder="Khmer New Year, trip to Siem Reap…" required data-error="Name what you’re counting down to">
          </label>
          <div class="row">
            <label class="field">
              <span class="field-head">Date</span>
              <DatePicker v-model="form.date" aria-label="Date" :min="isoToday()" required />
            </label>
            <label class="field">
              <span class="field-head">Time <span class="optional">Optional</span></span>
              <AppSelect v-model="form.time" aria-label="Time" :options="timeOptions" placeholder="Any time" />
            </label>
          </div>
          <div class="actions">
            <button type="submit" class="btn">Start countdown</button>
          </div>
        </form>
      </div>

      <Step title="Coming up" v-sticky-fit class="list-step">
        <template #aside><ClientOnly><DataSource :sync="sync" /></ClientOnly></template>
        <ClientOnly>
          <template v-if="ready && items.length">
            <!-- The next date gets the spotlight: name and date on the left, a live flip clock on the right -->
            <section v-if="featured" :data-item-id="featured.id" class="panel featured" v-bind="menuFor(() => countdownMenu(featured!), featured.title)" :class="{ editing: editingId === featured.id }" aria-live="off">
              <div class="featured-text">
                <span class="label">Next up</span>
                <h2>{{ featured.title }}</h2>
                <p class="when-text">{{ formatWhen(featured) }}</p>
                <div class="featured-progress">
                  <span class="bar" role="img" :aria-label="`${Math.round(featured.progress * 100)}% of the wait has passed`">
                    <span :style="{ transform: `scaleX(${featured.progress})` }" />
                  </span>
                  <span class="bar-text">{{ Math.round(featured.progress * 100) }}% of the wait done</span>
                </div>
                <span class="links">
                  <CalendarAdd :title="featured.title" :date="featured.date" :time="featured.time" details="Counting down in Ousa’s Apps" />
                  <button type="button" class="link" @click="edit(featured)">Edit</button>
                  <ConfirmDelete text :name="featured.title" @confirm="del(featured)" />
                </span>
              </div>
              <div class="clock" role="timer" :aria-label="`${parts(featured.left).days} days left`">
                <div v-for="(v, k) in parts(featured.left)" :key="k" class="unit">
                  <strong><RollingNumber :value="String(v).padStart(k === 'days' ? 1 : 2, '0')" /></strong>
                  <span>{{ k }}</span>
                </div>
              </div>
            </section>

            <!-- Later dates: a date tile, how long to go (more exact as it nears) and how much of the wait is done -->
            <h3 v-if="later.length" class="later-head">After that</h3>
            <TransitionGroup v-if="later.length" tag="ul" name="list" class="pages">
              <li v-for="e in later" :key="e.id" :data-item-id="e.id" class="page panel" v-bind="menuFor(() => countdownMenu(e), e.title)" v-swipe-delete="() => del(e)" :class="{ editing: editingId === e.id }">
                <span class="date-tile" aria-hidden="true">
                  <span class="month">{{ monthOf(e).split(' ')[0]!.slice(0, 3) }}</span>
                  <strong class="day">{{ dayOf(e) }}</strong>
                </span>
                <span class="page-body">
                  <span class="title">{{ e.title }}</span>
                  <span class="weekday">{{ weekdayOf(e) }}, {{ dayOf(e) }} {{ monthOf(e) }}{{ e.time ? ` · ${e.time}` : '' }}</span>
                  <span class="progress" role="img" :aria-label="`${Math.round(e.progress * 100)}% of the wait has passed`">
                    <span :style="{ transform: `scaleX(${e.progress})` }" />
                  </span>
                </span>
                <span class="togo" role="timer" :aria-label="`${countdown(new Date(Date.now() + e.left)).text} to go`">
                  <b><RollingNumber :value="countdown(new Date(Date.now() + e.left)).value" /></b>
                  <span>{{ countdown(new Date(Date.now() + e.left)).unit }}</span>
                </span>
                <span class="links page-actions">
                  <CalendarAdd :title="e.title" :date="e.date" :time="e.time" details="Counting down in Ousa’s Apps" label="Calendar" />
                  <button type="button" class="icon-btn" :aria-label="`Edit ${e.title}`" title="Edit" @click="edit(e)">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg>
                  </button>
                  <ConfirmDelete :name="e.title" @confirm="del(e)" />
                </span>
              </li>
            </TransitionGroup>
            <p v-else-if="!featured" class="panel all-past">Everything has already happened. Add a new date to count down to.</p>

            <section v-if="past.length" class="past">
              <h3>Already happened</h3>
              <ul>
                <li v-for="e in past" :key="e.id" :data-item-id="e.id" v-bind="menuFor(() => countdownMenu(e), e.title)">
                  <span>{{ e.title }}</span>
                  <span class="meta">{{ agoText(e.left) }}</span>
                  <ConfirmDelete :name="e.title" @confirm="del(e)" />
                </li>
              </ul>
            </section>
          </template>

          <div v-else-if="ready" class="panel">
            <EmptyState title="No countdowns yet" icon="countdown" action="Add a date" @action="focusField(titleInput)">
              Count down to a birthday, a trip or a deadline, and see how much of the wait is behind you.
            </EmptyState>
          </div>
          <SkeletonList v-else variant="cards" :count="2" label="Loading your countdowns" />
          <template #fallback><SkeletonList variant="cards" :count="2" label="Loading your countdowns" /></template>
        </ClientOnly>
      </Step>

      <Step title="Cambodian public holidays" hint="Official days off. Lunar dates move every year, so they’re fetched fresh." v-sticky-fit class="holiday-step">
        <ClientOnly>
          <div v-if="holidayStatus === 'error' && !holidayData" class="panel holiday-msg">
            <p><strong>Couldn’t load the holiday list</strong></p>
            <p>{{ online ? 'The holiday service didn’t answer.' : 'You’re offline.' }} Your own countdowns still work.</p>
            <button type="button" class="btn btn-sm" @click="refreshHolidays()">Try again</button>
          </div>
          <div v-else-if="!holidayData" class="panel holiday-skeleton" aria-label="Loading holidays">
            <span class="skeleton" style="width: 40%; height: 0.9rem" />
            <span class="skeleton" style="width: 70%; height: 1.6rem" />
            <span class="skeleton" style="width: 55%; height: 0.9rem" />
            <span class="skeleton" style="height: 3rem; margin-top: 0.5rem" />
          </div>
          <p v-if="holidaysFromCache && cachedHolidays" class="cache-note">
            {{ online ? 'Couldn’t refresh the list' : 'You’re offline' }}: showing the holidays saved on {{ cachedWhen(cachedHolidays.at) }}.
            <button type="button" class="link" @click="refreshHolidays()">Try again</button>
          </p>
          <template v-if="holidayData && nextHoliday">
            <!-- The next day off, counting down live -->
            <section class="panel next-off" :class="{ 'on-now': nextHoliday.onNow }">
              <span class="label">{{ nextHoliday.onNow ? 'Today is a holiday' : 'Next day off' }}</span>
              <h3>{{ nextHoliday.name }}</h3>
              <p class="km" lang="km">{{ nextHoliday.localName }}</p>
              <p class="next-when">
                {{ holidayRange(nextHoliday) }}<template v-if="nextHoliday.days > 1"> · {{ nextHoliday.days }} days off</template>
              </p>
              <div v-if="!nextHoliday.onNow" class="mini-clock" role="timer" :aria-label="`${parts(nextHoliday.left).days} days until ${nextHoliday.name}`">
                <div v-for="(v, k) in parts(nextHoliday.left)" :key="k">
                  <strong><RollingNumber :value="String(v).padStart(k === 'days' ? 1 : 2, '0')" /></strong>
                  <span>{{ k }}</span>
                </div>
              </div>
              <button v-if="!isTracked(nextHoliday)" type="button" class="btn btn-sm add-mine" @click="track(nextHoliday)">Add to my countdowns</button>
            </section>

            <ol class="holidays">
              <li v-for="h in laterHolidays" :key="h.start" class="holiday">
                <span class="h-date" aria-hidden="true">
                  <strong>{{ holidayDay(h) }}</strong>
                  <span>{{ holidayMonth(h) }}</span>
                </span>
                <span class="h-text">
                  <span class="h-name">{{ h.name }}</span>
                  <span class="h-km km" lang="km" :title="h.localName">{{ h.localName }}</span>
                  <span class="h-meta">{{ holidayRange(h) }}<template v-if="h.days > 1"> · {{ h.days }} days</template></span>
                </span>
                <span class="h-side">
                  <span class="h-when">{{ holidayWhen(h) }}</span>
                  <button v-if="!isTracked(h)" type="button" class="link" :aria-label="`Add ${h.name} to my countdowns`" @click="track(h)">Add</button>
                  <span v-else class="h-added">Added</span>
                </span>
              </li>
            </ol>
            <button v-if="holidays.length > 7" type="button" class="btn btn-quiet btn-sm more" :aria-expanded="showAllHolidays" @click="showAllHolidays = !showAllHolidays">
              {{ showAllHolidays ? 'Show fewer' : `Show all ${holidays.length - 1}` }}
            </button>
            <p class="source-note">Holiday dates from Nager.Date. The government sometimes adds or moves days off, so check close to the date.</p>
          </template>
        </ClientOnly>
      </Step>
    </div>
    <Modal :open="!!editingId" title="Edit countdown" @close="cancel">
      <form v-validate class="edit-form" @submit.prevent="saveEdit">
        <label class="field">
          <span class="field-head">What’s happening?</span>
          <input v-model="editForm.title" class="input" required data-error="Name what you’re counting down to">
        </label>
        <div class="edit-row">
          <label class="field">
            <span class="field-head">Date</span>
            <DatePicker v-model="editForm.date" aria-label="Date" required />
          </label>
          <label class="field">
            <span class="field-head">Time <span class="optional">Optional</span></span>
            <AppSelect v-model="editForm.time" aria-label="Time" :options="editTimeOptions" placeholder="Any time" />
          </label>
        </div>
        <div class="edit-actions">
          <button type="submit" class="btn">Save changes</button>
          <button type="button" class="btn btn-quiet" @click="cancel">Cancel</button>
        </div>
      </form>
    </Modal>
  </ToolPage>
</template>

<style scoped>
.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 2.25rem;
}

/* Add bar: what, date, time and the button on one line */
.form {
  padding: 1rem 1.1rem;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem 1rem;
  box-shadow: 0 12px 30px -14px rgb(var(--shadow) / 0.35);
}

.form > .field {
  flex: 2 1 260px;
}

.row {
  flex: 1 1 320px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.optional {
  font-weight: 400;
  color: var(--ink-3);
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.edit-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.edit-actions {
  display: flex;
  gap: 0.5rem;
}

.edit-actions .btn:first-child {
  flex: 1;
}

@media (max-width: 480px) {
  .edit-row { grid-template-columns: minmax(0, 1fr); }
}

.actions {
  flex: 0 0 auto;
  display: flex;
  gap: 0.5rem;
}

.actions .btn:first-child {
  flex: 1;
}

.featured {
  position: relative;
  overflow: hidden;
  padding: 1.6rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.25rem 2rem;
  align-items: center;
  color: #fff;
  /* A soft light from the top-left corner so the banner isn't a flat slab of colour */
  background:
    radial-gradient(120% 140% at 0% 0%, rgb(255 255 255 / 0.18), transparent 55%),
    linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #1b1f2a));
  border: 0;
  box-shadow: 0 18px 40px -22px color-mix(in srgb, var(--accent) 80%, black);
}

.featured.editing {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
}

.featured-text {
  min-width: 0;
}

.featured-progress {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  max-width: 26rem;
}

.featured-progress .bar {
  flex: 1;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.22);
}

.featured-progress .bar span {
  display: block;
  height: 100%;
  background: #fff;
  border-radius: inherit;
  transform-origin: left;
}

.bar-text {
  font-size: 0.8rem;
  opacity: 0.85;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.featured .links {
  margin-top: 0.9rem;
  color: rgb(255 255 255 / 0.85);
}

.featured .link {
  color: rgb(255 255 255 / 0.85);
}

.featured .link:hover {
  color: #fff;
}

/* Wide enough: the clock moves beside the name */
@media (min-width: 1200px) {
  .featured {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
    padding: 1.8rem 2rem;
  }

  .featured .clock {
    margin-top: 0;
  }
}

.later-head {
  margin: 1.75rem 0 0;
  font-size: 0.95rem;
  color: var(--ink-2);
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

.unit > span {
  font-size: 0.75rem;
  text-transform: capitalize;
  opacity: 0.85;
}

.pages {
  position: relative;
  list-style: none;
  margin: 0.75rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}

/* One row per date, in the same shape as Renewals and the Recycle Bin */
.page {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 0.5rem 1rem;
  padding: 0.75rem 0.9rem;
  border-radius: var(--radius-lg);
}

.page.editing {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.date-tile {
  width: 3.4rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  background: var(--surface);
  border-radius: 10px;
  box-shadow: 0 0 0 1px var(--line), 0 2px 4px rgb(var(--shadow) / 0.08);
}

.month {
  width: 100%;
  padding: 0.15rem 0;
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #fff;
  background: var(--accent);
}

.day {
  padding: 0.1rem 0 0.2rem;
  font-size: 1.5rem;
  line-height: 1.15;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.page-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.title {
  font-weight: 700;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.weekday {
  font-size: var(--text-sm);
  color: var(--ink-2);
}

/* Big number, small unit: the hierarchy matches the clock above */
.togo {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.1;
}

.togo b {
  font-size: 1.6rem;
  letter-spacing: -0.02em;
  color: var(--ink);
}

.togo > span {
  font-size: var(--text-xs);
  color: var(--ink-2);
}

/* How much of the wait has passed since the date was added */
.progress {
  width: min(100%, 14rem);
  height: 4px;
  margin-top: 0.35rem;
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

.page-actions {
  gap: 0.25rem;
}

@media (max-width: 560px) {
  .page {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .page-actions {
    grid-column: 2 / -1;
    justify-content: flex-end;
  }
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

/* ---------- Live Cambodia clock, sitting in the band ---------- */
.now {
  min-width: 14rem;
  padding: 0.75rem 1rem 0.8rem;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
  background: rgb(0 0 0 / 0.16);
  border-radius: 16px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.15);
}

@media (max-width: 640px) {
  .now {
    align-items: flex-start;
    text-align: left;
  }
}

.now-place {
  font-size: 0.8rem;
  font-weight: 600;
  opacity: 0.85;
}

.now-time {
  font-size: clamp(1.9rem, 4vw, 2.5rem);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.now-time small {
  font-size: 0.55em;
  opacity: 0.75;
}

.now-period {
  font-size: 0.45em;
  font-weight: 600;
  letter-spacing: 0;
}

.now-date {
  font-size: 0.85rem;
  opacity: 0.9;
}

.km {
  font-family: 'Noto Sans Khmer', var(--font);
  line-height: 1.5;
}

/* ---------- Public holidays: a side column on wide screens ---------- */
@media (min-width: 1000px) {
  .workspace {
    grid-template-columns: minmax(0, 1fr) 380px;
    align-items: start;
    column-gap: 2rem;
  }

  .form-step {
    grid-column: 1 / -1;
  }

  /* The shorter column stays in view while the other scrolls (v-sticky-fit handles tall ones) */
  .list-step,
  .holiday-step {
    position: sticky;
    top: 5.5rem;
  }
}

.holiday-msg {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  color: var(--ink-2);
}

.holiday-msg strong {
  color: var(--ink);
}

.holiday-skeleton {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.cache-note {
  margin: 0 0 0.75rem;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.holiday-msg p {
  margin: 0;
}

/* Next day off: Cambodian flag stripe (blue, red, blue) along the top */
.next-off {
  --kh-blue: #032ea1;
  --kh-red: #e00025;
  position: relative;
  padding: 1.5rem 1.25rem 1.25rem;
  overflow: hidden;
}

.next-off::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 6px;
  background: linear-gradient(var(--kh-blue) 0 25%, var(--kh-red) 25% 75%, var(--kh-blue) 75%);
}

.next-off .label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ink-2);
}

.next-off.on-now .label {
  color: var(--good-ink);
}

.next-off h3 {
  margin-top: 0.15rem;
  font-size: 1.35rem;
  letter-spacing: -0.015em;
  text-wrap: balance;
}

.next-off .km {
  margin: 0.15rem 0 0;
  color: var(--ink-2);
}

.next-when {
  margin: 0.35rem 0 0;
  font-size: 0.9rem;
  font-weight: 600;
}

.mini-clock {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.4rem;
}

.mini-clock div {
  padding: 0.5rem 0.25rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--surface-2);
  border-radius: 10px;
}

.mini-clock strong {
  font-size: 1.4rem;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.mini-clock div > span {
  font-size: 0.7rem;
  text-transform: capitalize;
  color: var(--ink-2);
}

.add-mine {
  margin-top: 1rem;
}

.holidays {
  list-style: none;
  margin: 1rem 0 0;
  padding: 0;
}

.holiday {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  padding: 0.8rem 0;
  border-bottom: 1px solid var(--line);
}

/* A small tear-off date, echoing the calendar pages */
.h-date {
  flex: none;
  width: 3rem;
  padding: 0.3rem 0 0.35rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--surface);
  border-radius: 8px;
  box-shadow: 0 0 0 1px var(--line), 0 2px 0 var(--line);
}

.h-date strong {
  font-size: 1.25rem;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.h-date span {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--ink-2);
}

.h-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.h-name {
  font-weight: 700;
  line-height: 1.3;
}

.h-km {
  font-size: 0.85rem;
  color: var(--ink-2);
  /* Long Khmer names stay on one line; the full name is in the English title above */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.h-meta {
  font-size: 0.8rem;
  color: var(--ink-3);
}

.h-side {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}

.h-when {
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.h-added {
  font-size: 0.8rem;
  color: var(--ink-3);
}

.more {
  margin-top: 0.75rem;
}

.source-note {
  margin: 0.9rem 0 0;
  font-size: 0.8rem;
  color: var(--ink-3);
  text-wrap: pretty;
}

</style>
