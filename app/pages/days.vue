<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { WorkWeek } from '~/utils/dateMath'

const route = useRoute()
const router = useRouter()
const { play } = useSound()

type Tab = 'between' | 'add' | 'time'
const TABS: { value: Tab, label: string }[] = [
  { value: 'between', label: 'Days between' },
  { value: 'add', label: 'Add days' },
  { value: 'time', label: 'Hours' }
]
type Unit = 'days' | 'weeks' | 'months' | 'years' | 'workdays'
const UNITS: { value: Unit, label: string }[] = [
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
  { value: 'months', label: 'Months' },
  { value: 'years', label: 'Years' },
  { value: 'workdays', label: 'Working days' }
]

const { prefs } = useAppPrefs('days', { tab: 'between', saturday: false, holidays: true, includeEnd: false })

// The tab lives in the URL (?tab=add, ?tab=time), like Passwords
const tab = computed<Tab>(() => TABS.find(t => t.value === route.query.tab)?.value ?? 'between')
onMounted(() => {
  if (!route.query.tab && prefs.tab !== 'between') router.replace({ query: { tab: prefs.tab } })
})
function selectTab(value: Tab) {
  if (value === tab.value) return
  viewTransition(() => router.replace({ query: value === 'between' ? {} : { tab: value } }))
  play('select')
}

const today = localIsoDate()
const from = ref(today)
const to = ref(addDays(today, 30))
const start = ref(today)
const sign = ref<1 | -1>(1)
const amount = ref(10)
const unit = ref<Unit>('days')

// Cambodian public holidays for this year and next (the last list seen, offline)
const now = useNow()
const { data: holidayData } = useHolidays(now)
const holidays = computed(() => (prefs.holidays ? holidayDays(holidayData.value?.holidays ?? []) : new Set<string>()))
const holidayYears = computed(() => [...new Set((holidayData.value?.holidays ?? []).map(h => h.start.slice(0, 4)))].sort())
const week = computed<WorkWeek>(() => ({ saturday: prefs.saturday, holidays: holidays.value }))
// Holidays are only known for the years the API sends; say so when a date falls outside them
const outsideHolidays = (...dates: string[]) => prefs.holidays && holidayYears.value.length > 0 && dates.some(d => !holidayYears.value.includes(d.slice(0, 4)))

const fmtDate = (d: string) => new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`))
const plural = (n: number, word: string) => `${n.toLocaleString('en')} ${word}${Math.abs(n) === 1 ? '' : 's'}`
const joinParts = (parts: string[]) => parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : (parts[0] ?? '0 days')

// ---------- Between dates ----------
const between = computed(() => {
  if (!isIsoDate(from.value) || !isIsoDate(to.value)) return
  const [a, b] = from.value <= to.value ? [from.value, to.value] : [to.value, from.value]
  // "Include the end day" counts both ends: 1 to 3 May is 3 days rather than 2
  const end = prefs.includeEnd ? addDays(b, 1) : b
  const days = daysBetween(a, end)
  const work = workDaysBetween(a, end, week.value)
  const { years, months, days: rest } = ymdBetween(a, end)
  const ymd = joinParts([years && plural(years, 'year'), months && plural(months, 'month'), rest && plural(rest, 'day')].filter(Boolean) as string[])
  const weeks = Math.floor(days / 7)
  return {
    days,
    work,
    off: days - work,
    ymd,
    weeks: days % 7 ? `${plural(weeks, 'week')} and ${plural(days % 7, 'day')}` : plural(weeks, 'week'),
    backwards: from.value > to.value,
    note: outsideHolidays(a, b)
  }
})

// ---------- Add or subtract ----------
const added = computed(() => {
  if (!isIsoDate(start.value) || !Number.isFinite(amount.value)) return
  const n = Math.trunc(amount.value) * sign.value
  // Kept within a few centuries, so a stray zero can't make the working-day loop crawl
  if (Math.abs(n) > (unit.value === 'years' ? 500 : unit.value === 'months' ? 6000 : 100_000)) return
  const date = unit.value === 'days'
    ? addDays(start.value, n)
    : unit.value === 'weeks'
      ? addDays(start.value, n * 7)
      : unit.value === 'months'
        ? addMonths(start.value, n)
        : unit.value === 'years'
          ? addMonths(start.value, n * 12)
          : addWorkDays(start.value, n, week.value)
  const fromToday = daysBetween(today, date)
  return {
    date,
    label: fmtDate(date),
    fromToday: fromToday === 0 ? 'Today' : fromToday > 0 ? `In ${plural(fromToday, 'day')}` : `${plural(-fromToday, 'day')} ago`,
    note: unit.value === 'workdays' && outsideHolidays(start.value, date)
  }
})

// ---------- Time ----------
type TimeMode = 'between' | 'add'
const timeMode = ref<TimeMode>('between')
const timeFrom = ref('09:00')
const timeTo = ref('17:30')
const breakMin = ref(60)
const timeStart = ref('09:00')
const timeSign = ref<1 | -1>(1)
const addHours = ref(2)
const addMins = ref(30)

const timeBetween = computed(() => {
  if (!isClock(timeFrom.value) || !isClock(timeTo.value)) return
  const span = minutesBetween(timeFrom.value, timeTo.value)
  const worked = Math.max(0, span - Math.max(0, Math.trunc(breakMin.value) || 0))
  return {
    span,
    worked,
    // Timesheets often want 8.5 rather than 8 h 30 min
    decimal: (worked / 60).toLocaleString('en', { maximumFractionDigits: 2 }),
    overnight: clockMinutes(timeTo.value) < clockMinutes(timeFrom.value)
  }
})

const timeAdded = computed(() => {
  if (!isClock(timeStart.value)) return
  const n = ((Math.trunc(addHours.value) || 0) * 60 + (Math.trunc(addMins.value) || 0)) * timeSign.value
  const { time, days } = addMinutes(timeStart.value, n)
  return { time, n, days: days === 0 ? 'Same day' : days === 1 ? 'Next day' : days === -1 ? 'Day before' : days > 0 ? `${days} days later` : `${-days} days before` }
})

function flip() {
  ;[from.value, to.value] = [to.value, from.value]
  play('select')
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Copied')
    play('copy')
  } catch {
    toast.error('Could not copy', { description: 'Your browser blocked clipboard access.' })
    play('error')
  }
}
</script>

<template>
  <ToolPage header="bar">
    <template #settings>
      <SettingChoice v-model="prefs.tab" title="Open on" :options="TABS" />
      <SettingRow v-model="prefs.holidays" title="Skip public holidays" description="Working days leave out Cambodian public holidays, as well as weekends." />
      <SettingRow v-model="prefs.saturday" title="Saturday is a working day" description="For a six-day week, common in Cambodia. Only Sunday is off." />
      <SettingRow v-model="prefs.includeEnd" title="Include the end day" description="1 to 3 May counts as 3 days instead of 2." />
    </template>

    <div class="tabs" role="tablist" aria-label="Days">
      <button
        v-for="t in TABS"
        :id="`tab-${t.value}`"
        :key="t.value"
        type="button"
        role="tab"
        class="tab"
        :aria-selected="tab === t.value"
        :aria-controls="`panel-${t.value}`"
        @click="selectTab(t.value)"
      >
        {{ t.label }}
      </button>
    </div>

    <div :id="`panel-${tab}`" class="workspace" role="tabpanel" :aria-labelledby="`tab-${tab}`">
      <section class="panel pad stack">
        <template v-if="tab === 'between'">
          <label class="field">
            From
            <DatePicker v-model="from" aria-label="From" clipboard />
          </label>
          <button type="button" class="btn btn-quiet btn-sm swap" aria-label="Swap the two dates" @click="flip">⇅ Swap</button>
          <label class="field">
            To
            <DatePicker v-model="to" aria-label="To" clipboard />
          </label>
          <div class="chips">
            <button type="button" class="btn btn-quiet btn-sm" @click="from = today; play('select')">From today</button>
            <button type="button" class="btn btn-quiet btn-sm" @click="to = `${today.slice(0, 4)}-12-31`; play('select')">To the end of the year</button>
          </div>
        </template>

        <template v-else-if="tab === 'time'">
          <div class="segmented" role="radiogroup" aria-label="Time calculation">
            <label v-for="m in [{ value: 'between', label: 'Between times' }, { value: 'add', label: 'Add or subtract' }] as const" :key="m.value" :class="{ active: timeMode === m.value }">
              <input type="radio" name="days-time-mode" :checked="timeMode === m.value" @change="timeMode = m.value; play('select')">
              {{ m.label }}
            </label>
          </div>
          <template v-if="timeMode === 'between'">
            <div class="row">
              <label class="field grow">
                From
                <TimePicker v-model="timeFrom" aria-label="From" />
              </label>
              <label class="field grow">
                To
                <TimePicker v-model="timeTo" aria-label="To" />
              </label>
            </div>
            <label class="field">
              Break (minutes)
              <input v-model.number="breakMin" class="input" type="number" inputmode="numeric" min="0" step="5">
            </label>
          </template>
          <template v-else>
            <label class="field">
              Start time
              <TimePicker v-model="timeStart" aria-label="Start time" />
            </label>
            <div class="segmented" role="radiogroup" aria-label="Add or subtract">
              <label v-for="s in [1, -1] as const" :key="s" :class="{ active: timeSign === s }">
                <input type="radio" name="days-time-sign" :checked="timeSign === s" @change="timeSign = s; play('select')">
                {{ s === 1 ? '+ Add' : '− Subtract' }}
              </label>
            </div>
            <div class="row">
              <label class="field grow">
                Hours
                <input v-model.number="addHours" class="input" type="number" inputmode="numeric" min="0" step="1">
              </label>
              <label class="field grow">
                Minutes
                <input v-model.number="addMins" class="input" type="number" inputmode="numeric" min="0" step="5">
              </label>
            </div>
          </template>
        </template>

        <template v-else>
          <label class="field">
            Start date
            <DatePicker v-model="start" aria-label="Start date" clipboard />
          </label>
          <div class="segmented" role="radiogroup" aria-label="Add or subtract">
            <label v-for="s in [1, -1] as const" :key="s" :class="{ active: sign === s }">
              <input type="radio" name="days-sign" :checked="sign === s" @change="sign = s; play('select')">
              {{ s === 1 ? '+ Add' : '− Subtract' }}
            </label>
          </div>
          <div class="row">
            <label class="field amount">
              Amount
              <input v-model.number="amount" class="input" type="number" inputmode="numeric" min="0" step="1">
            </label>
            <label class="field grow">
              Unit
              <select v-model="unit" class="input">
                <option v-for="u in UNITS" :key="u.value" :value="u.value">{{ u.label }}</option>
              </select>
            </label>
          </div>
        </template>
      </section>

      <section class="panel pad result" aria-live="polite">
        <template v-if="tab === 'between' && between">
          <p class="label">{{ between.backwards ? 'Going back' : 'Total' }}</p>
          <p class="big"><output>{{ plural(between.days, 'day') }}</output></p>
          <dl class="facts">
            <div><dt>In weeks</dt><dd>{{ between.weeks }}</dd></div>
            <div><dt>In months</dt><dd>{{ between.ymd }}</dd></div>
            <div><dt>Working days</dt><dd>{{ between.work.toLocaleString('en') }}</dd></div>
            <div><dt>Weekends{{ prefs.holidays ? ' & holidays' : '' }}</dt><dd>{{ between.off.toLocaleString('en') }}</dd></div>
          </dl>
          <p v-if="between.note" class="note">Public holidays are only known for {{ holidayYears.join(' and ') }}; other years count weekends only.</p>
          <button type="button" class="btn copy" @click="copy(`${plural(between.days, 'day')} (${between.work} working days)`)">Copy</button>
        </template>

        <template v-else-if="tab === 'add' && added">
          <p class="label">{{ added.fromToday }}</p>
          <p class="big"><output>{{ added.label }}</output></p>
          <p v-if="added.note" class="note">Public holidays are only known for {{ holidayYears.join(' and ') }}; other years skip weekends only.</p>
          <button type="button" class="btn copy" @click="copy(added.label)">Copy</button>
        </template>

        <template v-else-if="tab === 'time' && timeMode === 'between' && timeBetween">
          <p class="label">{{ breakMin > 0 ? 'Without the break' : 'Total' }}</p>
          <p class="big"><output>{{ fmtDuration(timeBetween.worked) }}</output></p>
          <dl class="facts">
            <div><dt>In hours</dt><dd>{{ timeBetween.decimal }}</dd></div>
            <div v-if="breakMin > 0"><dt>With the break</dt><dd>{{ fmtDuration(timeBetween.span) }}</dd></div>
          </dl>
          <p v-if="timeBetween.overnight" class="note">Runs past midnight into the next day.</p>
          <button type="button" class="btn copy" @click="copy(`${fmtDuration(timeBetween.worked)} (${timeBetween.decimal} hours)`)">Copy</button>
        </template>

        <template v-else-if="tab === 'time' && timeMode === 'add' && timeAdded">
          <p class="label">{{ timeAdded.days }}</p>
          <p class="big"><output>{{ timeAdded.time }}</output></p>
          <p class="note">{{ timeStart }} {{ timeAdded.n < 0 ? '−' : '+' }} {{ fmtDuration(Math.abs(timeAdded.n)) }}</p>
          <button type="button" class="btn copy" @click="copy(timeAdded.time)">Copy</button>
        </template>

        <p v-else class="note">{{ tab === 'time' ? 'Pick a time to see the result.' : 'Pick a date to see the result.' }}</p>
      </section>
    </div>
  </ToolPage>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: 0.25rem;
  width: fit-content;
  max-width: 100%;
  margin: 0 0 1.75rem;
  padding: 4px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
}

.tab {
  padding: 0.55rem 1.1rem;
  white-space: nowrap;
  font: inherit;
  font-weight: 600;
  color: var(--ink-2);
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color var(--dur-fast), color var(--dur-fast);
}

.tab:hover {
  color: var(--ink);
}

.tab[aria-selected='true'] {
  color: var(--ink);
  background: var(--surface);
  box-shadow: 0 1px 2px rgb(var(--shadow) / 0.12), 0 0 0 1px var(--line);
}

.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 1.5rem;
  align-items: start;
}

.pad {
  padding: 1.25rem;
}

.stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.amount {
  flex: 0 1 8rem;
}

.grow {
  flex: 1 1 10rem;
}

.swap {
  align-self: flex-start;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.result {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.label {
  margin: 0;
  color: var(--ink-2);
  font-weight: 600;
}

.big {
  margin: 0;
  font-size: clamp(1.75rem, 5vw, 2.6rem);
  font-weight: 700;
  line-height: 1.1;
  color: var(--ink);
  text-wrap: balance;
}

.facts {
  display: grid;
  gap: 0.5rem;
  margin: 0.25rem 0 0;
}

.facts div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding-block: 0.5rem;
  border-top: 1px solid var(--line);
}

.facts dt {
  color: var(--ink-2);
}

.facts dd {
  margin: 0;
  font-weight: 600;
  text-align: right;
}

.note {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--ink-3);
}

.copy {
  align-self: flex-start;
}

@media (max-width: 720px) {
  .workspace {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 420px) {
  .tabs {
    width: 100%;
  }

  .tab {
    flex: 1;
    padding-inline: 0.5rem;
    font-size: var(--text-sm);
  }
}
</style>
