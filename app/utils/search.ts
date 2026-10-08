import { pathText, type Folder } from './folders'
import { typeOf } from './devices'
// Universal search (CHECKLIST.md #06): one place that knows how to find records in every app.
// Each source reads an app's saved list from this device (the same copy useCollection keeps), so
// search works offline and never sends anything anywhere. Add a source here when a new app stores data.
//
// The password vault is never searched: its entries are encrypted and stay that way.

export interface SearchHit {
  /** Unique across sources */
  key: string
  /** Group heading, e.g. "Bookmarks" */
  group: string
  title: string
  subtitle?: string
  /** Where choosing it goes; `focus` scrolls to and highlights the record there */
  to: string
  app: string
  score: number
}

interface Source {
  collection: string
  app: string
  group: string
  title: (item: Record<string, any>) => string
  subtitle?: (item: Record<string, any>) => string
  /** Extra text that should match but isn't shown */
  text?: (item: Record<string, any>) => string[]
}

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

const money = (price: number, currency: string) =>
  currency === 'KHR' ? `${Math.round(price).toLocaleString('en-US')} ៛` : `$${Number(price).toFixed(2).replace(/\.00$/, '')}`

export const SEARCH_SOURCES: Source[] = [
  {
    collection: 'bookmarks',
    app: '/bookmarks',
    group: 'Bookmarks',
    title: b => b.title,
    subtitle: b => host(b.url),
    text: b => [b.url, b.note, b.description, ...(b.folderNames ?? [])]
  },
  {
    collection: 'things',
    app: '/things',
    group: 'Things I own',
    title: t => t.name,
    subtitle: t => [typeOf(t.category).label, t.company, t.year].filter(Boolean).join(' · '),
    text: t => [t.category, t.type, t.company, t.model, t.generation, t.notes]
  },
  {
    collection: 'renewals',
    app: '/renewals',
    group: 'Renewals',
    title: r => r.name,
    subtitle: r => `${money(r.price, r.currency)} · ${CYCLES.find(c => c.value === r.cycle)?.label.toLowerCase() ?? r.cycle}`,
    text: r => [r.category]
  },
  {
    collection: 'countdown',
    app: '/countdown',
    group: 'Countdowns',
    title: c => c.title,
    subtitle: c => new Date(`${c.date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  },
  {
    collection: 'contacts',
    app: '/phone',
    group: 'Contacts',
    title: c => c.name || c.phone,
    subtitle: c => [c.phone, c.email].filter(Boolean).join(' · '),
    text: c => [c.phone, String(c.phone ?? '').replace(/\D/g, ''), c.email, c.notes]
  },
  {
    collection: 'eat',
    app: '/eat',
    group: 'Foods & places',
    title: s => s.name,
    subtitle: s => (s.kind === 'place' ? 'Place' : 'Food') + (s.note ? ` · ${s.note}` : ''),
    text: s => [s.note]
  }
]

function readCollection(name: string): Record<string, any>[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(`ousa-app:${name}`) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// Every word must appear somewhere; matches at the start of the title rank highest
function scoreOf(words: string[], title: string, rest: string) {
  const t = title.toLowerCase()
  const all = `${t} ${rest.toLowerCase()}`
  let score = 0
  for (const w of words) {
    if (!all.includes(w)) return 0
    if (t.startsWith(w)) score += 6
    else if (t.split(/[\s\-–·/]+/).some(part => part.startsWith(w))) score += 4
    else if (t.includes(w)) score += 2
    else score += 1
  }
  return score
}

export const searchWords = (query: string) => query.toLowerCase().split(/\s+/).filter(Boolean)

export function searchEverything(query: string, perGroup = 6): { group: string, hits: SearchHit[] }[] {
  const words = searchWords(query)
  if (!words.length) return []
  const groups: { group: string, hits: SearchHit[] }[] = []

  for (const src of SEARCH_SOURCES) {
    const items = readCollection(src.collection)
    // Bookmarks are found by the names of their folders too
    if (src.collection === 'bookmarks') {
      const folders = readCollection('bookmark-folders')
      const names = new Map(folders.map(f => [f.id, String(f.name)]))
      for (const b of items) b.folderNames = (Array.isArray(b.folders) ? b.folders : []).map((id: string) => names.get(id)).filter(Boolean)
    }
    const hits: SearchHit[] = []
    for (const item of items) {
      const title = String(src.title(item) ?? '')
      if (!title) continue
      const subtitle = src.subtitle?.(item)
      const rest = [subtitle, ...(src.text?.(item) ?? [])].filter(Boolean).join(' ')
      const score = scoreOf(words, title, rest)
      if (score) hits.push({ key: `${src.collection}:${item.id}`, group: src.group, title, subtitle, to: `${src.app}?focus=${encodeURIComponent(item.id)}`, app: src.app, score })
    }
    if (hits.length) groups.push({ group: src.group, hits: hits.sort((a, b) => b.score - a.score).slice(0, perGroup) })

    // Bookmark folders are worth finding on their own: they open the bookmarks in that folder
    if (src.collection === 'bookmarks') {
      const folders = readCollection('bookmark-folders') as unknown as Folder[]
      const folderHits: SearchHit[] = []
      for (const f of folders) {
        const path = pathText(folders, f.id)
        const score = scoreOf(words, f.name, path)
        if (!score) continue
        const inside = items.filter(b => Array.isArray(b.folders) && b.folders.includes(f.id)).length
        folderHits.push({ key: `folder:${f.id}`, group: 'Folders', title: f.name, subtitle: [path !== f.name ? path : '', `${inside} ${inside === 1 ? 'bookmark' : 'bookmarks'}`].filter(Boolean).join(' · '), to: `/bookmarks?folder=${encodeURIComponent(f.id)}`, app: '/bookmarks', score })
      }
      if (folderHits.length) groups.push({ group: 'Folders', hits: folderHits.sort((a, b) => b.score - a.score).slice(0, perGroup) })
    }
  }

  // The group with the best match comes first
  return groups.sort((a, b) => b.hits[0]!.score - a.hits[0]!.score)
}

/** How a query scores against plain text (commands, app names) */
export const matchScore = (query: string, title: string, rest = '') => scoreOf(searchWords(query), title, rest)
