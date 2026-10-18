import { createReadStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { createInterface } from 'node:readline'
import { defineEventHandler, getQuery, getRequestIP, HTTPError } from 'h3'
import { estimateCost } from '../../utils/claudePricing'

// Claude usage (the Claude Code tab): tokens, sessions and an estimated cost from the logs Claude Code keeps
// on this computer (~/.claude/projects/<project>/<session>.jsonl). Only works when this app runs on the
// same computer, and only answers requests from that computer itself, so nobody on the network can read
// them. On a hosted copy the folder doesn't exist and the page says so.
//   /api/claude/code?days=30   (0 = everything)

interface Entry {
  id: string // the API message id: one reply can be logged over several lines, counted once
  at: number
  model: string
  project: string
  session: string
  input: number
  output: number
  cacheRead: number
  cacheWrite5m: number
  cacheWrite1h: number
  cost: number | null
}

const ROOT = join(homedir(), '.claude', 'projects')
// Each file's entries, until the file changes (logs only grow, so size and time say when to read it again)
const cache = new Map<string, { size: number, mtime: number, entries: Entry[] }>()

// Temporary folders some tools create end in a UUID; they're one project, not hundreds
const projectName = (cwd: string) => basename(cwd || 'Unknown').replace(/[-_]?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, '') || 'Unknown'

async function readEntries(file: string): Promise<Entry[]> {
  const entries: Entry[] = []
  const lines = createInterface({ input: createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity })
  for await (const line of lines) {
    // Only replies carry usage; skip the rest (and the very large request copies) without parsing them
    if (!line.includes('"type":"assistant"') || !line.includes('"usage":{')) continue
    let row: { timestamp?: string, sessionId?: string, cwd?: string, message?: { id?: string, model?: string, usage?: Record<string, unknown> } }
    try {
      row = JSON.parse(line)
    } catch {
      continue
    }
    const msg = row.message
    const u = msg?.usage as { input_tokens?: number, output_tokens?: number, cache_read_input_tokens?: number, cache_creation_input_tokens?: number, cache_creation?: { ephemeral_5m_input_tokens?: number, ephemeral_1h_input_tokens?: number }, speed?: string } | undefined
    if (!msg?.id || !u || !row.timestamp || !msg.model || msg.model === '<synthetic>') continue
    const write1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0
    const write5m = u.cache_creation?.ephemeral_5m_input_tokens ?? Math.max(0, (u.cache_creation_input_tokens ?? 0) - write1h)
    const counts = { input: u.input_tokens ?? 0, output: u.output_tokens ?? 0, cacheRead: u.cache_read_input_tokens ?? 0, cacheWrite5m: write5m, cacheWrite1h: write1h }
    entries.push({
      id: msg.id,
      at: Date.parse(row.timestamp),
      model: msg.model,
      project: projectName(row.cwd ?? ''),
      session: row.sessionId ?? '',
      ...counts,
      cost: estimateCost(msg.model, counts, u.speed === 'fast')
    })
  }
  return entries
}

async function allFiles(dir: string): Promise<string[]> {
  const found = await readdir(dir, { recursive: true, withFileTypes: true })
  return found.filter(d => d.isFile() && d.name.endsWith('.jsonl')).map(d => join(d.parentPath, d.name))
}

async function loadAll() {
  const files = await allFiles(ROOT)
  const out: Entry[][] = []
  // A few at a time: the first read of a big history takes a while, later ones only read what changed
  for (let i = 0; i < files.length; i += 8) {
    out.push(...await Promise.all(files.slice(i, i + 8).map(async (file) => {
      const s = await stat(file)
      const hit = cache.get(file)
      if (hit && hit.size === s.size && hit.mtime === s.mtimeMs) return hit.entries
      const entries = await readEntries(file).catch(() => [])
      cache.set(file, { size: s.size, mtime: s.mtimeMs, entries })
      return entries
    })))
  }
  return out.flat()
}

const localDay = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event) ?? ''
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) {
    throw new HTTPError({ status: 403, message: 'Claude Code usage is only readable on the computer this app runs on.' })
  }
  try {
    await stat(ROOT)
  } catch {
    return { available: false as const }
  }

  const days = Math.max(0, Math.min(Number(getQuery(event).days) || 0, 3650))
  const since = days ? (() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - days + 1)
    return d.getTime()
  })() : 0

  // Counted once each, however many lines or files a reply was logged in
  const seen = new Set<string>()
  const entries = (await loadAll()).filter((e) => {
    if (e.at < since || seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })

  type Totals = { tokens: number, input: number, output: number, cacheRead: number, cacheWrite: number, cost: number, unpriced: number, messages: number }
  const blank = (): Totals => ({ tokens: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, unpriced: 0, messages: 0 })
  const add = (t: Totals, e: Entry) => {
    const write = e.cacheWrite5m + e.cacheWrite1h
    t.input += e.input
    t.output += e.output
    t.cacheRead += e.cacheRead
    t.cacheWrite += write
    t.tokens += e.input + e.output + e.cacheRead + write
    if (e.cost === null) t.unpriced++
    else t.cost += e.cost
    t.messages++
  }

  const total = blank()
  const byDay = new Map<string, Totals>()
  const byModel = new Map<string, Totals>()
  const byProject = new Map<string, Totals & { sessions: Set<string> }>()
  const sessions = new Set<string>()
  for (const e of entries) {
    add(total, e)
    sessions.add(e.session)
    const day = localDay(e.at)
    add(byDay.get(day) ?? byDay.set(day, blank()).get(day)!, e)
    add(byModel.get(e.model) ?? byModel.set(e.model, blank()).get(e.model)!, e)
    const p = byProject.get(e.project) ?? byProject.set(e.project, { ...blank(), sessions: new Set() }).get(e.project)!
    add(p, e)
    p.sessions.add(e.session)
  }

  // Every day in the range, empty ones included, so the chart has no gaps
  const firstDay = since || (entries.length ? Math.min(...entries.map(e => e.at)) : Date.now())
  const daily: (Totals & { day: string })[] = []
  for (let d = new Date(firstDay); d.getTime() <= Date.now(); d.setDate(d.getDate() + 1)) {
    const day = localDay(d.getTime())
    daily.push({ day, ...(byDay.get(day) ?? blank()) })
  }

  return {
    available: true as const,
    days,
    total: { ...total, sessions: sessions.size, projects: byProject.size },
    daily,
    models: [...byModel].map(([model, t]) => ({ model, ...t })).sort((a, b) => b.cost - a.cost || b.tokens - a.tokens),
    projects: [...byProject].map(([project, { sessions: s, ...t }]) => ({ project, sessions: s.size, ...t })).sort((a, b) => b.cost - a.cost || b.tokens - a.tokens).slice(0, 15)
  }
})
