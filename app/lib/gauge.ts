// Gauge primitives' shared code: geometry, the value spring, and the context a <Gauge> hands its parts.
// A Vue port of Gauge UI by Thordur (https://gauge-ui.dev, registry item "gauge"), which is React: the root,
// track, arc, zones, stacks, ticks, tick fills, marks, tick labels, needle (line, pointer, compass, arrow),
// hub, dot, tooltip, value, text, insets and drag control, with spring or tween animation, ranges, wrapped
// domains and a turning scale. Written here from Gauge UI's documented behaviour, not copied from its code.
// Kept out of utils/ on purpose: Nuxt auto-imports utils, and names like clamp and polar are taken there.
import { computed, inject, onBeforeUnmount, onMounted, ref, watch, type ComputedRef, type InjectionKey } from 'vue'

/* ---------- Geometry ----------
   Angles are "gauge degrees": 0 points straight down (six o'clock) and values increase clockwise, so a
   sweep from 40° to 320° leaves an opening at the bottom. Coordinates are SVG units centred on the gauge. */

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const round = (n: number) => Math.round(n * 1000) / 1000
const fmt = (n: number) => Number(n.toFixed(3)).toString()

/** Point on a circle of `radius` at a gauge angle, rounded so server and client render the same */
export function polar(radius: number, angle: number) {
  const theta = ((angle + 90) * Math.PI) / 180
  return { x: round(radius * Math.cos(theta)), y: round(radius * Math.sin(theta)) }
}

/** Linear map of a value in [min, max] onto the arc [startAngle, endAngle] */
export function valueToAngle(value: number, min: number, max: number, startAngle: number, endAngle: number) {
  const span = max - min
  const t = span === 0 ? 0 : (clamp(value, min, max) - min) / span
  return startAngle + t * (endAngle - startAngle)
}

/** SVG path for an arc from `from` to `to` gauge degrees; sweeps over 180° are split so a full circle works */
export function arcPath(radius: number, from: number, to: number) {
  const sweep = Math.min(to - from, 360)
  if (sweep <= 0 || radius <= 0) return ''
  const pieces = Math.max(1, Math.ceil(sweep / 180))
  const step = sweep / pieces
  const start = polar(radius, from)
  const parts = [`M ${fmt(start.x)} ${fmt(start.y)}`]
  for (let i = 1; i <= pieces; i++) {
    const p = polar(radius, from + step * i)
    parts.push(`A ${fmt(radius)} ${fmt(radius)} 0 0 1 ${fmt(p.x)} ${fmt(p.y)}`)
  }
  return parts.join(' ')
}

/** Tight box around an arc's sweep (and its centre, for a needle's hub), grown by `padding` */
export function arcBox(radius: number, from: number, to: number, padding = 0) {
  const sweep = clamp(to - from, 0, 360)
  const end = from + sweep
  const points = [{ x: 0, y: 0 }, polar(radius, from), polar(radius, end)]
  for (let a = Math.ceil(from / 90) * 90; a <= end; a += 90) points.push(polar(radius, a))
  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  const x = round(Math.min(...xs) - padding)
  const y = round(Math.min(...ys) - padding)
  return { x, y, width: round(Math.max(...xs) + padding - x), height: round(Math.max(...ys) + padding - y) }
}

/** The gauge angle of a point (SVG units from the centre): the inverse of polar */
export function angleOfPoint(x: number, y: number) {
  return (Math.atan2(y, x) * 180) / Math.PI - 90
}

/** `value` brought into [lo, lo + span), for domains that wrap round (a compass, a 24-hour clock) */
export const wrapInto = (value: number, lo: number, span: number) => (span > 0 ? lo + ((((value - lo) % span) + span) % span) : lo)

/** Evenly spaced values across the domain, both ends included */
export function stepValues(min: number, max: number, intervals: number) {
  const n = Math.max(1, Math.round(intervals))
  return Array.from({ length: n + 1 }, (_, i) => min + ((max - min) * i) / n)
}

/* ---------- Zones ---------- */

export interface Zone {
  /** Upper cutoff in domain units; ignored for the last zone, which runs to max */
  to: number
  color: string
}

/** Colour of the zone a value falls in, or `fallback` with no zones */
export function zoneColor(zones: Zone[], value: number, fallback: string) {
  if (!zones.length) return fallback
  for (let i = 0; i < zones.length - 1; i++) if (value < zones[i]!.to) return zones[i]!.color
  return zones.at(-1)!.color
}

export type FontFamily = 'sans' | 'rounded' | 'mono'
export type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold'
export type StrokeCap = 'round' | 'butt'
/** One colour for every mark, or one per mark from its value */
export type ValueColor = string | ((value: number) => string)

export const FONT: Record<FontFamily, string> = {
  sans: 'inherit',
  rounded: 'ui-rounded, inherit',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace'
}
export const WEIGHT: Record<FontWeight, number> = { regular: 400, medium: 500, semibold: 600, bold: 700 }

/* ---------- Animation: a damped spring or a cubic-bezier tween ---------- */

export type GaugeEasing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | [number, number, number, number] | ((t: number) => number)
export interface GaugeSpringTransition {
  type: 'spring'
  stiffness?: number
  damping?: number
  mass?: number
  /** Seconds the spring visibly takes to arrive. Default 0.5 */
  visualDuration?: number
  /** 0 settles without overshoot, 1 rings freely. Default 0.1 */
  bounce?: number
}
export interface GaugeTweenTransition {
  type: 'tween'
  /** Seconds. Default 0.5 */
  duration?: number
  ease?: GaugeEasing
}
export type GaugeTransition = GaugeSpringTransition | GaugeTweenTransition

export const DEFAULT_TRANSITION: GaugeSpringTransition = { type: 'spring', visualDuration: 0.5, bounce: 0.1 }

const resolveTransition = (t: GaugeTransition | boolean | undefined): GaugeTransition | null =>
  !t ? null : t === true ? DEFAULT_TRANSITION : t

interface SpringPhysics { stiffness: number, damping: number, mass: number }

// The perceptual pair maps onto stiffness and damping the way the motion library does
function springPhysics(t: GaugeSpringTransition): SpringPhysics {
  if (t.stiffness !== undefined || t.damping !== undefined || t.mass !== undefined) {
    return { stiffness: t.stiffness ?? 100, damping: t.damping ?? 10, mass: t.mass ?? 1 }
  }
  const root = (2 * Math.PI) / ((t.visualDuration ?? 0.5) * 1.2)
  const stiffness = root * root
  const ratio = clamp(1 - (t.bounce ?? 0.1), 0.05, 1)
  return { stiffness, damping: 2 * ratio * Math.sqrt(stiffness), mass: 1 }
}

// Semi-implicit Euler in small steps, which stays stable for stiff springs
function stepSpring(state: { value: number, velocity: number }, target: number, p: SpringPhysics, dt: number, precision: number) {
  let { value, velocity } = state
  let remaining = Math.min(dt, 0.064)
  while (remaining > 0) {
    const h = Math.min(1 / 240, remaining)
    velocity += ((-p.stiffness * (value - target) - p.damping * velocity) / p.mass) * h
    value += velocity * h
    remaining -= h
  }
  const done = Math.abs(value - target) < precision && Math.abs(velocity) < precision * 10
  return done ? { state: { value: target, velocity: 0 }, done } : { state: { value, velocity }, done }
}

const CURVES = { linear: [0, 0, 1, 1], easeIn: [0.42, 0, 1, 1], easeOut: [0, 0, 0.58, 1], easeInOut: [0.42, 0, 0.58, 1] } as const

function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const bezier = (t: number, a: number, b: number) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3
  const slope = (t: number, a: number, b: number) => 3 * (1 - t) ** 2 * a + 6 * (1 - t) * t * (b - a) + 3 * t * t * (1 - b)
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 8; i++) {
      const dx = bezier(t, x1, x2) - x
      const d = slope(t, x1, x2)
      if (Math.abs(dx) < 1e-6) return bezier(t, y1, y2)
      if (Math.abs(d) < 1e-6) break
      t -= dx / d
    }
    let lo = 0
    let hi = 1
    t = x
    while (hi - lo > 1e-6) {
      if (bezier(t, x1, x2) < x) lo = t
      else hi = t
      t = (lo + hi) / 2
    }
    return bezier(t, y1, y2)
  }
}

function easing(ease: GaugeEasing = 'easeInOut') {
  if (typeof ease === 'function') return ease
  const [a, b, c, d] = Array.isArray(ease) ? ease : CURVES[ease]
  return cubicBezier(a, b, c, d)
}

/**
 * Follows `target` with the transition and gives the value to draw this frame. With no transition it is
 * `target` itself. `initial` is where it starts on mount, for a sweep in. Snaps for reduced motion.
 */
export function useAnimatedValue(target: () => number, transition: () => GaugeTransition | boolean | undefined, span: () => number, initial?: number) {
  const shown = ref(initial ?? target())
  let state = { value: shown.value, velocity: 0 }
  let frame = 0

  function run() {
    if (import.meta.server) return
    cancelAnimationFrame(frame)
    const config = resolveTransition(transition())
    const goal = target()
    if (!config || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      state = { value: goal, velocity: 0 }
      shown.value = goal
      return
    }
    const precision = Math.max(span(), 1e-6) * 1e-4
    const from = state.value
    const startedAt = performance.now()
    let last = startedAt
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      let done: boolean
      if (config.type === 'spring') {
        const next = stepSpring(state, goal, springPhysics(config), dt, precision)
        state = next.state
        done = next.done
      } else {
        const progress = Math.min((now - startedAt) / 1000 / Math.max(config.duration ?? 0.5, 1e-3), 1)
        state = { value: from + (goal - from) * easing(config.ease)(progress), velocity: 0 }
        done = progress >= 1
      }
      shown.value = state.value
      if (!done) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
  }

  onMounted(run)
  watch([target, () => JSON.stringify(transition())], run)
  onBeforeUnmount(() => import.meta.client && cancelAnimationFrame(frame))
  return shown
}

/* ---------- Context ---------- */

export interface GaugeContext {
  /** Value drawn this frame, clamped to the domain unless a spring overshoots (for a range, its high end) */
  value: number
  /** Where the value is heading */
  target: number
  /** A range's low end this frame; undefined for a single value */
  from?: number
  min: number
  max: number
  /** The arc's ends, turned by the rotation */
  startAngle: number
  endAngle: number
  /** Radius of the reference circle in SVG units; every part places itself against it */
  radius: number
  /** Degrees the whole scale is turned by */
  rotation: number
  /** The domain wraps round: max is the same place as min */
  wrap: boolean
  angleOf: (value: number) => number
}

/** What a <Gauge> (or a <GaugeInset> inside one) takes to set up its scale and value */
export interface GaugeRootProps {
  /** A value, or [from, to] for a range */
  value: number | [number, number]
  min: number
  max: number
  startAngle: number
  endAngle: number
  radius: number
  transition?: GaugeTransition | boolean
  initialValue?: number
  /** A domain that wraps round (compass, 24-hour clock): changes take the short way, through max to min */
  wrap?: boolean
  /** Turn the whole scale by these degrees, or 'value' to turn it so the value sits at rotateTo (a compass card) */
  rotate?: number | 'value'
  /** With rotate="value", the angle the value is turned to. Default 180, the top */
  rotateTo?: number
}

/** The shared root: animates the value (both ends of a range), wraps and turns the scale, and gives the context */
export function useGaugeRoot(props: GaugeRootProps) {
  const lo = computed(() => Math.min(props.min, props.max))
  const hi = computed(() => Math.max(props.min, props.max))
  const span = computed(() => hi.value - lo.value)
  const ends = computed(() => (Array.isArray(props.value) ? [Math.min(...props.value), Math.max(...props.value)] as const : [undefined, props.value] as const))
  const fit = (v: number) => (props.wrap ? wrapInto(v, lo.value, span.value) : clamp(v, lo.value, hi.value))
  const target = computed(() => fit(ends.value[1]))

  // A wrapped value is followed unwrapped, so a change from 350° to 10° turns 20° forward, not 340° back
  const unwrapped = ref(target.value)
  watch(target, (t) => {
    if (!props.wrap) return void (unwrapped.value = t)
    let d = t - wrapInto(unwrapped.value, lo.value, span.value)
    if (d > span.value / 2) d -= span.value
    if (d < -span.value / 2) d += span.value
    unwrapped.value += d
  })
  const goal = computed(() => (props.wrap ? unwrapped.value : target.value))
  const initial = props.initialValue === undefined ? undefined : fit(props.initialValue)
  const shown = useAnimatedValue(() => goal.value, () => props.transition, () => span.value, initial)
  const low = computed(() => (ends.value[0] === undefined ? undefined : clamp(ends.value[0], lo.value, hi.value)))
  const shownLow = useAnimatedValue(() => low.value ?? lo.value, () => props.transition, () => span.value, initial)

  return computed<GaugeContext>(() => {
    const raw = props.transition ? shown.value : goal.value
    const value = props.wrap ? wrapInto(raw, lo.value, span.value) : raw
    const base = (v: number) => valueToAngle(props.wrap ? wrapInto(v, lo.value, span.value) : v, props.min, props.max, props.startAngle, props.endAngle)
    const rotation = props.rotate === 'value' ? (props.rotateTo ?? 180) - base(value) : (props.rotate ?? 0)
    return {
      value,
      target: target.value,
      from: low.value === undefined ? undefined : props.transition ? shownLow.value : low.value,
      min: props.min,
      max: props.max,
      startAngle: props.startAngle + rotation,
      endAngle: props.endAngle + rotation,
      radius: props.radius,
      rotation,
      wrap: !!props.wrap,
      angleOf: (v: number) => base(v) + rotation
    }
  })
}

export const GAUGE: InjectionKey<ComputedRef<GaugeContext>> = Symbol('gauge')

export function useGauge() {
  const gauge = inject(GAUGE)
  if (!gauge) throw new Error('Gauge parts must be inside <Gauge>.')
  return gauge
}
