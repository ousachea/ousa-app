<script setup lang="ts">
import { toast } from 'vue-sonner'
import { DIAL_STOPS, dialFraction, formatBytes, measureDownload, measurePing, measureUpload, VERDICT_ICONS, verdicts, type ServerInfo } from '~/utils/speedTest'

// Speed test: ping, then download, then upload, on one dial whose needle glides to the live speed.
// Every result is kept as a past test (useCollection 'speed'): synced to your account when signed in,
// on this device otherwise.
type Phase = 'idle' | 'ping' | 'download' | 'upload' | 'done' | 'error'

interface SpeedResult {
  id: string
  at: string
  down: number
  up: number
  ping: number
  jitter: number
  colo?: string
  bytes: number
}

const { play } = useSound()
const { prefs: sp } = useAppPrefs('speed', { seconds: 10, unit: 'mbps', plan: 0 })

const phase = ref<Phase>('idle')
const progress = ref(0)
const live = ref(0) // what the dial is heading for, in Mbps
const shown = ref(0) // what it shows, easing after `live`
const ping = ref<number | null>(null)
const jitter = ref<number | null>(null)
const down = ref<number | null>(null)
const up = ref<number | null>(null)
const pingSamples = ref<number[]>([])
const downSamples = ref<number[]>([])
const upSamples = ref<number[]>([])
const server = ref<ServerInfo>({})
const bytesUsed = ref(0)
const error = ref('')
// Past tests, newest first by default; deleting them skips the Recycle Bin and activity, like Gold's price history
const tests = useCollection<SpeedResult>('speed', undefined, { app: '/speed', trash: false, activity: false, label: r => `Speed test, ${dateFmt.format(new Date(r.at))}` })
// Plenty to look back on, without the list (and the account) growing forever
const KEEP_TESTS = 100

const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'down', label: 'Fastest download' },
  { value: 'up', label: 'Fastest upload' },
  { value: 'ping', label: 'Lowest ping' }
] as const
type Sort = (typeof SORTS)[number]['value']
const sort = useRemembered<Sort>('speed-sort', 'newest', v => SORTS.some(s => s.value === v))
const history = computed(() => [...tests.items.value].sort((a, b) => {
  if (sort.value === 'oldest') return a.at.localeCompare(b.at)
  if (sort.value === 'down') return b.down - a.down
  if (sort.value === 'up') return b.up - a.up
  if (sort.value === 'ping') return a.ping - b.ping
  return b.at.localeCompare(a.at)
}))
// What each past test was good enough for, as icons
const goodFor = (h: SpeedResult) => verdicts(h.down, h.up, h.ping, h.jitter).filter(v => v.ok)

// Tests saved before they synced lived only on this device (useRemembered 'speed-history'): moved in once
const oldHistory = useRemembered<Omit<SpeedResult, 'id'>[]>('speed-history', [], Array.isArray)
watch(() => tests.ready.value, (ready) => {
  if (!ready || !oldHistory.value.length || tests.sync.state.value === 'demo') return
  const known = new Set(tests.items.value.map(t => t.at))
  tests.addMany(oldHistory.value.filter(h => !known.has(h.at)))
  oldHistory.value = []
}, { immediate: true })

const running = computed(() => phase.value === 'ping' || phase.value === 'download' || phase.value === 'upload')
let controller: AbortController | undefined

// ---------- Units ----------

const unitLabel = computed(() => (sp.unit === 'mbs' ? 'MB/s' : 'Mbps'))
const inUnit = (mbps: number) => (sp.unit === 'mbs' ? mbps / 8 : mbps)
function fmt(mbps: number | null) {
  if (mbps === null) return '–'
  const v = inUnit(mbps)
  return v >= 100 ? Math.round(v).toString() : v >= 10 ? v.toFixed(1) : v.toFixed(2)
}

// ---------- The dial ----------

// A 270° dial opening at the bottom; angles in degrees, 0 pointing right, clockwise
const CX = 160
const CY = 160
const R = 128
const START = 135
const SWEEP = 270
const polar = (deg: number, r = R) => {
  const a = (deg * Math.PI) / 180
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)] as const
}
const ARC = (() => {
  const [x1, y1] = polar(START)
  const [x2, y2] = polar(START + SWEEP)
  return `M ${x1} ${y1} A ${R} ${R} 0 1 1 ${x2} ${y2}`
})()
const TICKS = DIAL_STOPS.map((v, i) => {
  const deg = START + (SWEEP * i) / (DIAL_STOPS.length - 1)
  const [x1, y1] = polar(deg, R - 16)
  const [x2, y2] = polar(deg, R - 24)
  const [lx, ly] = polar(deg, R - 40)
  return { v, x1, y1, x2, y2, lx, ly }
})
const fraction = computed(() => dialFraction(shown.value))
const needle = computed(() => START + SWEEP * fraction.value)
const tipPos = computed(() => polar(needle.value))

// The needle eases after the live reading with a frame-rate-independent spring, so it glides instead
// of stepping each time a new reading arrives
let raf = 0
let last = 0
function tick(now: number) {
  const dt = last ? Math.min(64, now - last) : 16
  last = now
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced'
  const k = reduce ? 1 : 1 - Math.exp(-dt / 220)
  shown.value += (live.value - shown.value) * k
  if (Math.abs(live.value - shown.value) < 0.005) shown.value = live.value
  raf = requestAnimationFrame(tick)
}
onMounted(() => (raf = requestAnimationFrame(tick)))
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  controller?.abort()
})

// ---------- Running a test ----------

function reset() {
  ping.value = jitter.value = down.value = up.value = null
  pingSamples.value = []
  downSamples.value = []
  upSamples.value = []
  bytesUsed.value = 0
  error.value = ''
  progress.value = 0
  live.value = 0
}

async function start() {
  if (running.value) return
  reset()
  controller = new AbortController()
  const { signal } = controller
  play('start')
  try {
    phase.value = 'ping'
    const p = await measurePing(signal, (ms, i, of) => {
      pingSamples.value = [...pingSamples.value, ms]
      progress.value = i / of
    })
    ping.value = p.ping
    jitter.value = p.jitter
    server.value = p.server

    phase.value = 'download'
    progress.value = 0
    const d = await measureDownload({
      seconds: sp.seconds,
      signal,
      onProgress: (mbps, prog, bytes) => {
        live.value = mbps
        progress.value = prog
        bytesUsed.value = bytes
        downSamples.value = [...downSamples.value, mbps]
      }
    })
    down.value = d.mbps
    live.value = d.mbps
    const downBytes = d.bytes
    await pause(500)
    live.value = 0
    await pause(450)

    phase.value = 'upload'
    progress.value = 0
    const u = await measureUpload({
      seconds: sp.seconds,
      signal,
      onProgress: (mbps, prog, bytes) => {
        live.value = mbps
        progress.value = prog
        bytesUsed.value = downBytes + bytes
        upSamples.value = [...upSamples.value, mbps]
      }
    })
    up.value = u.mbps
    live.value = down.value
    bytesUsed.value = downBytes + u.bytes

    phase.value = 'done'
    play('success')
    tests.add({
      at: new Date().toISOString(),
      down: d.mbps,
      up: u.mbps,
      ping: p.ping,
      jitter: p.jitter,
      colo: p.server.colo,
      bytes: bytesUsed.value
    })
    // Only the newest are kept
    const byAge = [...tests.items.value].sort((a, b) => b.at.localeCompare(a.at))
    for (const old of byAge.slice(KEEP_TESTS)) tests.remove(old.id, { undoAdd: true })
  } catch (e) {
    live.value = 0
    if ((e as Error).name === 'AbortError') {
      phase.value = 'idle'
      return
    }
    phase.value = 'error'
    error.value = navigator.onLine === false ? 'You’re offline. Connect to the internet and try again.' : 'Couldn’t reach the speed test server. Check your connection, or turn off anything that blocks it, and try again.'
    play('error')
  }
}

function stop() {
  controller?.abort()
  play('toggle-off')
}

const pause = (ms: number) => new Promise(r => setTimeout(r, ms))

// ---------- Reading it ----------

const PHASE_LABEL: Record<Phase, string> = {
  idle: 'Ready',
  ping: 'Checking ping',
  download: 'Download',
  upload: 'Upload',
  done: 'Download',
  error: 'Didn’t finish'
}
const status = computed(() => {
  if (phase.value === 'idle') return 'Ready when you are'
  if (phase.value === 'ping') return `Checking ping${server.value.colo ? ` · ${server.value.colo}` : ''}…`
  if (phase.value === 'download') return 'Testing download…'
  if (phase.value === 'upload') return 'Testing upload…'
  if (phase.value === 'done') return 'Done'
  return error.value
})

const good = computed(() => (phase.value === 'done' && down.value !== null && up.value !== null && ping.value !== null
  ? verdicts(down.value, up.value, ping.value, jitter.value ?? 0)
  : []))
const planShare = computed(() => (sp.plan > 0 && down.value ? Math.min(1.5, down.value / sp.plan) : null))

// A small line for each card, scaled to its own peak
function spark(values: number[], w = 120, h = 32) {
  if (values.length < 2) return { line: '', area: '' }
  const max = Math.max(...values, 0.001)
  const step = w / (values.length - 1)
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`)
  return { line: `M ${pts.join(' L ')}`, area: `M 0,${h} L ${pts.join(' L ')} L ${w},${h} Z` }
}

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function clearHistory() {
  const removed = [...tests.items.value]
  for (const t of removed) tests.remove(t.id)
  play('delete')
  toast('Past tests cleared', { action: { label: 'Undo', onClick: () => removed.forEach(t => tests.restore(t)) } })
}

// Space or Enter on the page starts a test (or stops one), when no field has the keyboard
function onKey(e: KeyboardEvent) {
  if (e.key !== ' ' || e.target !== document.body) return
  e.preventDefault()
  if (running.value) stop()
  else start()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <ToolPage header="bar">
    <template #settings>
      <SettingChoice v-model="sp.seconds" title="Test length" description="Longer tests are steadier, and use more data." :options="[{ value: 5, label: 'Quick' }, { value: 10, label: 'Standard' }, { value: 15, label: 'Thorough' }]" />
      <SettingChoice v-model="sp.unit" title="Show speeds in" :options="[{ value: 'mbps', label: 'Mbps' }, { value: 'mbs', label: 'MB/s' }]" />
      <label class="field plan-field">
        <span>Your plan’s download speed</span>
        <span class="plan-input input">
          <input :value="sp.plan || ''" type="number" min="0" step="any" inputmode="decimal" placeholder="e.g. 100" aria-label="Your plan’s download speed in Mbps" @input="sp.plan = Number(($event.target as HTMLInputElement).value) || 0">
          <span class="unit">Mbps</span>
        </span>
        <span class="hint">Results then say how much of it you’re getting.</span>
      </label>
    </template>

    <div class="speed" :class="`phase-${phase}`">
      <section class="dial-card panel" aria-label="Speed test">
        <div class="dial-wrap">
          <svg class="dial" viewBox="0 0 320 268" role="img" :aria-label="phase === 'idle' ? 'Speed dial' : `${PHASE_LABEL[phase]}: ${fmt(shown)} ${unitLabel}`">
            <defs>
              <linearGradient id="speed-fill" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stop-color="var(--meter-a)" />
                <stop offset="100%" stop-color="var(--meter-b)" />
              </linearGradient>
              <filter id="speed-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" />
              </filter>
            </defs>
            <path class="track" :d="ARC" pathLength="100" />
            <!-- The filled part: a soft glow underneath and the bar on top -->
            <path class="fill glow" :d="ARC" pathLength="100" :style="{ strokeDasharray: `${fraction * 100} 101`, opacity: fraction > 0.002 ? undefined : 0 }" filter="url(#speed-glow)" />
            <path class="fill" :d="ARC" pathLength="100" :style="{ strokeDasharray: `${fraction * 100} 101`, opacity: fraction > 0.002 ? undefined : 0 }" />
            <!-- Progress through this part of the test, as a thin inner ring -->
            <circle v-if="running" class="prog" :cx="CX" :cy="CY" r="72" pathLength="100" :style="{ strokeDasharray: `${progress * 100} 101`, opacity: progress > 0.005 ? undefined : 0 }" />
            <g class="ticks">
              <template v-for="t in TICKS" :key="t.v">
                <line :x1="t.x1" :y1="t.y1" :x2="t.x2" :y2="t.y2" />
                <text :x="t.lx" :y="t.ly" :class="{ lit: shown >= t.v && t.v > 0 }">{{ t.v >= 1000 ? '1G' : t.v }}</text>
              </template>
            </g>
            <g class="needle" :style="{ transform: `rotate(${needle}deg)` }">
              <path d="M 230 155 L 276 160 L 230 165 Z" />
            </g>
            <circle class="tip" :cx="tipPos[0]" :cy="tipPos[1]" r="6" />
          </svg>

          <!-- Start sits in the middle of the dial; while testing, the live speed takes its place -->
          <Transition name="swap" mode="out-in">
            <button v-if="phase === 'idle' || phase === 'error'" key="go" type="button" class="go" :aria-label="phase === 'error' ? 'Try again' : 'Start the speed test'" @click="start">
              <span class="ring" aria-hidden="true" />
              <span class="ring late" aria-hidden="true" />
              <span class="go-label">{{ phase === 'error' ? 'Retry' : 'Go' }}</span>
            </button>
            <div v-else key="read" class="readout" aria-live="off">
              <span class="phase-tag" :class="phase">
                <svg v-if="phase === 'download' || phase === 'done'" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v11M3.5 8.5 8 13l4.5-4.5" /></svg>
                <svg v-else-if="phase === 'upload'" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14V3M3.5 7.5 8 3l4.5 4.5" /></svg>
                {{ PHASE_LABEL[phase] }}
              </span>
              <span class="big">{{ phase === 'ping' ? (ping ?? (pingSamples.at(-1) ? Math.round(pingSamples.at(-1)!) : '–')) : fmt(shown) }}</span>
              <span class="unit">{{ phase === 'ping' ? 'ms' : unitLabel }}</span>
            </div>
          </Transition>
        </div>

        <p class="status" :class="{ bad: phase === 'error' }" role="status">{{ status }}</p>

        <div class="actions">
          <button v-if="running" type="button" class="btn btn-quiet btn-sm" @click="stop">Stop</button>
          <button v-else-if="phase === 'done'" type="button" class="btn" @click="start">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 8A5.5 5.5 0 1 1 11.9 4M13.5 2.5V5h-2.5" /></svg>
            Test again
          </button>
        </div>
      </section>

      <div class="stats">
        <div class="stat" :class="{ active: phase === 'ping', has: ping !== null }">
          <span class="stat-label">Ping</span>
          <span class="stat-value"><RollingNumber :value="ping === null ? '–' : Math.round(ping)" /><small>ms</small></span>
          <span class="stat-sub">Jitter {{ jitter === null ? '–' : `${Math.round(jitter)} ms` }}</span>
        </div>
        <div class="stat down" :class="{ active: phase === 'download', has: down !== null }">
          <span class="stat-label">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v11M3.5 8.5 8 13l4.5-4.5" /></svg>
            Download
          </span>
          <span class="stat-value"><RollingNumber :value="phase === 'download' ? fmt(live) : fmt(down)" /><small>{{ unitLabel }}</small></span>
          <svg class="spark" viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true">
            <path class="spark-area" :d="spark(downSamples).area" />
            <path class="spark-line" :d="spark(downSamples).line" />
          </svg>
        </div>
        <div class="stat up" :class="{ active: phase === 'upload', has: up !== null }">
          <span class="stat-label">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14V3M3.5 7.5 8 3l4.5 4.5" /></svg>
            Upload
          </span>
          <span class="stat-value"><RollingNumber :value="phase === 'upload' ? fmt(live) : fmt(up)" /><small>{{ unitLabel }}</small></span>
          <svg class="spark" viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true">
            <path class="spark-area" :d="spark(upSamples).area" />
            <path class="spark-line" :d="spark(upSamples).line" />
          </svg>
        </div>
      </div>

      <Transition name="rise">
        <section v-if="phase === 'done'" class="result panel" aria-label="What this connection is good for">
          <h2>Good for</h2>
          <ul class="verdicts">
            <li v-for="(v, i) in good" :key="v.label" :class="{ ok: v.ok }" :style="{ '--i': i }">
              <!-- What it's for, with a tick or a cross on its corner -->
              <span class="use-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16"><path v-for="d in VERDICT_ICONS[v.key]" :key="d" :d="d" /></svg>
                <svg class="mark" viewBox="0 0 16 16"><path v-if="v.ok" d="M3.5 8.5 6.5 11.5 12.5 4.5" /><path v-else d="M4.5 4.5l7 7M11.5 4.5l-7 7" /></svg>
              </span>
              {{ v.label }}
              <span class="sr-only">{{ v.ok ? 'yes' : 'not really' }}</span>
            </li>
          </ul>
          <div v-if="planShare !== null" class="plan">
            <div class="plan-head">
              <span>Your {{ sp.plan }} Mbps plan</span>
              <strong>{{ Math.round(planShare * 100) }}%</strong>
            </div>
            <div class="plan-bar"><span :style="{ width: `${Math.min(100, planShare * 100)}%` }" /></div>
          </div>
          <p class="meta">
            <span v-if="server.colo">Server: Cloudflare {{ server.colo }}</span>
            <span v-if="server.city">You: {{ server.city }}{{ server.country ? `, ${server.country}` : '' }}</span>
            <span>Data used: {{ formatBytes(bytesUsed) }}</span>
          </p>
        </section>
      </Transition>

      <section v-if="history.length" class="history panel" aria-label="Past tests">
        <div class="history-head">
          <h2>Past tests</h2>
          <AppSelect v-model="sort" class="history-sort" aria-label="Sort past tests" :options="SORTS" />
          <button type="button" class="link" @click="clearHistory">Clear</button>
        </div>
        <TransitionGroup tag="ul" name="list" class="history-list">
          <li v-for="h in history" :key="h.id">
            <span class="when">
              {{ dateFmt.format(new Date(h.at)) }}
              <!-- What it was good enough for -->
              <span class="uses" :aria-label="`Good for: ${goodFor(h).map(v => v.label).join(', ') || 'not much'}`">
                <svg v-for="v in goodFor(h)" :key="v.key" viewBox="0 0 16 16" aria-hidden="true"><title>{{ v.label }}</title><path v-for="d in VERDICT_ICONS[v.key]" :key="d" :d="d" /></svg>
              </span>
            </span>
            <span class="h-down"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v11M3.5 8.5 8 13l4.5-4.5" /></svg>{{ fmt(h.down) }}</span>
            <span class="h-up"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14V3M3.5 7.5 8 3l4.5 4.5" /></svg>{{ fmt(h.up) }}</span>
            <span class="h-ping">{{ Math.round(h.ping) }} ms</span>
          </li>
        </TransitionGroup>
        <p class="hint">Speeds in {{ unitLabel }}. {{ tests.sync.signedIn.value ? 'Saved to your account, on all your devices.' : 'Kept on this device; sign in to keep them in your account.' }} The icons show what each was good enough for.</p>
      </section>
    </div>
  </ToolPage>
</template>

<style scoped>
.speed {
  --meter-a: var(--accent);
  --meter-b: color-mix(in srgb, var(--accent) 55%, #ffb3f0);
  --up-a: var(--cyan);
  --up-b: color-mix(in srgb, var(--cyan) 50%, #9ff3ff);
  width: 100%;
  display: grid;
  grid-template-areas: 'dial' 'stats' 'result' 'history';
  gap: 1rem;
}

.dial-card {
  grid-area: dial;
}

.stats {
  grid-area: stats;
}

.result {
  grid-area: result;
}

.history {
  grid-area: history;
}

/* Wide screens: the dial on the left, held in view, and the numbers beside it */
@media (min-width: 1000px) {
  .speed {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: auto auto 1fr;
    grid-template-areas:
      'dial stats'
      'dial result'
      'dial history';
    align-items: start;
  }

  .dial-card {
    position: sticky;
    top: var(--pin-top);
  }

}

/* Upload turns the dial blue, so the two halves of the test read apart at a glance */
.speed.phase-upload {
  --meter-a: var(--up-a);
  --meter-b: var(--up-b);
}

.dial-card {
  display: grid;
  justify-items: center;
  padding: 1.5rem 1.5rem 1.25rem;
  overflow: hidden;
}

.dial-wrap {
  position: relative;
  width: min(100%, 22rem);
  /* The dial is open at the bottom, so the box stops just under its ends */
  aspect-ratio: 320 / 268;
}

/* Wide screens: the dial grows to fill its half of the page */
@media (min-width: 1000px) {
  .dial-wrap {
    width: min(100%, 30rem);
  }
}

.dial {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.track,
.fill {
  fill: none;
  stroke-width: 14;
  stroke-linecap: round;
}

.track {
  stroke: var(--surface-2);
}

.fill {
  stroke: url(#speed-fill);
  transition: stroke 0.4s, opacity 0.3s;
}

.fill.glow {
  opacity: 0.45;
}

.prog {
  fill: none;
  stroke: var(--meter-a);
  stroke-width: 3;
  stroke-linecap: round;
  opacity: 0.35;
  transition: stroke-dasharray 0.12s linear, opacity 0.3s;
  transform: rotate(-90deg);
  transform-origin: 160px 160px;
}

.ticks line {
  stroke: var(--line);
  stroke-width: 2;
  stroke-linecap: round;
}

.ticks text {
  fill: var(--ink-3);
  font-size: 11px;
  font-weight: 600;
  text-anchor: middle;
  dominant-baseline: middle;
  font-variant-numeric: tabular-nums;
  transition: fill 0.3s;
}

.ticks text.lit {
  fill: var(--ink);
}

.needle {
  transform-origin: 160px 160px;
  fill: var(--ink);
  opacity: 0;
  transition: opacity 0.4s;
}

.tip {
  fill: var(--surface);
  stroke: var(--meter-a);
  stroke-width: 3;
  opacity: 0;
  transition: opacity 0.4s;
}

/* A short pointer near the rim, so it never crosses the reading in the middle. It only shows while
   there's a speed to point at; the Go button has the middle otherwise. */
.phase-download .needle,
.phase-upload .needle,
.phase-done .needle,
.phase-download .tip,
.phase-upload .tip,
.phase-done .tip {
  opacity: 1;
}

/* ---------- Go ---------- */

.go {
  position: absolute;
  /* Centred on the dial's middle, which sits at 160 of the box's 268 */
  left: 28%;
  top: 33.4%;
  width: 44%;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 50%;
  color: var(--on-accent);
  background:
    radial-gradient(80% 80% at 30% 25%, color-mix(in srgb, var(--accent) 60%, #fff) 0%, transparent 60%),
    var(--accent);
  box-shadow: 0 10px 30px color-mix(in srgb, var(--accent) 40%, transparent), inset 0 -4px 0 rgb(0 0 0 / 0.15);
  font: inherit;
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.go:hover {
  transform: scale(1.04);
}

.go:active {
  transform: scale(0.95);
}

.go-label {
  position: relative;
  font-size: clamp(1.6rem, 7vw, 2.2rem);
  font-weight: 800;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

/* Two rings breathing out from the button, half a beat apart */
.ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid var(--accent);
  animation: breathe 2.4s cubic-bezier(0.2, 0.6, 0.3, 1) infinite;
  pointer-events: none;
}

.ring.late {
  animation-delay: 1.2s;
}

@keyframes breathe {
  from {
    transform: scale(1);
    opacity: 0.55;
  }

  to {
    transform: scale(1.55);
    opacity: 0;
  }
}

/* ---------- Live reading ---------- */

.readout {
  position: absolute;
  left: 50%;
  top: calc(160 / 268 * 100%);
  transform: translate(-50%, -50%);
  display: grid;
  justify-items: center;
  gap: 0.1rem;
  pointer-events: none;
}

.phase-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--meter-a);
  transition: color 0.3s;
}

.phase-tag svg,
.stat-label svg,
.history-list svg,
.btn svg {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.big {
  font-size: clamp(2.6rem, 12vw, 3.6rem);
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.readout .unit {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-2);
}

.swap-enter-active,
.swap-leave-active {
  transition: opacity 0.25s, transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.swap-enter-from,
.swap-leave-to {
  opacity: 0;
}

.go.swap-leave-to {
  transform: scale(0.6);
}

.readout.swap-enter-from {
  transform: translate(-50%, -40%);
}

.status {
  margin: 0.25rem 0 0;
  min-height: 1.4em;
  text-align: center;
  color: var(--ink-2);
  font-weight: 500;
}

.status.bad {
  color: var(--bad-ink);
}

.actions {
  min-height: 2.75rem;
  display: flex;
  align-items: center;
  margin-top: 0.75rem;
}

/* ---------- Stat cards ---------- */

.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.stat {
  --c: var(--ink-2);
  position: relative;
  display: grid;
  gap: 0.2rem;
  padding: 0.9rem 1rem;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  transition: border-color 0.3s, box-shadow 0.3s, transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  overflow: hidden;
}

.stat.down {
  --c: var(--accent);
}

.stat.up {
  --c: var(--cyan);
}

.stat.active {
  border-color: var(--c);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--c) 18%, transparent);
  transform: translateY(-2px);
}

.stat-label {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-2);
}

.stat.down .stat-label svg,
.stat.up .stat-label svg {
  color: var(--c);
}

.stat-value {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3rem;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--ink-3);
  transition: color 0.3s;
}

.stat.has .stat-value,
.stat.active .stat-value {
  color: var(--ink);
}

.stat-value small {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0;
  color: var(--ink-2);
}

.stat-sub {
  font-size: var(--text-sm);
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}

.spark {
  width: 100%;
  height: 2rem;
}

.spark-line {
  fill: none;
  stroke: var(--c);
  stroke-width: 2;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.spark-area {
  fill: color-mix(in srgb, var(--c) 16%, transparent);
}

/* ---------- Result ---------- */

.result,
.history {
  padding: 1.25rem 1.5rem;
}

.result h2,
.history h2 {
  margin: 0 0 0.75rem;
  font-size: 1.05rem;
}

.verdicts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.verdicts li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.75rem;
  border-radius: var(--radius);
  background: var(--surface-2);
  color: var(--ink-2);
  font-weight: 500;
  animation: pop-in 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(var(--i) * 60ms + 150ms);
}

.verdicts li.ok {
  color: var(--ink);
}

/* The use's own icon, with a small tick or cross badge on its corner */
.use-icon {
  position: relative;
  flex: none;
  width: 1.75rem;
  height: 1.75rem;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: var(--surface-2);
}

.verdicts li.ok .use-icon {
  background: color-mix(in srgb, var(--green) 14%, var(--surface));
}

.verdicts svg {
  flex: none;
  width: 1.1rem;
  height: 1.1rem;
  fill: none;
  stroke: var(--ink-3);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.verdicts li.ok svg {
  stroke: var(--good-ink);
}

.verdicts .mark {
  position: absolute;
  right: -0.3rem;
  bottom: -0.3rem;
  width: 0.85rem;
  height: 0.85rem;
  padding: 0.1rem;
  stroke-width: 2.6;
  background: var(--surface);
  border-radius: 50%;
  box-shadow: 0 0 0 1px var(--line);
}

.verdicts li:not(.ok) .mark {
  stroke: var(--bad-ink);
}

@keyframes pop-in {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.98);
  }
}

.plan {
  margin-top: 1rem;
}

.plan-head {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-sm);
  color: var(--ink-2);
  margin-bottom: 0.35rem;
}

.plan-head strong {
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.plan-bar {
  height: 0.55rem;
  border-radius: var(--radius-pill);
  background: var(--surface-2);
  overflow: hidden;
}

.plan-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--meter-a), var(--meter-b));
  animation: grow 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) both 0.3s;
  transform-origin: left;
}

@keyframes grow {
  from {
    transform: scaleX(0);
  }
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  margin: 1rem 0 0;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.rise-enter-active {
  transition: opacity 0.4s, transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.rise-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

/* ---------- History ---------- */

.history-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.history-sort {
  margin-left: auto;
  width: auto;
  min-width: 10rem;
  font-size: var(--text-sm);
}

/* The date, with what that test was good enough for in small icons underneath */
.history-list .when {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.uses {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  color: var(--good-ink);
}

.history-list .uses svg {
  width: 0.95rem;
  height: 0.95rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.history-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.history-list li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 5rem 5rem 4rem;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0;
  border-top: 1px solid var(--line);
  font-variant-numeric: tabular-nums;
}

.history-list li:first-child {
  border-top: 0;
}

.when {
  color: var(--ink-2);
  font-size: var(--text-sm);
}

.h-down,
.h-up {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-weight: 600;
}

.h-down svg {
  color: var(--accent);
}

.h-up svg {
  color: var(--cyan);
}

.h-ping {
  color: var(--ink-2);
  text-align: right;
  font-size: var(--text-sm);
}

.hint {
  margin: 0.5rem 0 0;
  font-size: var(--text-sm);
  color: var(--ink-3);
}

/* ---------- Settings ---------- */

.plan-field {
  padding: 0.85rem 0;
  border-top: 1px solid var(--line);
}

.plan-input {
  display: flex;
  align-items: center;
  padding: 0 0.85rem;
}

.plan-input input {
  flex: 1;
  min-width: 0;
  min-height: 2.75rem;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: 1rem;
}

.plan-input .unit {
  color: var(--ink-2);
  font-weight: 600;
}

.plan-field .hint {
  margin: 0;
}

/* ---------- Motion and phones ---------- */

@media (prefers-reduced-motion: reduce) {
  .ring {
    animation: none;
    opacity: 0;
  }

  .verdicts li,
  .plan-bar span {
    animation: none;
  }
}

:root[data-motion='reduced'] .ring {
  animation: none;
  opacity: 0;
}

/* Phones: small padding, so the dial gets the width */
@media (max-width: 640px) {
  .speed {
    gap: 0.75rem;
  }

  .dial-card {
    padding: 0.75rem 0.5rem 1rem;
  }

  .stats {
    gap: 0.5rem;
  }

  .stat {
    padding: 0.65rem 0.7rem;
  }

  .stat-value {
    font-size: 1.25rem;
  }

  .stat-value small {
    font-size: 0.65rem;
  }

  .result,
  .history {
    padding: 1rem;
  }

  .verdicts {
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem;
  }

  .verdicts li {
    padding: 0.5rem 0.6rem;
    font-size: var(--text-sm);
  }

  .history-list li {
    grid-template-columns: minmax(0, 1fr) 4rem 4rem 3.25rem;
    gap: 0.35rem;
    font-size: var(--text-sm);
  }
}
</style>
