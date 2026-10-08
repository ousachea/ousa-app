import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { HTTPError } from 'h3'

// Fetching from the web on someone's behalf, safely: only public http(s) sites. Private, loopback and
// link-local addresses are refused, and every redirect hop is checked again, so these routes can't be
// used to poke at the server's own network. Shared by /api/link-preview and /api/logo.
const MAX_REDIRECTS = 4

export function isPrivate(ip: string) {
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

export async function assertPublic(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new HTTPError({ status: 400, message: 'Only http and https links can be previewed' })
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => [])
  if (!addresses.length) throw new HTTPError({ status: 404, message: 'That site couldn’t be found' })
  if (addresses.some(a => isPrivate(a.address))) throw new HTTPError({ status: 400, message: 'Private network addresses can’t be previewed' })
}

// Follow redirects by hand so every hop gets the same public-address check
export async function fetchPage(start: URL, accept = 'text/html,application/xhtml+xml') {
  let url = start
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(url)
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(6000),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; OusaAppBookmarks/1.0)', 'accept': accept }
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

