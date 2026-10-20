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
  /** Bookmarks: on the Pinned shelf with your pinned links */
  pinned?: boolean
  /** Place on the Pinned shelf, set by dragging */
  pinOrder?: number
  /** Bookmarks: shared as a public page at /shared/<shareId> (utils/share.ts) */
  shareId?: string
}

// One icon per idea (#37), from the shared icon library
export const FOLDER_ICONS: Record<string, string> = {
  folder: 'lucide:folder', work: 'lucide:briefcase', bank: 'lucide:landmark', code: 'lucide:code',
  design: 'lucide:pen-tool', docs: 'lucide:file-text', book: 'lucide:book-open', star: 'lucide:star',
  heart: 'lucide:heart', home: 'lucide:house', shop: 'lucide:shopping-bag', music: 'lucide:music',
  video: 'lucide:video', game: 'lucide:gamepad-2', travel: 'lucide:plane', food: 'lucide:utensils',
  news: 'lucide:newspaper', school: 'lucide:graduation-cap', money: 'lucide:banknote',
  tools: 'lucide:wrench', cloud: 'lucide:cloud', chat: 'lucide:message-square', photo: 'lucide:image',
  globe: 'lucide:globe', ai: 'lucide:sparkles', lock: 'lucide:lock'
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

/** The folder and the folders it sits in, outermost first: [Work, Banking] for Work → Banking */
export function ancestorsOf(folders: readonly Folder[], id: string): Folder[] {
  const byId = new Map(folders.map(f => [f.id, f]))
  const out: Folder[] = []
  for (let f = byId.get(id), guard = 0; f && guard < 20; f = f.parentId ? byId.get(f.parentId) : undefined, guard++) out.unshift(f)
  return out
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
