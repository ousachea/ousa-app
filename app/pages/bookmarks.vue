<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { Bookmark, ImportedBookmark } from '~/utils/bookmarks'
import type { Folder } from '~/utils/folders'
import type { CsvColumn } from '~/utils/transfer'
import type { MenuEntry } from '~/composables/useContextMenu'

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
  if (f) {
    const before = folderStore.update(f.id, { ...data, ...(data.parentId !== f.parentId ? { order: childrenOf(folders.value, data.parentId).length } : {}) })
    toastSaved(before && (() => folderStore.replace(before)), `${data.name} saved`)
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
  flashId.value = id
  setTimeout(() => flashId.value === id && (flashId.value = undefined), 1600)
  nextTick(() => document.getElementById(`bm-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
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
const review = ref<{ url: string, title: string, description: string, icon: string, image: string, siteName: string, folders: string[], suggestion?: string, offline: boolean }>()
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
  const existing = force ? undefined : items.value.find(b => urlKey(b.url) === urlKey(url.href))
  if (existing) {
    duplicateOf.value = existing
    play('warning')
    return
  }
  duplicateOf.value = undefined

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
    note: '',
    tags: [],
    folders: r.folders,
    icon: r.icon,
    ...(r.image && !reviewImageBroken.value ? { image: r.image } : {}),
    pinned: false,
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

// ---------- Browse ----------
const query = ref('')
// The folder you were looking at, the sort and the view are remembered on this device (CHECKLIST.md #14)
const activeFolder = useRemembered<string>('bookmarks-folder-id', ALL_BOOKMARKS, v => typeof v === 'string')
// Opened from search on a folder (?folder=<id>): show just that folder
const route = useRoute()
// Also when already here (picking a folder in ⌘K while on Bookmarks)
const router = useRouter()
function followLink() {
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
const view = useRemembered<View>('bookmarks-view', 'list', v => VIEWS.includes(v as View), () => prefs.defaultView)
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
    return [b.title, b.url, b.note, b.description, ...pathsOf(b)].some(f => f.toLowerCase().includes(q))
  })
  if (sort.value === 'az') return list.sort((a, b) => a.title.localeCompare(b.title))
  if (sort.value === 'updated') return list.sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))
  // By folder path, then by name; bookmarks without one come last
  if (sort.value === 'folder') return list.sort((a, b) => (pathsOf(a)[0] ?? '￿').localeCompare(pathsOf(b)[0] ?? '￿') || a.title.localeCompare(b.title))
  if (sort.value === 'opened') return list.sort((a, b) => b.visits - a.visits || (b.lastOpened ?? '').localeCompare(a.lastOpened ?? ''))
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
})

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

// Bookmarks drag onto folders in the sidebar (desktop; phones use Move to folder…)
const finePointer = ref(false)
onMounted(() => (finePointer.value = matchMedia('(pointer: fine)').matches))
function onBookmarkDrag(e: DragEvent, b: Bookmark) {
  e.dataTransfer?.setData('application/x-bookmark', b.id)
  e.dataTransfer?.setData('text/uri-list', b.url)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copyMove'
}

// ---------- Right-click / long-press menu (CHECKLIST.md #26, #27) ----------
const menuFor = useRowMenu()
const bookmarkMenu = (b: Bookmark): MenuEntry[] => [
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
  { label: 'Copy link', icon: 'copy', run: () => copyLink(b) },
  { label: 'Refresh icon', icon: 'refresh', disabled: refreshing.value.has(b.id), run: () => refreshIcon(b) },
  { label: 'Duplicate', icon: 'duplicate', run: () => duplicate(b) },
  '-',
  { label: 'Delete', icon: 'delete', danger: true, run: () => del(b) }
]

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
</script>

<template>
  <ToolPage header="bar">
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

    <!-- The address bar: paste, press Enter, done -->
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
      >
      <button type="submit" class="btn" :disabled="saving">{{ saving ? 'Reading page…' : 'Save' }}</button>
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

    <!-- Review before saving (#43): what the page says about itself, editable, plus folders -->
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
          <div class="review-actions">
            <button type="submit" class="btn">Save bookmark</button>
            <button type="button" class="btn btn-quiet" @click="cancelReview">Cancel</button>
            <span class="review-hint"><kbd>Enter</kbd> to save</span>
          </div>
        </div>
      </form>
    </Transition>

    <ClientOnly>
      <!-- Pinned: the sites you open every day, as big tiles -->
      <section v-if="pinned.length" class="shelf drop-x" aria-label="Pinned. Drag to reorder, or Alt and the arrow keys.">
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
          <span class="ribbon" aria-hidden="true" />
          <span class="tile-icon">
            <img v-if="b.icon && !brokenIcons.has(b.icon)" :src="b.icon" alt="" referrerpolicy="no-referrer" @error="brokenIcons.add(b.icon)">
            <span v-else>{{ initial(b) }}</span>
          </span>
          <span class="tile-name">{{ b.title }}</span>
          <span class="tile-host">{{ hostOf(b.url) }}</span>
        </a>
      </section>

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
            @drop-bookmark="moveBookmark"
          />

          <div class="side-tools">
            <button type="button" class="link" @click="transferOpen = true">Import / Export</button>
            <NuxtLink to="/trash?app=/bookmarks" class="link">Recycle Bin</NuxtLink>
          </div>
        </aside>

        <section class="main" :aria-label="listTitle">
          <div v-sticky-bar class="toolbar">
            <h2 class="list-title">
              <FolderIcon v-if="activeFolderRecord" :icon="activeFolderRecord.icon" :color="activeFolderRecord.color" />
              {{ listTitle }}
            </h2>
            <label class="search">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
              <input ref="searchInput" v-model="query" type="search" placeholder="Search" aria-label="Search bookmarks" @keydown.enter.prevent="openFirst">
              <kbd v-if="!query" aria-hidden="true">/</kbd>
            </label>
            <AppSelect v-model="sort" class="sort" aria-label="Sort by" :options="SORTS" />
            <div class="views" role="radiogroup" aria-label="View">
              <button type="button" role="radio" class="view-btn" :aria-checked="view === 'list'" title="List" @click="setView('list')">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6.5h11M9 12h11M9 17.5h11" /><circle cx="4.75" cy="6.5" r="1.1" /><circle cx="4.75" cy="12" r="1.1" /><circle cx="4.75" cy="17.5" r="1.1" /></svg>
                <span class="sr-only">List</span>
              </button>
              <button type="button" role="radio" class="view-btn" :aria-checked="view === 'grid'" title="Grid" @click="setView('grid')">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></svg>
                <span class="sr-only">Grid</span>
              </button>
              <button type="button" role="radio" class="view-btn" :aria-checked="view === 'compact'" title="Compact" @click="setView('compact')">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M4 9.7h16M4 14.3h16M4 19h16" /></svg>
                <span class="sr-only">Compact</span>
              </button>
            </div>
          </div>

          <TransitionGroup v-if="shown.length" tag="ul" name="list" class="marks" :class="view === 'compact' ? ['list', 'compact'] : view">
            <li v-for="b in shown" :id="`bm-${b.id}`" :key="b.id" :data-item-id="b.id" class="mark" v-bind="menuFor(() => bookmarkMenu(b), b.title)" v-swipe-delete="() => del(b)" :class="{ flash: flashId === b.id }" :draggable="finePointer ? 'true' : undefined" @dragstart="onBookmarkDrag($event, b)">
              <span class="mark-icon" aria-hidden="true">
                <img v-if="b.icon && !brokenIcons.has(b.icon)" :src="b.icon" alt="" loading="lazy" referrerpolicy="no-referrer" @error="brokenIcons.add(b.icon)">
                <span v-else>{{ initial(b) }}</span>
              </span>
              <div class="mark-body">
                <a :href="b.url" target="_blank" rel="noopener" class="mark-title" @click="opened(b)">{{ b.title }}<svg class="ext" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M17 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4" /></svg><span class="sr-only"> (opens in a new tab)</span></a>
                <span class="mark-meta">
                  {{ hostOf(b.url) }} · added {{ ago(b.createdAt) }}<template v-if="b.visits"> · opened {{ b.visits }}×</template>
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
              <div class="mark-actions">
                <button type="button" class="icon-btn" :class="{ on: b.pinned }" :aria-pressed="b.pinned" :aria-label="b.pinned ? `Unpin ${b.title}` : `Pin ${b.title}`" :title="b.pinned ? 'Unpin' : 'Pin to the top'" @click="togglePin(b)">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h10a1 1 0 0 1 1 1v16l-6-4.2-6 4.2v-16a1 1 0 0 1 1-1z" /></svg>
                </button>
                <button type="button" class="icon-btn" :aria-label="`Edit ${b.title}`" title="Edit" @click="edit(b)">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg>
                </button>
                <ConfirmDelete :name="b.title" @confirm="del(b)" />
              </div>
            </li>
          </TransitionGroup>

          <div v-else-if="ready && items.length" class="empty">
            <p>Nothing matches{{ query ? ` “${query}”` : '' }}.</p>
            <button type="button" class="btn btn-quiet btn-sm" @click="query = ''; activeFolder = ALL_BOOKMARKS">Show everything</button>
          </div>

          <div v-else-if="ready" class="empty-panel">
            <EmptyState title="No bookmarks yet" icon="bookmarks" action="Save your first link" @action="focusField(linkField)">
              Paste a link and its title and icon are filled in for you. Pin the ones you open every day.
              <template #extra>
                <p class="import-hint">Already have bookmarks in your browser? <button type="button" class="link" @click="transferOpen = true">Import them</button>.</p>
              </template>
            </EmptyState>
          </div>
          <SkeletonList v-else label="Loading your bookmarks" />
        </section>
      </div>
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

    <FolderEditor :open="folderEditor.open" :folders="folders" :folder="folderEditor.folder" :parent-id="folderEditor.parentId" @close="folderEditor.open = false" @save="saveFolder" />

    <!-- Move to folder… (the menu way to do what dragging does) -->
    <Modal :open="!!moving" :title="moving ? `Move ${moving.title}` : 'Move'" @close="moving = undefined">
      <div class="move-list" role="listbox" aria-label="Folders">
        <button type="button" class="move-opt" @click="moveBookmark(moving!.id, UNFILED); moving = undefined">
          <ToolIcon name="bookmarks" /> Not in a folder
        </button>
        <button
          v-for="o in flatTree(folders)"
          :key="o.folder.id"
          type="button"
          class="move-opt"
          :class="{ current: moving && foldersOf(moving).includes(o.folder.id) }"
          :style="{ paddingLeft: `${0.8 + o.depth * 1}rem` }"
          @click="moveBookmark(moving!.id, o.folder.id); moving = undefined"
        >
          <FolderIcon :icon="o.folder.icon" :color="o.folder.color" /> {{ o.folder.name }}
        </button>
        <button type="button" class="move-opt new" @click="moving = undefined; openNewFolder()">+ New folder…</button>
      </div>
    </Modal>
  </ToolPage>
</template>

<style scoped>
/* ---------- Address bar ---------- */
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
  margin: 0 auto;
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
}

/* ---------- Pinned tiles ---------- */
.shelf {
  width: 100%;
  margin-top: 2rem;
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
  background: var(--accent);
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
  margin-top: 2.25rem;
  display: grid;
  grid-template-columns: 13rem minmax(0, 1fr);
  gap: 2rem;
  align-items: start;
}

.side {
  min-width: 0;
  position: sticky;
  top: 5rem;
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

.link {
  padding: 0;
  font: inherit;
  font-size: 0.875rem;
  color: var(--ink-2);
  background: none;
  border: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
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

.view-btn[aria-checked='true'] {
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
  color: var(--accent);
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
