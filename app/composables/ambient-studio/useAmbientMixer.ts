import type { AmbientLayerId, AmbientLayerMix } from '~/types/ambient-studio'
import { audioSupported, createVoice, type Voice } from '~/utils/ambient-studio/synth'
import { useAmbientStorage } from './useAmbientStorage'

// The sound mixer: one AudioContext for the whole studio, one voice per layer.
// Audio only starts from a tap (browsers require it), and every layer fades in and out.

const state = reactive({
  layers: [] as AmbientLayerMix[],
  /** The scene's own mix, for Reset */
  defaults: [] as AmbientLayerMix[],
  playing: false,
  supported: true,
  error: '',
  /** Seconds left in a fade-out started by a timer, or 0 */
  fading: 0
})

let ctx: AudioContext | undefined
let master: GainNode | undefined
const voices = new Map<AmbientLayerId, Voice>()
let stopTimer: number | undefined

// Sliders feel even when gain follows the square of their position
const curve = (v: number) => v * v
const RAMP = 0.12

function ensureContext() {
  if (ctx) return ctx
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)
  return ctx
}

function masterLevel() {
  const { store } = useAmbientStorage()
  return curve(store.settings.masterVolume)
}

/** Match the playing voices to the layer list: start new ones, retune, stop removed ones */
function sync() {
  if (!ctx || !master || !state.playing) return
  const wanted = new Set(state.layers.map(l => l.id))
  for (const [id, voice] of voices) {
    if (wanted.has(id)) continue
    voice.output.gain.setTargetAtTime(0, ctx.currentTime, RAMP)
    window.setTimeout(() => voice.stop(), 600)
    voices.delete(id)
  }
  for (const layer of state.layers) {
    let voice = voices.get(layer.id)
    if (!voice) {
      voice = createVoice(ctx, layer.id)
      voice.output.connect(master)
      voices.set(layer.id, voice)
    }
    voice.output.gain.setTargetAtTime(layer.muted ? 0 : curve(layer.volume), ctx.currentTime, RAMP)
  }
}

function cancelFade() {
  window.clearTimeout(stopTimer)
  stopTimer = undefined
  state.fading = 0
}

function stopNow() {
  cancelFade()
  state.playing = false
  for (const v of voices.values()) v.stop()
  voices.clear()
  if (master) master.gain.value = 0
  void ctx?.suspend().catch(() => {})
}

export function useAmbientMixer() {
  const { store } = useAmbientStorage()

  /** Check the browser can play generated audio; call once mounted */
  function init() {
    state.supported = audioSupported()
    if (!state.supported) state.error = 'This browser can’t play the mixer’s sounds. YouTube still works.'
    // Master volume lives in settings, so it's remembered; the page's scope stops this watch on unmount
    watch(() => store.settings.masterVolume, () => {
      if (ctx && master && state.playing && !state.fading) master.gain.setTargetAtTime(masterLevel(), ctx.currentTime, RAMP)
    })
  }

  async function start() {
    if (!state.supported) return
    cancelFade()
    try {
      const c = ensureContext()
      await c.resume()
      state.playing = true
      state.error = ''
      master!.gain.cancelScheduledValues(c.currentTime)
      master!.gain.setTargetAtTime(masterLevel(), c.currentTime, 0.3)
      sync()
    } catch {
      state.playing = false
      state.error = 'The browser didn’t let the mixer start. Tap Play again.'
    }
  }

  function stop() {
    if (!ctx || !master || !state.playing) return stopNow()
    cancelFade()
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.12)
    state.playing = false
    stopTimer = window.setTimeout(stopNow, 500)
  }

  /** Fade every layer out over `seconds`, then stop (timers use this) */
  function fadeOut(seconds: number) {
    if (!ctx || !master || !state.playing) return
    cancelFade()
    const t = ctx.currentTime
    master.gain.cancelScheduledValues(t)
    master.gain.setValueAtTime(master.gain.value, t)
    master.gain.linearRampToValueAtTime(0.0001, t + seconds)
    state.fading = seconds
    stopTimer = window.setTimeout(stopNow, seconds * 1000 + 100)
  }

  const toggle = () => (state.playing ? stop() : start())

  /** Load a scene's layers; keeps playing if it already was */
  function setMix(layers: AmbientLayerMix[]) {
    state.defaults = layers.map(l => ({ ...l }))
    state.layers = layers.map(l => ({ muted: false, ...l }))
    sync()
  }

  function setVolume(id: AmbientLayerId, volume: number) {
    const layer = state.layers.find(l => l.id === id)
    if (!layer) return
    layer.volume = Math.min(1, Math.max(0, volume))
    if (layer.volume > 0) layer.muted = false
    sync()
  }

  function toggleMute(id: AmbientLayerId) {
    const layer = state.layers.find(l => l.id === id)
    if (!layer) return
    layer.muted = !layer.muted
    sync()
  }

  function add(id: AmbientLayerId) {
    if (state.layers.some(l => l.id === id)) return
    state.layers.push({ id, volume: 0.4, muted: false })
    sync()
  }

  function remove(id: AmbientLayerId) {
    state.layers = state.layers.filter(l => l.id !== id)
    sync()
  }

  function reset() {
    state.layers = state.defaults.map(l => ({ muted: false, ...l }))
    sync()
  }

  /** Leaving the studio: stop and let the browser free the audio device */
  function dispose() {
    stopNow()
    void ctx?.close().catch(() => {})
    ctx = undefined
    master = undefined
  }

  return {
    state: readonly(state),
    init,
    start,
    stop,
    toggle,
    fadeOut,
    cancelFade,
    setMix,
    setVolume,
    toggleMute,
    add,
    remove,
    reset,
    dispose,
    /** The layers as they are now, for saving a mix */
    snapshot: () => state.layers.map(l => ({ ...l }))
  }
}
