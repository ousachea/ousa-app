<script setup lang="ts">
// Calendar's screen saver, in two looks (Calendar settings, the L key or the Switch look button):
// - page: like a page from a printed wall calendar. The month's facts in a row along the top, the month's
//   name huge between hairlines, every day listed week by week, and the day as a giant number running off
//   the bottom corner. ← → (or a sideways swipe) step a day, ↑ ↓ (or an up/down swipe) a month, and T
//   comes back to today; it comes back by itself after a minute. The time in the top row is always now.
// - clock: the time, weekday and date in big white type on glowing colours that slowly turn.
// Against burn-in, the whole screen glides slowly round a wide loop and its colours keep turning, so no
// text or hairline stays on the same pixels. Full screen, keeps the screen awake, and any tap or other key
// closes it. The page owns the clock, so it always matches the header.
const props = defineProps<{ open: boolean, now: number, timeZone: string, time: string, seconds: string, period: string, khmer?: string }>()
const emit = defineEmits<{ close: [] }>()
const look = defineModel<'page' | 'clock'>('look', { default: 'page' })

function switchLook() {
  look.value = look.value === 'page' ? 'clock' : 'page'
  wake()
}

// ---------- The day shown: today, or one you've stepped to ----------
interface Ymd { year: number, month: number, day: number }
const today = computed<Ymd>(() => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: props.timeZone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(props.now)
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value)
  return { year: get('year'), month: get('month'), day: get('day') }
})
const picked = ref<Ymd | null>(null)
const shown = computed(() => picked.value ?? today.value)
const isToday = computed(() => !picked.value)

// Calendar maths in UTC, so the device's own time zone never shifts a day
const fromUtc = (t: number): Ymd => {
  const d = new Date(t)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}
const BACK_TO_TODAY_MS = 60_000
let backTimer: ReturnType<typeof setTimeout> | undefined

/** Step through the calendar: `days` forward or back, or `months` (keeping the day, or the month's last) */
function step(days: number, months = 0) {
  const s = shown.value
  let next: Ymd
  if (months) {
    const first = fromUtc(Date.UTC(s.year, s.month - 1 + months, 1))
    const length = new Date(Date.UTC(first.year, first.month, 0)).getUTCDate()
    next = { ...first, day: Math.min(s.day, length) }
  } else {
    next = fromUtc(Date.UTC(s.year, s.month - 1, s.day + days))
  }
  const t = today.value
  picked.value = next.year === t.year && next.month === t.month && next.day === t.day ? null : next
  wake()
  // Left on another day, it comes back to today by itself
  clearTimeout(backTimer)
  if (picked.value) backTimer = setTimeout(() => (picked.value = null), BACK_TO_TODAY_MS)
}
function backToToday() {
  clearTimeout(backTimer)
  picked.value = null
  wake()
}

// Sideways swipes step a day, up and down a month; a plain tap still closes
let swipeFrom: { x: number, y: number } | undefined
let swiped = false
function onPointerDown(e: PointerEvent) {
  swipeFrom = { x: e.clientX, y: e.clientY }
  swiped = false
}
function onPointerUp(e: PointerEvent) {
  if (!swipeFrom || look.value !== 'page') return
  const dx = e.clientX - swipeFrom.x
  const dy = e.clientY - swipeFrom.y
  swipeFrom = undefined
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 50) return
  swiped = true
  if (Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1)
  else step(0, dy < 0 ? 1 : -1)
}
function onClick() {
  if (swiped) {
    swiped = false
    return
  }
  emit('close')
}

// Each date has its own paper colour: stepping a day turns the hue a little, a month a long way round.
// Today is 0, so the colour cycle carries on from where it was when you come back.
const dateHue = computed(() => {
  if (!picked.value) return 0
  const t = today.value
  const p = picked.value
  const months = (p.year - t.year) * 12 + (p.month - t.month)
  return months * 67 + (p.day - t.day) * 25
})

const weekdayOf = (d: Ymd) => new Date(Date.UTC(d.year, d.month - 1, d.day)).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })
const weekdayName = (day: number) => weekdayOf({ ...shown.value, day })
const month = computed(() => {
  const { year, month } = shown.value
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const weekdayOf = (d: number) => new Date(Date.UTC(year, month - 1, d)).getUTCDay() // 0 Sunday
  const all = Array.from({ length: days }, (_, i) => ({ day: i + 1, name: weekdayName(i + 1), sunday: weekdayOf(i + 1) === 0 }))
  // One line a week, Monday to Sunday
  const weeks: typeof all[] = [[]]
  for (const d of all) {
    weeks[weeks.length - 1]!.push(d)
    if (d.sunday) weeks.push([])
  }
  return {
    name: new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' }),
    days,
    // A weekend counts when both its Saturday and Sunday are in the month
    weekends: all.filter(d => weekdayOf(d.day) === 6 && d.day < days).length,
    begins: weekdayName(1),
    ends: weekdayName(days),
    weeks: weeks.filter(w => w.length)
  }
})
const pad = (n: number) => String(n).padStart(2, '0')
// For the clock look, always today: "18 October 2026"
const monthName = (d: Ymd) => new Date(Date.UTC(d.year, d.month - 1, 1)).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })
const dateLine = computed(() => `${today.value.day} ${monthName(today.value)} ${today.value.year}`)

const dialog = ref<HTMLDialogElement>()
// Only leave full screen if we went into it (phones may already be full screen, see fullscreen.client.ts)
let enteredFullscreen = false
let wakeLock: { release: () => Promise<void> } | undefined

// ---------- Full screen ----------
// The whole page goes full screen and the screen saver shows on top. Browsers only allow it from inside
// the click that asks for it (Safari strictly so), so the page calls enterFullscreen() in its button's click
// handler, before opening. Older Safari (and iPad) only know the webkit-prefixed calls. iPhone Safari has no
// full screen for pages at all; installed to the home screen, the app already fills the screen.
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => void }
type FsDocument = Document & { webkitFullscreenElement?: Element | null, webkitExitFullscreen?: () => void }
const fsElement = () => document.fullscreenElement ?? (document as FsDocument).webkitFullscreenElement ?? null

function enterFullscreen() {
  // Already asked (the request takes a moment) or already full screen
  if (enteredFullscreen || fsElement()) return
  const root = document.documentElement as FsElement
  try {
    if (root.requestFullscreen) {
      enteredFullscreen = true
      root.requestFullscreen({ navigationUI: 'hide' }).catch(() => (enteredFullscreen = false))
    } else if (root.webkitRequestFullscreen) {
      enteredFullscreen = true
      root.webkitRequestFullscreen()
    }
  } catch {
    enteredFullscreen = false
  }
}

function exitFullscreen() {
  if (!enteredFullscreen || !fsElement()) return
  const doc = document as FsDocument
  if (document.exitFullscreen) document.exitFullscreen().catch(() => {})
  else doc.webkitExitFullscreen?.()
}

defineExpose({ enterFullscreen })

// The cursor and the "how to close" hint go after a few still seconds, and come back when the mouse moves
const idle = ref(false)
let idleTimer: ReturnType<typeof setTimeout> | undefined
function wake() {
  idle.value = false
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => (idle.value = true), 3000)
}


async function show() {
  const el = dialog.value
  if (!el || el.open) return
  el.showModal()
  // Focus the screen saver itself, not its first button, so no focus ring sits on Switch look
  el.focus()
  wake()
  // Opened some other way than the button: Chrome and Firefox still allow it a moment after the click
  enterFullscreen()
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }
    wakeLock = await nav.wakeLock?.request('screen')
  } catch {}
}

function hide() {
  clearTimeout(idleTimer)
  clearTimeout(backTimer)
  picked.value = null
  wakeLock?.release().catch(() => {})
  wakeLock = undefined
  exitFullscreen()
  enteredFullscreen = false
  if (dialog.value?.open) dialog.value.close()
}

watch(() => props.open, open => (open ? show() : hide()), { flush: 'post' })

// Esc in full screen only leaves full screen; that's still a wish to close
function onFullscreenChange() {
  const el = dialog.value
  // The page going full screen is drawn above everything already open, this screen saver included;
  // opening it again puts it back on top
  if (fsElement() && el?.open) {
    el.close()
    el.showModal()
    el.focus()
    return
  }
  if (enteredFullscreen && !fsElement()) {
    enteredFullscreen = false
    emit('close')
  }
}
// The screen lock goes when the tab is hidden; take it back on return
async function onVisible() {
  if (props.open && document.visibilityState === 'visible' && !wakeLock) {
    try {
      wakeLock = await (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen')
    } catch {}
  }
}
onMounted(() => {
  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener('webkitfullscreenchange', onFullscreenChange)
  document.addEventListener('visibilitychange', onVisible)
})
onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
  document.removeEventListener('visibilitychange', onVisible)
  hide()
})

const NAV_KEYS: Record<string, () => void> = {
  ArrowLeft: () => step(-1),
  ArrowRight: () => step(1),
  ArrowUp: () => step(0, -1),
  ArrowDown: () => step(0, 1),
  t: backToToday,
  Home: backToToday
}

function onKey(e: KeyboardEvent) {
  // Modifier keys alone (switching apps, a screenshot) leave it running
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return
  e.preventDefault()
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
  if (key === 'l') return switchLook()
  // The arrows and T move through the calendar page; on the clock they do nothing rather than close
  if (NAV_KEYS[key]) {
    if (look.value === 'page') NAV_KEYS[key]()
    return
  }
  emit('close')
}
</script>

<template>
  <dialog
    ref="dialog"
    class="saver"
    tabindex="-1"
    :class="[`look-${look}`, { idle }]"
    :style="{ '--date-hue': `${dateHue}deg` }"
    aria-label="Screen saver"
    @cancel.prevent="emit('close')"
    @keydown="onKey"
    @click="onClick"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
    @pointermove="wake"
  >
    <div v-if="look === 'page'" class="sheet">
      <header class="facts">
        <p>{{ month.days }} Days<br>{{ month.weekends }} Weekends</p>
        <p>Begins {{ month.begins }}<br>Ends {{ month.ends }}</p>
        <p class="clock" role="timer" aria-live="off">{{ time }}<span class="sec">:{{ seconds }}</span> {{ period }}<br>{{ weekdayOf(today) }}</p>
        <p class="issue">Issue {{ shown.month }}<br>{{ shown.year }}</p>
      </header>

      <h2 class="month">{{ month.name }}</h2>

      <ol class="weeks" :aria-label="`${month.name} ${shown.year}`">
        <li v-for="(week, i) in month.weeks" :key="i">
          <span v-for="d in week" :key="d.day" :class="{ today: d.day === shown.day }" :aria-current="d.day === shown.day ? 'date' : undefined">{{ pad(d.day) }}, {{ d.name }}/ </span>
        </li>
      </ol>

      <p class="day" aria-live="polite" :aria-label="`${isToday ? 'Today, ' : ''}${weekdayOf(shown)} ${shown.day} ${month.name} ${shown.year}`">{{ shown.day }}</p>
      <!-- Stepped to another day: which, and how to come back -->
      <p v-if="!isToday" class="away">{{ weekdayOf(shown) }} · <button type="button" class="link-today" @click.stop="backToToday">Back to today (T)</button></p>
    </div>

    <div v-else class="face" role="timer" aria-live="off">
      <p class="big-time">{{ time }}<span class="big-sec">:{{ seconds }}</span><span class="period">{{ period }}</span></p>
      <p class="weekday">{{ weekdayOf(today) }}</p>
      <p class="date">{{ dateLine }}</p>
      <p v-if="khmer" class="khmer" lang="km">{{ khmer }}</p>
    </div>

    <div class="hint">
      <span v-if="look === 'page'">← → a day · ↑ ↓ a month (or swipe) · L the other look · tap or any other key closes</span>
      <span v-else>L for the other look · tap or any key closes</span>
      <!-- For touch screens, which have no arrow keys -->
      <button type="button" class="look-switch" @click.stop="switchLook">Switch look</button>
    </div>
  </dialog>
</template>

<style scoped>
/* The background's hue: each look turns it at its own pace from its own start */
@property --hue {
  syntax: '<angle>';
  inherits: true;
  initial-value: 222deg;
}

.saver {
  --ink: #111318;
  --rule: rgb(17 19 24 / 0.28);
  position: fixed;
  inset: 0;
  width: 100vw;
  max-width: none;
  height: 100dvh;
  max-height: none;
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 0;
  color: var(--ink);
  font-family: 'Helvetica Neue', Helvetica, Inter, Arial, sans-serif;
  cursor: none;
}

/* Page: pastel paper that keeps changing colour (one lap a minute), and glides to a new colour for each
   day or month you step to. Pale enough for the black type, saturated enough to see it change */
@property --date-hue {
  syntax: '<angle>';
  inherits: true;
  initial-value: 0deg;
}

.look-page {
  background: hsl(calc(var(--hue) + var(--date-hue)) 80% 84%);
  animation: hue-page 60s linear infinite;
  transition: --date-hue 0.9s cubic-bezier(0.2, 0, 0, 1);
}

/* Clock: two glows over a deep colour, all turning once a minute */
.look-clock {
  --ink: #fff;
  font-family: var(--font);
  background:
    radial-gradient(70% 90% at 15% 20%, hsl(calc(var(--hue) + 60deg) 85% 60%) 0%, transparent 60%),
    radial-gradient(80% 90% at 90% 85%, hsl(calc(var(--hue) - 70deg) 80% 50%) 0%, transparent 65%),
    hsl(var(--hue) 70% 32%);
  animation: hue-clock 60s linear infinite;
}

/* Focused so its keys work; nothing to outline on a full-screen picture */
.saver:focus {
  outline: none;
}

.saver:not([open]) {
  display: none;
}

.saver:not(.idle) {
  cursor: default;
}

.saver::backdrop {
  background: #000;
}

@keyframes hue-page {
  from { --hue: 222deg; }
  to { --hue: 582deg; }
}

@keyframes hue-clock {
  from { --hue: 260deg; }
  to { --hue: 620deg; }
}

/* Lite effects: the same colours, repainted twice a second instead of every frame */
:root[data-effects='lite'] .look-page {
  animation-timing-function: steps(120);
}

:root[data-effects='lite'] .look-clock {
  animation-timing-function: steps(120);
}

.sheet {
  position: absolute;
  inset: 0;
  padding: clamp(0.9rem, 2.2vw, 2.25rem) clamp(1rem, 3vw, 3rem);
  display: flex;
  flex-direction: column;
  animation: orbit 600s ease-in-out infinite;
  user-select: none;
}

p,
h2,
ol {
  margin: 0;
}

/* ---------- Top row: the month's facts, then a hairline across ---------- */
.facts {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr auto;
  gap: 1rem;
  padding-bottom: 0.6em;
  font-size: clamp(0.7rem, 1.05vw, 1.05rem);
  line-height: 1.25;
  letter-spacing: -0.01em;
  border-bottom: 1px solid var(--rule);
}

.issue {
  text-align: right;
}

.clock {
  font-variant-numeric: tabular-nums;
}

.sec {
  opacity: 0.55;
}

/* ---------- The month's name between a double rule and a single one ---------- */
.month {
  margin-top: auto;
  padding: 0.04em 0 0.02em;
  font-size: clamp(4rem, 14vw, 17rem);
  font-weight: 300;
  line-height: 1;
  letter-spacing: -0.045em;
  position: relative;
  border-top: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
}

/* The double rule above it: a second hairline just over the first */
.month::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: calc(-1 * clamp(0.35rem, 0.6vw, 0.6rem));
  border-top: 1px solid var(--rule);
}

/* ---------- Every day of the month, a week to a line ---------- */
.weeks {
  margin-top: auto;
  width: min(62%, 52rem);
  padding: 0;
  list-style: none;
  font-size: clamp(0.62rem, 0.95vw, 0.95rem);
  line-height: 1.25;
  letter-spacing: -0.01em;
}

.weeks li {
  padding: 0.35em 0;
  border-top: 1px solid var(--rule);
}

.weeks .today {
  font-weight: 700;
}

/* ---------- Today's date, giant, running off the bottom corner ---------- */
.day {
  position: absolute;
  right: clamp(0.5rem, 2vw, 2rem);
  bottom: 0;
  font-size: clamp(10rem, 44vh, 36rem);
  font-weight: 400;
  line-height: 0.74;
  letter-spacing: -0.06em;
  font-variant-numeric: tabular-nums;
  translate: 0 8%;
}

/* ---------- Clock look: the time, weekday and date, centred ---------- */
.face {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  text-shadow: 0 0.04em 0.25em rgb(0 0 0 / 0.25);
  animation: orbit 600s ease-in-out infinite;
  user-select: none;
}

.big-time {
  font-size: clamp(5rem, 22vw, 22rem);
  font-weight: 800;
  line-height: 0.95;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
  font-variation-settings: 'opsz' 96;
}

.big-sec {
  font-size: 0.32em;
  font-weight: 700;
  letter-spacing: -0.02em;
  opacity: 0.75;
}

.period {
  margin-left: 0.25em;
  font-size: 0.22em;
  font-weight: 700;
  letter-spacing: 0;
  opacity: 0.85;
}

.weekday {
  margin-top: 0.4em;
  font-size: clamp(2rem, 7vw, 6rem);
  font-weight: 700;
  letter-spacing: -0.02em;
}

.date {
  font-size: clamp(1.4rem, 4.5vw, 3.75rem);
  font-weight: 600;
  opacity: 0.9;
}

.khmer {
  margin-top: 0.6em;
  font-size: clamp(1rem, 2.6vw, 2rem);
  opacity: 0.8;
}

/* ---------- How to close and switch: fades once you're still ---------- */
.hint {
  position: absolute;
  left: 0;
  right: 0;
  bottom: max(1.25rem, env(safe-area-inset-bottom));
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.5rem 0.9rem;
  font-size: var(--text-sm);
  font-weight: 600;
  transition: opacity 0.6s;
}

.hint > span {
  opacity: 0.7;
}

.look-switch {
  flex: none;
  white-space: nowrap;
  padding: 0.45rem 0.9rem;
  font: inherit;
  color: inherit;
  background: color-mix(in srgb, var(--ink) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--ink) 30%, transparent);
  border-radius: var(--radius-pill);
  cursor: pointer;
}

/* The page look's corners are busy; its hint sits under the top row instead */
.look-page .hint {
  top: clamp(4.5rem, 10vh, 6.5rem);
  bottom: auto;
  justify-content: flex-end;
  padding: 0 clamp(1rem, 3vw, 3rem);
}

.idle .hint {
  opacity: 0;
  pointer-events: none;
}

/* Phones (portrait): the facts in two columns, and the day list across the full width */
@media (max-width: 640px) {
  .facts {
    grid-template-columns: 1fr auto;
  }

  .weeks {
    width: 100%;
    margin-bottom: 30vh;
  }
}

/* ---------- Against burn-in: the whole screen glides round a wide loop every ten minutes ----------
   A few pixels a minute: too slow to see moving, so it stays on even with reduced motion, but nothing
   (the hairlines, the big numbers) sits on the same pixels for long. The clock look's type is bigger and
   brighter, so it travels further. */
.sheet { --orbit: 2.5vmin; }
.face { --orbit: 5vmin; }

@keyframes orbit {
  0%, 100% { translate: 0 0; }
  20% { translate: var(--orbit) calc(var(--orbit) * -0.6); }
  40% { translate: calc(var(--orbit) * -0.8) calc(var(--orbit) * -1); }
  60% { translate: calc(var(--orbit) * -1) calc(var(--orbit) * 0.8); }
  80% { translate: calc(var(--orbit) * 0.6) var(--orbit); }
}

/* ---------- Stepped to another day ---------- */
.away {
  position: absolute;
  right: clamp(1rem, 3vw, 3rem);
  bottom: calc(clamp(10rem, 44vh, 36rem) * 0.8);
  font-size: clamp(0.75rem, 1.05vw, 1.05rem);
  font-weight: 700;
}

.link-today {
  padding: 0;
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  text-decoration: underline;
  text-underline-offset: 0.2em;
  cursor: pointer;
}
</style>
