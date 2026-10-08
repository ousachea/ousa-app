import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'
import { HTTPError } from 'h3'

// Fetching from the web on someone's behalf, safely: only public http(s) sites. Private, loopback and
// link-local addresses are refused, and every redirect hop is checked again, so these routes can't be
// used to poke at the server's own network. Shared by /api/link-preview and /api/logo.
const MAX_REDIRECTS = 4

// Every range that isn't the public internet: private, loopback, link-local, carrier NAT, test and
// reserved networks, multicast, and the IPv6 forms that can wrap an IPv4 address (6to4, NAT64)
const BLOCKED = new BlockList()
for (const [net, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3]] as const) {
  BLOCKED.addSubnet(net, prefix, 'ipv4')
}
for (const [net, prefix] of [['::', 128], ['::1', 128], ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['100::', 64], ['2001:db8::', 32], ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8]] as const) {
  BLOCKED.addSubnet(net, prefix, 'ipv6')
}

export function isPrivate(ip: string) {
  if (isIP(ip) === 4) return BLOCKED.check(ip, 'ipv4')
  if (isIP(ip) !== 6) return true
  // An IPv4 address written as IPv6 (::ffff:127.0.0.1, which URLs turn into ::ffff:7f00:1) is checked as IPv4
  const v = ip.toLowerCase()
  const dotted = v.match(/^(?:0{0,4}:){0,5}(?:0{0,4}:)?ffff:(\d+\.\d+\.\d+\.\d+)$/) ?? v.match(/^::(\d+\.\d+\.\d+\.\d+)$/)
  if (dotted) return isPrivate(dotted[1]!)
  const hex = v.match(/^(?:0{0,4}:){0,5}(?:0{0,4}:)?ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (hex) {
    const hi = Number.parseInt(hex[1]!, 16)
    const lo = Number.parseInt(hex[2]!, 16)
    return isPrivate(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`)
  }
  return BLOCKED.check(v, 'ipv6')
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

