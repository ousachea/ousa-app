// "Lite effects" keeps the app smooth on old or slow computers: no blur, no idle cube animation,
// simpler page and toast transitions. The no-flash script in nuxt.config.ts sets
// <html data-effects> before first paint from the same storage keys used here.
const PREF_KEY = 'ousa-app:effects' // 'auto' | 'full' | 'lite'
const DETECTED_KEY = 'ousa-app:effects-detected' // what auto found last time: 'slow' | 'fast'

export type EffectsPreference = 'auto' | 'full' | 'lite'

const state = reactive({
  preference: 'auto' as EffectsPreference,
  slowDevice: false
})

let started = false

function read(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {}
}

const resolved = computed(() => state.preference === 'lite' || (state.preference === 'auto' && state.slowDevice) ? 'lite' : 'full')

function apply() {
  document.documentElement.dataset.effects = resolved.value
}

// Old computers give themselves away: few cores, little memory, or simply dropped frames.
// The frame check runs once, a moment after load, and the verdict is remembered.
function probe() {
  const nav = navigator as Navigator & { deviceMemory?: number, connection?: { saveData?: boolean } }
  if ((nav.hardwareConcurrency ?? 8) <= 2 || (nav.deviceMemory ?? 8) <= 2 || nav.connection?.saveData) {
    state.slowDevice = true
    write(DETECTED_KEY, 'slow')
    apply()
    return
  }
  if (read(DETECTED_KEY)) return

  const frames: number[] = []
  let last = 0
  const tick = (now: number) => {
    if (last) frames.push(now - last)
    last = now
    if (frames.length < 90) return requestAnimationFrame(tick)
    if (document.visibilityState !== 'visible') return // a background tab says nothing about speed
    frames.sort((a, b) => a - b)
    const median = frames[Math.floor(frames.length / 2)]!
    const slow = frames.filter(f => f > 50).length
    // Under ~40 fps most of the time, or lots of visible hitches
    state.slowDevice = median > 25 || slow > 9
    write(DETECTED_KEY, state.slowDevice ? 'slow' : 'fast')
    apply()
  }
  setTimeout(() => requestAnimationFrame(tick), 1500)
}

function start() {
  if (started || import.meta.server) return
  started = true
  const saved = read(PREF_KEY)
  if (saved === 'auto' || saved === 'full' || saved === 'lite') state.preference = saved
  state.slowDevice = read(DETECTED_KEY) === 'slow'
  apply()
  probe()
}

export function useEffects() {
  start()

  function setEffects(preference: EffectsPreference) {
    state.preference = preference
    write(PREF_KEY, preference)
    apply()
  }

  return {
    effects: readonly(state),
    lite: computed(() => import.meta.client && resolved.value === 'lite'),
    setEffects
  }
}
