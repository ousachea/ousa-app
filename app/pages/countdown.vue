<script setup lang="ts">
import type { BulkAction } from '~/composables/useBulkSelect'
import { toast } from 'vue-sonner'
import type { CountdownEvent } from '~/utils/calendar'
import type { Cycle } from '~/utils/renewals'
import type { MenuEntry } from '~/composables/useContextMenu'

const { play } = useSound()
const online = useOnline()
// Calendar's Dates tab: your dates, plus your renewals and the holidays for the 30-day timeline (useCalendar)
const { items, ready, sync, add, update, replace, remove, restore } = useDates()
const renewals = useRenewals()

// Pull down on a phone to sync again and fetch the holidays fresh (CHECKLIST.md #26)
usePullToRefresh(async () => {
  await Promise.all([sync.retry(), refreshHolidays()])
  toast('Refreshed', { duration: 1800 })
})

const isoToday = () => localIsoDate()
const blank = () => ({ title: '', date: '', time: '', repeat: 'once' as Cycle })
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

// Calendar's clock, every second here: the header clock and the next date's flip clock show seconds
const now = useNow(() => true)

// Live clock in Cambodia time, whatever time zone this device is set to
const TZ = CAMBODIA_TZ
const clockFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit', second: '2-digit' })
const dateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const clock = computed(() => {
  const p = clockFmt.formatToParts(now.value)
  const get = (t: string) => p.find(x => x.type === t)?.value ?? ''
  return { time: `${get('hour')}:${get('minute')}`, seconds: get('second'), period: get('dayPeriod') }
})
const todayText = computed(() => dateFmt.format(now.value))

// Screen saver (the header's button): this month as a printed calendar page, with the same clock
const saverOpen = ref(false)
const saver = ref<{ enterFullscreen: () => void }>()
function openSaver() {
  // Full screen first, still inside the click: browsers refuse it a moment later
  saver.value?.enterFullscreen()
  saverOpen.value = true
  play('open')
}

// Written out by hand: not every browser ships Khmer locale data for Intl
const KM_DAYS = ['អាទិត្យ', 'ច័ន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍']
const KM_MONTHS = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ']
const kmDigits = (n: number) => String(n).replace(/\d/g, d => '០១២៣៤៥៦៧៨៩'[+d]!)
const todayKhmer = computed(() => {
  // Shift to UTC+7 (Cambodia has no daylight saving) and read the fields in UTC
  const d = new Date(now.value + 7 * 3_600_000)
  return `ថ្ងៃ${KM_DAYS[d.getUTCDay()]} ទី${kmDigits(d.getUTCDate())} ខែ${KM_MONTHS[d.getUTCMonth()]} ឆ្នាំ${kmDigits(d.getUTCFullYear())}`
})

// Public holidays (useHolidays): fetched fresh, or the last list this device saw when offline
const { holidays, data: holidayData, status: holidayStatus, fromCache: holidaysFromCache, cached: cachedHolidays, refresh: refreshHolidays } = useHolidays(now)
const DAY = 86_400_000

const nextHoliday = computed(() => holidays.value[0])
const showAllHolidays = ref(false)
// Calendar settings (the gear in the header); the holidays switch covers the timeline on both tabs
const { prefs: cdPrefs } = useCalendarPrefs()
const laterHolidays = computed(() => holidays.value.slice(1, showAllHolidays.value ? undefined : 7))

const holidayDateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short' })
const holidayWeekdayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short' })
function holidayRange(h: { startAt: number, endAt: number, days: number }) {
  if (h.days === 1) return `${holidayWeekdayFmt.format(h.startAt)}, ${holidayDateFmt.format(h.startAt)}`
  return `${holidayDateFmt.format(h.startAt)} – ${holidayDateFmt.format(h.endAt - DAY)}`
}
const holidayDay = (h: { startAt: number }) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric' }).format(h.startAt)
const holidayMonth = (h: { startAt: number }) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, month: 'short' }).format(h.startAt)

// Read the same way as every countdown in Calendar (countdown() in utils/renewals.ts): weeks, then months
function holidayWhen(h: { start: string, startAt: number, onNow: boolean }) {
  if (h.onNow) return 'On now'
  const today = khMidnight(new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now.value))
  if (Math.round((khMidnight(h.start) - today) / DAY) === 1) return 'Tomorrow'
  const c = countdown(new Date(h.startAt), new Date(now.value))
  return `In ${c.value} ${c.unit}`
}

const isTracked = (h: { name: string, start: string }) => items.value.some(e => e.title === h.name && e.date === h.start)

function track(h: { name: string, start: string }) {
  if (isTracked(h)) return
  const added = add({ title: h.name, date: h.start, time: '', createdAt: new Date().toISOString() })
  play('success')
  toast.success(`Counting down to ${h.name}`, { action: { label: 'Undo', onClick: () => remove(added.id, { undoAdd: true }) } })
}

const events = computed(() => items.value
  .map((e) => {
    // A repeating date counts down to the next time it comes round (occurrence in utils/calendar.ts)
    const o = occurrence(e, now.value)
    // The wait runs from when it was added, or for a repeating date from the last time it came round
    const start = Math.max(new Date(e.createdAt).getTime(), o.since ?? 0)
    const span = Math.max(o.at - start, 1)
    const days = daysUntil(o.date, new Date(now.value))
    return {
      ...e,
      at: o.at,
      nextDate: o.date,
      left: o.at - now.value,
      days,
      // An all-day date stays up for the whole of its day
      today: !e.time && days === 0,
      // Share of the wait already behind you (0 when added, 1 on the day)
      progress: Math.min(Math.max((now.value - start) / span, 0), 1)
    }
  })
  .sort((a, b) => a.at - b.at))

const upcoming = computed(() => events.value.filter(e => e.left > 0 || e.today))
const past = computed(() => events.value.filter(e => e.left <= 0 && !e.today).reverse())
const featured = computed(() => upcoming.value[0])
// The cards below the banner, so the next date isn't shown twice
const later = computed(() => upcoming.value.slice(1))

function parts(ms: number) {
  const s = Math.max(Math.floor(ms / 1000), 0)
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 }
}

function agoText(ms: number) {
  const days = Math.floor(-ms / 86_400_000)
  if (days === 0) return 'Today'
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

type Shown = { at: number, time: string, repeat?: Cycle }
const formatWhen = (e: Shown) =>
  new Date(e.at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', ...(e.time ? { hour: '2-digit', minute: '2-digit' } : {}) })
  + (repeatLabel(e.repeat) ? ` · ${repeatLabel(e.repeat)}` : '')

const monthOf = (e: Shown) => new Date(e.at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
const dayOf = (e: Shown) => new Date(e.at).getDate()
const weekdayOf = (e: Shown) => new Date(e.at).toLocaleDateString('en-GB', { weekday: 'long' })
// Time left, worded like every countdown in Calendar
const togo = (e: { at: number }) => countdown(new Date(e.at), new Date(now.value))

// ---------- The next 30 days, and the day's reminder: shared with the Renewals tab ----------
const marks = computed(() => upcomingMarks({ dates: items.value, renewals: renewals.items.value, holidays: cdPrefs.holidays ? holidays.value : [] }, new Date(now.value)))
useDueReminder(() => ready.value && renewals.ready.value && sync.state.value !== 'demo'
  ? { dates: items.value, renewals: renewals.items.value, holidays: cdPrefs.holidays ? holidays.value : [] }
  : undefined)

const canSave = computed(() => form.title.trim() && form.date)
const titleInput = ref<HTMLInputElement>()
const draft = useDraft('countdown', form, {
  active: () => true,
  isEmpty: f => !f.title.trim() && !f.date,
  summary: f => [f.title, f.date && new Date(`${f.date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), f.time, repeatLabel(f.repeat)]
})
onMounted(() => draft.check())
useAddAction(() => focusField(titleInput.value))

function save() {
  if (!canSave.value) return
  const added = add({ title: form.title.trim(), date: form.date, time: form.time, repeat: form.repeat, createdAt: new Date().toISOString() })
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
  { label: e.favorite ? 'Remove from favourites' : 'Add to favourites', icon: 'star', run: () => toggleFavourite(items.value.find(x => x.id === e.id)!, e.title, update, replace) },
  '-',
  { label: 'Delete', icon: 'delete', danger: true, run: () => del(e) }
]

function edit(e: CountdownEvent) {
  editingId.value = e.id
  Object.assign(editForm, { title: e.title, date: e.date, time: e.time, repeat: e.repeat ?? 'once' })
  play('open')
}

function saveEdit() {
  if (!editingId.value || !canSaveEdit.value) return
  const before = update(editingId.value, { title: editForm.title.trim(), date: editForm.date, time: editForm.time, repeat: editForm.repeat })
  toastSaved(before && (() => replace(before)))
  play('success')
  cancel()
}

function cancel() {
  editingId.value = undefined
}

// ---------- Select several (useBulkSelect) ----------
// In the order they're shown: next up, later ones, then the ones that already happened
const allShown = computed(() => [...upcoming.value, ...past.value])
const bulkText = (n: number) => `${n} ${n === 1 ? 'countdown' : 'countdowns'}`
const sel = useBulkSelect({ items, shown: allShown, onDelete: () => deleteSelected() })
function deleteSelected() {
  sel.guard(`Delete ${bulkText(sel.selected.size)}?`, () => bulkRemove(sel.selectedItems as CountdownEvent[], remove, restore, bulkText))
}
const bulkActions = computed<BulkAction[]>(() => [
  { label: allFavourite(sel.selectedItems as CountdownEvent[]) ? 'Unfavourite' : 'Favourite', icon: 'star', run: () => bulkFavourite(sel.selectedItems as CountdownEvent[], update, replace, bulkText) },
  { label: 'Delete', icon: 'delete', danger: true, run: deleteSelected }
])

function del(e: CountdownEvent) {
  const removed = remove(e.id)
  if (editingId.value === e.id) cancel()
  play('delete')
  toastDeleted(e.title, () => removed && restore(removed))
}
</script>

<template>
  <ToolPage header="band">
    <template #settings>
      <SettingRow v-model="cdPrefs.clock" title="Phnom Penh clock" description="The time and today’s date, in English and Khmer, in the header." />
      <SettingRow v-model="cdPrefs.holidays" title="Cambodian public holidays" description="The list of official days off beside your countdowns." />
      <SettingChoice v-model="cdPrefs.saver" title="Screen saver" description="What the Screen saver button shows. While it’s on, press L to switch; on the calendar page the arrows (or a swipe) move through days and months." :options="[{ value: 'page', label: 'Calendar page' }, { value: 'clock', label: 'Big clock' }]" />
    </template>
    <template #actions>
      <ClientOnly>
        <div v-if="cdPrefs.clock" class="now" role="timer" aria-live="off" :aria-label="`Cambodia time ${clock.time} ${clock.period}, ${todayText}`">
          <span class="now-place">Phnom Penh time</span>
          <span class="now-time">{{ clock.time }}<small>:{{ clock.seconds }}</small> <span class="now-period">{{ clock.period }}</span></span>
          <span class="now-date">{{ todayText }}</span>
          <span class="now-date km" lang="km">{{ todayKhmer }}</span>
        </div>
        <button type="button" class="btn btn-quiet btn-sm saver-btn" title="The time and date in big type, full screen" @click="openSaver">
          <AppIcon name="monitor" />
          Screen saver
        </button>
        <ScreenSaver
          ref="saver"
          :open="saverOpen"
          :time="clock.time"
          :seconds="clock.seconds"
          :period="clock.period"
          v-model:look="cdPrefs.saver"
          :now="now"
          :time-zone="TZ"
          :khmer="todayKhmer"
          @close="saverOpen = false"
        />
      </ClientOnly>
    </template>

    <div class="workspace" :class="{ 'no-holidays': !cdPrefs.holidays }">
      <!-- Three numbered steps, the way every app here walks you through it. The first is a card
           resting on the band, so its heading isn't on the colour -->
      <Step :n="1" title="Add a date" hint="A birthday, a trip, a deadline. Add a time if it matters to the minute, and repeat it every year for birthdays." class="panel form-step">
        <form v-validate class="form" aria-label="Add a date" @submit.prevent="save">
          <DraftCard v-if="draft.offered.value" :lines="draft.lines.value" @resume="draft.resume()" @discard="draft.discard()" />
          <label class="field">
            <span class="field-head">What’s happening?</span>
            <input ref="titleInput" v-model="form.title" class="input" placeholder="Khmer New Year, trip to Siem Reap…" required data-error="Name what you’re counting down to">
          </label>
          <div class="row">
            <label class="field">
              <span class="field-head">Date</span>
              <!-- A repeating date can start in the past: a birthday from the day someone was born -->
              <DatePicker v-model="form.date" aria-label="Date" :min="form.repeat === 'once' ? isoToday() : undefined" required />
            </label>
            <label class="field">
              <span class="field-head">Time <span class="optional">Optional</span></span>
              <AppSelect v-model="form.time" aria-label="Time" :options="timeOptions" placeholder="Any time" />
            </label>
            <label class="field">
              <span class="field-head">Repeats</span>
              <AppSelect v-model="form.repeat" aria-label="Repeats" :options="REPEATS" />
            </label>
          </div>
          <div class="actions">
            <button type="submit" class="btn">Start countdown</button>
          </div>
        </form>
      </Step>

      <Step :n="2" title="Watch it count down" hint="The next one gets the big clock. Add any of them to your calendar, or long-press one to edit it." v-sticky-fit class="list-step">
        <template #aside><ClientOnly><span class="aside-tools"><BulkToggle v-if="items.length" :select="sel" /><DataSource :sync="sync" /></span></ClientOnly></template>
        <ClientOnly>
          <template v-if="ready && items.length">
            <!-- The next date gets the spotlight: name and date on the left, a live flip clock on the right -->
            <section v-if="featured" :data-item-id="featured.id" class="panel featured bulk-row" v-bind="menuFor(() => countdownMenu(featured!), featured.title)" :data-bulk="sel.selecting || undefined" @click.capture="sel.onRowClick($event, featured.id)" :class="{ editing: editingId === featured.id, 'bulk-picked': sel.has(featured.id) }" aria-live="off">
              <BulkCheck v-if="sel.selecting" :checked="sel.has(featured.id)" :label="`Select ${featured.title}`" @pick="sel.pick(featured.id, $event)" />
              <div class="featured-text">
                <span class="label">Next up<span v-if="dateBadge(featured.days)" class="badge featured-badge" :class="dateBadge(featured.days)!.badge"><span aria-hidden="true">{{ dateBadge(featured.days)!.symbol }}</span> {{ dateBadge(featured.days)!.label }}</span></span>
                <h2>{{ featured.title }}</h2>
                <p class="when-text">{{ formatWhen(featured) }}</p>
                <div class="featured-progress">
                  <!-- A ring that closes as the day comes (components/gauge) -->
                  <span class="ring-dial" role="img" :aria-label="`${Math.floor(featured.progress * 100)}% of the wait has passed`">
                    <Gauge :value="featured.progress" :min="0" :max="1" :start-angle="180" :end-angle="540" :radius="200" :padding="24" transition :initial-value="0">
                      <GaugeTrack :width="40" color="#fff" :opacity="0.22" />
                      <GaugeArc :width="40" color="#fff" />
                      <GaugeValue :font-size="104" weight="bold" color="#fff" :format="v => `${Math.floor(v * 100)}%`" />
                    </Gauge>
                  </span>
                  <span class="bar-text">{{ Math.floor(featured.progress * 100) }}% of the wait done</span>
                </div>
                <span class="links">
                  <CalendarAdd :title="featured.title" :date="featured.nextDate" :time="featured.time" :repeat="featured.repeat" details="Counting down in Ousa’s Apps" />
                  <span class="menu-dup"><button type="button" class="link" @click="edit(featured)">Edit</button>
                    <ConfirmDelete text :name="featured.title" @confirm="del(featured)" /></span>
                </span>
              </div>
              <p v-if="featured.left <= 0" class="today-word">It’s today</p>
              <div v-else class="clock" role="timer" :aria-label="`${parts(featured.left).days} days left`">
                <div v-for="(v, k) in parts(featured.left)" :key="k" class="unit">
                  <strong><RollingNumber :value="String(v).padStart(k === 'days' ? 1 : 2, '0')" /></strong>
                  <span>{{ k }}</span>
                </div>
              </div>
            </section>

            <!-- The next 30 days across Calendar: your dates, renewals and holidays on one track -->
            <UpcomingTimeline class="timeline" :marks="marks" />

            <!-- Later dates: a date tile, how long to go (more exact as it nears) and how much of the wait is done -->
            <h3 v-if="later.length" class="later-head">After that</h3>
            <TransitionGroup v-if="later.length" tag="ul" name="list" class="pages">
              <li v-for="e in later" :key="e.id" :data-item-id="e.id" class="page panel bulk-row" v-bind="menuFor(() => countdownMenu(e), e.title)" v-swipe-delete="() => del(e)" :data-bulk="sel.selecting || undefined" @click.capture="sel.onRowClick($event, e.id)" :class="{ editing: editingId === e.id, 'bulk-picked': sel.has(e.id) }">
                <BulkCheck v-if="sel.selecting" :checked="sel.has(e.id)" :label="`Select ${e.title}`" @pick="sel.pick(e.id, $event)" />
                <span class="date-tile" aria-hidden="true">
                  <span class="month">{{ monthOf(e).split(' ')[0]!.slice(0, 3) }}</span>
                  <strong class="day">{{ dayOf(e) }}</strong>
                </span>
                <span class="page-body">
                  <span class="title-row">
                    <span class="title">{{ e.title }}<span v-if="e.favorite" class="fav" title="Favourite" aria-label="Favourite"> ★</span></span>
                    <!-- The same status badge as Renewals, for anything in the next week -->
                    <span v-if="dateBadge(e.days)" class="badge" :class="dateBadge(e.days)!.badge"><span aria-hidden="true">{{ dateBadge(e.days)!.symbol }}</span> {{ dateBadge(e.days)!.label }}</span>
                  </span>
                  <span class="weekday">{{ weekdayOf(e) }}, {{ dayOf(e) }} {{ monthOf(e) }}{{ e.time ? ` · ${e.time}` : '' }}{{ repeatLabel(e.repeat) ? ` · ${repeatLabel(e.repeat)}` : '' }}</span>
                  <span class="progress" role="img" :aria-label="`${Math.floor(e.progress * 100)}% of the wait has passed`">
                    <span :style="{ transform: `scaleX(${e.progress})` }" />
                  </span>
                </span>
                <span v-if="e.today" class="togo"><b class="word">Today</b></span>
                <span v-else class="togo" role="timer" :aria-label="`${togo(e).text} to go`">
                  <b><RollingNumber :value="togo(e).value" /></b>
                  <span>{{ togo(e).unit }}</span>
                </span>
                <span class="links page-actions">
                  <CalendarAdd :title="e.title" :date="e.nextDate" :time="e.time" :repeat="e.repeat" details="Counting down in Ousa’s Apps" label="Calendar" />
                  <span class="menu-dup"><button type="button" class="icon-btn" :aria-label="`Edit ${e.title}`" title="Edit" @click="edit(e)">
                    <AppIcon name="pencil" />
                  </button>
                    <ConfirmDelete :name="e.title" @confirm="del(e)" /></span>
                </span>
              </li>
            </TransitionGroup>
            <p v-else-if="!featured" class="panel all-past">Everything has already happened. Add a new date to count down to.</p>

            <section v-if="past.length" class="past">
              <h3>Already happened</h3>
              <TransitionGroup tag="ul" name="list">
                <li v-for="e in past" :key="e.id" :data-item-id="e.id" class="bulk-row" v-bind="menuFor(() => countdownMenu(e), e.title)" :data-bulk="sel.selecting || undefined" @click.capture="sel.onRowClick($event, e.id)" :class="{ 'bulk-picked': sel.has(e.id) }">
                  <BulkCheck v-if="sel.selecting" inline :checked="sel.has(e.id)" :label="`Select ${e.title}`" @pick="sel.pick(e.id, $event)" />
                  <span>{{ e.title }}</span>
                  <span class="meta">{{ agoText(e.left) }}</span>
                  <span class="menu-dup"><ConfirmDelete :name="e.title" @confirm="del(e)" /></span>
                </li>
              </TransitionGroup>
            </section>
          </template>

          <p v-else-if="ready" class="panel step-empty">Your next date shows here with a live clock, and how much of the wait is behind you.</p>
          <SkeletonList v-else variant="cards" :count="2" label="Loading your countdowns" />
          <template #fallback><SkeletonList variant="cards" :count="2" label="Loading your countdowns" /></template>
        </ClientOnly>
      </Step>

      <Step v-if="cdPrefs.holidays" :n="3" title="Plan around public holidays" hint="Official days off. Lunar dates move every year, so they’re fetched fresh." v-sticky-fit class="holiday-step">
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

            <TransitionGroup tag="ol" name="list" class="holidays">
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
            </TransitionGroup>
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
        <label class="field">
          <span class="field-head">Repeats</span>
          <AppSelect v-model="editForm.repeat" aria-label="Repeats" :options="REPEATS" />
        </label>
        <div class="edit-actions">
          <button type="submit" class="btn">Save changes</button>
          <button type="button" class="btn btn-quiet" @click="cancel">Cancel</button>
        </div>
      </form>
    </Modal>
    <BulkBar :select="sel" :actions="bulkActions" label="Selected countdowns" noun="countdowns" />
  </ToolPage>
</template>

<style scoped>
.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 2.25rem;
}

/* Add bar: what, date, time and the button on one line */
.form-step.panel {
  padding: 1.1rem 1.2rem;
  box-shadow: 0 12px 30px -14px rgb(var(--shadow) / 0.35);
}

.step-empty {
  margin: 0;
  padding: 1rem 1.25rem;
  font-size: var(--text-base);
  color: var(--ink-2);
}

.form {
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem 1rem;
}

.form > .field {
  flex: 2 1 260px;
}

.row {
  flex: 1 1 480px;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.75rem;
}

@media (max-width: 640px) {
  .row { grid-template-columns: 1fr 1fr; }
  .row > :last-child { grid-column: 1 / -1; }
}

/* The 30-day timeline (UpcomingTimeline), between the next date and the rest */
.timeline {
  margin-top: 1rem;
}

/* An all-day date on its day: no clock to run, just the word */
.today-word {
  margin: 0;
  font-size: clamp(1.8rem, 4vw, 2.6rem);
  font-weight: 800;
  letter-spacing: -0.02em;
}

.featured-badge {
  margin-left: 0.5rem;
  vertical-align: 1px;
}

.title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.5rem;
}

.togo .word {
  font-size: var(--text-title);
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

.ring-dial {
  flex: none;
  width: 3.75rem;
}

.bar-text {
  font-size: var(--text-sm);
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
  font-size: var(--text-base);
  color: var(--ink-2);
}

.featured .label {
  font-size: var(--text-sm);
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
  border-radius: var(--radius);
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
  font-size: var(--text-xs);
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
  border-radius: var(--radius-sm);
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
  font-size: var(--text-xl);
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
  font-size: var(--text-xl);
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
  border-radius: var(--radius-pill);
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

@media (max-width: 640px) {
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
  font-size: var(--text-md);
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
  font-size: var(--text-lg);
  color: var(--ink);
}

.empty p {
  margin: 0.5rem 0 0;
}

/* ---------- Live Cambodia clock, sitting in the band ---------- */
.saver-btn {
  display: flex;
  gap: 0.4rem;
  margin: 0.6rem 0 0 auto;
}

.saver-btn svg {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

@media (max-width: 640px) {
  .saver-btn {
    margin-left: 0;
  }
}

.now {
  min-width: 14rem;
  padding: 0.75rem 1rem 0.8rem;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
  background: rgb(0 0 0 / 0.16);
  border-radius: var(--radius-lg);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.15);
}

@media (max-width: 640px) {
  .now {
    align-items: flex-start;
    text-align: left;
  }
}

.now-place {
  font-size: var(--text-sm);
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
  font-size: var(--text-sm);
  opacity: 0.9;
}

.km {
  font-family: 'Noto Sans Khmer', var(--font);
  line-height: 1.5;
}

/* ---------- Public holidays: a side column on wide screens ---------- */
@media (min-width: 1100px) {
  .workspace {
    grid-template-columns: minmax(0, 1fr) 380px;
    align-items: start;
    column-gap: 2rem;
  }

  /* Holidays switched off in settings: the countdowns take the full width */
  .workspace.no-holidays {
    grid-template-columns: minmax(0, 1fr);
  }

  .form-step {
    grid-column: 1 / -1;
  }

  /* The shorter column stays in view while the other scrolls (v-sticky-fit handles tall ones) */
  .list-step,
  .holiday-step {
    position: sticky;
    top: var(--pin-top);
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
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-2);
}

.next-off.on-now .label {
  color: var(--good-ink);
}

.next-off h3 {
  margin-top: 0.15rem;
  font-size: var(--text-xl);
  letter-spacing: -0.015em;
  text-wrap: balance;
}

.next-off .km {
  margin: 0.15rem 0 0;
  color: var(--ink-2);
}

.next-when {
  margin: 0.35rem 0 0;
  font-size: var(--text-base);
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
  border-radius: var(--radius-sm);
}

.mini-clock strong {
  font-size: var(--text-xl);
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.mini-clock div > span {
  font-size: var(--text-2xs);
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
  border-radius: var(--radius-sm);
  box-shadow: 0 0 0 1px var(--line), 0 2px 0 var(--line);
}

.h-date strong {
  font-size: var(--text-lg);
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.h-date span {
  font-size: var(--text-2xs);
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
  font-size: var(--text-sm);
  color: var(--ink-2);
  /* Long Khmer names stay on one line; the full name is in the English title above */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.h-meta {
  font-size: var(--text-sm);
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
  font-size: var(--text-sm);
  font-weight: 600;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.h-added {
  font-size: var(--text-sm);
  color: var(--ink-3);
}

.more {
  margin-top: 0.75rem;
}

.source-note {
  margin: 0.9rem 0 0;
  font-size: var(--text-sm);
  color: var(--ink-3);
  text-wrap: pretty;
}

</style>
