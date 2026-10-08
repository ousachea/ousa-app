// Finding bookmarks saved more than once, and ones that look alike.
//
// Duplicates: the same page under addresses that only differ in ways that don't change the page —
// http/https, www./m./mobile., a trailing slash, #section, letter case of the site name, index.html,
// tracking codes (utm_…, fbclid, gclid…) or the order of the rest of the query.
// Similar: probably related, but you decide — same site and the same title, or a page and a page
// directly below it (github.com/nuxt/nuxt and github.com/nuxt/nuxt/issues).

export interface DupeItem {
  id: string
  url: string
  title: string
}

export interface DupeGroup<T extends DupeItem> {
  /** Stable for remembering "not duplicates" */
  key: string
  kind: 'duplicate' | 'similar'
  /** Why they were grouped, in plain words */
  reason: string
  items: T[]
}

const TRACKING = /^(utm_[a-z]+|fbclid|gclid|dclid|gbraid|wbraid|msclkid|mc_cid|mc_eid|igshid|si|ref|ref_src|ref_url|_hsenc|_hsmi|mkt_tok|yclid|spm|share|feature)$/i
const SUBDOMAIN = /^(www\d?|m|mobile|amp)\./

/** The page an address points at, with everything that doesn't change the page taken out */
export function pageKey(raw: string) {
  try {
    const u = new URL(raw)
    const host = u.hostname.toLowerCase().replace(SUBDOMAIN, '')
    const path = u.pathname.replace(/\/(index|default)\.(html?|php|aspx?)$/i, '/').replace(/\/+$/, '') || ''
    const params = [...u.searchParams.entries()].filter(([k]) => !TRACKING.test(k)).sort(([a], [b]) => a.localeCompare(b))
    const query = params.length ? `?${params.map(([k, v]) => `${k}=${v}`).join('&')}` : ''
    return `${host}${path}${query}`
  } catch {
    return raw.trim().toLowerCase()
  }
}

/** What made two addresses differ, for the reason line */
function differences(urls: string[]) {
  const parsed = urls.map((u) => {
    try {
      return new URL(u)
    } catch {
      return undefined
    }
  }).filter((u): u is URL => !!u)
  const why = new Set<string>()
  const all = <K>(f: (u: URL) => K) => new Set(parsed.map(f)).size > 1
  if (all(u => u.protocol)) why.add('http vs https')
  if (all(u => u.hostname.toLowerCase())) why.add('www or mobile site')
  if (all(u => u.hash)) why.add('#section')
  if (all(u => u.pathname.replace(/\/+$/, ''))) why.add('trailing slash or index page')
  else if (all(u => u.pathname)) why.add('trailing slash')
  if (all(u => u.search)) why.add([...new Set(parsed.flatMap(u => [...u.searchParams.keys()]))].some(k => TRACKING.test(k)) ? 'tracking codes' : 'order of the query')
  return why.size ? `Same page; the addresses differ by ${[...why].join(', ')}` : 'Exactly the same address'
}

const segments = (raw: string) => {
  try {
    const u = new URL(raw)
    return { host: u.hostname.toLowerCase().replace(SUBDOMAIN, ''), parts: u.pathname.split('/').filter(Boolean).map(p => p.toLowerCase()) }
  } catch {
    return { host: raw, parts: [] as string[] }
  }
}

const sameTitle = (a: string, b: string) => {
  const n = (s: string) => s.toLowerCase().replace(/\s+[|·•–—-]\s+.*$/, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  return n(a).length >= 3 && n(a) === n(b)
}

export function findDuplicates<T extends DupeItem>(list: readonly T[], ignored: ReadonlySet<string> = new Set()): DupeGroup<T>[] {
  const groups: DupeGroup<T>[] = []

  // 1. Duplicates: same page key
  const byPage = new Map<string, T[]>()
  for (const b of list) byPage.set(pageKey(b.url), [...(byPage.get(pageKey(b.url)) ?? []), b])
  const inDuplicate = new Set<string>()
  for (const [key, items] of byPage) {
    if (items.length < 2) continue
    const groupKey = `dup:${key}`
    items.forEach(b => inDuplicate.add(b.id))
    if (ignored.has(groupKey)) continue
    groups.push({ key: groupKey, kind: 'duplicate', reason: differences(items.map(b => b.url)), items })
  }

  // 2. Similar: one representative per page, compared pairwise on the same site
  const reps = [...byPage.values()].map(items => items[0]!)
  const bySite = new Map<string, T[]>()
  for (const b of reps) {
    const { host } = segments(b.url)
    bySite.set(host, [...(bySite.get(host) ?? []), b])
  }
  const parent = new Map<string, string>()
  const find = (x: string): string => (parent.get(x) === x || !parent.has(x) ? x : find(parent.get(x)!))
  const union = (a: string, b: string) => parent.set(find(a), find(b))
  const why = new Map<string, Set<string>>()
  for (const site of bySite.values()) {
    // Very large sites (hundreds of links) are skipped for the pairwise pass to stay quick
    if (site.length < 2 || site.length > 400) continue
    for (let i = 0; i < site.length; i++) {
      for (let j = i + 1; j < site.length; j++) {
        const a = site[i]!
        const b = site[j]!
        const pa = segments(a.url).parts
        const pb = segments(b.url).parts
        const [short, long] = pa.length <= pb.length ? [pa, pb] : [pb, pa]
        const nested = short.length >= 1 && long.length - short.length === 1 && short.every((p, k) => p === long[k])
        const titled = sameTitle(a.title, b.title)
        if (!nested && !titled) continue
        for (const x of [a.id, b.id]) if (!parent.has(x)) parent.set(x, x)
        union(a.id, b.id)
        const root = find(a.id)
        why.set(root, new Set([...(why.get(root) ?? []), ...(titled ? ['same title'] : []), ...(nested ? ['one page is inside the other'] : [])]))
      }
    }
  }
  const clusters = new Map<string, T[]>()
  for (const b of reps) {
    if (!parent.has(b.id)) continue
    const root = find(b.id)
    clusters.set(root, [...(clusters.get(root) ?? []), b])
  }
  for (const [root, items] of clusters) {
    if (items.length < 2) continue
    const groupKey = `sim:${items.map(b => pageKey(b.url)).sort().join('|')}`
    if (ignored.has(groupKey)) continue
    const reasons = new Set<string>()
    for (const [r, set] of why) if (find(r) === root) set.forEach(s => reasons.add(s))
    groups.push({ key: groupKey, kind: 'similar', reason: `Same site, ${[...reasons].join(' and ')}`, items })
  }
  return groups
}
