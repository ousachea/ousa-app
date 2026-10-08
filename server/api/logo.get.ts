import { defineEventHandler, getQuery, HTTPError, setResponseHeaders } from 'h3'
import { fetchPage } from '../utils/publicFetch'

// A company's logo, served from this site (CHECKLIST.md #50, #54): /api/logo?domain=samsung.com.
// Many brands don't keep an icon at /favicon.ico (Samsung, Google Store, RedMagic) or refuse it to
// other sites (Sony), so this reads the icon the homepage declares (apple-touch-icon first), fetches
// it once and hands it back with a long cache. Only the domain is sent anywhere; no personal data.
const MAX_IMAGE = 300 * 1024
const DOMAIN = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/
const TTL = 7 * 86_400_000

interface Logo { body: Uint8Array, type: string, at: number }
const cache = new Map<string, Logo | null>()

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))?.slice(1).find(v => v !== undefined)

// Biggest declared icon first: apple-touch-icon, then sized icons, then any icon, then /favicon.ico
function iconCandidates(html: string, base: URL) {
  const links = (html.match(/<link\b[^>]*>/gi) ?? []).map(tag => ({ rel: (attr(tag, 'rel') ?? '').toLowerCase(), href: attr(tag, 'href'), sizes: attr(tag, 'sizes') ?? '' }))
  const size = (s: string) => Number.parseInt(s.split('x')[0] ?? '', 10) || 0
  const ranked = [
    ...links.filter(l => l.rel.includes('apple-touch-icon') && l.href),
    ...links.filter(l => /\bicon\b/.test(l.rel) && !l.rel.includes('mask') && l.href).sort((a, b) => size(b.sizes) - size(a.sizes))
  ]
  const urls: string[] = []
  for (const l of ranked) {
    try {
      urls.push(new URL(l.href!.replace(/&amp;/g, '&'), base).href)
    } catch {}
  }
  urls.push(new URL('/favicon.ico', base).href)
  return [...new Set(urls)]
}

async function readImage(res: Response) {
  const type = (res.headers.get('content-type') ?? '').split(';')[0]!.trim()
  if (!res.ok || !/^image\/(png|jpeg|gif|webp|x-icon|vnd\.microsoft\.icon|svg\+xml)$/.test(type)) {
    res.body?.cancel().catch(() => {})
    return undefined
  }
  const buf = new Uint8Array(await res.arrayBuffer())
  return buf.length && buf.length <= MAX_IMAGE ? { body: buf, type } : undefined
}

async function findLogo(domain: string): Promise<Logo | null> {
  const home = new URL(`https://${domain}/`)
  let html = ''
  let base = home
  try {
    const { res, url } = await fetchPage(home)
    base = url
    html = res.ok ? (await res.text()).slice(0, 512 * 1024).split(/<\/head>/i)[0] ?? '' : ''
  } catch {}
  for (const src of iconCandidates(html, base).slice(0, 4)) {
    try {
      const { res } = await fetchPage(new URL(src), 'image/*')
      const img = await readImage(res)
      if (img) return { ...img, at: Date.now() }
    } catch {}
  }
  return null
}

export default defineEventHandler(async (event) => {
  const domain = String(getQuery(event).domain ?? '').trim().toLowerCase().replace(/^www\./, '')
  if (!DOMAIN.test(domain)) throw new HTTPError({ status: 400, message: 'That isn’t a domain name' })

  let logo = cache.get(domain)
  if (logo === undefined || (logo && Date.now() - logo.at > TTL)) {
    logo = await findLogo(domain)
    cache.set(domain, logo)
    // A miss is remembered for a while too, so a missing logo isn't looked up on every page view
    if (!logo) setTimeout(() => cache.delete(domain), 3_600_000)
  }
  if (!logo) throw new HTTPError({ status: 404, message: 'No logo found for that site' })

  setResponseHeaders(event, {
    'content-type': logo.type,
    'cache-control': 'public, max-age=604800, stale-while-revalidate=86400',
    // SVGs from elsewhere must never run scripts when opened directly
    'content-security-policy': 'default-src \'none\'; style-src \'unsafe-inline\'; sandbox',
    'x-content-type-options': 'nosniff'
  })
  return logo.body
})
