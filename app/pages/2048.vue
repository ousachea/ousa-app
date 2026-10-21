<script setup lang="ts">
// 2048: slide every tile one way; two tiles with the same number join into their sum, and a new 2 (or,
// one time in ten, a 4) lands in an empty cell. Reach 2048 to win, then keep going if you like.
// Arrow keys on a keyboard, a swipe on the board with a finger. The game in progress and the best score
// are kept on this device, so closing the tab doesn't lose a run.
const { play } = useSound()

const SIZE = 4
const GOAL = 2048

interface Tile {
  id: number
  value: number
  row: number
  col: number
  /** Just joined: pops once */
  merged?: boolean
  /** Just arrived: grows in */
  fresh?: boolean
  /** Joined into another tile: slides under it, then goes */
  gone?: boolean
}

interface Game {
  tiles: Tile[]
  score: number
  won: boolean
  /** Reached 2048 and chose to carry on */
  playingOn: boolean
  over: boolean
}

let nextId = 1
const emptyGame = (): Game => ({ tiles: [], score: 0, won: false, playingOn: false, over: false })
const game = reactive<Game>(emptyGame())
// One step back: the board before the last move
const previous = ref<Game>()
const best = useRemembered<number>('2048-best', 0, v => typeof v === 'number')
const saved = useRemembered<Game | null>('2048-game', null, v => v === null || (typeof v === 'object' && Array.isArray((v as Game).tiles)))

const live = () => game.tiles.filter(t => !t.gone)
const snapshot = (): Game => JSON.parse(JSON.stringify({ ...game, tiles: live().map(({ merged: _m, fresh: _f, ...t }) => t) }))

function load(g: Game) {
  Object.assign(game, JSON.parse(JSON.stringify(g)))
  nextId = Math.max(0, ...game.tiles.map(t => t.id)) + 1
}

function spawn() {
  const taken = new Set(live().map(t => t.row * SIZE + t.col))
  const free = Array.from({ length: SIZE * SIZE }, (_, i) => i).filter(i => !taken.has(i))
  if (!free.length) return
  const at = free[Math.floor(Math.random() * free.length)]!
  game.tiles.push({ id: nextId++, value: Math.random() < 0.9 ? 2 : 4, row: Math.floor(at / SIZE), col: at % SIZE, fresh: true })
}

function newGame() {
  Object.assign(game, emptyGame())
  previous.value = undefined
  spawn()
  spawn()
  saved.value = snapshot()
  play('select')
}

type Dir = 'up' | 'down' | 'left' | 'right'

// Clear the last move's leftovers (joined tiles still sliding away, pop and grow flags)
let settle: ReturnType<typeof setTimeout> | undefined
function tidy() {
  clearTimeout(settle)
  game.tiles = live().map(({ merged: _m, fresh: _f, ...t }) => t)
}

function canMove() {
  const grid = new Map(live().map(t => [t.row * SIZE + t.col, t.value]))
  if (grid.size < SIZE * SIZE) return true
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = grid.get(r * SIZE + c)
      if ((c < SIZE - 1 && grid.get(r * SIZE + c + 1) === v) || (r < SIZE - 1 && grid.get((r + 1) * SIZE + c) === v)) return true
    }
  }
  return false
}

function move(dir: Dir) {
  if (game.over || (game.won && !game.playingOn)) return
  tidy()
  const before = snapshot()
  const vertical = dir === 'up' || dir === 'down'
  const towardsEnd = dir === 'down' || dir === 'right'
  let moved = false
  let gained = 0

  for (let line = 0; line < SIZE; line++) {
    // This row or column's tiles, nearest the wall they slide towards first
    const row = live()
      .filter(t => (vertical ? t.col : t.row) === line)
      .sort((a, b) => (vertical ? a.row - b.row : a.col - b.col) * (towardsEnd ? -1 : 1))
    let slot = 0
    let last: Tile | undefined
    for (const t of row) {
      const place = (i: number) => (towardsEnd ? SIZE - 1 - i : i)
      if (last && !last.merged && last.value === t.value) {
        // Joins the tile in front: slides onto it, which doubles
        last.value *= 2
        last.merged = true
        gained += last.value
        t.gone = true
        t.row = last.row
        t.col = last.col
        moved = true
        continue
      }
      const target = place(slot++)
      const [r, c] = vertical ? [target, line] : [line, target]
      if (t.row !== r || t.col !== c) moved = true
      t.row = r
      t.col = c
      last = t
    }
  }

  if (!moved) return
  previous.value = before
  game.score += gained
  if (game.score > best.value) best.value = game.score
  spawn()
  play(gained ? 'success' : 'select')
  settle = setTimeout(tidy, 160)

  if (!game.won && live().some(t => t.value >= GOAL)) {
    game.won = true
    play('toggle-on')
  }
  if (!canMove()) {
    game.over = true
    play('error')
  }
  saved.value = snapshot()
}

function undo() {
  if (!previous.value) return
  tidy()
  load(previous.value)
  previous.value = undefined
  saved.value = snapshot()
  play('toggle-off')
}

function keepGoing() {
  game.playingOn = true
  saved.value = snapshot()
  play('select')
}

// A game in progress comes back as you left it
onMounted(() => {
  nextTick(() => {
    if (saved.value?.tiles.length) load(saved.value)
    else newGame()
  })
})
onBeforeUnmount(() => clearTimeout(settle))

// ---------- Keys and swipes ----------
const KEYS: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }
function onKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || document.querySelector('dialog[open]')) return
  const dir = KEYS[e.key]
  if (dir) {
    e.preventDefault()
    move(dir)
  } else if ((e.key === 'z' || e.key === 'u') && previous.value) {
    e.preventDefault()
    undo()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

let start: { x: number, y: number, id: number } | undefined
function onPointerDown(e: PointerEvent) {
  start = { x: e.clientX, y: e.clientY, id: e.pointerId }
}
function onPointerUp(e: PointerEvent) {
  if (!start || start.id !== e.pointerId) return
  const dx = e.clientX - start.x
  const dy = e.clientY - start.y
  start = undefined
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
  move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'))
}

// Each number its own colour, warming up as it grows; past 2048 they stay dark
const SHADES: Record<number, [string, string]> = {
  2: ['#eee4da', '#776e65'], 4: ['#ede0c8', '#776e65'], 8: ['#f2b179', '#fff'], 16: ['#f59563', '#fff'],
  32: ['#f67c5f', '#fff'], 64: ['#f65e3b', '#fff'], 128: ['#edcf72', '#fff'], 256: ['#edcc61', '#fff'],
  512: ['#edc850', '#fff'], 1024: ['#edc53f', '#fff'], 2048: ['#edc22e', '#fff']
}
const shade = (v: number) => SHADES[v] ?? ['#3c3a32', '#fff']
const highest = computed(() => Math.max(0, ...live().map(t => t.value)))
const status = computed(() => (game.over ? `No moves left. Final score ${game.score}.` : game.won && !game.playingOn ? `You made ${GOAL}!` : ''))
</script>

<template>
  <ToolPage header="bar">
    <div class="game">
      <div class="scores">
        <div class="score">
          <span class="label">Score</span>
          <RollingNumber class="value" :value="game.score" />
        </div>
        <div class="score">
          <span class="label">Best</span>
          <span class="value">{{ best }}</span>
        </div>
        <div class="actions">
          <button type="button" class="btn btn-quiet btn-sm" :disabled="!previous" title="Undo the last move (Z)" @click="undo">
            <AppIcon name="undo-2" />Undo
          </button>
          <button type="button" class="btn btn-sm" @click="newGame">New game</button>
        </div>
      </div>

      <div
        class="board"
        role="application"
        aria-label="2048 board. Use the arrow keys or swipe to slide the tiles."
        aria-roledescription="game"
        @pointerdown="onPointerDown"
        @pointerup="onPointerUp"
        @pointercancel="start = undefined"
      >
        <span v-for="i in SIZE * SIZE" :key="`cell-${i}`" class="cell" aria-hidden="true" />
        <span
          v-for="t in game.tiles"
          :key="t.id"
          class="tile"
          :class="{ merged: t.merged, fresh: t.fresh, gone: t.gone, big: t.value >= 1024, huge: t.value >= 16384 }"
          :style="{ '--r': t.row, '--c': t.col, '--bg': shade(t.value)[0], '--fg': shade(t.value)[1] }"
          aria-hidden="true"
        >
          <span class="num">{{ t.value }}</span>
        </span>

        <Transition name="fade">
          <div v-if="status" class="overlay" :class="{ win: !game.over }" role="status">
            <strong>{{ game.over ? 'Game over' : `${GOAL}!` }}</strong>
            <p>{{ game.over ? `You scored ${game.score}, with a ${highest} tile.` : 'You did it. Keep going for a higher tile?' }}</p>
            <div class="overlay-actions">
              <button v-if="!game.over" type="button" class="btn" @click="keepGoing">Keep going</button>
              <button v-if="game.over && previous" type="button" class="btn btn-quiet" @click="undo">Undo last move</button>
              <button type="button" class="btn" :class="{ 'btn-quiet': !game.over }" @click="newGame">New game</button>
            </div>
          </div>
        </Transition>
      </div>
      <p class="sr-only" aria-live="polite">Score {{ game.score }}. Highest tile {{ highest }}. {{ status }}</p>

      <p class="how">
        <span class="keys" aria-hidden="true"><kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd></span>
        <span class="on-keys">Slide with the arrow keys. Matching numbers join into one. <kbd>Z</kbd> undoes a move.</span>
        <span class="on-touch">Swipe on the board to slide the tiles. Matching numbers join into one.</span>
      </p>
    </div>
  </ToolPage>
</template>

<style scoped>
.game {
  --gap: clamp(0.4rem, 2.2vw, 0.75rem);
  width: min(100%, 30rem);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.scores {
  display: flex;
  align-items: stretch;
  gap: 0.5rem;
}

.score {
  min-width: 5.5rem;
  padding: 0.4rem 0.85rem;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: inset 0 0 0 1px var(--line);
}

.score .label {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.score .value {
  font-size: var(--text-xl);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  white-space: nowrap;
}

@media (max-width: 480px) {
  .score {
    min-width: 4.25rem;
    padding: 0.35rem 0.65rem;
  }
}

.actions svg {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* The board: a 4×4 of empty cells, with the tiles placed over them by row and column */
.board {
  --cell: calc((100% - var(--gap) * 5) / 4);
  position: relative;
  aspect-ratio: 1;
  padding: var(--gap);
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--gap);
  background: #bbada0;
  border-radius: var(--radius-lg);
  touch-action: none;
  user-select: none;
  container-type: inline-size;
}

.cell {
  background: rgb(238 228 218 / 0.35);
  border-radius: var(--radius-sm);
}

.tile {
  position: absolute;
  top: var(--gap);
  left: var(--gap);
  width: var(--cell);
  height: var(--cell);
  display: grid;
  place-items: center;
  font-size: 13cqi;
  font-weight: 800;
  color: var(--fg);
  background: var(--bg);
  border-radius: var(--radius-sm);
  translate: calc(var(--c) * (100% + var(--gap))) calc(var(--r) * (100% + var(--gap)));
  transition: translate var(--dur-fast) ease-in-out;
  z-index: 1;
}

.tile.big { font-size: 10cqi; }
.tile.huge { font-size: 8cqi; }

/* A joined tile pops on top; the one it swallowed slides underneath and goes */
.tile.merged {
  z-index: 2;
}

.tile.merged .num {
  animation: tile-pop 0.2s ease 0.08s;
}

.tile.merged {
  animation: tile-pop-box 0.2s ease 0.08s;
}

.tile.gone {
  z-index: 0;
}

.tile.fresh {
  animation: tile-in 0.2s ease 0.1s backwards;
}

@keyframes tile-pop-box {
  50% { scale: 1.12; }
}

@keyframes tile-pop {
  from { opacity: 1; }
}

@keyframes tile-in {
  from { scale: 0; opacity: 0; }
}

.overlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem;
  text-align: center;
  color: #776e65;
  background: rgb(238 228 218 / 0.78);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(2px);
}

.overlay.win {
  color: #fff;
  background: rgb(237 194 46 / 0.6);
}

.overlay strong {
  font-size: var(--text-3xl);
  font-weight: 800;
  line-height: 1;
}

.overlay p {
  margin: 0 0 0.5rem;
  font-weight: 600;
}

.overlay-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
}

.how {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: var(--text-sm);
  color: var(--ink-2);
  text-align: center;
}

.keys {
  display: inline-flex;
  gap: 0.2rem;
}

.on-touch {
  display: none;
}

@media (pointer: coarse) {
  .keys,
  .on-keys {
    display: none;
  }

  .on-touch {
    display: inline;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tile,
  .tile.merged,
  .tile.fresh {
    transition: none;
    animation: none;
  }
}
</style>
