import { childrenOf, type Folder } from './folders'

export interface Bookmark {
  id: string
  url: string
  title: string
  description: string // from the page itself
  note: string // the user's own words
  tags: string[] // older versions' free-text tags; turned into folders on first open, then left as they were
  folders?: string[] // ids of the folders it's in (CHECKLIST.md #35)
  image?: string // the page's preview image (og:image), when it has one
  icon: string // site icon URL ('' to use the letter tile)
  pinned: boolean
  visits: number
  createdAt: string // ISO
  lastOpened?: string // ISO
  updatedAt?: string // ISO, last edited by hand
  pinOrder?: number // place on the pinned shelf, set by dragging
}

export type NewBookmark = Omit<Bookmark, 'id'>

// "https://www.github.com/nuxt" -> "github.com"
export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// Same page whatever the protocol, www or trailing slash
export function urlKey(url: string) {
  try {
    const u = new URL(url)
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}${u.search}`.toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}

// Each tag keeps one colour everywhere: hashed onto the app's colour tokens
const TAG_COLORS = ['var(--blue)', 'var(--teal)', 'var(--purple)', 'var(--pink)', 'var(--lime)', 'var(--sky)', 'var(--indigo)', 'var(--brown)', 'var(--orange)', 'var(--green)']
export function tagColor(tag: string) {
  let h = 0
  for (const c of tag) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return TAG_COLORS[h % TAG_COLORS.length]!
}

export const normaliseTag = (t: string) => t.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-')

// Folders every browser adds at the root; they say nothing about the link, so they don't become tags
const ROOT_FOLDERS = new Set(['bookmarks', 'bookmarks bar', 'bookmarks toolbar', 'bookmarks menu', 'other bookmarks', 'mobile bookmarks', 'favorites', 'favourites', 'favorites bar', 'imported'])

// The "Netscape bookmark file" every browser exports: nested <DL> lists, <H3> folders, <A> links.
// Each link keeps the path of folders it sat in (`folderPath`), so nested folders come across as nested.
export type ImportedBookmark = NewBookmark & { folderPath?: string[] }

export function parseBrowserBookmarks(html: string): ImportedBookmark[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out: ImportedBookmark[] = []

  function walk(dl: Element, folders: string[]) {
    for (const dt of Array.from(dl.children)) {
      if (dt.tagName !== 'DT') continue
      const a = dt.querySelector(':scope > a')
      const h3 = dt.querySelector(':scope > h3')
      if (a) {
        const href = a.getAttribute('href') ?? ''
        if (!/^https?:\/\//i.test(href)) continue // skip javascript:, place:, file: and the like
        const added = Number(a.getAttribute('add_date'))
        const folder = folders.at(-1)
        out.push({
          url: href,
          title: a.textContent?.trim() || hostOf(href),
          description: '',
          note: '',
          tags: folder ? [normaliseTag(folder)] : [],
          folderPath: [...folders],
          icon: new URL('/favicon.ico', href).href,
          pinned: false,
          visits: 0,
          createdAt: new Date(added > 0 ? added * 1000 : Date.now()).toISOString()
        })
      } else if (h3) {
        // A folder's list is the next <DL>, either inside this <DT> or right after it
        const list = dt.querySelector(':scope > dl') ?? (dt.nextElementSibling?.tagName === 'DL' ? dt.nextElementSibling : null)
        const name = h3.textContent?.trim() ?? ''
        if (list) walk(list, ROOT_FOLDERS.has(name.toLowerCase()) ? folders : [...folders, name])
      }
    }
  }

  const root = doc.querySelector('dl')
  if (root) walk(root, [])
  return out
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Export in the same format, with the folder tree nested as it is here, so any browser can import it.
// A bookmark in several folders is listed under the first one.
export function exportBrowserBookmarks(list: Bookmark[], folders: readonly Folder[] = []) {
  const known = new Set(folders.map(f => f.id))
  const home = (b: Bookmark) => (b.folders ?? []).find(id => known.has(id)) ?? ''
  const link = (b: Bookmark, pad: string) => `${pad}<DT><A HREF="${escape(b.url)}" ADD_DATE="${Math.floor(new Date(b.createdAt).getTime() / 1000)}">${escape(b.title)}</A>`
  const lines = ['<!DOCTYPE NETSCAPE-Bookmark-file-1>', '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">', '<TITLE>Bookmarks</TITLE>', '<H1>Bookmarks</H1>', '<DL><p>']
  const walk = (parentId: string, pad: string) => {
    for (const f of childrenOf(folders, parentId)) {
      lines.push(`${pad}<DT><H3>${escape(f.name)}</H3>`, `${pad}<DL><p>`)
      walk(f.id, `${pad}  `)
      lines.push(...list.filter(b => home(b) === f.id).map(b => link(b, `${pad}  `)), `${pad}</DL><p>`)
    }
  }
  walk('', '  ')
  lines.push(...list.filter(b => !home(b)).map(b => link(b, '  ')), '</DL><p>')
  return lines.join('\n')
}
