import { defineEventHandler, getQuery, HTTPError } from 'h3'
import { fetchPage } from '../utils/publicFetch'

// Reads a page's title, description and icon so a saved bookmark gets a proper name.
// Only public http(s) sites: private, loopback and link-local addresses are refused so this
// route can't be used to poke at the server's own network.
export interface LinkPreview {
  url: string // final URL after redirects
  title: string // best title: og:title, else <title>
  description: string // best description: meta description, else og:description
  icon: string // absolute URL; /favicon.ico when the page doesn't declare one
  pageTitle: string // the page's own <title>
  ogTitle: string
  ogDescription: string
  image: string // og:image / twitter:image, absolute; '' when there isn't one
  siteName: string // og:site_name
  domain: string // hostname without www.
}

const MAX_BYTES = 512 * 1024

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
  const domain = url.hostname.replace(/^www\./, '')
  const fallback: LinkPreview = { url: url.href, title: '', description: '', icon: new URL('/favicon.ico', url).href, pageTitle: '', ogTitle: '', ogDescription: '', image: '', siteName: '', domain }
  // Error pages ("Forbidden", "Just a moment…") would make a misleading title
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) {
    res.body?.cancel().catch(() => {})
    return fallback
  }

  const html = await readCapped(res)
  const head = html.split(/<\/head>/i)[0] ?? html
  const pageTitle = decode(head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').slice(0, 200)
  const ogTitle = meta(head, ['og:title', 'twitter:title']).slice(0, 200)
  const ogDescription = meta(head, ['og:description', 'twitter:description']).slice(0, 300)
  const rawImage = meta(head, ['og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image', 'twitter:image:src'])
  let image = ''
  try {
    const abs = rawImage ? new URL(rawImage, url) : undefined
    if (abs && (abs.protocol === 'https:' || abs.protocol === 'http:')) image = abs.href
  } catch {}
  return {
    url: url.href,
    title: ogTitle || pageTitle,
    description: (meta(head, ['description']) || ogDescription).slice(0, 300),
    icon: iconOf(head, url),
    pageTitle,
    ogTitle,
    ogDescription,
    image,
    siteName: meta(head, ['og:site_name']).slice(0, 100),
    domain
  }
})
