<script setup lang="ts">
import { formatClock, type TimerMode, useAmbientTimer } from '~/composables/ambient-studio/useAmbientTimer'
import { useAmbientSettings } from '~/composables/ambient-studio/useAmbientSettings'

// Focus rounds with breaks, a plain countdown, or a sleep timer that fades the sound out.
const timer = useAmbientTimer()
const { settings } = useAmbientSettings()
const { play } = useSound()
const t = timer.state

const MODES: { value: TimerMode, label: string }[] = [
  { value: 'focus', label: 'Focus' },
  { value: 'countdown', label: 'Countdown' },
  { value: 'sleep', label: 'Sleep' }
]

const phaseLabel = computed(() => {
  if (t.mode === 'sleep') return 'Sleep timer'
  if (t.mode === 'countdown') return 'Countdown'
  if (t.phase === 'focus') return `Focus · round ${t.round} of ${settings.value.timer.rounds}`
  return t.phase === 'short' ? 'Short break' : 'Long break'
})

const progress = computed(() => (t.total ? 1 - t.remaining / t.total : 0))
const R = 52
const C = 2 * Math.PI * R

const quick = computed(() => (t.mode === 'sleep' ? [15, 30, 45, 60, 90] : [10, 20, 30, 45, 60]))
const selected = computed(() => (t.mode === 'sleep' ? settings.value.timer.sleep : t.countdownMinutes))

function pick(minutes: number) {
  if (t.mode === 'sleep') {
    settings.value.timer.sleep = minutes
    timer.reset()
  } else {
    timer.setCountdown(minutes)
  }
  play('select')
}

function onMode(mode: TimerMode) {
  timer.setMode(mode)
  play('select')
}

function onStart() {
  timer.toggle()
  play(t.running ? 'toggle-on' : 'toggle-off')
}

const custom = ref<number | ''>('')
function applyCustom() {
  const n = Number(custom.value)
  if (!Number.isFinite(n) || n < 1) return
  pick(Math.min(600, Math.round(n)))
  custom.value = ''
}
</script>

<template>
  <section class="ambient-studio-timer" aria-labelledby="ambient-studio-timer-title">
    <h3 id="ambient-studio-timer-title" class="sr-only">Timer</h3>
    <div class="modes" role="group" aria-label="Timer type">
      <button v-for="m in MODES" :key="m.value" type="button" :aria-pressed="t.mode === m.value" @click="onMode(m.value)">
        <AmbientStudioIcon :name="m.value === 'sleep' ? 'moon' : 'clock'" /> {{ m.label }}
      </button>
    </div>

    <div class="dial">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" :r="R" class="track" />
        <circle cx="60" cy="60" :r="R" class="fill" :stroke-dasharray="C" :stroke-dashoffset="C * (1 - progress)" />
      </svg>
      <div class="readout">
        <span class="phase">{{ phaseLabel }}</span>
        <span class="clock" role="timer" :aria-label="`${formatClock(t.remaining)} left`">{{ formatClock(t.remaining) }}</span>
      </div>
    </div>

    <div class="buttons">
      <button type="button" class="btn" @click="onStart">
        <AmbientStudioIcon :name="t.running ? 'pause' : 'play'" />
        {{ t.running ? 'Pause' : t.remaining < t.total ? 'Resume' : 'Start' }}
      </button>
      <button type="button" class="btn btn-quiet" :disabled="t.remaining === t.total && !t.running" @click="timer.reset()">
        <AmbientStudioIcon name="reset" /> Reset
      </button>
      <button v-if="t.mode === 'focus'" type="button" class="btn btn-quiet" @click="timer.nextPhase(t.running)">
        Skip <AmbientStudioIcon name="next" />
      </button>
    </div>

    <div v-if="t.mode !== 'focus'" class="lengths">
      <div class="chips" role="group" :aria-label="t.mode === 'sleep' ? 'Sleep after' : 'Count down from'">
        <button v-for="n in quick" :key="n" type="button" class="chip" :aria-pressed="selected === n" @click="pick(n)">{{ n }} min</button>
      </div>
      <form class="custom" @submit.prevent="applyCustom">
        <label class="sr-only" for="ambient-studio-minutes">Minutes</label>
        <input id="ambient-studio-minutes" v-model="custom" class="input" type="number" min="1" max="600" inputmode="numeric" placeholder="Other: minutes">
        <button type="submit" class="btn btn-sm btn-quiet" :disabled="!custom">Set</button>
      </form>
    </div>

    <p class="note">
      <template v-if="t.mode === 'focus'">
        {{ settings.timer.focus }} minutes of focus, then a {{ settings.timer.shortBreak }}-minute break; a {{ settings.timer.longBreak }}-minute break every {{ settings.timer.rounds }} rounds. Change these in Settings.
      </template>
      <template v-else-if="settings.stopAtEnd">
        When it ends, the mixer {{ settings.fadeOut ? 'fades out' : 'stops' }} and the video pauses. This only works while this page stays open.
      </template>
      <template v-else>
        When it ends you’ll get a chime; the sound keeps playing. Turn on “Stop the sound” in Settings to stop it.
      </template>
    </p>
  </section>
</template>

<style scoped>
.ambient-studio-timer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.modes {
  display: flex;
  width: 100%;
  padding: 3px;
  background: rgb(255 255 255 / 0.04);
  border: 1px solid var(--as-line);
  border-radius: 12px;
}

.modes button {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 2.25rem;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--as-ink-3);
  background: none;
  border: 0;
  border-radius: 9px;
  cursor: pointer;
  transition: color var(--dur-fast), background-color var(--dur-fast);
}

.modes button[aria-pressed='true'] {
  color: var(--as-ink);
  background: rgb(255 255 255 / 0.09);
}

.dial {
  position: relative;
  width: min(13rem, 70%);
  aspect-ratio: 1;
}

.dial svg {
  width: 100%;
  height: 100%;
  rotate: -90deg;
}

.track,
.fill {
  fill: none;
  stroke-width: 5;
}

.track {
  stroke: rgb(255 255 255 / 0.07);
}

.fill {
  stroke: var(--tint);
  stroke-linecap: round;
  transition: stroke-dashoffset 0.3s linear;
}

.readout {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  text-align: center;
}

.phase {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--as-ink-3);
}

.clock {
  font-size: clamp(2rem, 5vw, 2.6rem);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  color: var(--as-ink);
}

.buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
}

.btn {
  --accent: var(--tint);
  --accent-btn: var(--tint);
  --on-accent: #0b0d12;
}

.btn-quiet {
  color: var(--as-ink);
  background: rgb(255 255 255 / 0.05);
  box-shadow: inset 0 0 0 1px var(--as-line);
}

.btn-quiet:hover:not(:disabled) {
  background: rgb(255 255 255 / 0.1);
}

.lengths {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.35rem;
}

.chip {
  min-height: 2rem;
  padding: 0 0.75rem;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--as-ink-2);
  background: none;
  border: 1px solid var(--as-line);
  border-radius: 999px;
  cursor: pointer;
}

.chip[aria-pressed='true'] {
  color: #0b0d12;
  background: var(--tint);
  border-color: var(--tint);
}

.custom {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.4rem;
}

.custom .input {
  min-height: 2.25rem;
  padding: 0.4rem 0.75rem;
  font-size: 0.875rem;
}

.note {
  margin: 0;
  font-size: 0.8rem;
  text-align: center;
  color: var(--as-ink-3);
}

@media (prefers-reduced-motion: reduce) {
  .fill {
    transition: none;
  }
}
</style>
