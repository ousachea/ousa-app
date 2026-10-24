<script setup lang="ts">
import { toast } from 'vue-sonner'

const { play } = useSound()

type Phase = 'focus' | 'short' | 'long'
const PHASES: { value: Phase, label: string }[] = [
  { value: 'focus', label: 'Focus' },
  { value: 'short', label: 'Short break' },
  { value: 'long', label: 'Long break' }
]
const minuteOptions = (list: number[]) => list.map(m => ({ value: m, label: `${m} min` }))

const { prefs } = useAppPrefs('focus', { focus: 25, short: 5, long: 15, every: 4, autoStart: false, edge: true })
// Sessions finished today, kept so a reload doesn't lose the count
const today = useRemembered('focus-today', { date: '', count: 0 }, v => !!v && typeof v === 'object' && 'count' in v)
const doneToday = computed(() => (today.value.date === localIsoDate() ? today.value.count : 0))

const phase = ref<Phase>('focus')
const length = computed(() => prefs[phase.value] * 60_000)
// Running: endAt is set and the clock counts towards it. Paused: `left` holds what remained.
const endAt = ref<number>()
const left = ref(length.value)
const nowMs = ref(Date.now())
const running = computed(() => endAt.value !== undefined)
const remaining = computed(() => Math.max(0, running.value ? endAt.value! - nowMs.value : left.value))
// Focus sessions in this round, towards the long break
const inRound = ref(0)

let timer: ReturnType<typeof setInterval> | undefined
function tick() {
  nowMs.value = Date.now()
  if (running.value && remaining.value <= 0) finish()
}
onBeforeUnmount(() => clearInterval(timer))

function start() {
  endAt.value = Date.now() + left.value
  nowMs.value = Date.now()
  clearInterval(timer)
  timer = setInterval(tick, 250)
  play('start')
}
function pause() {
  left.value = remaining.value
  endAt.value = undefined
  clearInterval(timer)
  play('press')
}
function setPhase(p: Phase, silent = false) {
  clearInterval(timer)
  endAt.value = undefined
  phase.value = p
  left.value = length.value
  if (!silent) play('select')
}
// Changing a length in Settings resets a phase that hasn't started yet
watch(length, (ms, old) => {
  if (!running.value && left.value === old) left.value = ms
})

// Moves on to the next phase; only a focus session that ran to the end counts towards the long break
function advance(completed: boolean) {
  const wasFocus = phase.value === 'focus'
  if (wasFocus && completed) {
    inRound.value++
    today.value = { date: localIsoDate(), count: doneToday.value + 1 }
  }
  if (phase.value === 'long') inRound.value = 0
  const next: Phase = !wasFocus ? 'focus' : completed && inRound.value % prefs.every === 0 ? 'long' : 'short'
  setPhase(next, true)
  return next
}

function finish() {
  const wasFocus = phase.value === 'focus'
  const next = advance(true)
  play('complete')
  toast.success(wasFocus ? 'Focus session done' : 'Break’s over', { description: wasFocus ? `Time for a ${next === 'long' ? 'long' : 'short'} break.` : 'Back to focus.' })
  if (prefs.autoStart) start()
}

function skip() {
  advance(false)
  play('select')
}

const clock = computed(() => {
  const s = Math.ceil(remaining.value / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
})
const phaseLabel = computed(() => PHASES.find(p => p.value === phase.value)!.label)
// The tab shows the time left while it runs, so it can be seen from another tab
useHead({ titleTemplate: computed(() => (running.value ? `${clock.value} · ${phaseLabel.value}` : '%s · Ousa’s Apps')) })

// ---------- Progress around the edge of the window ----------
// A line traces the window's edge clockwise from the top centre as the session goes by, with a marker
// at each quarter that fills once it's passed, so progress shows even out of the corner of your eye.
const EDGE = 6
const MILESTONES = [0.25, 0.5, 0.75]
const view = ref({ w: 0, h: 0 })
const measure = () => (view.value = { w: window.innerWidth, h: window.innerHeight })
onMounted(() => {
  measure()
  window.addEventListener('resize', measure)
})
onBeforeUnmount(() => window.removeEventListener('resize', measure))

const elapsed = computed(() => 1 - remaining.value / length.value)
const showEdge = computed(() => prefs.edge && view.value.w > 0 && (running.value || left.value !== length.value))
// The rectangle's sides, inset so the whole stroke stays on screen
const box = computed(() => ({ x: EDGE / 2, y: EDGE / 2, w: view.value.w - EDGE, h: view.value.h - EDGE }))
const edgePath = computed(() => {
  const { x, y, w, h } = box.value
  return `M${x + w / 2} ${y}H${x + w}V${y + h}H${x}V${y}Z`
})
/** The point a fraction `f` of the way round, starting at the top centre */
function edgePoint(f: number) {
  const { x, y, w, h } = box.value
  let d = f * 2 * (w + h)
  const legs: [number, (t: number) => [number, number]][] = [
    [w / 2, t => [x + w / 2 + t, y]],
    [h, t => [x + w, y + t]],
    [w, t => [x + w - t, y + h]],
    [h, t => [x, y + h - t]],
    [w / 2, t => [x + t, y]]
  ]
  for (const [len, at] of legs) {
    if (d <= len) return at(d)
    d -= len
  }
  return [x + w / 2, y]
}
// Nudged inside the window so the round markers aren't cut in half by its edge
const MARK = 9
const milestones = computed(() => MILESTONES.map((f) => {
  const [x, y] = edgePoint(f)
  return { f, at: [Math.min(Math.max(x, MARK), view.value.w - MARK), Math.min(Math.max(y, MARK), view.value.h - MARK)], passed: elapsed.value >= f }
}))

// Space starts and pauses, like most timers
function onKey(e: KeyboardEvent) {
  // Not on a focused button or choice, where Space already presses it
  if (e.code !== 'Space' || isTyping(e.target) || (e.target as HTMLElement | null)?.closest?.('button, label, a')) return
  e.preventDefault()
  if (running.value) pause()
  else start()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <ToolPage>
    <template #settings>
      <SettingChoice v-model="prefs.focus" title="Focus length" :options="minuteOptions([15, 25, 45, 50])" />
      <SettingChoice v-model="prefs.short" title="Short break" :options="minuteOptions([3, 5, 10])" />
      <SettingChoice v-model="prefs.long" title="Long break" :options="minuteOptions([10, 15, 20, 30])" />
      <SettingChoice v-model="prefs.every" title="Long break after" :options="[2, 3, 4, 6].map(n => ({ value: n, label: `${n} sessions` }))" />
      <SettingRow v-model="prefs.edge" title="Progress around the screen" description="A line runs round the edge of the window as time passes, with a marker at each quarter." />
      <SettingRow v-model="prefs.autoStart" title="Start the next one by itself" description="When time is up, the break or the next focus session starts straight away." />
    </template>

    <svg v-if="showEdge" class="edge" :class="{ paused: !running }" :viewBox="`0 0 ${view.w} ${view.h}`" :style="{ '--edge': phase === 'focus' ? 'var(--accent)' : 'var(--teal)' }" aria-hidden="true">
      <path :d="edgePath" pathLength="100" class="edge-track" :stroke-width="EDGE" />
      <path :d="edgePath" pathLength="100" class="edge-fill" :stroke-width="EDGE" :stroke-dasharray="`${elapsed * 100} 100`" />
      <circle v-for="m in milestones" :key="m.f" :cx="m.at[0]" :cy="m.at[1]" r="7" class="milestone" :class="{ passed: m.passed }" />
    </svg>

    <div class="focus">
      <div class="segmented phases" role="radiogroup" aria-label="Session">
        <label v-for="p in PHASES" :key="p.value" :class="{ active: phase === p.value }">
          <input type="radio" name="focus-phase" :checked="phase === p.value" @change="setPhase(p.value)">
          {{ p.label }}
        </label>
      </div>

      <div class="dial" role="timer" :aria-label="`${clock} left of ${phaseLabel}`">
        <Gauge :value="remaining / length" :min="0" :max="1" :start-angle="180" :end-angle="540" :radius="200" :padding="22">
          <GaugeTrack :width="22" color="var(--ink)" :opacity="0.08" />
          <GaugeArc reverse :width="22" :color="phase === 'focus' ? 'var(--accent)' : 'var(--teal)'" />
          <GaugeText :y="-4" :font-size="96" weight="bold" color="var(--ink)">{{ clock }}</GaugeText>
          <GaugeText :y="64" :font-size="28" color="var(--ink-2)">{{ phaseLabel }}</GaugeText>
        </Gauge>
      </div>

      <div class="controls">
        <button v-if="!running" type="button" class="btn big" @click="start">{{ left === length ? 'Start' : 'Resume' }}</button>
        <button v-else type="button" class="btn big" @click="pause">Pause</button>
        <button type="button" class="btn btn-quiet" :disabled="!running && left === length" @click="setPhase(phase)">Reset</button>
        <button type="button" class="btn btn-quiet" @click="skip">Skip</button>
      </div>

      <p class="count">
        <output>{{ doneToday }}</output> focus {{ doneToday === 1 ? 'session' : 'sessions' }} today ·
        {{ prefs.every - (inRound % prefs.every) }} until a long break
      </p>
      <p class="hint">Press <kbd>Space</kbd> to start or pause.</p>
    </div>
  </ToolPage>
</template>

<style scoped>
.focus {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.edge {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 40;
  pointer-events: none;
}

.edge path {
  fill: none;
}

.edge-track {
  stroke: var(--ink);
  opacity: 0.08;
}

.edge-fill {
  stroke: var(--edge);
  transition: stroke-dasharray 0.25s linear;
}

.edge.paused .edge-fill {
  opacity: 0.5;
}

.milestone {
  fill: var(--surface);
  stroke: var(--ink-3);
  stroke-width: 2;
  transition: fill var(--dur), stroke var(--dur), r var(--dur);
}

.milestone.passed {
  fill: var(--edge);
  stroke: var(--surface);
  r: 8;
}

.phases {
  width: min(100%, 26rem);
}

.phases label {
  white-space: nowrap;
}

.dial {
  width: min(100%, 20rem);
}

.dial :deep(svg) {
  display: block;
  width: 100%;
  height: auto;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
}

.big {
  min-width: 8rem;
}

.count,
.hint {
  margin: 0;
  color: var(--ink-2);
  text-align: center;
}

.hint {
  font-size: var(--text-sm);
  color: var(--ink-3);
}
</style>
