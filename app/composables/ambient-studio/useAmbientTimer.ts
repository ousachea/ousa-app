import { useAmbientStorage } from './useAmbientStorage'

// One timer for the studio: focus rounds with breaks (Pomodoro), a plain countdown, or a sleep timer.
// It counts down to a fixed end time, so a throttled background tab still ends on time.

export type TimerMode = 'focus' | 'countdown' | 'sleep'
export type FocusPhase = 'focus' | 'short' | 'long'

export interface TimerEnd {
  mode: TimerMode
  phase: FocusPhase
}

const state = reactive({
  mode: 'focus' as TimerMode,
  phase: 'focus' as FocusPhase,
  /** Which focus round this is, from 1 */
  round: 1,
  running: false,
  /** Seconds left, and the length it started at */
  remaining: 25 * 60,
  total: 25 * 60,
  /** The custom countdown's length in minutes */
  countdownMinutes: 20
})

let endsAt = 0
let interval: number | undefined
const listeners = new Set<(end: TimerEnd) => void>()

function minutesFor(mode: TimerMode, phase: FocusPhase) {
  const { store } = useAmbientStorage()
  const t = store.settings.timer
  if (mode === 'sleep') return t.sleep
  if (mode === 'countdown') return state.countdownMinutes
  return phase === 'focus' ? t.focus : phase === 'short' ? t.shortBreak : t.longBreak
}

function stopTicking() {
  window.clearInterval(interval)
  interval = undefined
}

function tick() {
  const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
  state.remaining = left
  if (left > 0) return
  stopTicking()
  state.running = false
  const end: TimerEnd = { mode: state.mode, phase: state.phase }
  for (const fn of listeners) fn(end)
}

function setLength(minutes: number) {
  state.total = Math.round(minutes * 60)
  state.remaining = state.total
}

export function useAmbientTimer() {
  function start() {
    if (state.running || import.meta.server) return
    if (state.remaining <= 0) setLength(minutesFor(state.mode, state.phase))
    endsAt = Date.now() + state.remaining * 1000
    state.running = true
    stopTicking()
    interval = window.setInterval(tick, 250)
  }

  function pause() {
    if (!state.running) return
    tick()
    stopTicking()
    state.running = false
  }

  /** Back to the start of this mode's current phase */
  function reset() {
    pause()
    setLength(minutesFor(state.mode, state.phase))
  }

  function setMode(mode: TimerMode) {
    pause()
    state.mode = mode
    state.phase = 'focus'
    state.round = 1
    setLength(minutesFor(mode, 'focus'))
  }

  function setCountdown(minutes: number) {
    state.countdownMinutes = Math.min(600, Math.max(1, Math.round(minutes)))
    if (state.mode === 'countdown') {
      pause()
      setLength(state.countdownMinutes)
    }
  }

  /** Focus mode: move on to the break (or the next round); `autostart` keeps it running */
  function nextPhase(autostart = false) {
    if (state.mode !== 'focus') return
    pause()
    const { store } = useAmbientStorage()
    if (state.phase === 'focus') {
      state.phase = state.round % store.settings.timer.rounds === 0 ? 'long' : 'short'
    } else {
      state.phase = 'focus'
      state.round++
    }
    setLength(minutesFor('focus', state.phase))
    if (autostart) start()
  }

  /** Get told when a timer runs out; stops listening when the calling component unmounts */
  function onEnd(fn: (end: TimerEnd) => void) {
    listeners.add(fn)
    if (getCurrentInstance()) onBeforeUnmount(() => listeners.delete(fn))
    return () => listeners.delete(fn)
  }

  /** Leaving the studio: stop counting and start over next time */
  function dispose() {
    stopTicking()
    state.running = false
    setLength(minutesFor(state.mode, state.phase))
  }

  /** Pick up new default lengths from settings while the timer is stopped and untouched */
  function refresh() {
    if (!state.running && state.remaining === state.total) setLength(minutesFor(state.mode, state.phase))
  }

  return { state: readonly(state), start, pause, toggle: () => (state.running ? pause() : start()), reset, setMode, setCountdown, nextPhase, onEnd, dispose, refresh }
}

export function formatClock(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const mm = String(m).padStart(h ? 2 : 1, '0')
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}
