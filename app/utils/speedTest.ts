// Internet speed test against Cloudflare's speed servers (the ones speed.cloudflare.com uses), so the
// result is this device's connection to a nearby data centre, and none of it goes through this site.
// Ping first, then download and upload over a few connections at once, each for a set time. The first
// part of each is left out of the result while the connections speed up, like other speed tests do.
const BASE = 'https://speed.cloudflare.com'

export interface ServerInfo {
  /** Cloudflare's code for the data centre that answered, like SIN or HKG */
  colo?: string
  /** Where Cloudflare thinks you are */
  city?: string
  country?: string
}

export interface PingResult {
  ping: number
  jitter: number
  server: ServerInfo
}

export interface RunOptions {
  seconds: number
  signal: AbortSignal
  /** Live speed in Mbps, how far through (0–1), and bytes moved so far */
  onProgress: (mbps: number, progress: number, bytes: number) => void
}

export interface RunResult {
  mbps: number
  bytes: number
}

const DOWN_STREAMS = 4
const UP_STREAMS = 3
const DOWN_CHUNK = 25_000_000
const UP_CHUNK = 4_000_000
/** The share of each run left out while connections speed up */
const WARMUP = 0.25
/** The live reading averages this much time, so it moves smoothly instead of jumping */
const WINDOW_MS = 1200

const fresh = () => `r=${Math.random().toString(36).slice(2)}`

// Cloudflare reports how long it spent on the request itself; that isn't network time
function serverMs(res: Response) {
  const m = /dur=([\d.]+)/.exec(res.headers.get('server-timing') ?? '')
  return m ? Number(m[1]) : 0
}

export async function measurePing(signal: AbortSignal, onSample: (ms: number, i: number, of: number) => void, count = 12): Promise<PingResult> {
  const times: number[] = []
  let server: ServerInfo = {}
  // One extra at the start opens the connection; it's slower and not counted
  for (let i = 0; i <= count; i++) {
    const start = performance.now()
    const res = await fetch(`${BASE}/__down?bytes=0&${fresh()}`, { cache: 'no-store', signal })
    await res.arrayBuffer()
    const ms = Math.max(1, performance.now() - start - serverMs(res))
    if (i === 0) {
      server = {
        colo: res.headers.get('cf-meta-colo') ?? undefined,
        city: res.headers.get('cf-meta-city') ?? undefined,
        country: res.headers.get('cf-meta-country') ?? undefined
      }
      continue
    }
    times.push(ms)
    onSample(ms, i, count)
  }
  const sorted = [...times].sort((a, b) => a - b)
  const ping = sorted[Math.floor(sorted.length / 2)]!
  const jitter = times.slice(1).reduce((sum, t, i) => sum + Math.abs(t - times[i]!), 0) / Math.max(1, times.length - 1)
  return { ping, jitter, server }
}

// Shared by download and upload: counts bytes as they move, reports a smoothed live speed every
// frame-ish, and works out the final speed from after the warm-up
function meter(seconds: number, onProgress: RunOptions['onProgress']) {
  const start = performance.now()
  const total = seconds * 1000
  let bytes = 0
  let warmBytes = 0
  let warmAt = 0
  const samples: { t: number, bytes: number }[] = [{ t: start, bytes: 0 }]

  const timer = setInterval(() => {
    const now = performance.now()
    samples.push({ t: now, bytes })
    while (samples.length > 2 && now - samples[0]!.t > WINDOW_MS) samples.shift()
    const first = samples[0]!
    const mbps = now > first.t ? ((bytes - first.bytes) * 8) / ((now - first.t) / 1000) / 1e6 : 0
    if (!warmAt && now - start >= total * WARMUP) {
      warmAt = now
      warmBytes = bytes
    }
    onProgress(mbps, Math.min(1, (now - start) / total), bytes)
  }, 100)

  return {
    add: (n: number) => (bytes += n),
    done: () => performance.now() - start >= total,
    finish(): RunResult {
      clearInterval(timer)
      const end = performance.now()
      const from = warmAt || start
      const moved = warmAt ? bytes - warmBytes : bytes
      return { mbps: (moved * 8) / ((end - from) / 1000) / 1e6, bytes }
    },
    stop: () => clearInterval(timer)
  }
}

export async function measureDownload({ seconds, signal, onProgress }: RunOptions): Promise<RunResult> {
  const m = meter(seconds, onProgress)
  const stop = new AbortController()
  const cancel = () => stop.abort()
  signal.addEventListener('abort', cancel)
  const deadline = setTimeout(cancel, seconds * 1000)

  async function stream() {
    while (!m.done() && !stop.signal.aborted) {
      const res = await fetch(`${BASE}/__down?bytes=${DOWN_CHUNK}&${fresh()}`, { cache: 'no-store', signal: stop.signal })
      const reader = res.body!.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        m.add(value.byteLength)
      }
    }
  }

  try {
    await Promise.all(Array.from({ length: DOWN_STREAMS }, () => stream().catch((e) => {
      // Stopping at the deadline aborts the downloads still running; that's the plan, not a failure
      if (!stop.signal.aborted) throw e
    })))
  } finally {
    clearTimeout(deadline)
    signal.removeEventListener('abort', cancel)
    m.stop()
  }
  if (signal.aborted) throw new DOMException('Stopped', 'AbortError')
  return m.finish()
}

// Random bytes, so nothing along the way can compress the upload and flatter the result
let payload: Blob | undefined
function uploadPayload() {
  if (!payload) {
    const bytes = new Uint8Array(UP_CHUNK)
    for (let i = 0; i < bytes.length; i += 65536) crypto.getRandomValues(bytes.subarray(i, i + 65536))
    payload = new Blob([bytes])
  }
  return payload
}

export async function measureUpload({ seconds, signal, onProgress }: RunOptions): Promise<RunResult> {
  const m = meter(seconds, onProgress)
  const body = uploadPayload()
  const live = new Set<XMLHttpRequest>()
  const cancel = () => live.forEach(x => x.abort())
  signal.addEventListener('abort', cancel)
  const deadline = setTimeout(cancel, seconds * 1000)

  // XHR rather than fetch: only XHR says how much of an upload has gone so far
  const send = () => new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    live.add(xhr)
    let sent = 0
    xhr.upload.onprogress = (e) => {
      m.add(e.loaded - sent)
      sent = e.loaded
    }
    xhr.onloadend = () => {
      live.delete(xhr)
      if (xhr.status === 0 && !m.done() && !signal.aborted) reject(new Error('Upload failed'))
      else resolve()
    }
    xhr.open('POST', `${BASE}/__up?${fresh()}`)
    xhr.send(body)
  })

  async function stream() {
    while (!m.done() && !signal.aborted) await send()
  }

  try {
    await Promise.all(Array.from({ length: UP_STREAMS }, stream))
  } finally {
    clearTimeout(deadline)
    signal.removeEventListener('abort', cancel)
    m.stop()
  }
  if (signal.aborted) throw new DOMException('Stopped', 'AbortError')
  return m.finish()
}

// ---------- Reading the result ----------

/** Equal room on the dial for each step, so 5 Mbps and 500 Mbps both move the needle visibly */
export const DIAL_STOPS = [0, 1, 5, 10, 20, 50, 100, 250, 500, 1000]

export function dialFraction(mbps: number) {
  const s = DIAL_STOPS
  if (mbps <= 0) return 0
  if (mbps >= s[s.length - 1]!) return 1
  const i = s.findIndex(v => v > mbps)
  const lo = s[i - 1]!
  const hi = s[i]!
  return (i - 1 + (mbps - lo) / (hi - lo)) / (s.length - 1)
}

export type VerdictKey = 'browse' | 'hd' | 'uhd' | 'calls' | 'games' | 'downloads'

export interface Verdict {
  key: VerdictKey
  label: string
  ok: boolean
}

/** A small line icon for each use (16×16, drawn with a stroke) */
export const VERDICT_ICONS: Record<VerdictKey, string[]> = {
  browse: ['M14 8A6 6 0 1 1 2 8a6 6 0 0 1 12 0z', 'M2 8h12', 'M8 2c2.2 2.2 2.2 9.8 0 12M8 2C5.8 4.2 5.8 11.8 8 14'],
  hd: ['M2 3.5h12v8H2z', 'M6 14h4', 'M7 5.8v3.4l2.8-1.7z'],
  uhd: ['M4 4.5v4h3M6 4.5v7', 'M9.5 4.5v7M12.5 4.5 9.6 8l2.9 3.5'],
  calls: ['M2 4.5h8v7H2z', 'M10 7l4-2.2v6.4L10 9'],
  games: ['M5 5h6a3.2 3.2 0 0 1 2.9 4.6l-.5 1.1a1.7 1.7 0 0 1-2.8.4L9.6 10H6.4l-1 1.1a1.7 1.7 0 0 1-2.8-.4l-.5-1.1A3.2 3.2 0 0 1 5 5z', 'M5.5 6.8v2M4.5 7.8h2', 'M10.3 7.3h.01M11.5 8.5h.01'],
  downloads: ['M8 2v8M4.5 6.6 8 10l3.5-3.4', 'M3 13.5h10']
}

/** What the connection is good for, from the numbers that matter for each */
export function verdicts(down: number, up: number, ping: number, jitter: number): Verdict[] {
  return [
    { key: 'browse', label: 'Browsing and messages', ok: down >= 1 },
    { key: 'hd', label: 'HD video', ok: down >= 5 },
    { key: 'uhd', label: '4K video', ok: down >= 25 },
    { key: 'calls', label: 'Video calls', ok: down >= 3 && up >= 2 && ping < 150 },
    { key: 'games', label: 'Online games', ok: down >= 3 && ping < 60 && jitter < 25 },
    { key: 'downloads', label: 'Big downloads fast', ok: down >= 100 }
  ]
}

export function formatBytes(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`
  if (n >= 1e6) return `${Math.round(n / 1e6)} MB`
  return `${Math.round(n / 1e3)} KB`
}
