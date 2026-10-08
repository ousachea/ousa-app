// Bookmark folders (CHECKLIST.md #35–#40): nested, each with a name, icon and colour, in the order
// you arrange them. A bookmark can be in several folders. Folders replace the old free-text tags;
// `migrateTags` turns existing tags into folders the first time the new app opens.

/** Sidebar choices besides real folders */
export const ALL_BOOKMARKS = ''
export const UNFILED = ':unfiled'

export interface Folder {
  id: string
  name: string
  /** '' for a top-level folder */
  parentId: string
  /** Key of FOLDER_ICONS */
  icon: string
  /** Palette name ('' = the app's own colour) */
  color: string
  /** Position among its siblings */
  order: number
}

// One stroke icon per idea, drawn on the same 24px grid as the app icons (#37)
export const FOLDER_ICONS: Record<string, string> = {
  folder: 'M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z',
  work: 'M4 8h16v11H4zM9 8V5.5h6V8M4 13h16',
  bank: 'M3.5 9.5L12 4.5l8.5 5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3.5 19.5h17',
  code: 'M8.5 8l-4 4 4 4M15.5 8l4 4-4 4M13.5 5.5l-3 13',
  design: 'M4 20l4-1 11-11-3-3L5 16zM14 7l3 3',
  docs: 'M7 3.5h7l4 4v13H7zM14 3.5V8h4M10 12h5M10 15.5h5',
  book: 'M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 0 0 5 20.5zM5 20.5A2.5 2.5 0 0 0 7.5 23H19',
  star: 'M12 4l2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z',
  heart: 'M12 19.5s-7.5-4.4-7.5-9.7A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5c0 5.3-7.5 9.7-7.5 9.7z',
  home: 'M4 11l8-6.5 8 6.5M6 9.5V19.5h12V9.5M10 19.5v-5h4v5',
  shop: 'M5 7.5h14l-1.2 11.5H6.2zM9 7.5a3 3 0 0 1 6 0',
  music: 'M9 17.5V5.5l10-2v12M9 17.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 15.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',
  video: 'M4 6.5h11v11H4zM15 10.5l5-3v9l-5-3',
  game: 'M7 9h10a4 4 0 0 1 0 8c-1.5 0-2.3-1.5-3-2.5h-4C9.3 15.5 8.5 17 7 17a4 4 0 0 1 0-8zM8 11.5v3M6.5 13h3M16 12.5h.01M18 14h.01',
  travel: 'M3.5 13.5l7-1.5 4.5-7.5 2 .5-2 7 4.5-1 1.5 1.5-5.5 3-4 5.5-1.5-.5 1-5-5 1z',
  food: 'M7 3.5v7M5 3.5v4.5a2 2 0 0 0 4 0V3.5M7 10.5v10M16.5 20.5V3.5c-2 1-3.5 3.5-3.5 7h3.5',
  news: 'M5 5h12v14H6.5A1.5 1.5 0 0 1 5 17.5zM17 9h2v8.5a1.5 1.5 0 0 1-1.5 1.5M8 8.5h6M8 12h6M8 15.5h4',
  school: 'M2.5 9.5L12 5l9.5 4.5L12 14zM6.5 11.5v5c3 2 8 2 11 0v-5M21.5 9.5v5',
  money: 'M4 7h16v10H4zM12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM7 10v4M17 10v4',
  tools: 'M14.5 5.5a4 4 0 0 0-5 5L4 16l4 4 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z',
  cloud: 'M7 18.5h10.5a4 4 0 0 0 .4-8A6 6 0 0 0 6.3 9.6 4.5 4.5 0 0 0 7 18.5z',
  chat: 'M4.5 6h15v10h-9l-4 3.5V16h-2z',
  photo: 'M4 6h16v13H4zM4 15.5l4.5-4.5 4 4 2.5-2.5 5 5M15.5 9.5h.01',
  globe: 'M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zM3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z',
  ai: 'M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8zM18.5 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3'
}

// Folder colours (#38): the app palette; '' uses the Bookmarks app's own colour
export const FOLDER_COLORS = ['', 'blue', 'red', 'orange', 'gold', 'green', 'teal', 'cyan', 'indigo', 'purple', 'pink', 'brown', 'slate'] as const

export const folderColor = (f?: Pick<Folder, 'color'>) => (f?.color ? `var(--${f.color})` : 'var(--accent)')

/** "work" → "Work"; folder names always start with a capital (#39) */
export const folderName = (s: string) => {
  const t = s.trim().replace(/\s+/g, ' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// Good first guesses for an icon from a folder's name
const ICON_HINTS: [RegExp, string][] = [
  [/work|job|office|career/i, 'work'], [/bank|financ|money|pay|crypto/i, 'bank'], [/dev|code|program|git/i, 'code'],
  [/design|ui|ux|font|art/i, 'design'], [/doc|manual|guide|reference/i, 'docs'], [/read|book|blog|article/i, 'book'],
  [/fav|star|best/i, 'star'], [/home|house|family/i, 'home'], [/shop|buy|store/i, 'shop'], [/music|song|podcast/i, 'music'],
  [/video|movie|film|watch|youtube|entertain/i, 'video'], [/game|play/i, 'game'], [/travel|trip|flight|hotel/i, 'travel'],
  [/food|recipe|eat|cook/i, 'food'], [/news/i, 'news'], [/learn|school|course|study|education/i, 'school'],
  [/tool|util/i, 'tools'], [/social|chat/i, 'chat'], [/photo|image|picture/i, 'photo'], [/ai|gpt|claude/i, 'ai'],
  [/private|secret|password/i, 'lock'], [/cloud/i, 'cloud']
]
export const guessIcon = (name: string) => ICON_HINTS.find(([re]) => re.test(name))?.[1] ?? 'folder'

// ---------- Tree helpers ----------

export function childrenOf(folders: readonly Folder[], parentId: string) {
  return folders.filter(f => f.parentId === parentId).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
}

/** Every folder below this one (not including it) */
export function descendantsOf(folders: readonly Folder[], id: string): string[] {
  const out: string[] = []
  const walk = (pid: string) => {
    for (const f of folders) {
      if (f.parentId === pid && !out.includes(f.id)) {
        out.push(f.id)
        walk(f.id)
      }
    }
  }
  walk(id)
  return out
}

/** ["Work", "Banking"] for Work → Banking */
export function pathOf(folders: readonly Folder[], id: string): string[] {
  const byId = new Map(folders.map(f => [f.id, f]))
  const path: string[] = []
  let f = byId.get(id)
  let guard = 0
  while (f && guard++ < 20) {
    path.unshift(f.name)
    f = f.parentId ? byId.get(f.parentId) : undefined
  }
  return path
}

export const pathText = (folders: readonly Folder[], id: string) => pathOf(folders, id).join(' → ')

/** Folders in tree order with their depth, for lists and pickers */
export function flatTree(folders: readonly Folder[]) {
  const out: { folder: Folder, depth: number }[] = []
  const walk = (pid: string, depth: number) => {
    for (const f of childrenOf(folders, pid)) {
      out.push({ folder: f, depth })
      if (depth < 12) walk(f.id, depth + 1)
    }
  }
  walk('', 0)
  // Anything whose parent went missing still shows, at the top level
  const seen = new Set(out.map(o => o.folder.id))
  for (const f of folders) if (!seen.has(f.id)) out.push({ folder: f, depth: 0 })
  return out
}

/**
 * Old tags → folders, once: one top-level folder per tag name. Returns the folders to create and,
 * per bookmark id, the folder ids it belongs in.
 */
export function migrateTags(bookmarks: { id: string, tags?: string[], folders?: string[] }[], existing: readonly Folder[]) {
  const byName = new Map(existing.map(f => [f.name.toLowerCase(), f.id]))
  const created: Omit<Folder, 'id'>[] = []
  const pendingNames: string[] = []
  for (const b of bookmarks) {
    if (b.folders || !b.tags?.length) continue
    for (const t of b.tags) {
      const key = folderName(t.replace(/-/g, ' ')).toLowerCase()
      if (!byName.has(key) && !pendingNames.includes(key)) {
        pendingNames.push(key)
        created.push({ name: folderName(t.replace(/-/g, ' ')), parentId: '', icon: guessIcon(t), color: '', order: existing.length + created.length })
      }
    }
  }
  return { created, pendingNames }
}
