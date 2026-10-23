<script setup lang="ts">
import { toast } from 'vue-sonner'
import { DIAL_STOPS, dialFraction, fetchConnection, formatBytes, measureDownload, measurePing, measureUpload, VERDICT_ICONS, verdicts, type ServerInfo, type VerdictKey } from '~/utils/speedTest'

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
  // Where and how it was run (all optional; older tests don't have them)
  ip?: string
  isp?: string
  city?: string
  country?: string
  os?: string
  network?: Network
}

type Network = 'wifi' | 'mobile' | 'cable'
const NETWORKS: { value: Network, label: string, icon: string }[] = [
  { value: 'wifi', label: 'Wi-Fi', icon: 'lucide:wifi' },
  { value: 'mobile', label: 'Mobile data', icon: 'lucide:signal' },
  { value: 'cable', label: 'Cable', icon: 'lucide:ethernet-port' }
]
const networkLabel = (n?: Network) => NETWORKS.find(x => x.value === n)?.label

const { play } = useSound()
const { prefs: sp } = useAppPrefs('speed', { seconds: 10, unit: 'mbps', plan: 0, network: '' })

// ---------- This device and its connection ----------
// The OS from the browser's own description of the device
function osName() {
  const ua = navigator.userAgent
  const platform = (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform
  let os = platform || ''
  if (/iPhone|iPod/.test(ua)) os = 'iOS'
  else if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) os = 'iPadOS'
  else if (/Android/.test(ua)) os = `Android ${/Android (\d+)/.exec(ua)?.[1] ?? ''}`.trim()
  else if (!os) os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown'
  if (os === 'Chrome OS') os = 'ChromeOS'
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : ''
  return browser ? `${os} · ${browser}` : os
}
const os = ref('')
// Wi-Fi, mobile data or cable: Chrome on Android says which; other browsers don't, so you pick, and it's remembered
const detectedNetwork = ref<Network>()
const network = ref<Network | ''>('')
onMounted(() => {
  os.value = osName()
  const type = (navigator as { connection?: { type?: string } }).connection?.type
  detectedNetwork.value = type === 'wifi' ? 'wifi' : type === 'cellular' ? 'mobile' : type === 'ethernet' ? 'cable' : undefined
  network.value = detectedNetwork.value ?? (sp.network as Network | '')
})
function pickNetwork(n: Network) {
  network.value = network.value === n ? '' : n
  sp.network = network.value
  // Changed after a test: that test is corrected too
  if (phase.value === 'done' && lastId.value) tests.update(lastId.value, { network: network.value || undefined }, { quiet: true })
  play('select')
}
const lastId = ref<string>()
// "KH" → "Cambodia"
const countryName = (code?: string) => {
  if (!code) return ''
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}
// "Cloudflare Singapore (SIN)", or just the code when the city isn't known
const serverLabel = computed(() => {
  const { colo, coloCity } = server.value
  if (!colo) return 'Cloudflare'
  return coloCity ? `Cloudflare ${coloCity} (${colo})` : `Cloudflare ${colo}`
})
function copyIp() {
  if (!server.value.ip) return
  navigator.clipboard.writeText(server.value.ip).then(() => toast('IP address copied'), () => toast.error('Couldn’t copy'))
}

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
// ---------- Past tests, a day at a time ----------
// Grouped by the day they ran (newest day first, oldest first when sorted that way); within a day, the
// chosen sort. Today's day opens by default, or the latest day when there's nothing from today yet.
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })
const dayOf = (iso: string) => localIsoDate(new Date(iso))
function dayTitle(key: string) {
  const today = localIsoDate()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (key === today) return 'Today'
  if (key === localIsoDate(yesterday)) return 'Yesterday'
  const d = new Date(`${key}T00:00`)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() && { year: 'numeric' }) })
}
const days = computed(() => {
  const groups = new Map<string, SpeedResult[]>()
  for (const h of history.value) {
    const key = dayOf(h.at)
    const list = groups.get(key)
    if (list) list.push(h)
    else groups.set(key, [h])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (sort.value === 'oldest' ? a.localeCompare(b) : b.localeCompare(a)))
    .map(([key, items]) => ({
      key,
      title: dayTitle(key),
      items,
      bestDown: Math.max(...items.map(h => h.down)),
      bestUp: Math.max(...items.map(h => h.up))
    }))
})
const openDays = ref(new Set<string>())
let daysOpened = false
watch(days, (list) => {
  if (daysOpened || !list.length) return
  daysOpened = true
  const today = localIsoDate()
  openDays.value = new Set([list.some(d => d.key === today) ? today : [...list].sort((a, b) => b.key.localeCompare(a.key))[0]!.key])
}, { immediate: true })
function toggleDay(key: string) {
  const next = new Set(openDays.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  openDays.value = next
  play(next.has(key) ? 'open' : 'close')
}
// The colour of the band a speed falls in, as on the dial
const bandColor = (mbps: number) => (BANDS.find(b => mbps < b.to) ?? BANDS.at(-1)!).color

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

// A 270° dial opening at the bottom, drawn with the gauge parts (components/gauge). Its scale isn't even
// (0, 1, 5, 10 … 1000 Mbps; DIAL_STOPS), so the gauge runs 0–1 and each stop sits at its share of the sweep.
// The box matches the one the Go button and readout are laid over: the dial's middle is 160 down of 268.
const R = 128
const STOP_AT = DIAL_STOPS.map((_, i) => i / (DIAL_STOPS.length - 1))
const stopLabel = (f: number) => {
  const v = DIAL_STOPS[Math.round(f * (DIAL_STOPS.length - 1))]!
  return v >= 1000 ? '1G' : String(v)
}
const fraction = computed(() => dialFraction(shown.value))
// What a speed is good for, as bands of colour on the dial. The cutoffs match the "Good for" list (verdicts in
// utils/speedTest.ts); while uploading the same bands say what an upload that fast is good for. The fill, the
// needle's tip and the live reading all take the colour of the band the speed is in.
const BANDS = [
  { to: 1, color: 'var(--red)', range: 'Under 1', down: 'Too slow for much', up: 'Too slow to send much', downShort: 'Too slow', upShort: 'Too slow', downIcon: 'lucide:snail', upIcon: 'lucide:snail' },
  { to: 5, color: 'var(--orange)', range: '1–5', down: 'Browsing and messages', up: 'Photos and messages', downShort: 'Browsing', upShort: 'Photos', downIcon: 'lucide:globe', upIcon: 'lucide:image' },
  { to: 25, color: 'color-mix(in srgb, var(--yellow) 75%, var(--orange))', range: '5–25', down: 'HD video', up: 'Video calls', downShort: 'HD video', upShort: 'Video calls', downIcon: 'lucide:tv-minimal-play', upIcon: 'lucide:video' },
  { to: 100, color: 'var(--green)', range: '25–100', down: '4K video', up: 'Uploading video', downShort: '4K video', upShort: 'Video', downIcon: 'lucide:monitor-play', upIcon: 'lucide:cloud-upload' },
  { to: Infinity, color: 'var(--blue)', range: '100+', down: 'Big downloads fast', up: 'Big uploads fast', downShort: 'Big files', upShort: 'Big files', downIcon: 'lucide:hard-drive-download', upIcon: 'lucide:hard-drive-upload' }
]
// Each use in "Good for" has a colour of its own, well apart from the others, so the six icons
// read apart at a glance (sharing the dial's band colours made pairs of them identical)
const USE_COLOR: Record<VerdictKey, string> = {
  browse: 'var(--blue)',
  hd: 'var(--orange)',
  uhd: 'var(--purple)',
  calls: 'var(--teal)',
  games: 'var(--pink)',
  downloads: 'var(--green)'
}
// The same bands in the dial's own units (0–1 along the sweep)
const BAND_ZONES = BANDS.map(b => ({ to: b.to === Infinity ? 1 : dialFraction(b.to), color: b.color }))
const bandIndex = computed(() => BANDS.findIndex(b => shown.value < b.to))
const showBand = computed(() => (phase.value === 'download' || phase.value === 'upload' || phase.value === 'done') && shown.value > 0)
// Hands the band's colour to everything drawn in the dial's colour (--meter-a / --meter-b)
const bandStyle = computed(() => {
  if (!showBand.value) return undefined
  const c = BANDS[bandIndex.value]!.color
  return { '--meter-a': c, '--meter-b': c }
})

// Labels light up once the needle has passed them
const labelColor = (f: number) => (f > 0 && fraction.value >= f - 1e-6 ? 'var(--ink)' : 'var(--ink-3)')
// The short pointer near the rim, in the SVG's own degrees (0 pointing right, clockwise)
const needle = computed(() => 135 + 270 * fraction.value)
const tipPos = computed(() => {
  const a = (needle.value * Math.PI) / 180
  return [R * Math.cos(a), R * Math.sin(a)] as const
})

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
    // Who and where, fetched alongside the ping so it doesn't slow the test down
    const connection = fetchConnection(signal)
    const p = await measurePing(signal, (ms, i, of) => {
      pingSamples.value = [...pingSamples.value, ms]
      progress.value = i / of
    })
    ping.value = p.ping
    jitter.value = p.jitter
    // The lookup's answers, falling back to whatever the ping's own headers said
    const found = await connection
    server.value = { ...p.server, ...Object.fromEntries(Object.entries(found).filter(([, v]) => v)) }

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
    lastId.value = tests.add({
      at: new Date().toISOString(),
      down: d.mbps,
      up: u.mbps,
      ping: p.ping,
      jitter: p.jitter,
      colo: server.value.colo,
      bytes: bytesUsed.value,
      ip: server.value.ip,
      isp: server.value.isp ?? (server.value.asn ? `AS${server.value.asn}` : undefined),
      city: server.value.city,
      country: server.value.country,
      os: os.value || undefined,
      network: network.value || undefined
    }).id
    // The new test shows under Today, opened
    openDays.value = new Set([...openDays.value, localIsoDate()])
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
      <section class="dial-card panel" aria-label="Speed test" :style="bandStyle">
        <div class="dial-wrap">
          <Gauge class="dial" :value="fraction" :min="0" :max="1" :start-angle="45" :end-angle="315" :radius="R" view-box="-160 -160 320 268" role="img" :aria-label="phase === 'idle' ? 'Speed dial' : `${PHASE_LABEL[phase]}: ${fmt(shown)} ${unitLabel}`">
            <defs>
              <linearGradient id="speed-fill" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stop-color="var(--meter-a)" />
                <stop offset="100%" stop-color="var(--meter-b)" />
              </linearGradient>
              <filter id="speed-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" />
              </filter>
            </defs>
            <!-- The bands, faint under the fill: what each stretch of the dial is good for -->
            <GaugeZones :zones="BAND_ZONES" :width="14" :gap="0.8" end-cap="round" :opacity="0.22" />
            <!-- The filled part: a soft glow underneath and the bar on top -->
            <!-- The filled part: a glow in the colour of the band the speed is in, then the fill itself in each
                 band's own colour up to the speed, so you can see which bands it has passed. Only the first
                 is rounded: the next one is drawn over its far end, so the joins stay square -->
            <template v-if="fraction > 0.002">
              <GaugeArc class="fill" :width="14" color="url(#speed-fill)" :opacity="0.45" filter="url(#speed-glow)" />
              <template v-for="(z, i) in BAND_ZONES" :key="i">
                <GaugeArc v-if="fraction > (BAND_ZONES[i - 1]?.to ?? 0)" class="fill" :from="BAND_ZONES[i - 1]?.to ?? 0" :to="Math.min(fraction, z.to)" :width="14" :color="z.color" :cap="i === 0 ? 'round' : 'butt'" />
              </template>
            </template>
            <!-- Progress through this part of the test, as a thin inner ring -->
            <circle v-if="running" class="prog" r="72" pathLength="100" transform="rotate(-90)" :style="{ strokeDasharray: `${progress * 100} 101`, opacity: progress > 0.005 ? undefined : 0 }" />
            <GaugeTicks :values="STOP_AT" :length="8" :offset="-20" color="var(--line)" />
            <GaugeTickLabels class="labels" :values="STOP_AT" :offset="-40" :font-size="11" weight="semibold" :color="labelColor" :format="stopLabel" />
            <g class="needle" :transform="`rotate(${needle})`">
              <path d="M 70 -5 L 116 0 L 70 5 Z" />
            </g>
            <circle class="tip" :cx="tipPos[0]" :cy="tipPos[1]" r="6" />
          </Gauge>

          <!-- Start sits in the middle of the dial; while testing, the live speed takes its place -->
          <Transition name="swap" mode="out-in">
            <button v-if="phase === 'idle' || phase === 'error'" key="go" type="button" class="go" :aria-label="phase === 'error' ? 'Try again' : 'Start the speed test'" @click="start">
              <span class="ring" aria-hidden="true" />
              <span class="ring late" aria-hidden="true" />
              <span class="go-label">{{ phase === 'error' ? 'Retry' : 'Go' }}</span>
            </button>
            <div v-else key="read" class="readout" aria-live="off">
              <span class="phase-tag" :class="phase">
                <AppIcon v-if="phase === 'download' || phase === 'done'" name="arrow-down" />
                <AppIcon v-else-if="phase === 'upload'" name="arrow-up" />
                <AnimatedIcon v-else-if="phase === 'ping'" name="activity" trigger="loop" />
                {{ PHASE_LABEL[phase] }}
              </span>
              <span class="big">{{ phase === 'ping' ? (ping ?? (pingSamples.at(-1) ? Math.round(pingSamples.at(-1)!) : '–')) : fmt(shown) }}</span>
              <span class="unit">{{ phase === 'ping' ? 'ms' : unitLabel }}</span>
            </div>
          </Transition>
        </div>

        <!-- The key to the colours: a strip of the five bands, like the dial laid flat, with the one the
             speed is in lit up -->
        <ol class="scale" :class="{ live: showBand }" :aria-label="phase === 'upload' ? 'What each upload speed is good for, in Mbps' : 'What each speed is good for, in Mbps'">
          <li v-for="(b, i) in BANDS" :key="b.range" :class="{ on: showBand && i === bandIndex, ahead: showBand && i > bandIndex }" :style="{ '--band': b.color }" :title="phase === 'upload' ? b.up : b.down" :aria-current="showBand && i === bandIndex ? 'true' : undefined">
            <span class="scale-bar" aria-hidden="true" />
            <AppIcon class="scale-icon" :name="phase === 'upload' ? b.upIcon : b.downIcon" />
            <span class="scale-name">{{ phase === 'upload' ? b.upShort : b.downShort }}</span>
            <span class="scale-range">{{ b.range }}</span>
          </li>
        </ol>

        <!-- What's happening, and what you can do about it -->
        <div class="dial-foot" :class="{ solo: !running && phase !== 'done' }">
          <p class="status" :class="[`is-${phase}`, { bad: phase === 'error' }]" role="status"><span class="status-dot" aria-hidden="true" />{{ status }}</p>
          <button v-if="running" type="button" class="btn btn-quiet btn-sm" @click="stop">
            <AppIcon name="square" />
            Stop
          </button>
          <button v-else-if="phase === 'done'" type="button" class="btn btn-sm" @click="start">
            <AnimatedIcon name="rotate-cw" />
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
            <AppIcon name="arrow-down" />
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
            <AppIcon name="arrow-up" />
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
            <li v-for="(v, i) in good" :key="v.label" :class="{ ok: v.ok }" :style="{ '--i': i, '--use': USE_COLOR[v.key] }">
              <!-- What it's for, with a tick or a cross on its corner -->
              <span class="use-icon" aria-hidden="true">
                <AppIcon :name="VERDICT_ICONS[v.key]" />
                <AppIcon class="mark" :name="v.ok ? 'check' : 'x'" />
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
          <!-- Where and how this test ran; saved with it -->
          <dl class="conn">
            <div>
              <dt><AppIcon name="lucide:map-pin" />Location</dt>
              <dd>{{ server.city ? [server.city, server.region !== server.city ? server.region : '', countryName(server.country)].filter(Boolean).join(', ') : 'Unknown' }}<small>Approximate, from your IP address</small></dd>
            </div>
            <div>
              <dt><AppIcon name="lucide:globe" />IP address</dt>
              <dd>
                <span class="ip">{{ server.ip ?? 'Unknown' }}</span>
                <button v-if="server.ip" type="button" class="link" @click="copyIp">Copy</button>
                <small>{{ server.isp ?? (server.asn ? `AS${server.asn}` : 'Provider unknown') }}</small>
              </dd>
            </div>
            <div>
              <dt><AppIcon name="lucide:laptop" />Device</dt>
              <dd>{{ os || 'Unknown' }}</dd>
            </div>
            <div class="conn-network">
              <dt><AppIcon :name="NETWORKS.find(n => n.value === network)?.icon ?? 'lucide:wifi'" />Network</dt>
              <dd>
                <span class="net-pick" role="radiogroup" aria-label="Network type">
                  <button v-for="n in NETWORKS" :key="n.value" type="button" role="radio" :aria-checked="network === n.value" @click="pickNetwork(n.value)">{{ n.label }}</button>
                </span>
                <small>{{ detectedNetwork ? 'Detected by your browser' : 'Your browser doesn’t say, so pick one; it’s remembered' }}</small>
              </dd>
            </div>
            <div>
              <dt><AppIcon name="lucide:server" />Server</dt>
              <dd>{{ serverLabel }}<small>Data used: {{ formatBytes(bytesUsed) }}</small></dd>
            </div>
          </dl>
        </section>
      </Transition>

      <section v-if="history.length" class="history panel" aria-label="Past tests">
        <div class="history-head">
          <h2>Past tests</h2>
          <div class="history-tools">
            <AppSelect v-model="sort" class="history-sort" aria-label="Sort past tests" :options="SORTS" />
            <button type="button" class="btn btn-quiet btn-sm clear-btn" title="Clear past tests" @click="clearHistory">
              <AnimatedIcon name="trash-2" />
              Clear
            </button>
          </div>
        </div>
        <div class="days">
          <section v-for="d in days" :key="d.key" class="day" :class="{ open: openDays.has(d.key) }">
            <h3 class="day-h">
              <button type="button" class="day-head" :aria-expanded="openDays.has(d.key)" :aria-controls="`day-${d.key}`" @click="toggleDay(d.key)">
                <span class="day-title">{{ d.title }}</span>
                <span class="day-count">{{ d.items.length }} {{ d.items.length === 1 ? 'test' : 'tests' }}</span>
                <span class="day-best" :aria-label="`Best ${fmt(d.bestDown)} down, ${fmt(d.bestUp)} up`">
                  <span class="best-label" aria-hidden="true">Best</span>
                  <span class="best-down" :style="{ '--band': bandColor(d.bestDown) }"><AppIcon name="arrow-down" />{{ fmt(d.bestDown) }}</span>
                  <span class="best-up"><AppIcon name="arrow-up" />{{ fmt(d.bestUp) }}</span>
                </span>
                <AppIcon class="chev" name="chevron-down" />
              </button>
            </h3>
            <div :id="`day-${d.key}`" class="day-body" :inert="!openDays.has(d.key)">
              <div class="day-inner">
                <TransitionGroup tag="ul" name="list" class="history-list">
                  <li v-for="h in d.items" :key="h.id">
                    <span class="h-time">{{ timeFmt.format(new Date(h.at)) }}</span>
                    <span class="h-info">
                      <span v-if="h.city || h.network || h.os" class="where" :title="h.ip ? `IP ${h.ip}${h.isp ? ` · ${h.isp}` : ''}` : undefined">
                        {{ [h.city, networkLabel(h.network), h.os?.split(' · ')[0]].filter(Boolean).join(' · ') }}
                      </span>
                      <!-- What it was good enough for -->
                      <span class="uses" :aria-label="`Good for: ${goodFor(h).map(v => v.label).join(', ') || 'not much'}`">
                        <span v-for="v in goodFor(h)" :key="v.key" :title="v.label" :style="{ color: USE_COLOR[v.key] }"><AppIcon :name="VERDICT_ICONS[v.key]" /></span>
                      </span>
                    </span>
                    <span class="h-down" :style="{ '--band': bandColor(h.down) }"><AppIcon name="arrow-down" />{{ fmt(h.down) }}</span>
                    <span class="h-up"><AppIcon name="arrow-up" />{{ fmt(h.up) }}</span>
                    <span class="h-ping">{{ Math.round(h.ping) }} ms</span>
                  </li>
                </TransitionGroup>
              </div>
            </div>
          </section>
        </div>
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
@media (min-width: 1100px) {
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
@media (min-width: 1100px) {
  .dial-wrap {
    width: min(100%, 30rem);
  }
}

.dial {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.fill {
  transition: stroke 0.4s;
}

/* The fill's colour eases from band to band */
.dial stop {
  transition: stop-color 0.4s;
}

.prog {
  fill: none;
  stroke: var(--meter-a);
  stroke-width: 3;
  stroke-linecap: round;
  opacity: 0.35;
  transition: stroke-dasharray var(--dur-fast) linear, opacity var(--dur-slow);
}

.labels :deep(text) {
  transition: fill var(--dur-slow);
}

.needle {
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
  transition: transform var(--dur) cubic-bezier(0.2, 0.8, 0.2, 1);
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
  transition: color var(--dur-slow);
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
  transition: opacity var(--dur), transform var(--dur-slow) cubic-bezier(0.2, 0.8, 0.2, 1);
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

.scale {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.35rem;
  width: min(100%, 30rem);
  margin: 0.75rem 0 0;
  padding: 0;
  list-style: none;
}

.scale li {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  min-width: 0;
  padding: 0 0.15rem 0.45rem;
  text-align: center;
  border-radius: var(--radius-sm);
  transition: background-color var(--dur-slow), opacity var(--dur-slow);
}

/* The band's colour along the top; together the five read as the dial's arc laid flat */
.scale-bar {
  align-self: stretch;
  height: 6px;
  margin-bottom: 0.35rem;
  background: var(--band);
  border-radius: var(--radius-pill);
  opacity: 0.55;
  transition: height var(--dur-slow), opacity var(--dur-slow), box-shadow var(--dur-slow);
}

.scale-icon {
  width: 1.05rem;
  height: 1.05rem;
  color: var(--band);
}

.scale-name {
  max-width: 100%;
  overflow: hidden;
  font-size: var(--text-xs);
  font-weight: 600;
  line-height: 1.2;
  color: var(--ink-2);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scale-range {
  font-size: var(--text-2xs);
  font-variant-numeric: tabular-nums;
  color: var(--ink-3);
}

/* While a speed is showing, the bands it hasn't reached step back, the ones it has passed stay, and its own
   comes forward, as on the dial */
.scale li.ahead {
  opacity: 0.45;
}

.scale li.on {
  background: color-mix(in srgb, var(--band) 12%, transparent);
}

.scale li.on .scale-bar {
  height: 8px;
  opacity: 1;
  box-shadow: 0 0 12px color-mix(in srgb, var(--band) 55%, transparent);
}

.scale li.on .scale-name {
  color: var(--ink);
}

/* ---------- Under the dial: status and the button ---------- */
.dial-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: min(100%, 30rem);
  min-height: 3.25rem;
  margin-top: 0.85rem;
  padding-top: 0.85rem;
  border-top: 1px solid var(--line);
}

/* Nothing to press (before a test; Go is in the dial): the status sits in the middle */
.dial-foot.solo {
  justify-content: center;
}

.dial-foot .btn {
  flex: none;
}

.dial-foot .btn .app-icon {
  width: 0.95rem;
  height: 0.95rem;
}

.status-dot {
  flex: none;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--ink-3);
}

.status.is-ping .status-dot,
.status.is-download .status-dot,
.status.is-upload .status-dot {
  background: var(--meter-a);
  animation: status-pulse 1s ease-in-out infinite alternate;
}

.status.is-done .status-dot {
  background: var(--green);
}

.status.bad .status-dot {
  background: var(--bad-ink);
}

@keyframes status-pulse {
  to { opacity: 0.35; }
}

@media (prefers-reduced-motion: reduce) {
  .status-dot { animation: none !important; }
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  margin: 0;
  color: var(--ink-2);
  font-weight: 500;
}

.status.bad {
  color: var(--bad-ink);
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
  transition: border-color var(--dur-slow), box-shadow var(--dur-slow), transform var(--dur-slow) cubic-bezier(0.2, 0.8, 0.2, 1);
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
  font-size: var(--text-xl);
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--ink-3);
  transition: color var(--dur-slow);
}

.stat.has .stat-value,
.stat.active .stat-value {
  color: var(--ink);
}

.stat-value small {
  font-size: var(--text-xs);
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
  font-size: var(--text-title);
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
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}

.verdicts li.ok .use-icon {
  background: color-mix(in srgb, var(--use, var(--green)) 16%, var(--surface));
}

.verdicts svg {
  flex: none;
  width: 1.1rem;
  height: 1.1rem;
  fill: none;
  stroke: var(--ink-3);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.verdicts li.ok svg {
  stroke: var(--use, var(--good-ink));
}

.verdicts li.ok .mark {
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

.conn {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr));
  gap: 0.9rem 1.25rem;
  margin: 1.25rem 0 0;
  padding-top: 1rem;
  border-top: 1px solid var(--line);
}

.conn div {
  min-width: 0;
}

.conn dt {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.conn dt .app-icon {
  width: 0.9rem;
  height: 0.9rem;
}

.conn dd {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.15rem 0.5rem;
  margin: 0.25rem 0 0;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.conn small {
  flex-basis: 100%;
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--ink-3);
}

.ip {
  font-variant-numeric: tabular-nums;
}

.conn-network {
  grid-column: span 2;
}

@media (max-width: 480px) {
  .conn-network {
    grid-column: auto;
  }
}

.net-pick {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.net-pick button {
  padding: 0.3rem 0.65rem;
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-2);
  background: var(--surface-2);
  border: 0;
  border-radius: var(--radius-pill);
  box-shadow: inset 0 0 0 1px var(--line);
  cursor: pointer;
}

.net-pick button[aria-checked='true'] {
  color: var(--on-accent);
  background: var(--accent);
  box-shadow: none;
}

.where {
  display: block;
  font-size: var(--text-2xs);
  color: var(--ink-3);
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
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 0.6rem 1rem;
  margin-bottom: 1rem;
}

.history .history-head h2 {
  margin: 0;
}

.history-tools {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

/* A compact pill, the same height as the Clear button beside it */
.history-sort {
  width: auto;
  min-width: 9.5rem;
}

.history-sort :deep(.trigger) {
  min-height: 2.25rem;
  padding: 0.3rem 0.65rem 0.3rem 0.85rem;
  font-size: var(--text-sm);
  font-weight: 600;
  border-radius: var(--radius-pill);
}

.history-sort :deep(.chevron) {
  width: 0.9rem;
  height: 0.9rem;
}

.clear-btn {
  min-height: 2.25rem;
}

.clear-btn .app-icon {
  width: 0.95rem;
  height: 0.95rem;
}

/* ---------- A day at a time ---------- */
.days {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.day {
  background: var(--surface-2);
  border-radius: var(--radius-lg);
  box-shadow: inset 0 0 0 1px var(--line);
}

.day-h {
  margin: 0;
  font-size: inherit;
}

.day-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.7rem 0.85rem 0.7rem 1rem;
  font: inherit;
  color: var(--ink);
  text-align: left;
  background: none;
  border: 0;
  border-radius: inherit;
  cursor: pointer;
}

.day-head:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.day-title {
  font-weight: 700;
}

.day-count {
  padding: 0.1rem 0.5rem;
  font-size: var(--text-2xs);
  font-weight: 600;
  color: var(--ink-2);
  background: var(--surface);
  border-radius: var(--radius-pill);
  box-shadow: inset 0 0 0 1px var(--line);
}

.day-best {
  display: inline-flex;
  gap: 0.6rem;
  margin-left: auto;
  font-size: var(--text-sm);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.day-best > span {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
}

.best-label {
  font-size: var(--text-2xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.best-down .app-icon {
  color: var(--band);
}

.best-up .app-icon {
  color: var(--cyan);
}

.day-best .app-icon {
  width: 0.85rem;
  height: 0.85rem;
}

.chev {
  flex: none;
  width: 1.1rem;
  height: 1.1rem;
  color: var(--ink-3);
  transition: rotate var(--dur) cubic-bezier(0.2, 0, 0, 1);
}

.day.open .chev {
  rotate: 180deg;
}

/* Opens and closes smoothly: the body's one row grows from nothing to its height */
.day-body {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--dur-slow) cubic-bezier(0.2, 0, 0, 1);
}

.day.open .day-body {
  grid-template-rows: 1fr;
}

.day-inner {
  min-height: 0;
  overflow: hidden;
}

@media (prefers-reduced-motion: reduce) {
  .day-body,
  .chev { transition: none; }
}

/* ---------- The tests in a day ---------- */
.history-list {
  margin: 0 0.6rem 0.6rem;
  padding: 0;
  list-style: none;
  background: var(--surface);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--line);
}

.history-list li {
  display: grid;
  grid-template-columns: 3.25rem minmax(0, 1fr) 4.75rem 4.75rem 3.5rem;
  grid-template-areas: 'time info down up ping';
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  border-top: 1px solid var(--line);
  font-variant-numeric: tabular-nums;
}

.history-list li:first-child {
  border-top: 0;
}

.h-time {
  grid-area: time;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-2);
}

/* Where it ran, with what that test was good enough for in small icons */
.h-info {
  grid-area: info;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.where {
  overflow: hidden;
  font-size: var(--text-xs);
  color: var(--ink-3);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.uses {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.history-list .uses .app-icon {
  width: 0.95rem;
  height: 0.95rem;
}

.h-down,
.h-up {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-weight: 650;
}

.h-down { grid-area: down; }
.h-up { grid-area: up; }

.h-down .app-icon {
  color: var(--band, var(--accent));
}

.h-up .app-icon {
  color: var(--cyan);
}

.h-ping {
  grid-area: ping;
  color: var(--ink-2);
  text-align: right;
  font-size: var(--text-sm);
}

/* Phones: the numbers on one line, where it ran and what it was good for underneath */
@media (max-width: 640px) {
  .history-list li {
    grid-template-columns: 3rem minmax(0, 1fr) minmax(0, 1fr) 3.25rem;
    grid-template-areas:
      'time down up ping'
      '. info info info';
    row-gap: 0.3rem;
  }

  .day-best .best-up,
  .day-best .best-label {
    display: none;
  }
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
  font-size: var(--text-md);
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
    font-size: var(--text-lg);
  }

  .stat-value small {
    font-size: var(--text-2xs);
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
