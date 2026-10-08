<script setup lang="ts">
import type { ToolIconName } from '~/utils/tools'

type Vec3 = [number, number, number]
type Mat3 = [Vec3, Vec3, Vec3]
type Face = 'front' | 'back' | 'right' | 'left' | 'top' | 'bottom'

interface CubeLink {
  to: string
  name: string
  icon: ToolIconName
  color?: string
  onColor?: string
}

interface Cubie {
  pos: Vec3
  rot: Mat3
  stickers: Partial<Record<Face, string>>
  // App links printed on some stickers; they travel with the piece when the cube turns
  links: Partial<Record<Face, CubeLink>>
}

interface Move {
  axis: 0 | 1 | 2
  layer: -1 | 0 | 1
  dir: 1 | -1
}

const props = withDefaults(defineProps<{
  size?: number
  moveDuration?: number
  /** Turn the whole cube to face the mouse pointer */
  followPointer?: boolean
  /** Click (or Enter/Space) to shuffle; every click adds more turns */
  interactive?: boolean
  /** Up to 16 links shown as icons on the stickers of the top, front and right faces */
  links?: CubeLink[]
  /** Paint icon stickers in each app's own colour instead of the classic cube colours */
  appColors?: boolean
  scrambleLength?: number
}>(), {
  size: 64,
  moveDuration: 380,
  scrambleLength: 18,
  followPointer: false,
  interactive: false,
  links: () => [],
  appColors: false
})

// CSS uses a y-down coordinate system: -y is the top face.
const COLORS: Record<Face, string> = {
  front: '#00b04f',
  back: '#0a5bd8',
  right: '#e3262f',
  left: '#ff8a00',
  top: '#f5f5f5',
  bottom: '#ffd500'
}
const FACES: Face[] = ['front', 'back', 'right', 'left', 'top', 'bottom']

const IDENTITY: Mat3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]

function rotation(axis: number, angle: number): Mat3 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  if (axis === 0) return [[1, 0, 0], [0, c, -s], [0, s, c]]
  if (axis === 1) return [[c, 0, s], [0, 1, 0], [-s, 0, c]]
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]]
}

function mulMat(a: Mat3, b: Mat3): Mat3 {
  return a.map((row, i) =>
    [0, 1, 2].map(j => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j])
  ) as Mat3
}

function mulVec(a: Mat3, v: Vec3): Vec3 {
  return a.map(row => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]) as Vec3
}

const round = <T extends number[] | number[][]>(m: T): T =>
  JSON.parse(JSON.stringify(m), (_, v) => (typeof v === 'number' ? Math.round(v) : v))

function createCubies(): Cubie[] {
  const cubies: Cubie[] = []
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        const stickers: Cubie['stickers'] = {}
        if (x === 1) stickers.right = COLORS.right
        if (x === -1) stickers.left = COLORS.left
        if (y === -1) stickers.top = COLORS.top
        if (y === 1) stickers.bottom = COLORS.bottom
        if (z === 1) stickers.front = COLORS.front
        if (z === -1) stickers.back = COLORS.back
        cubies.push({ pos: [x, y, z], rot: IDENTITY, stickers, links: {} })
      }
    }
  }

  // Four links per visible face: the centre plus three edges, so they read clearly at rest
  const SLOTS: [Vec3, Face][] = [
    [[0, -1, 0], 'top'], [[0, -1, 1], 'top'], [[1, -1, 0], 'top'], [[-1, -1, 0], 'top'],
    [[0, 0, 1], 'front'], [[-1, 0, 1], 'front'], [[1, 0, 1], 'front'], [[0, 1, 1], 'front'],
    [[1, 0, 0], 'right'], [[1, 1, 0], 'right'], [[1, 0, -1], 'right'], [[1, -1, 0], 'right'],
    [[-1, -1, 1], 'top'], [[-1, 1, 1], 'front'], [[1, 1, -1], 'right'], [[1, -1, 1], 'top']
  ]
  props.links.slice(0, SLOTS.length).forEach((link, i) => {
    const [pos, face] = SLOTS[i]!
    const cubie = cubies.find(c => c.pos.every((v, k) => v === pos[k]))
    if (cubie) cubie.links[face] = link
  })
  return cubies
}

// Dark ink on the light stickers (white, yellow, orange), white on the rest
const LIGHT_STICKERS = new Set([COLORS.top, COLORS.bottom, COLORS.left])
const inkOn = (color?: string) => (color && LIGHT_STICKERS.has(color) ? '#1b1f2a' : '#ffffff')

function faceStyle(cubie: Cubie, face: Face) {
  const color = cubie.stickers[face]
  if (!color) return undefined
  const link = cubie.links[face]
  // App colours: the icon sticker takes its app's colour; plain stickers keep the cube's
  if (props.appColors && link?.color) return { '--c': link.color, '--ink': link.onColor ?? '#ffffff' }
  return { '--c': color, '--ink': inkOn(color) }
}

const cubies = createCubies()

function toMatrix3d(cubie: Cubie, anim: Mat3): string {
  const l = mulMat(anim, cubie.rot)
  const t = mulVec(anim, cubie.pos).map(n => n * props.size)
  return `matrix3d(${l[0][0]},${l[1][0]},${l[2][0]},0,${l[0][1]},${l[1][1]},${l[2][1]},0,${l[0][2]},${l[1][2]},${l[2][2]},0,${t[0]},${t[1]},${t[2]},1)`
}

// Initial pose for the server render; after that each frame writes transforms straight to the
// elements, so a turn never re-renders the 27 pieces and their 162 faces through Vue
const initialTransforms = cubies.map(c => toMatrix3d(c, IDENTITY))
const cubieEls: HTMLElement[] = []

function render(move?: Move, angle = 0) {
  const anim = move ? rotation(move.axis, angle) : IDENTITY
  cubies.forEach((c, i) => {
    // Only the turning layer changes mid-turn; the rest keep their last transform
    if (move && c.pos[move.axis] !== move.layer && angle !== 0) return
    const el = cubieEls[i]
    if (el) el.style.transform = toMatrix3d(c, move && c.pos[move.axis] === move.layer ? anim : IDENTITY)
  })
}

function commit(move: Move) {
  const r = round(rotation(move.axis, move.dir * Math.PI / 2))
  for (const c of cubies) {
    if (c.pos[move.axis] !== move.layer) continue
    c.pos = round(mulVec(r, c.pos))
    c.rot = round(mulMat(r, c.rot))
  }
}

function randomMove(prev?: Move): Move {
  let move: Move
  do {
    move = {
      axis: Math.floor(Math.random() * 3) as Move['axis'],
      layer: (Math.floor(Math.random() * 3) - 1) as Move['layer'],
      dir: Math.random() < 0.5 ? 1 : -1
    }
  } while (prev && prev.axis === move.axis && prev.layer === move.layer)
  return move
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

// ---------- Turn sequencing ----------
// `history` holds every turn applied so far. Solving undoes it in reverse, so any mix of automatic
// and clicked scrambles always returns to a solved cube.

type Step =
  | { kind: 'turn', move: Move, solving: boolean, fast: boolean }
  | { kind: 'pause', ms: number }

const SHUFFLE_TURNS = 6
const FAST_MOVE_MS = 150
const SOLVE_AFTER_MS = 2200 // wait after the last click before solving

const history: Move[] = []
let queue: Step[] = []
let reducedMotion = false

const inverse = (m: Move): Move => ({ ...m, dir: -m.dir as Move['dir'] })

function lastPlannedMove() {
  for (let i = queue.length - 1; i >= 0; i--) {
    const step = queue[i]!
    if (step.kind === 'turn' && !step.solving) return step.move
  }
  return history[history.length - 1]
}

function scrambleSteps(count: number, fast: boolean): Step[] {
  const steps: Step[] = []
  let prev = lastPlannedMove()
  for (let i = 0; i < count; i++) {
    prev = randomMove(prev)
    steps.push({ kind: 'turn', move: prev, solving: false, fast })
  }
  return steps
}

// While the pointer is over the cube it holds still (solved) so the app icons are easy to click
let hold = false
let solveNow = false
let skipPause = false

function onHoverStart() {
  if (!props.links.length || reducedMotion) return
  hold = true
  solveNow = true
  skipPause = true
  // Planned turns aren't applied yet, so they can be dropped; the cube then solves straight away
  queue = queue.filter(step => step.kind === 'turn' && step.fast && !step.solving)
}

function onHoverEnd() {
  hold = false
}

// What to do when nothing is queued: solve if scrambled, otherwise start a slow scramble (or rest while held)
function idleSteps(): Step[] {
  if (history.length) {
    const pause: Step[] = hold && solveNow ? [] : [{ kind: 'pause', ms: SOLVE_AFTER_MS }]
    solveNow = false
    return [
      ...pause,
      ...history.slice().reverse().map(m => ({ kind: 'turn', move: inverse(m), solving: true, fast: hold }) as Step)
    ]
  }
  // Lite effects (old or slow computers): rest solved until clicked instead of scrambling forever
  if (hold || lite.value) return []
  return [{ kind: 'pause', ms: 1200 }, ...scrambleSteps(props.scrambleLength, false)]
}

function shuffle() {
  if (reducedMotion) {
    // No animation: apply the turns instantly
    for (const step of scrambleSteps(SHUFFLE_TURNS, true)) {
      if (step.kind !== 'turn') continue
      commit(step.move)
      history.push(step.move)
    }
    render()
    return
  }
  // Interrupt any pause, solve or slow scramble. Planned turns aren't applied yet, so dropping them is safe;
  // only earlier click bursts are kept so rapid clicks stack up.
  queue = queue.filter(step => step.kind === 'turn' && step.fast)
  queue.push(...scrambleSteps(SHUFFLE_TURNS, true))
}

const { play } = useSound()
const { lite } = useEffects()

function onShuffle() {
  if (!props.interactive) return
  shuffle()
  play('press')
}

let frame = 0
let stopped = false

// ---------- Whole-cube orientation: slow idle spin, or turn to face the pointer ----------

const BASE_TILT = -28 // degrees; shows the top face
const LOOK_X = 32 // how far the cube tilts up/down toward the pointer
const LOOK_Y = 55 // how far it turns left/right toward the pointer
const IDLE_AFTER = 2500 // ms without pointer movement before the idle spin resumes
const HOME_SPIN = -35 // resting angle: top, front and right faces in view

const sceneEl = ref<HTMLElement>()
const cubeEl = ref<HTMLElement>()
let orientFrame = 0

function startOrientation() {
  let rx = BASE_TILT
  let ry = -35
  let spin = -35 // idle spin angle; frozen while the pointer is being followed
  let lookX = 0 // pointer offset from the cube centre, -1..1
  let lookY = 0
  let lastMove = -Infinity

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || !sceneEl.value) return
    const box = sceneEl.value.getBoundingClientRect()
    const clamp = (n: number) => Math.max(-1, Math.min(1, n))
    lookX = clamp((e.clientX - (box.left + box.width / 2)) / (window.innerWidth / 2))
    lookY = clamp((e.clientY - (box.top + box.height / 2)) / (window.innerHeight / 2))
    lastMove = performance.now()
  }

  // Leaving the window counts as going idle straight away
  const onLeave = () => (lastMove = -Infinity)

  if (props.followPointer && !lite.value) {
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
  }

  let prev = performance.now()
  let lastPose = ''
  const tick = (now: number) => {
    if (!visible) {
      prev = now
      orientFrame = requestAnimationFrame(tick)
      return
    }
    // Frame-rate independent smoothing
    const dt = Math.min((now - prev) / 16.67, 4)
    prev = now

    if (hold) {
      // Held for clicking: turn back to the home angle that shows the top, front and right faces
      const home = HOME_SPIN + 360 * Math.round((spin - HOME_SPIN) / 360)
      spin += (home - spin) * (1 - Math.pow(1 - 0.1, dt))
    } else if (now - lastMove > IDLE_AFTER) {
      lookX *= Math.pow(0.97, dt)
      lookY *= Math.pow(0.97, dt)
      if (!lite.value) spin += 0.25 * dt
    }

    const targetX = BASE_TILT - lookY * LOOK_X
    const targetY = spin + lookX * LOOK_Y
    const ease = 1 - Math.pow(1 - 0.08, dt)
    rx += (targetX - rx) * ease
    ry += (targetY - ry) * ease

    const pose = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`
    // Skip the style write once the cube has settled (lite mode, or held at home)
    if (cubeEl.value && pose !== lastPose) cubeEl.value.style.transform = pose
    lastPose = pose
    orientFrame = requestAnimationFrame(tick)
  }
  orientFrame = requestAnimationFrame(tick)

  return () => {
    cancelAnimationFrame(orientFrame)
    window.removeEventListener('pointermove', onPointerMove)
    document.documentElement.removeEventListener('pointerleave', onLeave)
  }
}

let stopOrientation: (() => void) | undefined

// Off screen (scrolled past) nothing animates; the loops just idle until it's back
let visible = true
let observer: IntersectionObserver | undefined

onMounted(() => {
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (sceneEl.value) {
    observer = new IntersectionObserver(([entry]) => (visible = !!entry?.isIntersecting))
    observer.observe(sceneEl.value)
  }
  if (reducedMotion) return
  stopOrientation = startOrientation()

  let current: Step | undefined
  let start = 0

  const tick = (now: number) => {
    if (stopped) return
    if (!visible) {
      // Shift the current step's clock so it resumes where it left off
      start += 16
      frame = requestAnimationFrame(tick)
      return
    }
    // A click may have cleared a pause; drop it so the burst starts right away
    if (current?.kind === 'pause' && queue[0]?.kind === 'turn' && queue[0].fast) current = undefined
    // Hovering ends any pause right away so the cube can settle for clicking
    if (skipPause) {
      if (current?.kind === 'pause') current = undefined
      skipPause = false
    }
    if (!current) {
      if (!queue.length) queue = idleSteps()
      current = queue.shift()
      start = now
    }
    if (!current) {
      // Held and solved: nothing to animate
      frame = requestAnimationFrame(tick)
      return
    }

    const step = current
    const duration = step.kind === 'pause' ? step.ms : step.fast ? FAST_MOVE_MS : props.moveDuration
    const t = Math.min((now - start) / duration, 1)

    if (step.kind === 'turn') {
      if (t < 1) {
        render(step.move, step.move.dir * ease(t) * Math.PI / 2)
      } else {
        commit(step.move)
        if (step.solving) history.pop()
        else history.push(step.move)
        render()
      }
    }
    if (t >= 1) current = undefined
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  stopped = true
  cancelAnimationFrame(frame)
  stopOrientation?.()
})
</script>

<template>
  <div
    ref="sceneEl"
    class="scene"
    :class="{ interactive }"
    :style="{ '--s': `${size}px` }"
    :role="interactive ? 'group' : 'img'"
    :tabindex="interactive ? 0 : undefined"
    :aria-label="interactive ? 'Rubik’s cube of app icons. Press Enter to shuffle it.' : 'Animated Rubik’s cube'"
    :aria-keyshortcuts="interactive ? 'Enter Space' : undefined"
    :title="interactive ? 'Click to shuffle' : undefined"
    @click="onShuffle"
    @pointerenter="onHoverStart"
    @pointerleave="onHoverEnd"
    @keydown.enter.prevent="onShuffle"
    @keydown.space.prevent="onShuffle"
  >
    <div ref="cubeEl" class="cube">
      <div
        v-for="(cubie, i) in cubies"
        :key="i"
        :ref="el => el && (cubieEls[i] = el as HTMLElement)"
        class="cubie"
        :style="{ transform: initialTransforms[i] }"
      >
        <div
          v-for="face in FACES"
          :key="face"
          :class="['face', face, { sticker: cubie.stickers[face] }]"
          :style="faceStyle(cubie, face)"
        >
          <!-- Clicking an icon opens that app; clicking a plain sticker still shuffles. A pointer shortcut
               only: the same apps are proper links in the list below, so these stay out of the
               screen-reader and keyboard order (the cube itself is one "shuffle" button) -->
          <NuxtLink
            v-if="cubie.links[face]"
            :to="cubie.links[face]!.to"
            class="face-link"
            :title="cubie.links[face]!.name"
            aria-hidden="true"
            tabindex="-1"
            @click.stop
          >
            <ToolIcon :name="cubie.links[face]!.icon" />
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scene {
  /* A 3x3x3 cube spinning in 3D reaches ~2.6 cubies from its centre, so reserve that much room */
  width: calc(var(--s) * 5.2);
  height: calc(var(--s) * 5.2);
  perspective: calc(var(--s) * 14);
  display: grid;
  place-items: center;
}

.scene.interactive {
  cursor: pointer;
  border-radius: 50%;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.15s cubic-bezier(0.3, 1.5, 0.6, 1);
}

/* transform (not scale) so the press combines with any size set by the parent */
.scene.interactive:active {
  transform: scale(0.96);
}

.scene.interactive:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--ink) 35%, transparent);
  outline-offset: -1.5rem;
}

.cube {
  position: relative;
  width: 0;
  height: 0;
  transform-style: preserve-3d;
  /* Resting pose before JS takes over (and for reduced motion) */
  transform: rotateX(-28deg) rotateY(-35deg);
}

.cubie {
  position: absolute;
  width: var(--s);
  height: var(--s);
  left: calc(var(--s) / -2);
  top: calc(var(--s) / -2);
  transform-style: preserve-3d;
}

.face {
  position: absolute;
  inset: 0;
  background: #121212;
  border-radius: calc(var(--s) * 0.08);
  backface-visibility: hidden;
}

/* Icon sticker: sits above the coloured sticker layer */
.face-link {
  position: absolute;
  inset: calc(var(--s) * 0.06);
  z-index: 1;
  display: grid;
  place-items: center;
  font-size: calc(var(--s) * 0.46);
  color: var(--ink);
  border-radius: calc(var(--s) * 0.12);
  cursor: pointer;
  transition: transform 0.15s cubic-bezier(0.2, 0, 0, 1), background-color 0.15s;
}

.face-link:hover {
  transform: scale(1.08);
  background: rgb(255 255 255 / 0.18);
}

.face-link:active {
  transform: scale(0.96);
}

.face.sticker::after {
  content: '';
  position: absolute;
  inset: calc(var(--s) * 0.06);
  border-radius: calc(var(--s) * 0.12);
  background: var(--c, transparent);
  box-shadow: inset 0 0 calc(var(--s) * 0.18) rgb(0 0 0 / 0.18);
}

/* Lite effects: flat stickers are much cheaper for an old graphics chip to redraw */
:root[data-effects='lite'] .face.sticker::after {
  box-shadow: none;
}

.front { transform: translateZ(calc(var(--s) / 2)); }
.back { transform: rotateY(180deg) translateZ(calc(var(--s) / 2)); }
.right { transform: rotateY(90deg) translateZ(calc(var(--s) / 2)); }
.left { transform: rotateY(-90deg) translateZ(calc(var(--s) / 2)); }
.top { transform: rotateX(90deg) translateZ(calc(var(--s) / 2)); }
.bottom { transform: rotateX(-90deg) translateZ(calc(var(--s) / 2)); }

</style>
