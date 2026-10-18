<script setup lang="ts">
// Calendar's screen saver, in two looks (Calendar settings, or ← → while it's on):
// - page: like a page from a printed wall calendar. The month's facts in a row along the top, the month's
//   name huge between hairlines, every day listed week by week, and today's date as a giant number running
//   off the bottom corner. The time sits in the top row; the paper slowly shifts through pale colours.
// - clock: the time, weekday and date in big white type on glowing colours that slowly turn.
// Full screen, keeps the screen awake, and any tap or other key closes it. The page owns the clock, so it
// always matches the header.
const props = defineProps<{ open: boolean, now: number, timeZone: string, time: string, seconds: string, period: string, khmer?: string }>()
const emit = defineEmits<{ close: [] }>()
const look = defineModel<'page' | 'clock'>('look', { default: 'page' })

function switchLook() {
  look.value = look.value === 'page' ? 'clock' : 'page'
  wake()
}

// ---------- The month, in the page's time zone ----------
const today = computed(() => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: props.timeZone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(props.now)
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value)
  return { year: get('year'), month: get('month'), day: get('day') }
})
// Calendar maths in UTC, so the device's own time zone never shifts a day
const weekdayName = (day: number) => new Date(Date.UTC(today.value.year, today.value.month - 1, day)).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })
const month = computed(() => {
  const { year, month } = today.value
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
// For the clock look: "18 October 2026"
const dateLine = computed(() => `${today.value.day} ${month.value.name} ${today.value.year}`)

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

// The page drifts a few pixels every minute so a screen left on doesn't keep one picture burnt in
const drift = ref({ x: 0, y: 0 })
watch(() => props.time, () => {
  if (props.open) drift.value = { x: Math.round(Math.random() * 12 - 6), y: Math.round(Math.random() * 12 - 6) }
})

async function show() {
  const el = dialog.value
  if (!el || el.open) return
  el.showModal()
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

function onKey(e: KeyboardEvent) {
  // Modifier keys alone (switching apps, a screenshot) leave it running
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return
  e.preventDefault()
  // ← → switch the look; any other key closes
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') switchLook()
  else emit('close')
}
</script>

<template>
  <dialog
    ref="dialog"
    class="saver"
    :class="[`look-${look}`, { idle }]"
    aria-label="Screen saver"
    @cancel.prevent="emit('close')"
    @keydown="onKey"
    @click="emit('close')"
    @pointermove="wake"
  >
    <div v-if="look === 'page'" class="sheet" :style="{ translate: `${drift.x}px ${drift.y}px` }">
      <header class="facts">
        <p>{{ month.days }} Days<br>{{ month.weekends }} Weekends</p>
        <p>Begins {{ month.begins }}<br>Ends {{ month.ends }}</p>
        <p class="clock" role="timer" aria-live="off">{{ time }}<span class="sec">:{{ seconds }}</span> {{ period }}<br>{{ weekdayName(today.day) }}</p>
        <p class="issue">Issue {{ today.month }}<br>{{ today.year }}</p>
      </header>

      <h2 class="month">{{ month.name }}</h2>

      <ol class="weeks" :aria-label="`${month.name} ${today.year}`">
        <li v-for="(week, i) in month.weeks" :key="i">
          <span v-for="d in week" :key="d.day" :class="{ today: d.day === today.day }" :aria-current="d.day === today.day ? 'date' : undefined">{{ pad(d.day) }}, {{ d.name }}/ </span>
        </li>
      </ol>

      <p class="day" :aria-label="`Today, ${weekdayName(today.day)} ${today.day} ${month.name} ${today.year}`">{{ today.day }}</p>
    </div>

    <div v-else class="face" :style="{ translate: `${drift.x / 2}vw ${drift.y / 2}vh` }" role="timer" aria-live="off">
      <p class="big-time">{{ time }}<span class="big-sec">:{{ seconds }}</span><span class="period">{{ period }}</span></p>
      <p class="weekday">{{ weekdayName(today.day) }}</p>
      <p class="date">{{ dateLine }}</p>
      <p v-if="khmer" class="khmer" lang="km">{{ khmer }}</p>
    </div>

    <div class="hint">
      <span>Tap or press any key to close · ← → for the other look</span>
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

/* Page: pale paper, from pale blue through pale tints (one lap every two minutes) */
.look-page {
  background: hsl(var(--hue) 62% 91%);
  animation: hue-page 120s linear infinite;
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
  animation-timing-function: steps(240);
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
  transition: translate 3s ease-in-out;
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
  transition: translate 3s ease-in-out;
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
  font-size: 0.85rem;
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
  border-radius: 999px;
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

/* Reduced motion: the colours still shift (no movement), but the page stays put */
@media (prefers-reduced-motion: reduce) {
  .sheet, .face { transition: none; translate: none !important; }
}

:root[data-motion='reduced'] .sheet,
:root[data-motion='reduced'] .face {
  transition: none;
  translate: none !important;
}
</style>
