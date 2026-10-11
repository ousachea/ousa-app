import type { AmbientLayerId } from '~/types/ambient-studio'

// Ambient Studio's sound layers, made in the browser with the Web Audio API: shaped noise,
// filters, slow wobbles and a few scheduled one-shots (thunder rolls, bird chirps). There are no
// recordings to license or download, and every layer works offline.

export interface Voice {
  /** The layer's own volume; the mixer sets its gain */
  output: GainNode
  stop(): void
}

const SECONDS = 8
const cache = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>()

function buffer(ctx: BaseAudioContext, key: string, fill: (data: Float32Array, rate: number) => void) {
  let byKey = cache.get(ctx)
  if (!byKey) cache.set(ctx, (byKey = new Map()))
  let buf = byKey.get(key)
  if (!buf) {
    buf = ctx.createBuffer(2, ctx.sampleRate * SECONDS, ctx.sampleRate)
    // Each ear gets its own noise, so layers sound wide instead of coming from the middle
    for (let ch = 0; ch < 2; ch++) fill(buf.getChannelData(ch), ctx.sampleRate)
    byKey.set(key, buf)
  }
  return buf
}

// ---------- Noise colours ----------

const fillWhite = (d: Float32Array) => {
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
}

// Paul Kellet's pink filter: equal energy per octave
const fillPink = (d: Float32Array) => {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + w * 0.0555179
    b1 = 0.99332 * b1 + w * 0.0750759
    b2 = 0.969 * b2 + w * 0.153852
    b3 = 0.8665 * b3 + w * 0.3104856
    b4 = 0.55 * b4 + w * 0.5329522
    b5 = -0.7616 * b5 - w * 0.016898
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
    b6 = w * 0.115926
  }
}

// Brown (red) noise: a random walk that leans back to the middle
const fillBrown = (d: Float32Array) => {
  let last = 0
  for (let i = 0; i < d.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
    d[i] = last * 3.5
  }
}

// Sparse clicks that die away fast: raindrops (soft, many) or fire crackles (sharp, bursty)
function fillClicks(perSecond: number, decayMs: [number, number], bursty: boolean) {
  return (d: Float32Array, rate: number) => {
    d.fill(0)
    let t = 0
    while (t < d.length) {
      t += Math.floor((-Math.log(1 - Math.random()) / perSecond) * rate * (bursty && Math.random() < 0.3 ? 0.15 : 1))
      const amp = 0.2 + Math.random() * 0.8
      const decay = (decayMs[0] + Math.random() * (decayMs[1] - decayMs[0])) / 1000 * rate
      const len = Math.min(Math.floor(decay * 6), d.length - t)
      for (let i = 0; i < len; i++) d[t + i]! += (Math.random() * 2 - 1) * amp * Math.exp(-i / decay)
    }
  }
}

function loop(ctx: AudioContext, buf: AudioBuffer) {
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.loop = true
  // Start each layer somewhere different in its loop so two layers never line up
  src.start(0, Math.random() * SECONDS)
  return src
}

function filter(ctx: AudioContext, type: BiquadFilterType, frequency: number, Q = 0.7) {
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = frequency
  f.Q.value = Q
  return f
}

function gain(ctx: AudioContext, value: number) {
  const g = ctx.createGain()
  g.gain.value = value
  return g
}

/** A slow sine that nudges `param` up and down by `depth` */
function wobble(ctx: AudioContext, param: AudioParam, hz: number, depth: number) {
  const osc = ctx.createOscillator()
  osc.frequency.value = hz
  const amount = gain(ctx, depth)
  osc.connect(amount).connect(param)
  osc.start(ctx.currentTime + Math.random() * 2)
  return osc
}

/** Build one sound layer, already playing; the mixer fades its `output` in */
export function createVoice(ctx: AudioContext, id: AmbientLayerId): Voice {
  const output = gain(ctx, 0)
  const sources: AudioScheduledSourceNode[] = []
  const timers: number[] = []
  const white = () => buffer(ctx, 'white', fillWhite)
  const pink = () => buffer(ctx, 'pink', fillPink)
  const brown = () => buffer(ctx, 'brown', fillBrown)
  const play = (buf: AudioBuffer, ...chain: AudioNode[]) => {
    const src = loop(ctx, buf)
    sources.push(src)
    let node: AudioNode = src
    for (const n of chain) node = node.connect(n)
    node.connect(output)
    return src
  }
  // Repeat `fn` at a random gap between min and max seconds, until the voice stops
  const every = (min: number, max: number, fn: () => void) => {
    const slot = timers.length
    const next = () => {
      timers[slot] = window.setTimeout(() => {
        fn()
        next()
      }, (min + Math.random() * (max - min)) * 1000)
    }
    next()
  }

  switch (id) {
    case 'white':
      play(white(), gain(ctx, 0.22))
      break
    case 'pink':
      play(pink(), gain(ctx, 0.55))
      break
    case 'brown':
      play(brown(), gain(ctx, 0.9))
      break

    case 'rain': {
      // A bed of filtered hiss with soft drops on top, swelling slightly now and then
      const bed = gain(ctx, 0.35)
      play(pink(), filter(ctx, 'highpass', 450), filter(ctx, 'lowpass', 7000), bed)
      sources.push(wobble(ctx, bed.gain, 0.06, 0.08))
      play(buffer(ctx, 'drops', fillClicks(90, [1, 4], false)), filter(ctx, 'bandpass', 2600, 0.6), gain(ctx, 0.5))
      break
    }

    case 'fire': {
      play(brown(), filter(ctx, 'lowpass', 380), gain(ctx, 0.55))
      play(buffer(ctx, 'crackle', fillClicks(9, [0.4, 3], true)), filter(ctx, 'highpass', 900), gain(ctx, 0.9))
      play(buffer(ctx, 'hiss', fillClicks(40, [0.2, 1], false)), filter(ctx, 'highpass', 3000), gain(ctx, 0.12))
      break
    }

    case 'ocean': {
      // Two slow, out-of-step swells, so the waves never fall into an exact rhythm
      const swell = gain(ctx, 0.45)
      play(brown(), filter(ctx, 'lowpass', 650), swell)
      sources.push(wobble(ctx, swell.gain, 0.071, 0.3), wobble(ctx, swell.gain, 0.113, 0.15))
      const wash = gain(ctx, 0.08)
      play(pink(), filter(ctx, 'bandpass', 1400, 0.5), wash)
      sources.push(wobble(ctx, wash.gain, 0.071, 0.07))
      break
    }

    case 'wind': {
      const band = filter(ctx, 'bandpass', 520, 0.9)
      const level = gain(ctx, 0.6)
      play(pink(), band, level)
      sources.push(wobble(ctx, band.frequency, 0.047, 260), wobble(ctx, level.gain, 0.083, 0.35))
      break
    }

    case 'fan': {
      play(pink(), filter(ctx, 'lowpass', 1100), gain(ctx, 0.45))
      play(brown(), filter(ctx, 'lowpass', 220), gain(ctx, 0.5))
      const hum = ctx.createOscillator()
      hum.frequency.value = 98
      hum.connect(gain(ctx, 0.012)).connect(output)
      hum.start()
      sources.push(hum)
      break
    }

    case 'thunder': {
      // A low roll every 12–40 seconds, each one a different length and loudness
      const low = filter(ctx, 'lowpass', 170)
      low.connect(output)
      every(12, 40, () => {
        const src = ctx.createBufferSource()
        src.buffer = brown()
        src.playbackRate.value = 0.6 + Math.random() * 0.5
        const env = gain(ctx, 0)
        const t = ctx.currentTime
        const peak = 0.6 + Math.random() * 0.8
        const length = 4 + Math.random() * 5
        env.gain.setValueAtTime(0, t)
        env.gain.linearRampToValueAtTime(peak, t + 0.25 + Math.random() * 0.6)
        env.gain.setTargetAtTime(peak * 0.5, t + 1.2, 0.4)
        env.gain.setTargetAtTime(0, t + 2, length / 4)
        src.connect(env).connect(low)
        src.start(t, Math.random() * 4)
        src.stop(t + length + 2)
      })
      break
    }

    case 'birds': {
      // Short phrases of chirps from different spots in the trees
      every(1.5, 6, () => {
        const pan = ctx.createStereoPanner()
        pan.pan.value = Math.random() * 1.6 - 0.8
        pan.connect(output)
        const base = 2400 + Math.random() * 2200
        const notes = 2 + Math.floor(Math.random() * 5)
        let t = ctx.currentTime + 0.05
        for (let i = 0; i < notes; i++) {
          const dur = 0.05 + Math.random() * 0.1
          const osc = ctx.createOscillator()
          const from = base * (0.85 + Math.random() * 0.3)
          osc.frequency.setValueAtTime(from, t)
          osc.frequency.exponentialRampToValueAtTime(from * (Math.random() < 0.5 ? 1.35 : 0.75), t + dur)
          const env = gain(ctx, 0)
          env.gain.setValueAtTime(0, t)
          env.gain.linearRampToValueAtTime(0.09, t + 0.012)
          env.gain.exponentialRampToValueAtTime(0.0001, t + dur)
          osc.connect(env).connect(pan)
          osc.start(t)
          osc.stop(t + dur + 0.02)
          t += dur + 0.03 + Math.random() * 0.12
        }
      })
      break
    }
  }

  return {
    output,
    stop() {
      for (const t of timers) window.clearTimeout(t)
      timers.length = 0
      for (const s of sources) {
        try {
          s.stop()
        } catch {}
      }
      output.disconnect()
    }
  }
}

export const audioSupported = () => typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window)
