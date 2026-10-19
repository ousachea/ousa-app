<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { Bookmark, ImportedBookmark } from '~/utils/bookmarks'
import type { Folder } from '~/utils/folders'
import type { CsvColumn } from '~/utils/transfer'
import type { MenuEntry } from '~/composables/useContextMenu'
import type { BulkAction } from '~/composables/useBulkSelect'

const { play } = useSound()

// ---------- Demo: a few folders, pinned daily sites and a note ----------
const DEMO_FOLDERS = (): (Folder)[] => [
  { id: 'demo-dev', name: 'Development', parentId: '', icon: 'code', color: 'indigo', order: 0 },
  { id: 'demo-docs', name: 'Documentation', parentId: 'demo-dev', icon: 'docs', color: '', order: 0 },
  { id: 'demo-design', name: 'Design', parentId: '', icon: 'design', color: 'pink', order: 1 },
  { id: 'demo-news', name: 'News', parentId: '', icon: 'news', color: 'teal', order: 2 }
]
const demoMark = (url: string, title: string, folders: string[], extra: Partial<Bookmark> = {}): Omit<Bookmark, 'id'> => ({
  url, title, tags: [], folders, description: '', note: '', icon: new URL('/favicon.ico', url).href, pinned: false, visits: 0, createdAt: new Date(isoDaysAgo(Math.round(Math.random() * 90))).toISOString(), ...extra
})
const DEMO = (): Omit<Bookmark, 'id'>[] => [
  demoMark('https://github.com/', 'GitHub', ['demo-dev'], { pinned: true, visits: 42, icon: 'https://github.com/fluidicon.png' }),
  demoMark('https://nuxt.com/', 'Nuxt', ['demo-dev', 'demo-docs'], { pinned: true, visits: 18, icon: 'https://nuxt.com/icon.png', note: 'Docs for the framework this app is built on' }),
  demoMark('https://developer.mozilla.org/', 'MDN Web Docs', ['demo-docs'], { visits: 9, description: 'Resources for developers, by developers.' }),
  demoMark('https://www.figma.com/', 'Figma', ['demo-design'], { pinned: true, visits: 12 }),
  demoMark('https://fonts.google.com/', 'Google Fonts', ['demo-design'], { description: 'Making the web more beautiful, fast, and open through great typography.' }),
  demoMark('https://www.khmertimeskh.com/', 'Khmer Times', ['demo-news'], { visits: 5 }),
  demoMark('https://www.youtube.com/', 'YouTube', [], { visits: 30 })
]
const { items, ready, sync, add, addMany, update, replace, remove, restore } = useCollection<Bookmark>('bookmarks', undefined, { demo: DEMO })

// ---------- Folders (CHECKLIST.md #35–#40) ----------
const folderStore = useCollection<Folder>('bookmark-folders', undefined, { demo: DEMO_FOLDERS, app: '/bookmarks', trash: false, label: f => f.name })
const folders = folderStore.items
const folderIds = computed(() => new Set(folders.value.map(f => f.id)))
// Only folders that still exist; a restored bookmark may point at one deleted since
const foldersOf = (b: Pick<Bookmark, 'folders'>) => (b.folders ?? []).filter(id => folderIds.value.has(id))
const folderById = (id: string) => folders.value.find(f => f.id === id)
const pathsOf = (b: Bookmark) => foldersOf(b).map(id => pathText(folders.value, id))

/** A folder by name (any capitalisation), made if it doesn't exist yet; returns its id */
function ensureFolder(name: string, parentId = ''): string {
  const n = folderName(name)
  const found = folders.value.find(f => f.parentId === parentId && f.name.toLowerCase() === n.toLowerCase())
  if (found) return found.id
  return folderStore.add({ name: n, parentId, icon: guessIcon(n), color: '', order: childrenOf(folders.value, parentId).length }).id
}
/** "Work → Banking" (or ["Work", "Banking"]) to the innermost folder's id, making any that are missing */
function ensurePath(path: string[]) {
  let parent = ''
  for (const part of path.map(p => p.trim()).filter(Boolean)) parent = ensureFolder(part, parent)
  return parent
}

// Old free-text tags become folders, once, when both lists have loaded
let migrated = false
watch([ready, folderStore.ready], ([a, b]) => {
  if (!a || !b || migrated || useDemoState('/bookmarks').active.value) return
  migrated = true
  const pending = items.value.filter(bk => !bk.folders && bk.tags?.length)
  if (!pending.length) return
  for (const bk of pending) update(bk.id, { folders: [...new Set(bk.tags.map(t => ensureFolder(t.replace(/-/g, ' '))))] }, { quiet: true })
  toast.success('Tags are folders now', { description: `${pending.length} ${pending.length === 1 ? 'bookmark was' : 'bookmarks were'} put in folders named after their tags.` })
}, { immediate: true })

// ---------- Duplicate folders ----------
// Two folders with the same name (any capitalisation) in the same place are one folder: the first
// keeps its place, the other's bookmarks and sub-folders move into it, and the copy goes. Merging
// sub-folders can make new pairs inside, so it repeats until none are left. One Undo puts it all back.
const sameName = (a: string, b: string) => folderName(a).toLowerCase() === folderName(b).toLowerCase()
function duplicatePairs() {
  const pairs: [keep: Folder, copy: Folder][] = []
  const groups = new Map<string, Folder[]>()
  for (const f of [...folders.value].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))) {
    const key = `${f.parentId}\u0000${folderName(f.name).toLowerCase()}`
    const g = groups.get(key)
    if (g) pairs.push([g[0]!, f])
    else groups.set(key, [f])
  }
  return pairs
}
function mergeDuplicateFolders(quietIfNone = true) {
  const removed: Folder[] = []
  const bookmarksBefore = new Map<string, Bookmark>()
  const foldersBefore = new Map<string, Folder>()
  for (let round = 0; round < 10; round++) {
    const pairs = duplicatePairs()
    if (!pairs.length) break
    for (const [keep, copy] of pairs) {
      for (const b of items.value.filter(x => x.folders?.includes(copy.id))) {
        const before = update(b.id, { folders: [...new Set((b.folders ?? []).map(id => (id === copy.id ? keep.id : id)))] }, { quiet: true })
        if (before && !bookmarksBefore.has(b.id)) bookmarksBefore.set(b.id, before)
      }
      for (const c of folders.value.filter(x => x.parentId === copy.id)) {
        const before = folderStore.update(c.id, { parentId: keep.id, order: childrenOf(folders.value, keep.id).length }, { quiet: true })
        if (before && !foldersBefore.has(c.id)) foldersBefore.set(c.id, before)
      }
      if (activeFolder.value === copy.id) activeFolder.value = keep.id
      folderStore.remove(copy.id)
      removed.push(copy)
    }
  }
  if (!removed.length) {
    if (!quietIfNone) toast('No duplicate folders')
    return 0
  }
  const names = [...new Set(removed.map(f => f.name))]
  toast.success(`Merged ${removed.length} duplicate ${removed.length === 1 ? 'folder' : 'folders'}`, {
    description: `${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}: their bookmarks are in the folder with the same name.`,
    duration: 8000,
    action: { label: 'Undo', onClick: () => {
      for (const f of removed) folderStore.restore(f)
      for (const f of foldersBefore.values()) folderStore.replace(f)
      for (const b of bookmarksBefore.values()) replace(b)
    } }
  })
  return removed.length
}
// Check once the page is up and both lists have loaded, and whenever folders arrive from another device
function checkDuplicateFolders() {
  if (!ready.value || !folderStore.ready.value || useDemoState('/bookmarks').active.value) return
  if (duplicatePairs().length) mergeDuplicateFolders()
}
onMounted(() => {
  checkDuplicateFolders()
  watch([ready, folderStore.ready, () => folders.value.length], checkDuplicateFolders)
})

// Open and closed folders in the sidebar, remembered (#14)
const collapsed = useRemembered<string[]>('bookmarks-collapsed', [], Array.isArray)
function toggleFolder(id: string) {
  collapsed.value = collapsed.value.includes(id) ? collapsed.value.filter(x => x !== id) : [...collapsed.value, id]
}

// Create / edit / delete
const folderEditor = reactive({ open: false, folder: undefined as Folder | undefined, parentId: '' })
function openNewFolder(parentId = '') {
  Object.assign(folderEditor, { open: true, folder: undefined, parentId })
  if (parentId && collapsed.value.includes(parentId)) toggleFolder(parentId)
  play('open')
}
function openEditFolder(f: Folder) {
  Object.assign(folderEditor, { open: true, folder: f, parentId: f.parentId })
  play('open')
}
function saveFolder(data: Pick<Folder, 'name' | 'parentId' | 'icon' | 'color'>) {
  const f = folderEditor.folder
  folderEditor.open = false
  // A folder with this name is already there: use it rather than making a second one
  const twin = folders.value.find(x => x.id !== f?.id && x.parentId === data.parentId && sameName(x.name, data.name))
  if (twin && !f) {
    activeFolder.value = twin.id
    toast(`${twin.name} already exists`, { description: 'Opened it instead of making a second one.' })
    return
  }
  if (f) {
    const before = folderStore.update(f.id, { ...data, ...(data.parentId !== f.parentId ? { order: childrenOf(folders.value, data.parentId).length } : {}) })
    // Renamed or moved onto a folder with the same name: the two become one
    if (twin) mergeDuplicateFolders()
    else toastSaved(before && (() => folderStore.replace(before)), `${data.name} saved`)
  } else {
    const created = folderStore.add({ ...data, order: childrenOf(folders.value, data.parentId).length })
    activeFolder.value = created.id
    toast.success(`${created.name} created`, { action: { label: 'Undo', onClick: () => folderStore.remove(created.id, { undoAdd: true }) } })
  }
  play('success')
}

// Deleting a folder keeps its bookmarks (they just leave it) and lifts its sub-folders up a level.
// Undo puts everything back exactly.
function deleteFolder(f: Folder) {
  const members = items.value.filter(b => b.folders?.includes(f.id))
  const children = folders.value.filter(c => c.parentId === f.id)
  for (const b of members) update(b.id, { folders: (b.folders ?? []).filter(id => id !== f.id) }, { quiet: true })
  for (const c of children) folderStore.update(c.id, { parentId: f.parentId }, { quiet: true })
  folderStore.remove(f.id)
  if (activeFolder.value === f.id) activeFolder.value = ALL_BOOKMARKS
  play('delete')
  toast(`${f.name} deleted`, {
    description: members.length ? `Its ${members.length} ${members.length === 1 ? 'bookmark is' : 'bookmarks are'} still in All bookmarks.` : undefined,
    duration: 7000,
    action: { label: 'Undo', onClick: () => {
      folderStore.restore(f)
      for (const c of children) folderStore.update(c.id, { parentId: f.id }, { quiet: true })
      for (const b of members) update(b.id, { folders: [...new Set([...(items.value.find(x => x.id === b.id)?.folders ?? []), f.id])] }, { quiet: true })
    } }
  })
}

// Reorder or nest by dragging (#28): siblings are renumbered in their new order
function moveFolder(id: string, parentId: string, beforeId: string | null) {
  const f = folderById(id)
  if (!f || id === parentId || descendantsOf(folders.value, id).includes(parentId)) return
  const before = folders.value.map(x => ({ ...x }))
  const siblings = childrenOf(folders.value, parentId).filter(s => s.id !== id)
  const at = beforeId ? siblings.findIndex(s => s.id === beforeId) : siblings.length
  siblings.splice(at < 0 ? siblings.length : at, 0, f)
  siblings.forEach((s, i) => {
    if (s.order !== i || s.parentId !== parentId) folderStore.update(s.id, { order: i, parentId }, { quiet: true })
  })
  if (parentId && collapsed.value.includes(parentId)) toggleFolder(parentId)
  play('select')
  toast(parentId && f.parentId !== parentId ? `${f.name} moved into ${folderById(parentId)?.name}` : `${f.name} moved`, {
    action: { label: 'Undo', onClick: () => before.forEach(x => folderStore.replace(x)) }
  })
}

// Move a bookmark to a folder (drag onto the sidebar, or Move to folder…); Not in a folder clears it
function moveBookmark(id: string, folderId: string) {
  const b = items.value.find(x => x.id === id)
  if (!b) return
  const target = folderId === UNFILED || folderId === ALL_BOOKMARKS ? [] : [folderId]
  if (JSON.stringify(foldersOf(b)) === JSON.stringify(target)) return
  const before = update(id, { folders: target, updatedAt: new Date().toISOString() })
  play('success')
  toast(target.length ? `Moved to ${pathText(folders.value, folderId)}` : 'Taken out of its folders', {
    description: b.title,
    action: before && { label: 'Undo', onClick: () => replace(before) }
  })
}
const moving = ref<Bookmark>()

// Duplicate and similar finder; the sidebar shows how many duplicate groups there are
const dupesOpen = ref(false)
const ignoredDupes = useRemembered<string[]>('bookmarks-not-dupes', [], Array.isArray)
const duplicateGroups = computed(() => findDuplicates(items.value, new Set(ignoredDupes.value)).filter(g => g.kind === 'duplicate'))
const duplicateCount = computed(() => duplicateGroups.value.length)
// Bookmarks saved more than once get a Duplicate badge on their card, which opens Find duplicates
const duplicateIds = computed(() => new Set(duplicateGroups.value.flatMap(g => g.items.map(b => b.id))))

// ---------- Save a link ----------
const online = useOnline()

// Pull down on a phone to sync again (CHECKLIST.md #26)
usePullToRefresh(async () => {
  await Promise.all([sync.retry(), folderStore.sync.retry()])
  toast(sync.signedIn.value ? 'Up to date with your account' : 'Refreshed', { duration: 1800 })
})
const linkInput = ref('')
const linkField = ref<HTMLInputElement>()
useAddAction(() => focusField(linkField.value))
const saving = ref(false)
const flashId = ref<string>()

function parseLink(raw: string) {
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    return url.hostname.includes('.') ? url : undefined
  } catch {
    return undefined
  }
}

function flash(id: string) {
  // Make sure it's drawn even in a long list
  const at = shown.value.findIndex(b => b.id === id)
  if (at >= limit.value) limit.value = at + 1
  flashId.value = id
  setTimeout(() => flashId.value === id && (flashId.value = undefined), 1600)
  nextTick(() => document.getElementById(`bm-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
}

// The open folder is where a new link goes (save); this opens a folder and puts you in the address bar
const savingTo = computed(() => (activeFolder.value && activeFolder.value !== UNFILED ? folderById(activeFolder.value) : undefined))
function addInFolder(id = activeFolder.value) {
  activeFolder.value = id
  query.value = ''
  linkField.value?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  focusField(linkField.value)
}

// A link that's already saved asks first (CHECKLIST.md #29)
const duplicateOf = ref<Bookmark>()
watch(linkInput, () => (duplicateOf.value = undefined))
const folderPath = (b: Bookmark) => pathsOf(b).join(', ') || undefined
function showExisting() {
  const b = duplicateOf.value
  duplicateOf.value = undefined
  if (!b) return
  linkInput.value = ''
  activeFolder.value = ALL_BOOKMARKS
  query.value = ''
  flash(b.id)
}

// A folder suggestion as a name, from where you've filed other links from the site (CHECKLIST.md #30)
const suggestFor = (url: string, exceptId?: string) => {
  const name = suggestFolder(url, items.value.filter(b => b.id !== exceptId).map(b => ({ url: b.url, tags: foldersOf(b).map(id => folderById(id)?.name ?? '') })))
  return name ? folderName(name) : undefined
}

// Review before saving (CHECKLIST.md #43): what the page says about itself, editable, with folders.
// Enter in the link box reads the page; Enter again (or Save) keeps it.
const review = ref<{ url: string, title: string, description: string, note: string, pinned: boolean, icon: string, image: string, siteName: string, folders: string[], suggestion?: string, offline: boolean }>()
const reviewTitle = ref<HTMLInputElement>()
const reviewImageBroken = ref(false)

async function save(force = false) {
  const raw = linkInput.value.trim()
  if (!raw || saving.value) return
  const url = parseLink(raw)
  if (!url) {
    toast.error('That doesn’t look like a link', { description: 'Try something like nuxt.com or https://…' })
    play('error')
    return
  }
  // Same page even if the address differs by http/www/tracking codes (utils/bookmarkDupes.ts)
  const existing = force ? undefined : items.value.find(b => pageKey(b.url) === pageKey(url.href))
  if (existing) {
    duplicateOf.value = existing
    play('warning')
    return
  }
  duplicateOf.value = undefined
  review.value = undefined

  saving.value = true
  // Read the page's title, description, image and icon; if the site won't say (or there's no internet), use its address
  const preview = online.value
    ? await $fetch('/api/link-preview', { query: { url: url.href } }).catch(() => undefined)
    : undefined
  saving.value = false

  const finalUrl = preview?.url || url.href
  const inFolder = activeFolder.value && activeFolder.value !== UNFILED && folderIds.value.has(activeFolder.value)
  const suggestion = inFolder ? undefined : suggestFor(finalUrl)
  reviewImageBroken.value = false
  review.value = {
    url: finalUrl,
    title: preview?.title || hostOf(finalUrl),
    description: preview?.description ?? '',
    note: '',
    pinned: false,
    icon: preview?.icon || new URL('/favicon.ico', finalUrl).href,
    image: preview?.image ?? '',
    siteName: preview?.siteName || preview?.domain || hostOf(finalUrl),
    folders: inFolder ? [activeFolder.value] : [],
    suggestion,
    offline: !preview
  }
  play('open')
  nextTick(() => reviewTitle.value?.focus())
}

function keepReviewed() {
  const r = review.value
  if (!r) return
  const record = add({
    url: r.url,
    title: r.title.trim() || hostOf(r.url),
    description: r.description.trim(),
    note: r.note.trim(),
    tags: [],
    folders: r.folders,
    icon: r.icon,
    ...(r.image && !reviewImageBroken.value ? { image: r.image } : {}),
    pinned: r.pinned,
    visits: 0,
    createdAt: new Date().toISOString()
  })
  review.value = undefined
  linkInput.value = ''
  play('success')
  toast.success('Bookmark saved', {
    description: record.folders?.length ? `${record.title} · ${pathsOf(record).join(', ')}` : record.title,
    action: { label: 'Undo', onClick: () => remove(record.id, { undoAdd: true }) }
  })
  flash(record.id)
  nextTick(() => linkField.value?.focus())
}

function cancelReview() {
  review.value = undefined
  nextTick(() => linkField.value?.focus())
}

// Pasting a link into an empty box reads the page straight away; no Enter needed
function onLinkPaste(e: ClipboardEvent) {
  const text = e.clipboardData?.getData('text').trim()
  if (!text || linkInput.value.trim() || !parseLink(text)) return
  e.preventDefault()
  linkInput.value = text
  save()
}

// A Paste button that reads the clipboard itself (the browser may ask once). Only shown where the browser allows it.
const canReadClipboard = ref(false)
onMounted(() => (canReadClipboard.value = !!navigator.clipboard?.readText))
async function pasteFromClipboard() {
  let text = ''
  try {
    text = (await navigator.clipboard.readText()).trim()
  } catch {
    toast.error('Couldn’t read the clipboard', { description: 'Allow clipboard access for this site, or paste with ⌘V / Ctrl+V.' })
    play('error')
    return focusField(linkField.value)
  }
  if (!text) {
    toast('The clipboard is empty', { description: 'Copy a link first, then press Paste.' })
    return focusField(linkField.value)
  }
  linkInput.value = text
  if (parseLink(text)) save()
  else {
    toast.error('The clipboard doesn’t hold a link', { description: text.length > 60 ? `${text.slice(0, 60)}…` : text })
    play('error')
    focusField(linkField.value)
  }
}

// ---------- Browse ----------
const query = ref('')
// The folder you were looking at, the sort and the view are remembered on this device (CHECKLIST.md #14)
const activeFolder = useRemembered<string>('bookmarks-folder-id', ALL_BOOKMARKS, v => typeof v === 'string')
// Opened from search on a folder (?folder=<id>): show just that folder
const route = useRoute()
// Also when already here (picking a folder in ⌘K while on Bookmarks)
const router = useRouter()
function followLink() {
  // ?dupes=1 (from ⌘K) opens the duplicate finder
  if (route.query.dupes) {
    dupesOpen.value = true
    const { dupes: _, ...rest } = route.query
    router.replace({ query: rest })
    return
  }
  const f = route.query.folder
  if (typeof f === 'string' && f) {
    activeFolder.value = f
    query.value = ''
    const { folder: _, ...rest } = route.query
    router.replace({ query: rest })
  }
  // Jumping to one bookmark from search: show everything so it's on screen
  else if (route.query.focus) {
    activeFolder.value = ALL_BOOKMARKS
    query.value = ''
    // Draw everything so the bookmark being jumped to exists on the page
    nextTick(() => (limit.value = Math.max(limit.value, shown.value.length)))
  }
}
onMounted(followLink)
watch(() => route.query, followLink)
// A folder that no longer exists drops back to All
watch([folders, activeFolder], () => {
  if (folderStore.ready.value && activeFolder.value && activeFolder.value !== UNFILED && !folderIds.value.has(activeFolder.value)) activeFolder.value = ALL_BOOKMARKS
})

const SORTS = [
  { value: 'newest', label: 'Recently added' },
  { value: 'updated', label: 'Recently updated' },
  { value: 'opened', label: 'Most opened' },
  { value: 'az', label: 'A–Z' },
  { value: 'folder', label: 'Folder' }
] as const
type Sort = (typeof SORTS)[number]['value']
const sort = useRemembered<Sort>('bookmarks-sort', 'newest', v => SORTS.some(s => s.value === v))

// List, grid of cards, or compact one-line rows (CHECKLIST.md #15)
type View = 'list' | 'grid' | 'compact'
const VIEWS: View[] = ['list', 'grid', 'compact']
const { prefs } = usePrefs()
const view = smoothRef(useRemembered<View>('bookmarks-view', 'list', v => VIEWS.includes(v as View), () => prefs.defaultView))
// Earlier versions kept the view under its own key
onMounted(() => {
  try {
    const old = localStorage.getItem('ousa-app:bookmarks-view')
    if (old === 'grid') view.value = 'grid'
    localStorage.removeItem('ousa-app:bookmarks-view')
  } catch {}
})
function setView(next: View) {
  if (view.value === next) return
  view.value = next
  play('select')
}
// Show or hide each page's preview image (og:image) on cards and list rows
const showImages = useRemembered<boolean>('bookmarks-images', true, v => typeof v === 'boolean')
function toggleImages() {
  showImages.value = !showImages.value
  play(showImages.value ? 'toggle-on' : 'toggle-off')
}
const searchInput = ref<HTMLInputElement>()

// How many bookmarks sit directly in each folder; the tree adds up sub-folders itself
const counts = computed(() => {
  const out: Record<string, number> = {}
  for (const b of items.value) for (const id of foldersOf(b)) out[id] = (out[id] ?? 0) + 1
  return out
})
const unfiledCount = computed(() => items.value.filter(b => !foldersOf(b).length).length)

// The pinned shelf keeps the order you drag it into; never-dragged ones follow, oldest first
const pinned = computed(() => items.value
  .filter(b => b.pinned)
  .sort((a, b) => (a.pinOrder ?? Number.MAX_SAFE_INTEGER) - (b.pinOrder ?? Number.MAX_SAFE_INTEGER) || a.createdAt.localeCompare(b.createdAt)))
const reorderPinned = useDragReorder<Bookmark>({
  keyOf: b => b.id,
  axis: 'x',
  onMove(from, to) {
    moved(pinned.value, from, to).forEach((b, i) => {
      if (b.pinOrder !== i) update(b.id, { pinOrder: i }, { quiet: true })
    })
  }
})

// A folder shows its own bookmarks and those in its sub-folders
const inView = computed(() => {
  if (!activeFolder.value) return undefined
  if (activeFolder.value === UNFILED) return UNFILED
  return new Set([activeFolder.value, ...descendantsOf(folders.value, activeFolder.value)])
})

const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  const scope = inView.value
  const list = items.value.filter((b) => {
    const mine = foldersOf(b)
    if (scope === UNFILED ? mine.length : scope && !mine.some(id => scope.has(id))) return false
    if (!q) return true
    // Older or imported bookmarks may have no note or description
    return [b.title, b.url, b.note, b.description, ...pathsOf(b)].some(f => f?.toLowerCase().includes(q))
  })
  if (sort.value === 'az') return list.sort((a, b) => a.title.localeCompare(b.title))
  if (sort.value === 'updated') return list.sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))
  // By folder path, then by name; bookmarks without one come last
  if (sort.value === 'folder') return list.sort((a, b) => (pathsOf(a)[0] ?? '￿').localeCompare(pathsOf(b)[0] ?? '￿') || a.title.localeCompare(b.title))
  if (sort.value === 'opened') return list.sort((a, b) => b.visits - a.visits || (b.lastOpened ?? '').localeCompare(a.lastOpened ?? ''))
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
})

// Long libraries draw 150 rows at a time (#70); more appear as you reach the end
const PAGE = 150
const limit = ref(PAGE)
watch([activeFolder, query, sort], () => (limit.value = PAGE))
const visibleMarks = computed(() => shown.value.slice(0, limit.value))
const moreSentinel = ref<HTMLElement>()
let moreObserver: IntersectionObserver | undefined
watch(moreSentinel, (el) => {
  moreObserver?.disconnect()
  if (!el) return
  moreObserver = new IntersectionObserver((entries) => {
    if (entries.some(e => e.isIntersecting)) limit.value += PAGE
  }, { rootMargin: '600px' })
  moreObserver.observe(el)
})
onBeforeUnmount(() => moreObserver?.disconnect())

const activeFolderRecord = computed(() => folderById(activeFolder.value))
const listTitle = computed(() => activeFolder.value === UNFILED ? 'Not in a folder' : activeFolderRecord.value ? pathText(folders.value, activeFolder.value) : 'All bookmarks')

// "/" jumps to search from anywhere on the page, like most sites with a search box
function onKey(e: KeyboardEvent) {
  if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return
  const t = e.target as HTMLElement
  if (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return
  e.preventDefault()
  searchInput.value?.focus()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// Enter in the search box opens the top result
function openFirst() {
  const first = shown.value[0]
  if (!first) return
  opened(first)
  window.open(first.url, '_blank', 'noopener')
}

function opened(b: Bookmark) {
  update(b.id, { visits: (b.visits ?? 0) + 1, lastOpened: new Date().toISOString() }, { quiet: true })
}

function togglePin(b: Bookmark) {
  const before = update(b.id, { pinned: !b.pinned })
  play(b.pinned ? 'toggle-off' : 'toggle-on')
  toast(b.pinned ? 'Unpinned' : 'Pinned to the top', { description: b.title, action: before && { label: 'Undo', onClick: () => replace(before) } })
}

function del(b: Bookmark) {
  const removed = remove(b.id)
  play('delete')
  toastDeleted(b.title, () => removed && restore(removed))
}

// ---------- Select several: pin, move, copy or delete them together (useBulkSelect) ----------
const marksText = (n: number) => `${n} ${n === 1 ? 'bookmark' : 'bookmarks'}`
const sel = useBulkSelect({ items, shown, accentFrom: searchInput, onDelete: () => deleteSelected() })
const selectedMarks = computed(() => sel.selectedItems as Bookmark[])

const selectionPinned = computed(() => selectedMarks.value.length > 0 && selectedMarks.value.every(b => b.pinned))
function bulkPin(pinned = !selectionPinned.value) {
  const targets = selectedMarks.value.filter(b => !!b.pinned !== pinned)
  if (!targets.length) return
  const before = targets.map(b => update(b.id, { pinned }, { quiet: true })).filter((b): b is Bookmark => !!b)
  logActivity('edited', '/bookmarks', `${pinned ? 'Pinned' : 'Unpinned'} ${marksText(targets.length)}`)
  play(pinned ? 'toggle-on' : 'toggle-off')
  toast(`${marksText(targets.length)} ${pinned ? 'pinned' : 'unpinned'}`, { action: { label: 'Undo', onClick: () => before.forEach(b => replace(b)) } })
}

const movingMany = ref(false)
function bulkMove(folderId: string) {
  movingMany.value = false
  moveMarks(selectedMarks.value, folderId)
}

// Several bookmarks to one folder: the selection, or a drag of selected bookmarks
function moveMarks(marks: Bookmark[], folderId: string) {
  const target = folderId === UNFILED || folderId === ALL_BOOKMARKS ? [] : [folderId]
  const targets = marks.filter(b => JSON.stringify(foldersOf(b)) !== JSON.stringify(target))
  if (!targets.length) return
  const now = new Date().toISOString()
  const before = targets.map(b => update(b.id, { folders: target, updatedAt: now }, { quiet: true })).filter((b): b is Bookmark => !!b)
  const where = target.length ? `moved to ${pathText(folders.value, folderId)}` : 'taken out of their folders'
  logActivity('edited', '/bookmarks', `${marksText(targets.length)} ${where}`)
  play('success')
  toast(`${marksText(targets.length)} ${where}`, { action: { label: 'Undo', onClick: () => before.forEach(b => replace(b)) } })
}

async function bulkCopy() {
  const links = selectedMarks.value.map(b => b.url)
  if (!links.length) return
  try {
    await navigator.clipboard.writeText(links.join('\n'))
    play('copy')
    toast.success(links.length === 1 ? 'Link copied' : `${links.length} links copied`, { description: 'One per line.' })
  } catch {
    toast.error('Could not copy')
  }
}

// Everything goes to the Recycle Bin with one Undo; a big batch is asked first
function deleteSelected() {
  sel.guard(`Delete ${marksText(sel.selected.size)}?`, () => bulkRemove(selectedMarks.value, remove, restore, marksText))
}

const bulkActions = computed<BulkAction[]>(() => [
  { label: selectionPinned.value ? 'Unpin' : 'Pin', icon: 'pin', run: () => bulkPin() },
  { label: 'Move', icon: 'move', run: () => (movingMany.value = true) },
  { label: 'Copy links', icon: 'copy', run: bulkCopy },
  { label: 'Delete', icon: 'delete', danger: true, run: deleteSelected }
])

// The Move dialog serves one bookmark (from its menu) or the selection
function pickFolder(folderId: string) {
  if (movingMany.value) bulkMove(folderId)
  else if (moving.value) moveBookmark(moving.value.id, folderId)
  moving.value = undefined
}

// Bookmarks drag onto folders: with a mouse onto the sidebar (the whole row drags, the grip shows it can),
// with a finger by the grip onto the tray of folders that slides up (FolderDropTray).
// Dragging a selected bookmark takes the whole selection along.
const finePointer = ref(false)
onMounted(() => (finePointer.value = matchMedia('(pointer: fine)').matches))
const dragIdsFor = (b: Bookmark) => (sel.has(b.id) && sel.selected.size > 1 ? [...sel.selected] : [b.id])
const dragLabel = (ids: string[]) => (ids.length === 1 ? items.value.find(x => x.id === ids[0])?.title ?? '1 bookmark' : marksText(ids.length))
const draggingMarks = ref(false)
function onBookmarkDrag(e: DragEvent, b: Bookmark) {
  const ids = dragIdsFor(b)
  e.dataTransfer?.setData('application/x-bookmark', ids.join('\n'))
  e.dataTransfer?.setData('text/uri-list', b.url)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copyMove'
  // A chip saying what's moving, instead of a ghost of the whole row
  const chip = document.createElement('div')
  chip.className = 'drag-ghost'
  chip.textContent = ids.length > 1 ? `Moving ${marksText(ids.length)}` : (b.title || hostOf(b.url))
  document.body.append(chip)
  e.dataTransfer?.setDragImage(chip, 16, 16)
  setTimeout(() => chip.remove())
  draggingMarks.value = true
}
function dropMarks(ids: string[], folderId: string) {
  if (ids.length === 1) moveBookmark(ids[0]!, folderId)
  else moveMarks(items.value.filter(b => ids.includes(b.id)), folderId)
}
const touchDrag = useTouchItemDrag(dropMarks)

// ---------- Right-click / long-press menu (CHECKLIST.md #26, #27) ----------
const menuFor = useRowMenu()
const bookmarkMenu = (b: Bookmark): MenuEntry[] => sel.has(b.id) && sel.selected.size > 1 ? selectionMenu() : [
  { label: 'Open', icon: 'open', run: () => {
    opened(b)
    window.location.href = b.url
  } },
  { label: 'Open in new tab', icon: 'new-tab', run: () => {
    opened(b)
    window.open(b.url, '_blank', 'noopener')
  } },
  '-',
  { label: 'Edit', icon: 'edit', run: () => edit(b) },
  { label: 'Move to folder…', icon: 'folder', run: () => (moving.value = b) },
  { label: b.pinned ? 'Unpin' : 'Pin to the top', icon: 'pin', run: () => togglePin(b) },
  { label: 'Select', icon: 'select', run: () => (sel.selecting ? sel.toggle(b.id) : sel.start(b.id)) },
  { label: 'Copy link', icon: 'copy', run: () => copyLink(b) },
  { label: 'Refresh icon', icon: 'refresh', disabled: refreshing.value.has(b.id), run: () => refreshIcon(b) },
  { label: 'Duplicate', icon: 'duplicate', run: () => duplicate(b) },
  '-',
  { label: 'Delete', icon: 'delete', danger: true, run: () => del(b) }
]

// Right-click or long-press on a picked row while several are picked acts on all of them
function selectionMenu(): MenuEntry[] {
  const n = sel.selected.size
  return [
    { label: `${selectionPinned.value ? 'Unpin' : 'Pin'} ${n}`, icon: 'pin', run: () => bulkPin() },
    { label: `Move ${n} to folder…`, icon: 'folder', run: () => (movingMany.value = true) },
    { label: `Copy ${n} links`, icon: 'copy', run: bulkCopy },
    '-',
    { label: `Delete ${n}`, icon: 'delete', danger: true, run: deleteSelected }
  ]
}

async function copyLink(b: Bookmark) {
  try {
    await navigator.clipboard.writeText(b.url)
    play('copy')
    toast.success('Link copied', { description: b.url })
  } catch {
    play('error')
    toast.error('Couldn’t copy the link')
  }
}

function duplicate(b: Bookmark) {
  // Firestore refuses undefined values, so the per-copy fields are left out rather than cleared
  const { id: _, updatedAt: _u, lastOpened: _l, ...rest } = b
  const copy = add({ ...rest, title: `${b.title} (copy)`, pinned: false, visits: 0, createdAt: new Date().toISOString() })
  play('success')
  toast.success('Bookmark duplicated', { description: copy.title, action: { label: 'Undo', onClick: () => remove(copy.id, { undoAdd: true }) } })
  flash(copy.id)
}

// Refresh favicon (CHECKLIST.md #42): ask the site again; keep the current icon unless a new one really loads
const refreshing = ref(new Set<string>())
const loadsAsImage = (src: string) => new Promise<boolean>((resolve) => {
  const img = new Image()
  img.referrerPolicy = 'no-referrer'
  img.onload = () => resolve(img.naturalWidth > 0)
  img.onerror = () => resolve(false)
  img.src = src
  setTimeout(() => resolve(false), 8000)
})
async function refreshIcon(b: Bookmark) {
  if (!online.value) {
    toast('Can’t refresh the icon offline', { description: 'The current icon stays. Try again when you’re back online.' })
    return
  }
  refreshing.value = new Set(refreshing.value).add(b.id)
  const loading = toast.loading(`Refreshing the icon for ${b.title}…`)
  const preview = await $fetch('/api/link-preview', { query: { url: b.url } }).catch(() => undefined)
  const candidate = preview?.icon || new URL('/favicon.ico', b.url).href
  const ok = await loadsAsImage(candidate)
  const next = new Set(refreshing.value)
  next.delete(b.id)
  refreshing.value = next
  if (ok) {
    brokenIcons.value.delete(candidate)
    const before = update(b.id, { icon: candidate }, { quiet: true })
    play('success')
    toast.success(candidate === b.icon ? 'The icon is already up to date' : 'Icon updated', {
      id: loading,
      description: b.title,
      action: before && candidate !== b.icon ? { label: 'Undo', onClick: () => replace(before) } : undefined
    })
  } else {
    play('error')
    toast.error('Couldn’t find a new icon', { id: loading, description: 'The site didn’t offer one. The current icon was kept.', action: { label: 'Try again', onClick: () => refreshIcon(b) } })
  }
}

// Site icons load straight from each site; any that fail fall back to a letter tile
const brokenIcons = ref(new Set<string>())
const initial = (b: Bookmark) => (b.title.trim()[0] ?? hostOf(b.url)[0] ?? '?').toUpperCase()

function ago(iso?: string) {
  if (!iso) return ''
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ---------- Edit (popup) ----------
const editingId = ref<string>()
const form = reactive({ url: '', title: '', note: '', folders: [] as string[], pinned: false })
// A folder suggestion while it has none (CHECKLIST.md #30); Ignore hides it for this bookmark
const ignoredSuggestion = ref(false)
const formSuggestion = computed(() => {
  if (ignoredSuggestion.value || form.folders.length) return undefined
  const link = parseLink(form.url.trim())
  return link ? suggestFor(link.href, editingId.value) : undefined
})

function edit(b: Bookmark) {
  ignoredSuggestion.value = false
  editingId.value = b.id
  Object.assign(form, { url: b.url, title: b.title, note: b.note, folders: foldersOf(b), pinned: b.pinned })
  play('select')
}

function saveEdit() {
  const id = editingId.value
  const url = parseLink(form.url.trim())
  if (!id || !url) return
  const prev = items.value.find(b => b.id === id)
  const before = update(id, {
    url: url.href,
    title: form.title.trim() || hostOf(url.href),
    note: form.note.trim(),
    folders: [...form.folders],
    pinned: form.pinned,
    updatedAt: new Date().toISOString(),
    // A new address means a new site icon
    ...(prev && hostOf(prev.url) !== hostOf(url.href) ? { icon: new URL('/favicon.ico', url).href } : {})
  })
  editingId.value = undefined
  play('success')
  toastSaved(before && (() => replace(before)))
}

// ---------- Import / export (CHECKLIST.md #18): JSON, CSV and the browser's HTML bookmarks file ----------
const transferOpen = ref(false)
const BOOKMARK_COLUMNS: CsvColumn<Bookmark>[] = [
  { header: 'Title', get: b => b.title },
  { header: 'URL', get: b => b.url },
  { header: 'Folders', get: b => pathsOf(b) },
  { header: 'Note', get: b => b.note },
  { header: 'Description', get: b => b.description },
  { header: 'Pinned', get: b => (b.pinned ? 'yes' : '') },
  { header: 'Added', get: b => b.createdAt }
]
// Folders arrive as paths ("Work → Banking", "Work/Banking"); missing ones are made
function bookmarkFrom(url: string, title: string, paths: string[], note: string, description: string, pinned: boolean, added: string): Omit<Bookmark, 'id'> | undefined {
  const link = parseLink(url.trim())
  if (!link) return undefined
  const ids = paths.map(p => p.trim()).filter(Boolean).map(p => ensurePath(p.split(/\s*(?:→|\/|>)\s*/)))
  return {
    url: link.href,
    title: title.trim() || hostOf(link.href),
    tags: [],
    folders: [...new Set(ids)],
    note: note.trim(),
    description: description.trim(),
    icon: new URL('/favicon.ico', link).href,
    pinned,
    visits: 0,
    createdAt: added && !Number.isNaN(new Date(added).getTime()) ? new Date(added).toISOString() : new Date().toISOString()
  }
}
const bookmarkFromRow = (r: Record<string, string>) => bookmarkFrom(
  cellOf(r, 'url', 'link', 'address'), cellOf(r, 'title', 'name'), cellOf(r, 'folders', 'folder', 'tags').split(/[;,|]/),
  cellOf(r, 'note', 'notes'), cellOf(r, 'description'), /^(yes|true|1)$/i.test(cellOf(r, 'pinned')), cellOf(r, 'added', 'created')
)
// Our own JSON keeps folder ids; they're used when this device has those folders, else the folder paths
const bookmarkFromJSON = (r: Record<string, unknown>) => {
  const ids = Array.isArray(r.folders) ? r.folders.map(String).filter(id => folderIds.value.has(id)) : []
  const paths = ids.length ? [] : Array.isArray(r.folderPaths) ? r.folderPaths.map(String) : Array.isArray(r.tags) ? r.tags.map(String) : []
  const made = bookmarkFrom(String(r.url ?? ''), String(r.title ?? ''), paths, String(r.note ?? ''), String(r.description ?? ''), r.pinned === true, String(r.createdAt ?? ''))
  return made && ids.length ? { ...made, folders: ids } : made
}
const exportItems = computed(() => items.value.map(b => ({ ...b, folderPaths: pathsOf(b) })))
const BOOKMARK_HTML = [{
  label: 'Browser HTML',
  ext: 'html',
  mime: 'text/html',
  write: (list: Bookmark[]) => exportBrowserBookmarks(list, folders.value),
  read: (text: string) => parseBrowserBookmarks(text).map((b: ImportedBookmark) => {
    const { folderPath, ...rest } = b
    return { ...rest, tags: [], folders: folderPath?.length ? [ensurePath(folderPath)] : [] }
  })
}]

// Imported links only have a name; fill in each site's icon and description in the background,
// a few at a time, keeping the title the browser had
async function enrich(list: Bookmark[]) {
  if (!online.value) return
  const queue = [...list]
  const worker = async () => {
    for (let b = queue.shift(); b; b = queue.shift()) {
      const preview = await $fetch('/api/link-preview', { query: { url: b.url } }).catch(() => undefined)
      if (preview && items.value.some(i => i.id === b!.id)) update(b.id, { icon: preview.icon, description: preview.description, ...(preview.image ? { image: preview.image } : {}) }, { quiet: true })
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))
}

// ---------- Site details for every bookmark (one button) ----------
// Reads each page's preview image, description, icon and site name again, four at a time, with a
// running count. Titles you've typed stay; only a title that's still just the address is replaced.
// One Undo puts every bookmark back as it was.
const fetchingDetails = ref(false)
const brokenImages = ref(new Set<string>())
async function refreshAllDetails() {
  if (fetchingDetails.value) return
  if (!online.value) {
    toast('Can’t get site details offline', { description: 'Try again when you’re back online.' })
    return
  }
  const list = [...items.value]
  if (!list.length) return
  fetchingDetails.value = true
  const loading = toast.loading(`Getting site details… 0 of ${list.length}`)
  const befores: Bookmark[] = []
  let done = 0
  let changed = 0
  let failed = 0
  const queue = [...list]
  const worker = async () => {
    for (let b = queue.shift(); b; b = queue.shift()) {
      const preview = await $fetch('/api/link-preview', { query: { url: b.url } }).catch(() => undefined)
      done++
      toast.loading(`Getting site details… ${done} of ${list.length}`, { id: loading })
      const current = items.value.find(i => i.id === b!.id)
      if (!preview || !current) {
        failed++
        continue
      }
      const bareTitle = !current.title.trim() || current.title === current.url || current.title === hostOf(current.url)
      const patch: Partial<Bookmark> = {
        ...(preview.icon ? { icon: preview.icon } : {}),
        ...(preview.description ? { description: preview.description } : {}),
        ...(preview.image ? { image: preview.image } : {}),
        ...(preview.siteName ? { siteName: preview.siteName } : {}),
        ...(bareTitle && preview.title ? { title: preview.title } : {})
      }
      const differs = (Object.keys(patch) as (keyof Bookmark)[]).some(k => patch[k] !== current[k])
      if (!differs) continue
      const before = update(current.id, patch, { quiet: true })
      if (before) {
        befores.push(before)
        changed++
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))
  fetchingDetails.value = false
  brokenImages.value = new Set()
  play(changed ? 'success' : 'select')
  toast.success(changed ? `Updated ${changed} ${changed === 1 ? 'bookmark' : 'bookmarks'}` : 'Everything was already up to date', {
    id: loading,
    description: failed ? `${failed} ${failed === 1 ? 'site' : 'sites'} couldn’t be reached; they kept their details.` : undefined,
    action: befores.length ? { label: 'Undo', onClick: () => befores.forEach(b => replace(b)) } : undefined
  })
}
</script>

<template>
  <ToolPage header="bar">
    <template #settings>
      <SettingChoice v-model="sort" title="Sort by" :options="SORTS" />
      <SettingChoice v-model="view" title="Show as" :options="VIEWS.map(v => ({ value: v, label: v === 'grid' ? 'Cards' : v[0]!.toUpperCase() + v.slice(1) }))" />
    </template>
    <template #transfer>
      <button type="button" class="btn btn-quiet btn-sm" @click="transferOpen = true">More formats…</button>
      <span>Your browser’s bookmarks file, CSV or JSON.</span>
    </template>
    <TransferDialog
      :open="transferOpen"
      title="Bookmarks"
      collection="bookmarks"
      app="/bookmarks"
      :items="exportItems"
      :columns="BOOKMARK_COLUMNS"
      :from-row="bookmarkFromRow"
      :from-json="bookmarkFromJSON"
      :same-as="b => urlKey(b.url)"
      :add-many="addMany"
      :remove="remove"
      :extra="BOOKMARK_HTML"
      :on-imported="enrich"
      @close="transferOpen = false"
    />
    <template #actions><ClientOnly><DataSource :sync="sync" /></ClientOnly></template>

    <!-- 1: the address bar. Paste a link, check what the page says, add a note or folder, save -->
    <Step :n="1" title="Save a link" hint="Paste a link and the page’s title, picture and description fill in. Add a note, a folder or pin it, then save." class="save-step">
    <form v-validate data-validate-target class="omnibox" aria-label="Save a link" @submit.prevent="save()">
      <span class="omni-icon" aria-hidden="true"><ToolIcon name="bookmarks" /></span>
      <input
        ref="linkField"
        v-model="linkInput"
        type="text"
        inputmode="url"
        autocomplete="off"
        spellcheck="false"
        placeholder="Paste a link to save it"
        aria-label="Link to save"
        required
        data-error="Paste a link first"
        v-check="linkInput.trim() && !parseLink(linkInput.trim()) ? 'That doesn’t look like a link. Try something like nuxt.com' : ''"
        :disabled="saving"
        @paste="onLinkPaste"
      >
      <ClientOnly>
        <button v-if="savingTo" type="button" class="omni-folder" :style="{ '--tag': folderColor(savingTo) }" :title="`New links go into ${pathText(folders, savingTo.id)}. Click to save to All bookmarks instead.`" @click="activeFolder = ALL_BOOKMARKS">
          <FolderIcon :icon="savingTo.icon" :color="savingTo.color" />
          <span class="omni-folder-name">{{ savingTo.name }}</span>
          <AppIcon class="omni-folder-x" name="x" />
          <span class="sr-only">: saving into this folder. Save to All bookmarks instead</span>
        </button>
      </ClientOnly>
      <button v-if="canReadClipboard && !linkInput.trim() && !saving" type="button" class="omni-paste" title="Paste a link from the clipboard" @click="pasteFromClipboard">
        <AppIcon name="clipboard" />
        Paste
      </button>
      <button type="submit" class="btn" :disabled="saving">
        <span v-if="saving" class="omni-spinner" aria-hidden="true" />
        {{ saving ? 'Reading page…' : 'Add' }}
      </button>
    </form>
    <DuplicateCard
      v-if="duplicateOf"
      class="dup-card"
      :title="duplicateOf.title"
      :where="folderPath(duplicateOf)"
      :detail="duplicateOf.url"
      @open="showExisting"
      @keep="save(true)"
      @cancel="duplicateOf = undefined"
    />

    <!-- While the page is read: the shape of the card that's coming -->
    <Transition name="slide-down">
      <div v-if="saving" class="review panel review-loading" role="status" aria-label="Reading the page">
        <div class="review-media"><span class="skeleton review-icon" /></div>
        <div class="review-fields">
          <span class="skeleton sk-line" style="width: 40%" />
          <span class="skeleton sk-line sk-title" />
          <span class="skeleton sk-line sk-desc" />
          <span class="skeleton sk-line" style="width: 60%" />
        </div>
      </div>
    </Transition>

    <!-- Review before saving (#43): what the page says about itself, editable, plus a note, folders and pin -->
    <Transition name="slide-down">
      <form v-if="review" class="review panel" aria-label="Review the bookmark before saving" @submit.prevent="keepReviewed" @keydown.esc.stop="cancelReview">
        <div class="review-media">
          <img v-if="review.image && !reviewImageBroken" :src="review.image" alt="" referrerpolicy="no-referrer" @error="reviewImageBroken = true">
          <span v-else class="review-icon">
            <img v-if="!brokenIcons.has(review.icon)" :src="review.icon" alt="" referrerpolicy="no-referrer" @error="brokenIcons.add(review.icon)">
            <span v-else>{{ (review.title[0] ?? '?').toUpperCase() }}</span>
          </span>
        </div>
        <div class="review-fields">
          <p class="review-kicker">New bookmark</p>
          <p class="review-site">{{ review.siteName }} · <span class="review-url">{{ review.url }}</span></p>
          <p v-if="review.offline" class="review-note">Website details aren’t available offline. Your bookmark can still be saved; edit the title now or later.</p>
          <label class="field">
            <span class="sr-only">Title</span>
            <input ref="reviewTitle" v-model="review.title" class="input review-title" aria-label="Title">
          </label>
          <label class="field">
            <span class="sr-only">Description</span>
            <textarea v-model="review.description" class="input" rows="2" placeholder="Add a description" aria-label="Description" />
          </label>
          <label class="field">
            <span class="field-head">Note <span class="optional">Optional</span></span>
            <textarea v-model="review.note" class="input" rows="2" placeholder="Why you saved it, or what to look at" @keydown.enter.meta.prevent="keepReviewed" @keydown.enter.ctrl.prevent="keepReviewed" />
          </label>
          <div class="field">
            <span class="field-head">Folders <span class="optional">Optional</span></span>
            <FolderPicker v-model="review.folders" :folders="folders" :create-folder="name => ensureFolder(name)" />
          </div>
          <SuggestionChip
            v-if="review.suggestion && !review.folders.length"
            label="Suggested folder"
            :value="review.suggestion"
            @use="review!.folders = [ensureFolder(review!.suggestion!)]"
            @ignore="review!.suggestion = undefined"
          />
          <label class="pin-check">
            <input v-model="review.pinned" type="checkbox">
            Pin to the top
          </label>
          <div class="review-actions">
            <button type="submit" class="btn">Save bookmark</button>
            <button type="button" class="btn btn-quiet" @click="cancelReview">Cancel</button>
            <span class="review-hint"><kbd>Enter</kbd> to save</span>
          </div>
        </div>
      </form>
    </Transition>
    </Step>

    <ClientOnly>
      <!-- 2: pinned, the sites you open every day, as big tiles -->
      <Step v-if="pinned.length" :n="2" title="Pinned" hint="The links you open every day. Drag to reorder; right-click or long-press one to unpin it." class="pinned-step">
      <section v-if="pinned.length" class="shelf drop-x" :class="{ resting: sel.selecting }" :inert="sel.selecting || undefined" aria-label="Pinned. Drag to reorder, or Alt and the arrow keys.">
        <a
          v-for="(b, i) in pinned"
          :key="b.id"
          :href="b.url"
          target="_blank"
          rel="noopener"
          class="tile"
          v-bind="{ ...menuFor(() => bookmarkMenu(b), b.title), ...reorderPinned.bind(b, i) }"
          @click="opened(b)"
        >
          <span class="drag-grip corner" aria-hidden="true"><AppIcon name="grip-vertical" /></span>
          <span class="ribbon" aria-hidden="true" />
          <span class="tile-icon">
            <img v-if="b.icon && !brokenIcons.has(b.icon)" :src="b.icon" alt="" referrerpolicy="no-referrer" @error="brokenIcons.add(b.icon)">
            <span v-else>{{ initial(b) }}</span>
          </span>
          <span class="tile-name">{{ b.title }}</span>
          <span class="tile-host">{{ hostOf(b.url) }}</span>
        </a>
      </section>
      </Step>

      <!-- Then: find one. Folders down the side, the list beside them -->
      <Step :n="pinned.length ? 3 : 2" title="Find a bookmark" hint="Pick a folder, then search or sort. Click to open; right-click or long-press for more." class="library-step">
      <div class="library">
        <!-- Folders down the side, like the spines on a shelf -->
        <aside v-sticky-fit class="side" aria-label="Folders">
          <FolderTree
            :folders="folders"
            :counts="counts"
            :total="items.length"
            :unfiled="unfiledCount"
            :active="activeFolder"
            :collapsed="collapsed"
            @select="id => activeFolder = id"
            @toggle="toggleFolder"
            @add="openNewFolder"
            @edit="openEditFolder"
            @delete="deleteFolder"
            @move-folder="moveFolder"
            :item-dragging="draggingMarks"
            @drop-bookmark="(ids, folderId) => { draggingMarks = false; dropMarks(ids.split('\n'), folderId) }"
            add-item-label="Add a bookmark here"
            @add-item="addInFolder"
          />

          <div class="side-tools">
            <button v-if="items.length" type="button" class="btn btn-quiet btn-sm details-btn" :disabled="fetchingDetails" title="Read every site’s preview image, description, icon and name again" @click="refreshAllDetails">
              <AppIcon name="rotate-cw" />
              {{ fetchingDetails ? 'Getting site details…' : 'Get site details' }}
            </button>
            <button type="button" class="link" @click="dupesOpen = true">Find duplicates<template v-if="duplicateCount"> <span class="count-pill">{{ duplicateCount }}</span></template></button>
            <NuxtLink to="/trash?app=/bookmarks" class="link">Recycle Bin</NuxtLink>
          </div>
        </aside>

        <section class="main" :aria-label="listTitle">
          <div v-sticky-bar class="toolbar">
            <h2 class="list-title">
              <FolderIcon v-if="activeFolderRecord" :icon="activeFolderRecord.icon" :color="activeFolderRecord.color" />
              {{ listTitle }}
            </h2>
            <button v-if="savingTo" type="button" class="view-btn add-here" :aria-label="`Add a bookmark to ${savingTo.name}`" :title="`Add a bookmark to ${savingTo.name}`" @click="addInFolder()">
              <ToolIcon name="plus" />
            </button>
            <label class="search">
              <AppIcon name="search" />
              <input ref="searchInput" v-model="query" type="search" placeholder="Search" aria-label="Search bookmarks" @keydown.enter.prevent="openFirst">
              <kbd v-if="!query" aria-hidden="true">/</kbd>
            </label>
            <button v-if="items.length" type="button" class="btn btn-quiet btn-sm select-btn" :aria-pressed="sel.selecting" @click="sel.selecting ? sel.stop() : sel.start()">{{ sel.selecting ? 'Done' : 'Select' }}</button>
            <AppSelect v-model="sort" class="sort" aria-label="Sort by" :options="SORTS" />
            <div class="views" role="radiogroup" aria-label="View">
              <button type="button" role="radio" class="view-btn" :aria-checked="view === 'list'" title="List" @click="setView('list')">
                <AppIcon name="list" />
                <span class="sr-only">List</span>
              </button>
              <button type="button" role="radio" class="view-btn" :aria-checked="view === 'grid'" title="Grid" @click="setView('grid')">
                <AppIcon name="layout-grid" />
                <span class="sr-only">Grid</span>
              </button>
              <button type="button" role="radio" class="view-btn" :aria-checked="view === 'compact'" title="Compact" @click="setView('compact')">
                <AppIcon name="align-justify" />
                <span class="sr-only">Compact</span>
              </button>
            </div>
            <div v-if="view !== 'compact'" class="views">
              <button type="button" class="view-btn" :aria-pressed="showImages" :title="showImages ? 'Hide preview images' : 'Show preview images'" @click="toggleImages">
                <AppIcon :name="showImages ? 'image' : 'image-off'" />
                <span class="sr-only">Preview images</span>
              </button>
            </div>
          </div>

          <template v-if="shown.length">
            <TransitionGroup tag="ul" name="list" class="marks" :class="[view === 'compact' ? ['list', 'compact'] : view, { 'selecting': sel.selecting, 'no-images': !showImages }]">
              <li v-for="b in visibleMarks" :id="`bm-${b.id}`" :key="b.id" :data-item-id="b.id" class="mark" v-bind="menuFor(() => bookmarkMenu(b), b.title)" v-swipe-delete="() => del(b)" :data-swipe-off="sel.selecting || undefined" :class="{ 'flash': flashId === b.id, 'picked': sel.has(b.id), 'is-pinned': b.pinned, 'is-dupe': duplicateIds.has(b.id) }" :draggable="finePointer ? 'true' : undefined" @dragstart="onBookmarkDrag($event, b)" @dragend="draggingMarks = false" @click.capture="sel.onRowClick($event, b.id)">
                <!-- Drag to a folder: the whole row with a mouse, this grip with a finger -->
                <button v-if="folders.length" type="button" class="grip" tabindex="-1" :aria-label="`Drag ${b.title} to a folder`" title="Drag to a folder" @pointerdown="touchDrag.start($event, dragIdsFor(b), dragLabel(dragIdsFor(b)))" @touchstart.stop @click.stop.prevent>
                  <AppIcon name="grip-vertical" />
                </button>
                <!-- Pinned: a ribbon hanging from the top edge -->
                <span v-if="b.pinned" class="pin-ribbon" aria-hidden="true">
                  <AppIcon name="pin" />
                </span>
                <!-- The page's own preview image: a cover on cards, a thumbnail in the list -->
                <img v-if="b.image && view !== 'compact' && !brokenImages.has(b.image)" class="mark-image" :src="b.image" alt="" loading="lazy" referrerpolicy="no-referrer" @error="brokenImages = new Set(brokenImages).add(b.image!)">
                <!-- The icon doubles as the checkbox: always while selecting, and on hover with a mouse to start -->
                <span class="mark-icon">
                  <img v-if="b.icon && !brokenIcons.has(b.icon)" :src="b.icon" alt="" loading="lazy" referrerpolicy="no-referrer" @error="brokenIcons.add(b.icon)">
                  <span v-else aria-hidden="true">{{ initial(b) }}</span>
                  <label class="mark-pick">
                    <input type="checkbox" class="pick-box" :checked="sel.has(b.id)" :tabindex="sel.selecting ? undefined : -1" :aria-label="`Select ${b.title}`" @click="sel.pick(b.id, $event)">
                    <svg class="pick-tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 12.5l3.5 3.5 7.5-8" /></svg>
                  </label>
                </span>
                <div class="mark-body">
                  <a :href="b.url" target="_blank" rel="noopener" class="mark-title" @click="opened(b)">{{ b.title }}<span v-if="b.pinned" class="sr-only"> (pinned)</span><AppIcon class="ext" name="external-link" /><span class="sr-only"> (opens in a new tab)</span></a>
                  <span class="mark-meta">
                    <template v-if="b.siteName && b.siteName.toLowerCase() !== b.title.toLowerCase()">{{ b.siteName }} · </template>{{ hostOf(b.url) }} · added {{ ago(b.createdAt) }}<template v-if="b.visits"> · opened {{ b.visits }}×</template>
                    <button v-if="duplicateIds.has(b.id)" type="button" class="dupe-badge" title="Saved more than once. Open Find duplicates to merge them." @click="dupesOpen = true">Duplicate</button>
                  </span>
                  <p v-if="b.description && !b.note" class="mark-desc">{{ b.description }}</p>
                  <p v-if="b.note" class="mark-note">{{ b.note }}</p>
                  <span v-if="foldersOf(b).length" class="mark-tags">
                    <button
                      v-for="id in foldersOf(b)"
                      :key="id"
                      type="button"
                      class="chip"
                      :style="{ '--tag': folderColor(folderById(id)) }"
                      :title="`Show ${pathText(folders, id)}`"
                      @click="activeFolder = id"
                    >
                      <FolderIcon :icon="folderById(id)?.icon" :color="folderById(id)?.color" />{{ folderById(id)?.name }}
                    </button>
                  </span>
                </div>
                <div class="mark-actions menu-dup">
                  <button type="button" class="icon-btn" :class="{ on: b.pinned }" :aria-pressed="b.pinned" :aria-label="b.pinned ? `Unpin ${b.title}` : `Pin ${b.title}`" :title="b.pinned ? 'Unpin' : 'Pin to the top'" @click="togglePin(b)">
                    <AppIcon name="pin" />
                  </button>
                  <button type="button" class="icon-btn" :aria-label="`Edit ${b.title}`" title="Edit" @click="edit(b)">
                    <AppIcon name="pencil" />
                  </button>
                  <ConfirmDelete :name="b.title" @confirm="del(b)" />
                </div>
              </li>
            </TransitionGroup>
            <!-- Long lists draw in pages (#70); this loads the next page as it scrolls into view -->
            <div v-if="shown.length > limit" ref="moreSentinel" class="more-sentinel">
              <button type="button" class="btn btn-quiet btn-sm" @click="limit += PAGE">Show more ({{ shown.length - limit }} left)</button>
            </div>
          </template>

          <div v-else-if="ready && items.length && savingTo && !query" class="empty">
            <p>{{ savingTo.name }} is empty.</p>
            <button type="button" class="btn btn-sm" @click="addInFolder()">Add a bookmark here</button>
          </div>

          <div v-else-if="ready && items.length" class="empty">
            <p>Nothing matches{{ query ? ` “${query}”` : '' }}.</p>
            <button type="button" class="btn btn-quiet btn-sm" @click="query = ''; activeFolder = ALL_BOOKMARKS">Show everything</button>
          </div>

          <div v-else-if="ready" class="empty-panel">
            <EmptyState title="No bookmarks yet" icon="bookmarks" action="Save your first link" @action="focusField(linkField)">
              Paste a link and its title and icon are filled in for you. Pin the ones you open every day.
              <template #extra>
                <p class="import-hint">Already have bookmarks in your browser? Import them in Settings, under Import &amp; export.</p>
              </template>
            </EmptyState>
          </div>
          <SkeletonList v-else label="Loading your bookmarks" />
        </section>
      </div>
      </Step>
      <template #fallback><SkeletonList label="Loading your bookmarks" /></template>
    </ClientOnly>

    <Modal :open="!!editingId" title="Edit bookmark" @close="editingId = undefined">
      <form v-validate class="edit" @submit.prevent="saveEdit">
        <label class="field">
          <span class="field-head">Title</span>
          <input v-model="form.title" class="input">
        </label>
        <label class="field">
          <span class="field-head">Link</span>
          <input v-model="form.url" class="input" inputmode="url" spellcheck="false" required data-error="Enter the link" v-check="form.url.trim() && !parseLink(form.url.trim()) ? 'That doesn’t look like a link. Try something like nuxt.com' : ''">
        </label>
        <label class="field">
          <span class="field-head">Note <span class="optional">Optional</span></span>
          <textarea v-model="form.note" class="input" rows="3" placeholder="Why you saved it, or what to look at" />
        </label>
        <div class="field">
          <span class="field-head">Folders <span class="optional">Optional</span></span>
          <FolderPicker v-model="form.folders" :folders="folders" :create-folder="name => ensureFolder(name)" />
        </div>
        <SuggestionChip v-if="formSuggestion" label="Suggested folder" :value="formSuggestion" @use="form.folders = [ensureFolder(formSuggestion!)]" @ignore="ignoredSuggestion = true" />
        <label class="pin-check">
          <input v-model="form.pinned" type="checkbox">
          Pin to the top
        </label>
        <div class="edit-actions">
          <button type="submit" class="btn">Save changes</button>
          <button type="button" class="btn btn-quiet" @click="editingId = undefined">Cancel</button>
        </div>
      </form>
    </Modal>

    <BookmarkDupes v-model:ignored="ignoredDupes" :open="dupesOpen" :bookmarks="items" :folders="folders" :update="update" :replace="replace" :remove="remove" :restore="restore" @close="dupesOpen = false" />

    <FolderEditor :open="folderEditor.open" :folders="folders" :folder="folderEditor.folder" :parent-id="folderEditor.parentId" @close="folderEditor.open = false" @save="saveFolder" />

    <!-- Select several: the floating bar (BulkBar) -->
    <BulkBar :select="sel" :actions="bulkActions" label="Selected bookmarks" noun="bookmarks" />


    <!-- Move to folder… (the menu way to do what dragging does) -->
    <Modal :open="!!moving || movingMany" :title="movingMany ? `Move ${marksText(sel.selected.size)}` : moving ? `Move ${moving.title}` : 'Move'" @close="moving = undefined; movingMany = false">
      <div class="move-list" role="listbox" aria-label="Folders">
        <button type="button" class="move-opt" @click="pickFolder(UNFILED)">
          <ToolIcon name="bookmarks" /> Not in a folder
        </button>
        <button
          v-for="o in flatTree(folders)"
          :key="o.folder.id"
          type="button"
          class="move-opt"
          :class="{ current: !movingMany && moving && foldersOf(moving).includes(o.folder.id) }"
          :style="{ paddingLeft: `${0.8 + o.depth * 1}rem` }"
          @click="pickFolder(o.folder.id)"
        >
          <FolderIcon :icon="o.folder.icon" :color="o.folder.color" /> {{ o.folder.name }}
        </button>
        <button type="button" class="move-opt new" @click="moving = undefined; movingMany = false; openNewFolder()">+ New folder…</button>
      </div>
    </Modal>
    <FolderDropTray :drag="touchDrag.drag" :folders="folders" unfiled />
  </ToolPage>
</template>

<style scoped>
/* ---------- Two markers, two colours ----------
   Pinned is blue everywhere (tiles, rows, cards, the pin button); Duplicate is amber, a heads-up */
.pinned-step,
.library-step {
  --pin-color: var(--blue);
  --dupe-color: var(--orange);
}

/* ---------- Steps: save, pinned, find ---------- */
.pinned-step,
.library-step {
  margin-top: 2.25rem;
}

/* ---------- Address bar ---------- */
.more-sentinel {
  display: flex;
  justify-content: center;
  padding: 1rem 0;
}

.count-pill {
  display: inline-block;
  min-width: 1.3em;
  padding: 0 0.35em;
  font-size: var(--text-xs);
  font-weight: 700;
  line-height: 1.5;
  text-align: center;
  color: var(--warn-ink);
  background: color-mix(in srgb, var(--orange) 16%, var(--surface));
  border-radius: 999px;
}

.dup-card {
  width: min(100%, 760px);
  margin: 0.75rem auto 0;
}

/* ---------- Review before saving ---------- */
.review {
  width: min(100%, 760px);
  margin: 0.75rem auto 0;
  padding: 1rem;
  display: grid;
  grid-template-columns: 9rem minmax(0, 1fr);
  gap: 1rem;
  text-align: left;
}

.review-media img {
  width: 100%;
  aspect-ratio: 1.91;
  object-fit: cover;
  border-radius: 12px;
  background: var(--surface-2);
}

.review-icon {
  width: 100%;
  aspect-ratio: 1.91;
  display: grid;
  place-items: center;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
  border-radius: 12px;
}

.review-icon img {
  width: 2.75rem;
  height: 2.75rem;
  aspect-ratio: auto;
  object-fit: contain;
  background: none;
}

.review-fields {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.review-kicker {
  margin: 0;
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--accent);
}

.review-loading .sk-line {
  display: block;
  height: 0.85rem;
  border-radius: 6px;
}

.review-loading .sk-title {
  height: 2.6rem;
  border-radius: 10px;
}

.review-loading .sk-desc {
  height: 3.6rem;
  border-radius: 10px;
}

.review-site {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--ink-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.review-url {
  color: var(--ink-3);
}

.review-note {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--warn-ink);
}

.review-title {
  font-weight: 700;
  font-size: 1.05rem;
}

.review-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.review-hint {
  margin-left: auto;
  font-size: var(--text-sm);
  color: var(--ink-3);
}

@media (max-width: 560px) {
  .review {
    grid-template-columns: minmax(0, 1fr);
  }

  .review-media img,
  .review-icon {
    aspect-ratio: 2.6;
  }

  .review-hint {
    display: none;
  }
}

.list-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

/* ---------- Move to folder ---------- */
.move-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 60dvh;
  overflow-y: auto;
}

.move-opt {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 2.75rem;
  padding: 0.4rem 0.8rem;
  font: inherit;
  font-weight: 600;
  text-align: left;
  color: var(--ink);
  background: none;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
}

.move-opt:hover {
  background: var(--surface-2);
}

.move-opt.current {
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
}

.move-opt.new {
  color: var(--ink-2);
}

.empty-panel {
  margin-top: 1rem;
  background: var(--surface);
  border-radius: 18px;
  box-shadow: 0 0 0 1px var(--line);
}

.import-hint {
  margin: 0.5rem 0 0;
  font-size: var(--text-sm);
}

.omnibox {
  width: min(100%, 760px);
  margin: 0;
  padding: 0.4rem 0.4rem 0.4rem 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: var(--surface);
  border-radius: 999px;
  box-shadow: 0 0 0 1px var(--line), 0 14px 30px -16px rgb(var(--shadow) / 0.35);
  transition: box-shadow 0.15s;
}

.omnibox:focus-within {
  box-shadow: 0 0 0 2px var(--accent), 0 14px 30px -16px rgb(var(--shadow) / 0.35);
}

.omnibox.is-invalid {
  box-shadow: 0 0 0 2px var(--bad-ink), 0 14px 30px -16px rgb(var(--shadow) / 0.35);
}

/* The validation message sits centred under the address bar */
.omnibox + :global(.field-error) {
  justify-content: center;
  margin-top: 0.6rem;
}

/* The folder a new link goes into, when one is open; clicking it saves to All bookmarks instead */
.omni-folder {
  flex: none;
  max-width: 11rem;
  min-height: 2rem;
  padding: 0 0.55rem 0 0.6rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--ink);
  background: color-mix(in srgb, var(--tag, var(--accent)) 14%, var(--surface-2));
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.omni-folder:hover {
  background: color-mix(in srgb, var(--tag, var(--accent)) 24%, var(--surface-2));
}

.omni-folder-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.omni-folder-x {
  flex: none;
  width: 0.8rem;
  height: 0.8rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
  opacity: 0.55;
}

.omni-folder:hover .omni-folder-x { opacity: 1; }

/* Same shape as the view switches beside it */
.view-btn.add-here {
  flex: none;
  width: 2.4rem;
  height: 2.4rem;
  color: var(--accent);
  background: var(--surface-2);
  border-radius: 12px;
  box-shadow: inset 0 0 0 1px var(--line);
}

.add-here :deep(svg) {
  width: 1.15rem;
  height: 1.15rem;
}

.omni-icon {
  flex: none;
  font-size: 1.35rem;
  color: var(--accent);
  display: grid;
}

.omni-icon :deep(svg) {
  width: 1.35rem;
  height: 1.35rem;
}

.omnibox input {
  flex: 1;
  min-width: 0;
  padding: 0.6rem 0;
  font: inherit;
  font-size: 1.1rem;
  color: var(--ink);
  background: none;
  border: 0;
  outline: none;
}

.omnibox input::placeholder {
  color: var(--ink-3);
}

.omnibox .btn {
  flex: none;
  border-radius: 999px;
  padding-inline: 1.3rem;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.omni-paste {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.8rem;
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-2);
  background: var(--surface-2);
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.omni-paste:hover {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
}

.omni-paste:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.omni-paste svg {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.omni-spinner {
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: omni-spin 0.7s linear infinite;
}

@keyframes omni-spin {
  to { transform: rotate(1turn); }
}

/* ---------- Pinned tiles ---------- */
.shelf {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
  gap: 0.75rem;
}

.tile {
  position: relative;
  -webkit-touch-callout: none;
  padding: 1.1rem 0.75rem 0.85rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  color: var(--ink);
  text-decoration: none;
  background: var(--surface);
  border-radius: 16px;
  box-shadow: 0 0 0 1px var(--line), 0 6px 14px -8px rgb(var(--shadow) / 0.3);
  transition: translate 0.15s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.15s, scale 0.15s;
}

.tile:hover {
  translate: 0 -2px;
  box-shadow: 0 0 0 1px var(--ink-3), 0 12px 22px -10px rgb(var(--shadow) / 0.35);
}

.tile:active {
  scale: 0.96;
}

/* A ribbon bookmark hanging over the top edge */
.ribbon {
  position: absolute;
  top: -3px;
  right: 1rem;
  width: 0.75rem;
  height: 1.3rem;
  background: var(--pin-color, var(--accent));
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 75%, 0 100%);
}

.tile-icon,
.mark-icon {
  display: grid;
  place-items: center;
  overflow: hidden;
  font-weight: 700;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
}

.tile-icon {
  width: 3rem;
  height: 3rem;
  font-size: 1.3rem;
  border-radius: 14px;
}

.tile-icon img,
.mark-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #fff;
  outline: 1px solid oklch(0 0 0 / 0.1);
  outline-offset: -1px;
}

.tile-name {
  width: 100%;
  margin-top: 0.6rem;
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tile-host {
  width: 100%;
  font-size: 0.75rem;
  color: var(--ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---------- Library: tags | list ---------- */
.library {
  width: 100%;
  display: grid;
  grid-template-columns: 13rem minmax(0, 1fr);
  gap: 2rem;
  align-items: start;
}

.side {
  min-width: 0;
  position: sticky;
  top: var(--pin-top);
}

.tags {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tag-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.25rem;
  padding: 0.35rem 0.7rem;
  font: inherit;
  font-size: 0.925rem;
  font-weight: 600;
  color: var(--ink-2);
  text-align: left;
  background: none;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.tag-row span {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-row b {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}

.tag-row:hover {
  color: var(--ink);
  background: var(--surface);
}

.tag-row.on {
  color: var(--ink);
  background: var(--surface);
  box-shadow: inset 3px 0 0 var(--tag, var(--accent)), 0 0 0 1px var(--line);
}

.tag-row.muted span {
  font-style: italic;
}

.swatch {
  flex: none;
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 3px;
  background: var(--tag);
}

.side-tools {
  margin-top: 1.25rem;
  padding: 0.9rem 0.7rem 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.4rem;
  border-top: 1px solid var(--line);
}


.link:hover {
  color: var(--ink);
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

/* As tall as the search box beside it */
.select-btn {
  min-height: 2.75rem;
}

.select-btn[aria-pressed='true'] {
  color: var(--accent);
  border-color: var(--accent);
}

/* The icon is the checkbox. Hidden until selecting (or hovering with a mouse), it covers the icon:
   an outlined box when unpicked, the accent with a tick when picked. */
.mark-icon {
  position: relative;
}

.mark-pick {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-items: center;
  border-radius: inherit;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease-out;
}

.marks.selecting .mark-pick,
.mark-pick:focus-within {
  opacity: 1;
  pointer-events: auto;
}

@media (hover: hover) and (pointer: fine) {
  .mark:hover .mark-pick {
    opacity: 1;
    pointer-events: auto;
  }
}

.pick-box {
  appearance: none;
  position: absolute;
  inset: 0;
  margin: 0;
  border-radius: inherit;
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--ink) 35%, transparent);
  cursor: pointer;
  transition-property: background-color, box-shadow;
  transition-duration: 0.15s;
  transition-timing-function: ease-out;
}

.pick-box:hover {
  box-shadow: inset 0 0 0 2px var(--accent);
}

.pick-box:checked {
  background: var(--accent);
  box-shadow: none;
}

.pick-box:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.pick-tick {
  position: relative;
  width: 58%;
  height: 58%;
  fill: none;
  stroke: var(--on-accent, #fff);
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: none;
  opacity: 0;
  scale: 0.25;
  filter: blur(4px);
  transition-property: opacity, scale, filter;
  transition-duration: 0.2s;
  transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
}

.pick-box:checked + .pick-tick {
  opacity: 1;
  scale: 1;
  filter: blur(0);
}

/* While selecting, the row is one big tap target: no link hover, no pointer on the title */
.marks.selecting .mark {
  cursor: pointer;
  user-select: none;
}

.marks.selecting .mark-title {
  pointer-events: none;
}

/* The pinned shelf rests while picking from the list */
.shelf.resting {
  opacity: 0.45;
  transition: opacity 0.15s ease-out;
}

.marks.selecting .mark-actions {
  visibility: hidden;
}

.mark.picked {
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
}

.toolbar h2 {
  flex: 1;
  min-width: 8rem;
  font-size: 1.3rem;
  letter-spacing: -0.015em;
}

.search {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: min(100%, 16rem);
  padding: 0 0.6rem 0 0.75rem;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  transition: border-color 0.15s;
}

.search:focus-within {
  border-color: var(--ink);
}

.search svg {
  flex: none;
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: var(--ink-3);
  stroke-width: 2;
  stroke-linecap: round;
}

.search input {
  flex: 1;
  min-width: 0;
  padding: 0.55rem 0;
  font: inherit;
  color: var(--ink);
  background: none;
  border: 0;
  outline: none;
}

kbd {
  padding: 0 0.4rem;
  font: inherit;
  font-size: 0.75rem;
  color: var(--ink-3);
  border: 1px solid var(--line);
  border-radius: 5px;
}

.sort {
  width: auto;
  padding-block: 0.5rem;
}

.marks {
  position: relative;
  list-style: none;
  margin: 1rem 0 0;
  padding: 0;
  background: var(--surface);
  border-radius: 18px;
  box-shadow: 0 0 0 1px var(--line);
}

.mark {
  position: relative;
  display: flex;
  /* A long press opens the app's own menu, not the phone's link preview */
  -webkit-touch-callout: none;
  align-items: flex-start;
  gap: 0.9rem;
  padding: 0.95rem 1rem;
  cursor: pointer;
  transition: background-color 0.6s;
}

/* The whole row or card opens the link: the title link stretches over it (still a real link, so
   middle-click, right-click and the visit count all work). Buttons and tags sit above it. */
.mark-title::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
}

.mark-actions,
.mark-tags {
  position: relative;
  z-index: 1;
}

/* Drag to a folder: a grip on the left edge. Shows on hover with a mouse; always there for a finger,
   which drags by it (the rest of the row scrolls the list) */
.grip {
  position: absolute;
  z-index: 2;
  left: 0;
  top: 50%;
  translate: 0 -50%;
  width: 1.1rem;
  height: 2.5rem;
  display: grid;
  place-items: center;
  padding: 0;
  color: var(--ink-3);
  background: none;
  border: 0;
  cursor: grab;
  opacity: 0;
  touch-action: none;
  transition: opacity 0.15s;
}

.grip svg {
  width: 1rem;
  height: 1rem;
  fill: currentColor;
}

.mark:hover .grip {
  opacity: 1;
}

.marks.grid .grip {
  top: 0.5rem;
  left: 0.25rem;
  translate: none;
  height: 1.6rem;
  background: color-mix(in srgb, var(--surface) 85%, transparent);
  border-radius: 6px;
}

@media (hover: none) {
  .grip {
    opacity: 0.7;
    width: 1.75rem;
  }

  .marks.list .mark {
    padding-left: 1.6rem;
  }
}

/* ---------- Hover: show clearly that the bookmark itself is what opens ----------
   Over a button or tag the highlight steps back, so it's obvious only that button will be clicked. */
.mark {
  --hl: 0;
}

.mark:hover:not(:has(.mark-actions:hover, .mark-tags:hover)),
.mark:has(.mark-title:focus-visible) {
  --hl: 1;
  background: color-mix(in srgb, var(--accent) 7%, var(--surface));
}

/* Quick to light up; the slower fade-out belongs to the "just saved" flash */
.mark:hover {
  transition-duration: 0.12s;
}

/* List rows: an accent edge on the left */
.marks.list .mark::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.6rem;
  bottom: 0.6rem;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--accent);
  opacity: var(--hl);
  transition: opacity 0.15s;
}

/* Pinned: a ribbon with a pin hangs from the top edge, beside the icon in the list and at the
   card's top-right corner in the grid. Its shape and pin carry the meaning, not colour alone. */
.pin-ribbon {
  position: absolute;
  z-index: 1;
  top: 0;
  left: 0.15rem;
  width: 0.8rem;
  height: 1.2rem;
  display: grid;
  place-items: start center;
  padding-top: 0.2rem;
  background: var(--pin-color);
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 75%, 0 100%);
  pointer-events: none;
}

.pin-ribbon svg {
  width: 0.55rem;
  height: 0.55rem;
  fill: #fff;
  stroke: #fff;
  stroke-width: 2;
  stroke-linejoin: round;
}

.marks.grid .pin-ribbon {
  left: auto;
  right: 1rem;
  width: 1.5rem;
  height: 2.1rem;
  padding-top: 0.4rem;
}

.marks.grid .pin-ribbon svg {
  width: 0.85rem;
  height: 0.85rem;
}

/* Saved more than once: an amber edge or border and a Duplicate badge that opens Find duplicates */
.marks.list .mark.is-dupe::before {
  opacity: 1;
  background: var(--dupe-color);
}

.marks.grid .mark.is-dupe {
  box-shadow: 0 0 0 2px var(--dupe-color);
}

.dupe-badge {
  margin-left: 0.4rem;
  padding: 0.05rem 0.45rem;
  font: inherit;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--warn-ink);
  background: color-mix(in srgb, var(--dupe-color) 14%, var(--surface));
  border: 0;
  border-radius: 999px;
  cursor: pointer;
}

.dupe-badge:hover {
  background: color-mix(in srgb, var(--dupe-color) 24%, var(--surface));
}

/* ---------- Preview images ---------- */
/* List: a thumbnail at the row's right end */
.mark-image {
  order: 3;
  flex: none;
  width: 7.5rem;
  aspect-ratio: 1.91;
  object-fit: cover;
  border-radius: 10px;
  background: var(--surface-2);
  box-shadow: 0 0 0 1px var(--line);
}

/* Cards: a cover across the top */
.marks.grid .mark-image {
  order: -1;
  width: calc(100% + 2rem);
  margin: -1rem -1rem 0;
  border-radius: 18px 18px 0 0;
  box-shadow: none;
}

/* The site icon sits on the cover's lower edge */
.marks.grid .mark-image + .mark-icon {
  margin-top: -2.2rem;
  box-shadow: 0 0 0 3px var(--surface);
}

@media (max-width: 640px) {
  .marks.list .mark-image {
    width: 5rem;
  }
}

/* The image toggle shrinks and fades the images rather than dropping them, so rows and cards
   ease into their new size. A card's cover height comes from its width (cqi), which lets it animate. */
.mark-image,
.marks.grid .mark-image + .mark-icon {
  transition: width 0.3s ease, height 0.3s ease, margin 0.3s ease, opacity 0.2s ease, box-shadow 0.3s ease;
}

.marks.grid .mark {
  container-type: inline-size;
}

.marks.grid .mark-image {
  height: calc((100cqi + 2rem) / 1.91);
}

.marks.list.no-images .mark-image {
  width: 0;
  margin-left: -0.9rem;
  opacity: 0;
  box-shadow: none;
}

/* Collapsed covers pull the gap back too, so the card lines up with ones that never had an image */
.marks.grid.no-images .mark-image {
  height: 0;
  margin-top: -0.7rem;
  opacity: 0;
}

.marks.grid.no-images .mark-image + .mark-icon {
  margin-top: 0;
  box-shadow: 0 0 0 3px transparent;
}

.details-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  justify-self: start;
  margin-bottom: 0.35rem;
}

.details-btn svg {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ext {
  width: 0.95em;
  height: 0.95em;
  margin-left: 0.3em;
  vertical-align: -0.1em;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: var(--hl);
  translate: calc((1 - var(--hl)) * -3px) calc((1 - var(--hl)) * 3px);
  transition: opacity 0.15s, translate 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.mark:has(.mark-title:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.mark-title:focus-visible {
  outline: none;
}

.mark + .mark {
  border-top: 1px solid var(--line);
}

/* A just-saved (or already-saved) bookmark glows briefly so you can see where it went */
.mark.flash {
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
  transition: none;
}

.mark:first-child { border-radius: 18px 18px 0 0; }
.mark:last-child { border-radius: 0 0 18px 18px; }
.mark:only-child { border-radius: 18px; }

.mark-icon {
  flex: none;
  width: 2.5rem;
  height: 2.5rem;
  margin-top: 0.1rem;
  border-radius: 10px;
}

.mark-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.mark-title {
  position: static;
  font-weight: 700;
  line-height: 1.3;
  color: var(--ink);
  text-decoration: none;
  overflow-wrap: anywhere;
}

.mark:hover:not(:has(.mark-actions:hover, .mark-tags:hover)) .mark-title,
.mark-title:focus-visible {
  color: var(--accent);
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}

.mark-meta {
  font-size: 0.8rem;
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}

.mark-desc {
  margin: 0.3rem 0 0;
  font-size: 0.875rem;
  color: var(--ink-2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Your own note, like pencil in the margin */
.mark-note {
  margin: 0.4rem 0 0;
  padding: 0.35rem 0.6rem;
  font-size: 0.875rem;
  color: var(--ink);
  background: color-mix(in srgb, var(--yellow) 18%, var(--surface));
  border-left: 3px solid var(--yellow);
  border-radius: 2px 8px 8px 2px;
  white-space: pre-line;
}

.mark-tags {
  margin-top: 0.45rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.chip {
  padding: 0.1rem 0.5rem;
  font: inherit;
  font-size: 0.775rem;
  font-weight: 600;
  color: var(--ink);
  background: color-mix(in srgb, var(--tag) 13%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--tag) 35%, transparent);
  border-radius: 999px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.chip:hover {
  background: color-mix(in srgb, var(--tag) 24%, var(--surface));
}

.mark-actions {
  flex: none;
  display: flex;
  gap: 0.1rem;
}

/* ---------- View switch ---------- */
.views {
  flex: none;
  display: flex;
  padding: 3px;
  gap: 2px;
  background: var(--surface-2);
  border-radius: 12px;
  box-shadow: inset 0 0 0 1px var(--line);
}

.view-btn {
  width: 2.3rem;
  height: 2.1rem;
  display: grid;
  place-items: center;
  padding: 0;
  color: var(--ink-3);
  background: none;
  border: 0;
  border-radius: 9px;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.view-btn:hover {
  color: var(--ink);
}

.view-btn[aria-checked='true'],
.view-btn[aria-pressed='true'] {
  color: var(--ink);
  background: var(--surface);
  box-shadow: 0 1px 2px rgb(var(--shadow) / 0.15);
}

.view-btn svg {
  width: 1.15rem;
  height: 1.15rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.view-btn circle {
  fill: currentColor;
  stroke: none;
}
/* Labels for screen readers only (the view buttons show icons) */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* ---------- Grid view: each bookmark is a card ---------- */
/* ---------- Compact: one line per bookmark, nothing but the name and site ---------- */
.marks.compact .mark {
  align-items: center;
  gap: 0.7rem;
  padding: 0.4rem 0.6rem 0.4rem 0.9rem;
}

.marks.compact .mark-icon {
  width: 1.5rem;
  height: 1.5rem;
  font-size: 0.75rem;
  border-radius: 6px;
}

.marks.compact .mark-body {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  min-width: 0;
}

.marks.compact .mark-title {
  flex: none;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.marks.compact .mark-meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.marks.compact .mark-desc,
.marks.compact .mark-note,
.marks.compact .mark-tags {
  display: none;
}

.marks.compact .icon-btn {
  width: 2rem;
  height: 2rem;
}

.marks.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 15.5rem), 1fr));
  gap: 0.75rem;
  background: none;
  box-shadow: none;
}

.marks.grid .mark {
  position: relative;
  flex-direction: column;
  gap: 0.7rem;
  padding: 1rem;
  background: var(--surface);
  border: 0;
  border-radius: 18px;
  box-shadow: 0 0 0 1px var(--line);
  transition: background-color 0.6s, translate 0.15s, box-shadow 0.15s;
}

.marks.grid .mark:hover:not(:has(.mark-actions:hover, .mark-tags:hover)),
.marks.grid .mark:has(.mark-title:focus-visible) {
  translate: 0 -2px;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 60%, transparent), 0 16px 30px -18px rgb(var(--shadow) / 0.5);
}

.marks.grid .mark.flash {
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
}

.marks.grid .mark-icon {
  width: 3rem;
  height: 3rem;
  margin: 0;
  font-size: 1.3rem;
  border-radius: 14px;
}

.marks.grid .mark-body {
  width: 100%;
  flex: 1;
}

.marks.grid .mark-title {
  font-size: 1.02rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.marks.grid .mark-desc {
  -webkit-line-clamp: 3;
}

/* Pin, edit and delete sit in the card's top-right corner, beside the icon */
.marks.grid .mark-actions {
  position: absolute;
  top: 0.65rem;
  right: 0.55rem;
}

@media (prefers-reduced-motion: reduce) {
  .marks.grid .mark:hover { translate: none; }
}

/* Quiet until the row is hovered; a filled pin always shows at full strength */
.icon-btn:not(.on) {
  opacity: 0.55;
}

.mark:hover .icon-btn,
.mark:focus-within .icon-btn {
  opacity: 1;
}

@media (hover: none) {
  .icon-btn:not(.on) { opacity: 1; }
}

.icon-btn {
  width: 2.25rem;
  height: 2.25rem;
  display: grid;
  place-items: center;
  padding: 0;
  color: var(--ink-2);
  background: none;
  border: 0;
  border-radius: 9px;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s, scale 0.15s, opacity 0.15s;
}

.icon-btn:hover {
  color: var(--ink);
  background: var(--surface-2);
}

.icon-btn:active {
  scale: 0.96;
}

.icon-btn svg {
  width: 1.15rem;
  height: 1.15rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* Pinned: the ribbon fills in */
.icon-btn.on {
  color: var(--pin-color, var(--accent));
}

.icon-btn.on svg {
  fill: currentColor;
}

.icon-btn.danger:hover {
  color: var(--bad-ink);
}

.empty {
  margin-top: 1rem;
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
  color: var(--ink-2);
  border: 2px dashed var(--line);
  border-radius: 18px;
}

.empty p {
  margin: 0;
  text-wrap: pretty;
}

.empty h3 {
  font-size: 1.2rem;
  color: var(--ink);
}

/* ---------- Edit popup ---------- */
.edit {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.optional {
  font-weight: 400;
  color: var(--ink-3);
}

.suggest {
  margin-top: -0.4rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.pin-check {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-weight: 600;
  cursor: pointer;
}

.pin-check input {
  width: 1.1rem;
  height: 1.1rem;
  accent-color: var(--accent);
}

.edit-actions {
  display: flex;
  gap: 0.5rem;
}

@media (max-width: 760px) {
  .library {
    grid-template-columns: minmax(0, 1fr);
    gap: 1.25rem;
  }

  .side {
    position: static;
  }

  /* Tags become a scrolling row of pills */
  .tags {
    flex-direction: row;
    overflow-x: auto;
    gap: 0.35rem;
    padding-bottom: 0.25rem;
  }

  .tag-row {
    flex: none;
    gap: 0.4rem;
    background: var(--surface);
    box-shadow: 0 0 0 1px var(--line);
  }

  .side-tools {
    margin-top: 0.5rem;
    padding: 0;
    flex-direction: row;
    gap: 1rem;
    border: 0;
  }

  .search {
    width: auto;
    flex: 1;
  }

  .omnibox .btn {
    padding-inline: 1rem;
  }
}

/* Narrow phones: the buttons move under the text so titles get the full width */
@media (max-width: 520px) {
  .marks.list:not(.compact) .mark {
    flex-wrap: wrap;
    column-gap: 0.75rem;
    row-gap: 0.2rem;
  }

  .marks.list:not(.compact) .mark-body {
    flex-basis: calc(100% - 3.25rem);
  }

  .marks.list:not(.compact) .mark-actions {
    width: 100%;
    padding-left: 2.6rem;
  }

  /* Compact stays one line: the site name gives way to the title */
  .marks.compact .mark-body {
    flex: 1;
  }

  .marks.compact .mark-title {
    max-width: 100%;
  }

  .marks.compact .mark-meta {
    display: none;
  }

  /* Phones: two small cards across */
  .marks.grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .marks.grid .mark-actions {
    position: static;
    margin-top: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tile,
  .mark {
    transition: none;
  }
}
</style>
