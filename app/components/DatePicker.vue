<script setup lang="ts">
// Calendar date picker in the app's own style, replacing <input type="date">. Works with yyyy-mm-dd strings.
// Click the month to jump by month or year. Keyboard: arrows move a day or week, Page Up/Down a month,
// Enter picks, Esc closes.
const props = defineProps<{ min?: string, max?: string, required?: boolean, ariaLabel?: string, placeholder?: string }>()
const model = defineModel<string>({ default: '' })
defineOptions({ inheritAttrs: false })

const uid = useId()
const trigger = ref<HTMLButtonElement>()
const panel = ref<HTMLDivElement>()
const { open, placement, show, hide } = useAnchoredPopover(trigger, panel)
const { play } = useSound()

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : undefined)
const todayIso = () => iso(new Date())

const MONTHS = Array.from({ length: 12 }, (_, m) => new Date(2000, m, 1).toLocaleDateString('en-GB', { month: 'short' }))
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

const label = computed(() => {
  const d = parse(model.value)
  return d ? d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : ''
})

const inRange = (s: string) => (!props.min || s >= props.min) && (!props.max || s <= props.max)

// What the calendar shows, and the day keyboard focus is on
const view = ref<'days' | 'months' | 'years'>('days')
const shown = ref(new Date())
const focusDay = ref(todayIso())

const title = computed(() => {
  if (view.value === 'days') return shown.value.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  if (view.value === 'months') return String(shown.value.getFullYear())
  const start = Math.floor(shown.value.getFullYear() / 12) * 12
  return `${start} – ${start + 11}`
})

// Six weeks starting on the Monday on or before the 1st, so the grid never jumps in height
const days = computed(() => {
  const first = new Date(shown.value.getFullYear(), shown.value.getMonth(), 1)
  const start = new Date(first)
  start.setDate(1 - ((first.getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const s = iso(d)
    return { iso: s, day: d.getDate(), outside: d.getMonth() !== first.getMonth(), disabled: !inRange(s) }
  })
})

const years = computed(() => {
  const start = Math.floor(shown.value.getFullYear() / 12) * 12
  return Array.from({ length: 12 }, (_, i) => start + i)
})

function openPicker() {
  const start = model.value && parse(model.value) ? model.value : (inRange(todayIso()) ? todayIso() : (props.max ?? props.min ?? todayIso()))
  focusDay.value = start
  shown.value = parse(start)!
  view.value = 'days'
  show()
  play('open')
  nextTick(focusCurrent)
}

function close(refocus = true) {
  hide({ refocus })
}

function focusCurrent() {
  panel.value?.querySelector<HTMLButtonElement>(`[data-iso="${focusDay.value}"]`)?.focus({ preventScroll: true })
}

function pick(s: string) {
  if (!inRange(s)) return
  model.value = s
  play('select')
  close()
}

function step(delta: number) {
  const d = new Date(shown.value)
  if (view.value === 'days') d.setMonth(d.getMonth() + delta, 1)
  else d.setFullYear(d.getFullYear() + delta * (view.value === 'years' ? 12 : 1))
  shown.value = d
  play('press')
}

function moveFocus(byDays: number, byMonths = 0) {
  const d = parse(focusDay.value)!
  if (byMonths) d.setMonth(d.getMonth() + byMonths)
  d.setDate(d.getDate() + byDays)
  focusDay.value = iso(d)
  if (d.getMonth() !== shown.value.getMonth() || d.getFullYear() !== shown.value.getFullYear()) {
    shown.value = new Date(d.getFullYear(), d.getMonth(), 1)
  }
  nextTick(focusCurrent)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    // Inside a popup, Esc closes only the calendar, not the popup too
    e.preventDefault()
    e.stopPropagation()
    if (view.value !== 'days') view.value = 'days'
    else close()
    return
  }
  if (view.value !== 'days') return
  const moves: Record<string, () => void> = {
    ArrowLeft: () => moveFocus(-1),
    ArrowRight: () => moveFocus(1),
    ArrowUp: () => moveFocus(-7),
    ArrowDown: () => moveFocus(7),
    PageUp: () => moveFocus(0, e.shiftKey ? -12 : -1),
    PageDown: () => moveFocus(0, e.shiftKey ? 12 : 1),
    Home: () => moveFocus(-((parse(focusDay.value)!.getDay() + 6) % 7)),
    End: () => moveFocus(6 - ((parse(focusDay.value)!.getDay() + 6) % 7))
  }
  const move = moves[e.key]
  if (move && (e.target as HTMLElement).dataset.iso) {
    e.preventDefault()
    move()
  }
}

function chooseMonth(m: number) {
  shown.value = new Date(shown.value.getFullYear(), m, 1)
  view.value = 'days'
  play('select')
}

function chooseYear(y: number) {
  shown.value = new Date(y, shown.value.getMonth(), 1)
  view.value = 'months'
  play('select')
}

function zoomOut() {
  view.value = view.value === 'days' ? 'months' : 'years'
  play('press')
}

const monthDisabled = (m: number) => {
  const y = shown.value.getFullYear()
  return !inRange(`${y}-${pad(m + 1)}-28`) && !inRange(`${y}-${pad(m + 1)}-01`)
}
const yearDisabled = (y: number) => (props.min && `${y}-12-31` < props.min) || (props.max && `${y}-01-01` > props.max)
</script>

<template>
  <div class="date-picker" v-bind="$attrs">
    <button
      ref="trigger"
      type="button"
      class="input trigger"
      :class="{ open, empty: !label }"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-controls="`${uid}-panel`"
      :aria-label="`${ariaLabel ?? 'Date'}: ${label || 'not set'}`"
      @click="open ? close() : openPicker()"
    >
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>
      <span class="value">{{ label || placeholder || 'Pick a date' }}</span>
    </button>
    <!-- Keeps the browser's "please fill in this field" check for required dates -->
    <input v-if="required" class="validate" :value="model" required tabindex="-1" aria-hidden="true" @focus="trigger?.focus()">

    <div
      :id="`${uid}-panel`"
      ref="panel"
      popover="manual"
      class="calendar"
      :class="[`from-${placement}`, { 'is-open': open }]"
      role="dialog"
      :aria-label="ariaLabel ?? 'Choose a date'"
      @keydown="onKey"
    >
      <header class="cal-head">
        <button type="button" class="nav" :aria-label="view === 'days' ? 'Previous month' : 'Earlier'" @click="step(-1)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <button type="button" class="title" :disabled="view === 'years'" @click="zoomOut">
          {{ title }}
          <svg v-if="view !== 'years'" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5" /></svg>
        </button>
        <button type="button" class="nav" :aria-label="view === 'days' ? 'Next month' : 'Later'" @click="step(1)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </header>

      <div v-if="view === 'days'" class="grid days" role="grid">
        <span v-for="w in WEEKDAYS" :key="w" class="weekday" aria-hidden="true">{{ w }}</span>
        <button
          v-for="d in days"
          :key="d.iso"
          type="button"
          class="day"
          :class="{ outside: d.outside, today: d.iso === todayIso(), selected: d.iso === model }"
          :data-iso="d.iso"
          :disabled="d.disabled"
          :tabindex="d.iso === focusDay ? 0 : -1"
          :aria-pressed="d.iso === model"
          :aria-label="new Date(`${d.iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })"
          @click="pick(d.iso)"
          @focus="focusDay = d.iso"
        >
          {{ d.day }}
        </button>
      </div>

      <div v-else-if="view === 'months'" class="grid months">
        <button
          v-for="(m, i) in MONTHS"
          :key="m"
          type="button"
          class="cell"
          :class="{ selected: model.startsWith(`${shown.getFullYear()}-${pad(i + 1)}`) }"
          :disabled="monthDisabled(i)"
          @click="chooseMonth(i)"
        >
          {{ m }}
        </button>
      </div>

      <div v-else class="grid months">
        <button
          v-for="y in years"
          :key="y"
          type="button"
          class="cell"
          :class="{ selected: model.startsWith(String(y)), current: y === new Date().getFullYear() }"
          :disabled="!!yearDisabled(y)"
          @click="chooseYear(y)"
        >
          {{ y }}
        </button>
      </div>

      <footer class="cal-foot">
        <button type="button" class="link" :disabled="!inRange(todayIso())" @click="pick(todayIso())">Today</button>
        <button v-if="!required && model" type="button" class="link" @click="model = ''; close()">Clear</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.date-picker {
  position: relative;
  min-width: 0;
}

.trigger {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  text-align: left;
  cursor: pointer;
  font-variant-numeric: tabular-nums;
}

.trigger.open {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent);
}

.icon {
  flex: none;
  width: 1.15rem;
  height: 1.15rem;
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 1.9;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty .value {
  color: var(--ink-3);
}

.validate {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

/* ---------- Calendar ---------- */
.calendar {
  position: fixed;
  inset: auto;
  margin: 0;
  width: 18.5rem;
  padding: 0.75rem;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 18px;
  box-shadow: 0 22px 48px -14px rgb(var(--shadow) / 0.38), 0 2px 6px rgb(var(--shadow) / 0.08);
}

.calendar.is-open {
  animation: cal-in 0.18s cubic-bezier(0.2, 0, 0, 1);
}

.calendar.from-above.is-open {
  animation-name: cal-in-above;
}

.cal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}

.cal-head button {
  font: inherit;
  color: var(--ink);
  background: none;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
}

.cal-head button:hover:not(:disabled) {
  background: var(--surface-2);
}

.nav {
  width: 2.2rem;
  height: 2.2rem;
  display: grid;
  place-items: center;
}

.cal-head svg {
  width: 1.1rem;
  height: 1.1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.title {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.4rem 0.6rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.title:disabled {
  cursor: default;
}

.title svg {
  width: 0.95rem;
  height: 0.95rem;
  color: var(--ink-2);
}

.grid {
  display: grid;
  gap: 2px;
}

.days {
  grid-template-columns: repeat(7, 1fr);
}

.months {
  grid-template-columns: repeat(3, 1fr);
  gap: 0.35rem;
  padding: 0.25rem 0;
}

.weekday {
  padding: 0.3rem 0;
  font-size: 0.72rem;
  font-weight: 700;
  text-align: center;
  color: var(--ink-3);
}

.day,
.cell {
  font: inherit;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
  background: none;
  border: 0;
  cursor: pointer;
  transition: background-color 0.12s, color 0.12s;
}

.day {
  aspect-ratio: 1;
  font-size: 0.9rem;
  border-radius: 50%;
}

.cell {
  padding: 0.7rem 0;
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: 12px;
}

.day:hover:not(:disabled),
.cell:hover:not(:disabled) {
  background: var(--surface-2);
}

.day:focus-visible,
.cell:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.day.outside {
  color: var(--ink-3);
}

.day.today,
.cell.current {
  font-weight: 700;
  box-shadow: inset 0 0 0 1.5px var(--line);
}

.day.selected,
.cell.selected {
  font-weight: 700;
  color: var(--on-accent, #fff);
  background: var(--accent);
  box-shadow: none;
}

.day.selected:hover,
.cell.selected:hover {
  background: var(--accent);
}

.day:disabled,
.cell:disabled {
  color: var(--ink-3);
  opacity: 0.4;
  cursor: not-allowed;
}

.cal-foot {
  display: flex;
  justify-content: space-between;
  margin-top: 0.5rem;
  padding-top: 0.55rem;
  border-top: 1px solid var(--line);
}

.link {
  padding: 0.3rem 0.5rem;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ink-2);
  background: none;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
}

.link:hover:not(:disabled) {
  color: var(--ink);
  background: var(--surface-2);
}

.link:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@keyframes cal-in {
  from { opacity: 0; translate: 0 -4px; scale: 0.98; }
}

@keyframes cal-in-above {
  from { opacity: 0; translate: 0 4px; scale: 0.98; }
}

@media (prefers-reduced-motion: reduce) {
  .calendar.is-open { animation: none; }
}
</style>
