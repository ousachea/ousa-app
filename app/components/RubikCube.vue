<script setup lang="ts">
type Vec3 = [number, number, number]
type Mat3 = [Vec3, Vec3, Vec3]
type Face = 'front' | 'back' | 'right' | 'left' | 'top' | 'bottom'

interface Cubie {
  pos: Vec3
  rot: Mat3
  stickers: Partial<Record<Face, string>>
}

interface Move {
  axis: 0 | 1 | 2
  layer: -1 | 0 | 1
  dir: 1 | -1
}

const props = withDefaults(defineProps<{
  size?: number
  moveDuration?: number
  scrambleLength?: number
}>(), {
  size: 64,
  moveDuration: 380,
  scrambleLength: 18
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
        cubies.push({ pos: [x, y, z], rot: IDENTITY, stickers })
      }
    }
  }
  return cubies
}

const cubies = createCubies()

function toMatrix3d(cubie: Cubie, anim: Mat3): string {
  const l = mulMat(anim, cubie.rot)
  const t = mulVec(anim, cubie.pos).map(n => n * props.size)
  return `matrix3d(${l[0][0]},${l[1][0]},${l[2][0]},0,${l[0][1]},${l[1][1]},${l[2][1]},0,${l[0][2]},${l[1][2]},${l[2][2]},0,${t[0]},${t[1]},${t[2]},1)`
}

const transforms = ref<string[]>(cubies.map(c => toMatrix3d(c, IDENTITY)))

function render(move?: Move, angle = 0) {
  const anim = move ? rotation(move.axis, angle) : IDENTITY
  transforms.value = cubies.map(c =>
    toMatrix3d(c, move && c.pos[move.axis] === move.layer ? anim : IDENTITY)
  )
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

// Scramble with random moves, pause, then play them back in reverse to solve.
function buildSequence(): (Move | 'pause')[] {
  const scramble: Move[] = []
  for (let i = 0; i < props.scrambleLength; i++) scramble.push(randomMove(scramble[i - 1]))
  const solve = scramble.slice().reverse().map(m => ({ ...m, dir: -m.dir as Move['dir'] }))
  return [...scramble, 'pause', ...solve, 'pause']
}

let frame = 0
let stopped = false

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  let queue = buildSequence()
  let current: Move | 'pause' | undefined
  let start = 0

  const tick = (now: number) => {
    if (stopped) return
    if (!current) {
      if (!queue.length) queue = buildSequence()
      current = queue.shift()
      start = now
    }
    const step = current!
    const duration = step === 'pause' ? 1200 : props.moveDuration
    const t = Math.min((now - start) / duration, 1)

    if (step !== 'pause') {
      if (t < 1) {
        render(step, step.dir * ease(t) * Math.PI / 2)
      } else {
        commit(step)
        render()
      }
    }
    if (t >= 1) current = undefined
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  stopped = true
  cancelAnimationFrame(frame)
})
</script>

<template>
  <div class="scene" :style="{ '--s': `${size}px` }" role="img" aria-label="Animated Rubik's cube">
    <div class="cube">
      <div
        v-for="(cubie, i) in cubies"
        :key="i"
        class="cubie"
        :style="{ transform: transforms[i] }"
      >
        <div
          v-for="face in FACES"
          :key="face"
          :class="['face', face]"
          :style="cubie.stickers[face] ? { '--c': cubie.stickers[face] } : undefined"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.scene {
  width: calc(var(--s) * 3);
  height: calc(var(--s) * 3);
  perspective: calc(var(--s) * 14);
  display: grid;
  place-items: center;
}

.cube {
  position: relative;
  width: 0;
  height: 0;
  transform-style: preserve-3d;
  animation: spin 24s linear infinite;
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

.face::after {
  content: '';
  position: absolute;
  inset: calc(var(--s) * 0.06);
  border-radius: calc(var(--s) * 0.12);
  background: var(--c, transparent);
  box-shadow: inset 0 0 calc(var(--s) * 0.18) rgb(0 0 0 / 0.18);
}

.front { transform: translateZ(calc(var(--s) / 2)); }
.back { transform: rotateY(180deg) translateZ(calc(var(--s) / 2)); }
.right { transform: rotateY(90deg) translateZ(calc(var(--s) / 2)); }
.left { transform: rotateY(-90deg) translateZ(calc(var(--s) / 2)); }
.top { transform: rotateX(90deg) translateZ(calc(var(--s) / 2)); }
.bottom { transform: rotateX(-90deg) translateZ(calc(var(--s) / 2)); }

@keyframes spin {
  from { transform: rotateX(-28deg) rotateY(0deg); }
  to { transform: rotateX(-28deg) rotateY(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .cube {
    animation: none;
    transform: rotateX(-28deg) rotateY(-35deg);
  }
}
</style>
