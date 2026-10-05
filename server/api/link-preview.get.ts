import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { defineEventHandler, getQuery, HTTPError } from 'h3'

// Reads a page's title, description and icon so a saved bookmark gets a proper name.
// Only public http(s) sites: private, loopback and link-local addresses are refused so this
// route can't be used to poke at the server's own network.
export interface LinkPreview {
  url: string // final URL after redirects
  title: string
  description: string
  icon: string // absolute URL; /favicon.ico when the page doesn't declare one
}

const MAX_BYTES = 512 * 1024
const MAX_REDIRECTS = 4

function isPrivate(ip: string) {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase()
    if (v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')) return true
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    return mapped ? isPrivate(mapped[1]!) : false
  }
  const [a, b] = ip.split('.').map(Number) as [number, number]
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
}

async function assertPublic(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new HTTPError({ status: 400, message: 'Only http and https links can be previewed' })
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => [])
  if (!addresses.length) throw new HTTPError({ status: 404, message: 'That site couldn’t be found' })
  if (addresses.some(a => isPrivate(a.address))) throw new HTTPError({ status: 400, message: 'Private network addresses can’t be previewed' })
}

// Follow redirects by hand so every hop gets the same public-address check
async function fetchPage(start: URL) {
  let url = start
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(url)
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(6000),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; OusaAppBookmarks/1.0)', 'accept': 'text/html,application/xhtml+xml' }
    })
    const next = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && next) {
      url = new URL(next, url)
      continue
    }
    return { res, url }
  }
  throw new HTTPError({ status: 508, message: 'Too many redirects' })
}

async function readCapped(res: Response) {
  const reader = res.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let size = 0
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    size += value.length
  }
  reader.cancel().catch(() => {})
  return new TextDecoder().decode(Buffer.concat(chunks))
}

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ', middot: '·', bull: '•', ndash: '–', mdash: '—', hellip: '…',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', copy: '©', reg: '®', trade: '™', times: '×'
}

const decode = (s: string) => s
  .replace(/&#x([\da-f]+);/gi, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z]+);/gi, (m, name: string) => NAMED[name.toLowerCase()] ?? m)
  .replace(/\s+/g, ' ').trim()

// Attribute value from a single tag, in any attribute order
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))?.slice(1).find(v => v !== undefined)

function meta(html: string, keys: string[]) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attr(tag, 'property') ?? attr(tag, 'name') ?? '').toLowerCase()
    if (keys.includes(key)) {
      const content = attr(tag, 'content')
      if (content) return decode(content)
    }
  }
  return ''
}

function iconOf(html: string, base: URL) {
  // Prefer apple-touch-icon (bigger, sharper), then any declared icon
  const links = (html.match(/<link\b[^>]*>/gi) ?? []).map(tag => ({ rel: (attr(tag, 'rel') ?? '').toLowerCase(), href: attr(tag, 'href') }))
  const pick = links.find(l => l.rel.includes('apple-touch-icon') && l.href) ?? links.find(l => /\bicon\b/.test(l.rel) && l.href)
  try {
    return new URL(pick?.href ? decode(pick.href) : '/favicon.ico', base).href
  } catch {
    return new URL('/favicon.ico', base).href
  }
}

export default defineEventHandler(async (event): Promise<LinkPreview> => {
  const raw = String(getQuery(event).url ?? '').trim()
  let start: URL
  try {
    start = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    throw new HTTPError({ status: 400, message: 'That doesn’t look like a link' })
  }

  let page: Awaited<ReturnType<typeof fetchPage>>
  try {
    page = await fetchPage(start)
  } catch (e) {
    if (e instanceof HTTPError) throw e
    throw new HTTPError({ status: 502, message: 'Couldn’t reach that site' })
  }

  const { res, url } = page
  const fallback = { url: url.href, title: '', description: '', icon: new URL('/favicon.ico', url).href }
  // Error pages ("Forbidden", "Just a moment…") would make a misleading title
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) {
    res.body?.cancel().catch(() => {})
    return fallback
  }

  const html = await readCapped(res)
  const head = html.split(/<\/head>/i)[0] ?? html
  const title = meta(head, ['og:title', 'twitter:title']) || decode(head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
  return {
    url: url.href,
    title: title.slice(0, 200),
    description: meta(head, ['description', 'og:description', 'twitter:description']).slice(0, 300),
    icon: iconOf(head, url)
  }
})
