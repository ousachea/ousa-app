<script setup lang="ts">
import { toast } from 'vue-sonner'
import { generateHTML, generateJSON } from '@tiptap/core'
import NoteEditor from '~/components/notes/NoteEditor.vue'
import QuickNote from '~/components/notes/QuickNote.vue'
import NoteHistory from '~/components/notes/NoteHistory.vue'
import NoteTransfer from '~/components/notes/NoteTransfer.vue'
import NoteSettings from '~/components/notes/NoteSettings.vue'
import type { Folder } from '~/utils/folders'
import type { MenuEntry } from '~/composables/useContextMenu'
import type { BulkAction } from '~/composables/useBulkSelect'
import type { ImportedNote, Note, NoteSort, NoteTemplate, NoteVersion, NoteView } from '~/utils/notes'

// Notes: fast enough for a thought, enough for a project. Three panels on a computer (folders and
// views, the list, the editor); list → editor on a phone. Notes save by themselves while you type,
// sync like every other app (useCollection), and deleted ones go to the Recycle Bin.
const { play } = useSound()
const route = useRoute()
const router = useRouter()
const { prefs: notePrefs, editorStyle } = useNotePrefs()
const { prefs } = usePrefs()
const { openMenu } = useContextMenu()
const menuFor = useRowMenu()

// ---------- Example data ----------
const DEMO_FOLDERS = () => [
  { id: 'nf-work', name: 'Work', parentId: '', icon: 'work', color: '', order: 0 },
  { id: 'nf-meetings', name: 'Meetings', parentId: 'nf-work', icon: 'chat', color: 'blue', order: 0 },
  { id: 'nf-projects', name: 'Projects', parentId: 'nf-work', icon: 'list', color: 'teal', order: 1 },
  { id: 'nf-personal', name: 'Personal', parentId: '', icon: 'home', color: 'green', order: 1 },
  { id: 'nf-ideas', name: 'Ideas', parentId: '', icon: 'ai', color: 'purple', order: 2 }
]
const demoNote = (id: string, title: string, html: string, folderId: string, hoursAgo: number, extra: Partial<Note> = {}): Omit<Note, 'id'> & { id: string } => {
  const at = new Date(Date.now() - hoursAgo * 3_600_000).toISOString()
  const d = import.meta.client ? derive(html) : { text: '', tags: [], links: [] }
  return { id, title, html, ...d, folderId, favorite: false, archived: false, createdAt: at, updatedAt: at, ...extra }
}
const DEMO = () => [
  demoNote('n-launch', 'Project launch', '<p>Launch checklist for the new app. See <span data-note-link data-id="n-uat" data-title="UAT checklist">UAT checklist</span>.</p><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Complete UI</p></li><li data-type="taskItem" data-checked="true"><p>Finish UAT</p></li><li data-type="taskItem" data-checked="false"><p>Send deployment request</p></li><li data-type="taskItem" data-checked="false"><p>Prepare production checklist</p></li></ul><p>#project</p>', 'nf-projects', 2, { favorite: true }),
  demoNote('n-uat', 'UAT checklist', '<h3>Before sign-off</h3><ul><li><p>Every form checked on a phone</p></li><li><p>Offline: add, edit and delete, then reconnect</p></li><li><p>Export and import a backup</p></li></ul><p>#project #todo</p>', 'nf-projects', 20),
  demoNote('n-meeting', 'Meeting with IT team', '<p><strong>Date:</strong> Thursday</p><p><strong>Participants:</strong> Dara, Sophea, me</p><h3>Decisions</h3><ul><li><p>Deploy on Monday morning</p></li><li><p>Freeze changes from Friday</p></li></ul><h3>Action items</h3><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Confirm the UAT date</p></li></ul><p>#meeting</p>', 'nf-meetings', 26),
  demoNote('n-shopping', '', '<p>Shopping list</p><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Rice</p></li><li data-type="taskItem" data-checked="true"><p>Coffee beans</p></li><li data-type="taskItem" data-checked="false"><p>Lime and chilli</p></li></ul>', 'nf-personal', 5),
  demoNote('n-ideas', 'App ideas', '<ul><li><p>Weekly review that pulls renewals and countdowns together</p></li><li><p>Share a bookmark folder as a page</p></li></ul><blockquote><p>Fast enough for a thought.</p></blockquote><p>#idea</p>', 'nf-ideas', 50, { favorite: true }),
  demoNote('n-travel', 'Siem Reap trip', '<p>Three days in December. Temples at sunrise, Pub Street once.</p>', 'nf-personal', 400, { archived: true })
]

// ---------- Data ----------
const { items: notes, ready, sync, add, addMany, update, replace, remove, restore } = useCollection<Note>('notes', undefined, { demo: DEMO, label: displayTitle })
const folderStore = useCollection<Folder>('note-folders', undefined, { demo: DEMO_FOLDERS, app: '/notes', trash: false, label: f => f.name })
const folders = folderStore.items
const versionStore = useCollection<NoteVersion>('note-versions', undefined, { app: '/notes', trash: false, activity: false })
const templateStore = useCollection<NoteTemplate>('note-templates', undefined, { app: '/notes', trash: false, label: t => t.name })

const byId = (id: string) => notes.value.find(n => n.id === id)
const folderIds = computed(() => new Set(folders.value.map(f => f.id)))
const folderById = (id: string) => folders.value.find(f => f.id === id)
const hasFolder = (n: Pick<Note, 'folderId'>) => !!n.folderId && folderIds.value.has(n.folderId)
const folderPath = (n: Pick<Note, 'folderId'>) => (hasFolder(n) ? pathText(folders.value, n.folderId) : '')

// ---------- Folders (the same folder system as Bookmarks) ----------
function ensureFolder(name: string, parentId = ''): string {
  const n = folderName(name)
  const found = folders.value.find(f => f.parentId === parentId && f.name.toLowerCase() === n.toLowerCase())
  if (found) return found.id
  return folderStore.add({ name: n, parentId, icon: guessIcon(n), color: '', order: childrenOf(folders.value, parentId).length }).id
}
const ensurePath = (path: string[]) => path.map(p => p.trim()).filter(Boolean).reduce((parent, part) => ensureFolder(part, parent), '')

const collapsed = useRemembered<string[]>('notes-collapsed', [], Array.isArray)
function toggleFolder(id: string) {
  collapsed.value = collapsed.value.includes(id) ? collapsed.value.filter(x => x !== id) : [...collapsed.value, id]
}

const folderEditor = reactive({ open: false, folder: undefined as Folder | undefined, parentId: '' })
function openNewFolder(parentId = '') {
  Object.assign(folderEditor, { open: true, folder: undefined, parentId })
  if (parentId && collapsed.value.includes(parentId)) toggleFolder(parentId)
}
function saveFolder(data: Pick<Folder, 'name' | 'parentId' | 'icon' | 'color'>) {
  const f = folderEditor.folder
  folderEditor.open = false
  if (f) {
    const before = folderStore.update(f.id, { ...data, ...(data.parentId !== f.parentId ? { order: childrenOf(folders.value, data.parentId).length } : {}) })
    toastSaved(before && (() => folderStore.replace(before)), `${data.name} saved`)
  } else {
    const created = folderStore.add({ ...data, order: childrenOf(folders.value, data.parentId).length })
    active.value = created.id
    toast.success(`${created.name} created`, { action: { label: 'Undo', onClick: () => folderStore.remove(created.id, { undoAdd: true }) } })
  }
  play('success')
}
// Its notes stay (they leave the folder) and its sub-folders move up a level; Undo puts it all back
function deleteFolder(f: Folder) {
  const members = notes.value.filter(n => n.folderId === f.id)
  const children = folders.value.filter(c => c.parentId === f.id)
  for (const n of members) update(n.id, { folderId: f.parentId }, { quiet: true })
  for (const c of children) folderStore.update(c.id, { parentId: f.parentId }, { quiet: true })
  folderStore.remove(f.id)
  if (active.value === f.id) active.value = NOTES_ALL
  play('delete')
  toast(`${f.name} deleted`, {
    description: members.length ? `Its ${members.length} ${members.length === 1 ? 'note is' : 'notes are'} still in All notes.` : undefined,
    duration: 7000,
    action: { label: 'Undo', onClick: () => {
      folderStore.restore(f)
      for (const c of children) folderStore.update(c.id, { parentId: f.id }, { quiet: true })
      for (const n of members) update(n.id, { folderId: f.id }, { quiet: true })
    } }
  })
}
function moveFolder(id: string, parentId: string, beforeId: string | null) {
  const f = folderById(id)
  if (!f || id === parentId || descendantsOf(folders.value, id).includes(parentId)) return
  const siblings = childrenOf(folders.value, parentId).filter(s => s.id !== id)
  const at = beforeId ? siblings.findIndex(s => s.id === beforeId) : siblings.length
  siblings.splice(at < 0 ? siblings.length : at, 0, f)
  siblings.forEach((s, i) => {
    if (s.order !== i || s.parentId !== parentId) folderStore.update(s.id, { order: i, parentId }, { quiet: true })
  })
}

// ---------- What's listed ----------
const active = useRemembered<string>('notes-choice', NOTES_ALL, v => typeof v === 'string')
const isFolderChoice = (a: string) => !!a && !a.startsWith(':')
// A folder deleted on another device: back to All
watch([folderStore.ready, folderIds], ([ok]) => {
  if (ok && isFolderChoice(active.value) && !folderIds.value.has(active.value)) active.value = NOTES_ALL
})
const SORTS: { value: NoteSort, label: string }[] = [
  { value: 'modified', label: 'Recently edited' },
  { value: 'created', label: 'Recently created' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'az', label: 'A–Z' },
  { value: 'za', label: 'Z–A' }
]
const sort = useRemembered<NoteSort>('notes-sort', 'modified', v => SORTS.some(s => s.value === v))
const VIEWS: NoteView[] = ['list', 'grid', 'compact']
const view = useRemembered<NoteView>('notes-layout', 'list', v => VIEWS.includes(v as NoteView), () => prefs.defaultView)

const query = ref('')
const searchText = ref('')
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(query, (q) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => (searchText.value = q), 120)
})
const parsed = computed(() => parseNoteQuery(searchText.value))
const searching = computed(() => !!searchText.value.trim())

const VIEW_LABEL: Record<string, string> = { [NOTES_ALL]: 'All notes', [NOTES_FAVORITES]: 'Favourites', [NOTES_RECENT]: 'Recent', [NOTES_ARCHIVED]: 'Archived', [NOTES_UNFILED]: 'Not in a folder' }
const listTitle = computed(() => VIEW_LABEL[active.value] ?? folderById(active.value)?.name ?? 'All notes')

const scoped = computed(() => {
  const a = active.value
  const inFolder = isFolderChoice(a) ? new Set([a, ...descendantsOf(folders.value, a)]) : undefined
  // Archived notes leave the usual lists, but a search still finds them
  const withArchived = a === NOTES_ARCHIVED || searching.value
  return notes.value.filter((n) => {
    if (a === NOTES_ARCHIVED && !n.archived) return false
    if (n.archived && !withArchived) return false
    if (a === NOTES_FAVORITES) return !!n.favorite
    if (a === NOTES_UNFILED) return !hasFolder(n)
    if (inFolder) return inFolder.has(n.folderId)
    return true
  })
})

const shown = computed(() => {
  const a = active.value
  if (searching.value) {
    const q = parsed.value
    const scored = scoped.value.map(n => [n, scoreNote(n, q, folderPath(n))] as const).filter(([, s]) => s > 0)
    if (q.words.length) return scored.sort((x, y) => y[1] - x[1] || y[0].updatedAt.localeCompare(x[0].updatedAt)).map(([n]) => n)
    return sortNotes(scored.map(([n]) => n), sort.value)
  }
  if (a === NOTES_RECENT) return sortNotes(scoped.value, 'modified').slice(0, 60)
  const list = sortNotes(scoped.value, sort.value)
  // Favourites sit at the top of every list (except Favourites itself, where they all are)
  return a === NOTES_FAVORITES ? list : [...list.filter(n => n.favorite), ...list.filter(n => !n.favorite)]
})

// Long lists draw 200 at a time; more appear as you scroll (#51)
const PAGE = 200
const limit = ref(PAGE)
watch([active, searchText, sort], () => (limit.value = PAGE))
const visible = computed(() => shown.value.slice(0, limit.value))
const moreSentinel = ref<HTMLElement>()
let moreObserver: IntersectionObserver | undefined
watch(moreSentinel, (el) => {
  moreObserver?.disconnect()
  if (!el) return
  moreObserver = new IntersectionObserver(entries => entries.some(e => e.isIntersecting) && (limit.value += PAGE), { rootMargin: '600px' })
  moreObserver.observe(el)
})
onBeforeUnmount(() => moreObserver?.disconnect())

// Recent is grouped by day: Today, Yesterday…
const groupOf = (n: Note) => (active.value === NOTES_RECENT && !searching.value ? dayGroup(n.updatedAt) : '')

const counts = computed(() => {
  const live = notes.value.filter(n => !n.archived)
  const perFolder: Record<string, number> = {}
  for (const n of live) if (hasFolder(n)) perFolder[n.folderId] = (perFolder[n.folderId] ?? 0) + 1
  return {
    all: live.length,
    favorites: live.filter(n => n.favorite).length,
    archived: notes.value.length - live.length,
    unfiled: live.filter(n => !hasFolder(n)).length,
    perFolder
  }
})
const allTags = computed(() => {
  const c = new Map<string, number>()
  for (const n of notes.value) if (!n.archived) for (const t of n.tags) c.set(t, (c.get(t) ?? 0) + 1)
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
})
function filterTag(t: string) {
  query.value = `tag:${t}`
  searchText.value = query.value
}

function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`
  const days = Math.round(s / 86_400)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: new Date(iso).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })
}

// Search results show where the words are, highlighted
function previewParts(n: Note): { t: string, hit: boolean }[] {
  const words = parsed.value.words
  const text = searching.value && words.length ? snippetAround(n.text, words, notePrefs.previewLength || 120) || previewOf(n, notePrefs.previewLength) : previewOf(n, notePrefs.previewLength)
  if (!text) return []
  if (!searching.value || !words.length) return [{ t: text, hit: false }]
  const re = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return text.split(re).filter(Boolean).map(t => ({ t, hit: words.includes(t.toLowerCase()) }))
}
function titleParts(n: Note) {
  const title = displayTitle(n)
  const words = parsed.value.words
  if (!searching.value || !words.length) return [{ t: title, hit: false }]
  const re = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return title.split(re).filter(Boolean).map(t => ({ t, hit: words.includes(t.toLowerCase()) }))
}

// ---------- The open note ----------
const openId = ref('')
const openNote = computed(() => (openId.value ? byId(openId.value) : undefined))
// What's in the editor; saved to the list shortly after you stop typing (and when you leave)
const draft = reactive({ id: '', title: '', html: '' })
const pendingSave = ref(false)
let saveTimer: ReturnType<typeof setTimeout> | undefined
const editor = ref<InstanceType<typeof NoteEditor>>()
const titleInput = ref<HTMLTextAreaElement>()
// Phones show one panel at a time
const pane = ref<'list' | 'editor'>('list')

function loadDraft(n?: Note) {
  draft.id = n?.id ?? ''
  draft.title = n?.title ?? ''
  draft.html = n?.html ?? ''
}

function openNoteById(id: string, focus: 'title' | 'body' | false = false) {
  if (id === openId.value) {
    pane.value = 'editor'
    return
  }
  leaveNote()
  const n = byId(id)
  if (!n) return
  openId.value = id
  loadDraft(n)
  pane.value = 'editor'
  router.replace({ query: { ...route.query, note: id, focus: undefined } })
  nextTick(() => {
    sizeTitle()
    // Phones: the note replaces the list, so start at its top
    if (matchMedia('(max-width: 760px)').matches) document.querySelector('.editor-step')?.scrollIntoView({ block: 'start' })
    // The title catches any keys typed while the editor is still getting ready, so none of them
    // run a shortcut instead (A would start another note)
    if (focus) titleInput.value?.focus()
    if (focus === 'body') editor.value?.focus('end')
  })
}

// Leaving a note: save it, and drop it if it was made and never written in
function leaveNote() {
  flushSave()
  const n = openId.value ? byId(openId.value) : undefined
  if (n && !n.title.trim() && !n.text.trim() && !n.html.includes('<img') && n.createdAt === n.updatedAt) remove(n.id, { undoAdd: true })
}

function closeNote() {
  leaveNote()
  openId.value = ''
  loadDraft()
  pane.value = 'list'
  router.replace({ query: { ...route.query, note: undefined } })
}

function onEdit() {
  pendingSave.value = true
  clearTimeout(saveTimer)
  saveTimer = setTimeout(flushSave, 800)
}

function flushSave() {
  clearTimeout(saveTimer)
  const n = draft.id ? byId(draft.id) : undefined
  if (!n || (n.title === draft.title && n.html === draft.html)) {
    pendingSave.value = false
    return
  }
  keepVersion(n)
  update(n.id, { title: draft.title, html: draft.html, ...derive(draft.html), updatedAt: new Date().toISOString() }, { quiet: true })
  pendingSave.value = false
}

// Never lose what's typed: save on the way out of the page or the app
const onHide = () => {
  if (document.visibilityState === 'hidden') flushSave()
}
onMounted(() => {
  window.addEventListener('pagehide', flushSave)
  document.addEventListener('visibilitychange', onHide)
})
onBeforeUnmount(() => {
  leaveNote()
  window.removeEventListener('pagehide', flushSave)
  document.removeEventListener('visibilitychange', onHide)
})

// Changed on another device (or by Undo) while open, with nothing unsaved here: show the new version
watch(() => [openNote.value?.title, openNote.value?.html], () => {
  const n = openNote.value
  if (!n || pendingSave.value || n.id !== draft.id) return
  if (n.html !== draft.html || n.title !== draft.title) loadDraft(n)
})
// Deleted elsewhere (or moved to the bin from the list) while open
watch(openNote, (n) => {
  if (openId.value && !n && ready.value) {
    openId.value = ''
    loadDraft()
    pane.value = 'list'
  }
})

// The title grows with what's typed
function sizeTitle() {
  const el = titleInput.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}
function onTitleKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.isComposing) {
    e.preventDefault()
    editor.value?.focus('start')
  }
}

const status = computed(() => {
  const s = sync.state.value
  if (pendingSave.value || s === 'saving' || s === 'loading') return { text: 'Saving…', kind: 'saving' }
  if (s === 'demo') return { text: 'Example — changes aren’t kept', kind: 'demo' }
  if (s === 'offline') return { text: 'Offline — saved on this device', kind: 'offline' }
  if (s === 'error') return { text: 'Couldn’t sync — saved on this device', kind: 'error' }
  if (s === 'device' || s === 'needs-setup') return { text: 'Saved on this device', kind: 'ok' }
  return { text: 'Saved', kind: 'ok' }
})

const details = computed(() => {
  const n = openNote.value
  if (!n) return undefined
  const words = wordCount(n.text)
  const date = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  return { created: date(n.createdAt), modified: date(n.updatedAt), words, folder: folderPath(n) }
})

// ---------- Links between notes ----------
const linkTargets = computed(() => notes.value.filter(n => n.id !== openId.value).map(n => ({ id: n.id, title: displayTitle(n) })))
const linksTo = computed(() => (openNote.value?.links ?? []).map(byId).filter((n): n is Note => !!n))
const linkedFrom = computed(() => (openId.value ? notes.value.filter(n => n.id !== openId.value && n.links.includes(openId.value)) : []))

function followLink(id: string, title: string) {
  const target = (id && byId(id)) || notes.value.find(n => displayTitle(n).toLowerCase() === title.toLowerCase())
  if (target) openNoteById(target.id)
  else {
    toast(`No note called “${title}”`, { action: { label: 'Create it', onClick: () => newNote({ title, focus: 'body' }) } })
  }
}
function createLinked(title: string, done: (id: string) => void) {
  const created = newNote({ title, open: false })
  done(created.id)
  toast.success(`“${title}” created`, { action: { label: 'Open', onClick: () => openNoteById(created.id) } })
}

// ---------- Suggestions for a new note (#34) ----------
const dismissed = ref(new Set<string>())
const STOP = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'from', 'have', 'need', 'about', 'into', 'your', 'today', 'note', 'notes'])
const wordsOf = (s: string) => new Set(s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 3 && !STOP.has(w)))
const suggestion = computed(() => {
  const n = openNote.value
  if (!n || dismissed.value.has(n.id) || n.text.length < 15 || n.archived) return undefined
  const words = wordsOf(`${displayTitle(n)} ${n.text.slice(0, 600)}`)
  let folder: Folder | undefined
  if (!hasFolder(n)) {
    let best = 0
    for (const f of folders.value) {
      const name = f.name.toLowerCase()
      const score = (n.tags.includes(name) ? 3 : 0) + (words.has(name) ? 2 : 0) + [...wordsOf(name)].filter(w => words.has(w)).length
      if (score > best) {
        best = score
        folder = f
      }
    }
  }
  const tags = allTags.value.map(([t]) => t).filter(t => !n.tags.includes(t) && words.has(t)).slice(0, 3)
  const related = notes.value
    .filter(o => o.id !== n.id && !o.archived && !n.links.includes(o.id))
    .map(o => ({ o, score: o.tags.filter(t => n.tags.includes(t)).length * 2 + [...wordsOf(displayTitle(o))].filter(w => words.has(w)).length }))
    .filter(x => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(x => x.o)
  return folder || tags.length || related.length ? { folder, tags, related } : undefined
})
function acceptFolder(f: Folder) {
  const n = openNote.value
  if (!n) return
  moveNotes([n.id], f.id)
}
function acceptTags(tags: string[]) {
  draft.html += `<p>${tags.map(t => `#${t}`).join(' ')}</p>`
  onEdit()
}
function acceptRelated(list: Note[]) {
  draft.html += `<p>Related: ${list.map(o => `<span data-note-link data-id="${o.id}" data-title="${displayTitle(o).replace(/"/g, '&quot;')}">${displayTitle(o).replace(/</g, '&lt;')}</span>`).join(' ')}</p>`
  onEdit()
}

// ---------- Versions (#31) ----------
// Before a save, keep the note as it was when you come back to it after 10+ minutes away, and every
// 30 minutes during one long session. Empty states aren't worth keeping.
const COME_BACK = 10 * 60_000
const CHECKPOINT = 30 * 60_000
const KEEP_VERSIONS = 20
const versionsOf = (id: string) => versionStore.items.value.filter(v => v.noteId === id).sort((a, b) => b.at.localeCompare(a.at))
const ms = (iso: string) => new Date(iso).getTime()
function keepVersion(n: Note, force = false) {
  if (!n.text.trim() && !n.html.includes('<img')) return
  const last = versionsOf(n.id)[0]
  if (last && last.html === n.html && last.title === n.title) return
  const away = Date.now() - ms(n.updatedAt) >= COME_BACK
  const longSession = ms(n.updatedAt) - (last ? ms(last.at) : ms(n.createdAt)) >= CHECKPOINT
  if (!force && !away && !longSession) return
  versionStore.add({ noteId: n.id, title: n.title, html: n.html, at: n.updatedAt })
  // Keep the newest 20; past 60 days only the newest 5
  const cutoff = Date.now() - 60 * 86_400_000
  versionsOf(n.id).forEach((v, i) => {
    if (i >= KEEP_VERSIONS || (i >= 5 && ms(v.at) < cutoff)) versionStore.remove(v.id)
  })
}
const historyOpen = ref(false)
function restoreVersion(v: NoteVersion) {
  const n = openNote.value
  if (!n) return
  flushSave()
  keepVersion(n, true)
  const before = { ...n }
  update(n.id, { title: v.title, html: v.html, ...derive(v.html), updatedAt: new Date().toISOString() })
  loadDraft(byId(n.id))
  historyOpen.value = false
  toast.success('Version restored', { description: 'What was there before is kept in the history too.', action: { label: 'Undo', onClick: () => replace(before) } })
}

// ---------- Making notes ----------
function newNote(o: { title?: string, html?: string, folderId?: string, focus?: 'title' | 'body', open?: boolean } = {}) {
  const a = active.value
  const fallback = notePrefs.defaultFolder && folderIds.value.has(notePrefs.defaultFolder) ? notePrefs.defaultFolder : ''
  const folderId = o.folderId ?? (isFolderChoice(a) ? a : fallback)
  const html = o.html ?? ''
  const now = new Date().toISOString()
  const created = add({ title: o.title ?? '', html, ...derive(html), folderId, favorite: a === NOTES_FAVORITES, archived: false, createdAt: now, updatedAt: now })
  if (a === NOTES_ARCHIVED) active.value = NOTES_ALL
  if (o.open !== false) {
    query.value = ''
    searchText.value = ''
    openNoteById(created.id, o.focus ?? (html ? 'body' : 'title'))
    play('open')
  }
  return created
}
useAddAction(() => newNote())

function fromTemplate(t: NoteTemplate) {
  newNote({ html: fillTemplate(t.html), focus: 'body' })
}

// The New note button's menu: blank, quick, templates (built in and your own)
function newMenu(e: MouseEvent) {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const own = templateStore.items.value
  const items: MenuEntry[] = [
    { label: 'Blank note', icon: 'edit', run: () => newNote() },
    { label: 'Quick note…', icon: 'plus', run: () => (quickOpen.value = true) },
    '-',
    ...BUILT_IN_TEMPLATES.map(t => ({ label: t.name, icon: 'list', run: () => fromTemplate(t) }) as MenuEntry),
    ...(own.length ? ['-' as const, ...own.map(t => ({ label: t.name, icon: 'star', run: () => fromTemplate(t) }) as MenuEntry)] : []),
    ...(own.length ? ['-' as const, { label: 'Remove a template…', icon: 'delete', run: () => removeTemplateMenu(e) } as MenuEntry] : [])
  ]
  openMenu(matchMedia('(pointer: coarse)').matches ? null : { clientX: r.left, clientY: r.bottom + 4 }, items, 'New note')
}
function removeTemplateMenu(e: MouseEvent) {
  openMenu(matchMedia('(pointer: coarse)').matches ? null : { clientX: e.clientX, clientY: e.clientY }, templateStore.items.value.map(t => ({
    label: t.name,
    icon: 'delete',
    danger: true,
    run: () => {
      const removed = templateStore.remove(t.id)
      toast(`Template “${t.name}” removed`, { action: removed ? { label: 'Undo', onClick: () => templateStore.restore(removed) } : undefined })
    }
  })), 'Remove a template')
}
function saveAsTemplate(n: Note) {
  flushSave()
  const t = templateStore.add({ name: displayTitle(n), html: byId(n.id)?.html ?? n.html })
  toast.success(`“${t.name}” saved as a template`, { description: 'It’s in the New note menu.' })
}

// Quick capture (#33)
const quickOpen = ref(false)
function saveQuick(text: string) {
  quickOpen.value = false
  const created = newNote({ html: importText(text).html, open: false })
  play('success')
  toast.success('Note saved', { description: displayTitle(created), action: { label: 'Open', onClick: () => openNoteById(created.id, 'body') } })
}

// ---------- Actions on a note ----------
function toggleFavorite(n: Note) {
  const before = update(n.id, { favorite: !n.favorite }, { quiet: true })
  play(n.favorite ? 'toggle-off' : 'toggle-on')
  toast(n.favorite ? 'Removed from favourites' : 'Added to favourites', { description: displayTitle(n), action: before && { label: 'Undo', onClick: () => replace(before) } })
}
function setArchived(n: Note, archived: boolean) {
  flushSave()
  const before = update(n.id, { archived }, { quiet: true })
  if (archived && openId.value === n.id && active.value !== NOTES_ARCHIVED) closeNote()
  toast(archived ? 'Note archived' : 'Note back in your notes', { description: displayTitle(n), action: before && { label: 'Undo', onClick: () => replace(before) } })
}
function duplicate(n: Note) {
  flushSave()
  const src = byId(n.id) ?? n
  const now = new Date().toISOString()
  const copy = add({ title: `${displayTitle(src)} (Copy)`, html: src.html, text: src.text, tags: src.tags, links: src.links, folderId: src.folderId, favorite: false, archived: false, createdAt: now, updatedAt: now })
  openNoteById(copy.id)
  toast.success('Note duplicated', { action: { label: 'Undo', onClick: () => remove(copy.id, { undoAdd: true }) } })
}
function del(n: Note) {
  if (openId.value === n.id) {
    flushSave()
    openId.value = ''
    loadDraft()
    pane.value = 'list'
  }
  const removed = remove(n.id)
  play('delete')
  toastDeleted(displayTitle(n), () => removed && restore(removed))
}
async function copyLink(n: Note) {
  try {
    await navigator.clipboard.writeText(`${location.origin}/notes?note=${encodeURIComponent(n.id)}`)
    play('copy')
    toast.success('Link copied', { description: 'Opens this note in Notes on any of your devices.' })
  } catch {
    toast.error('Could not copy')
  }
}
function rename(n: Note) {
  openNoteById(n.id)
  nextTick(() => {
    titleInput.value?.focus()
    titleInput.value?.select()
  })
}

// Move to folder (dialog, drag onto a folder, or the selection)
const moving = ref<string[]>([])
function moveNotes(ids: string[], folderId: string) {
  moving.value = []
  const target = folderId === NOTES_UNFILED || folderId === NOTES_ALL ? '' : folderId
  const targets = ids.map(byId).filter((n): n is Note => !!n && n.folderId !== target)
  if (!targets.length) return
  const before = targets.map(n => update(n.id, { folderId: target }, { quiet: true })).filter((n): n is Note => !!n)
  play('success')
  const what = targets.length === 1 ? displayTitle(targets[0]!) : `${targets.length} notes`
  toast(target ? `${what} moved to ${pathText(folders.value, target)}` : `${what} taken out of ${targets.length === 1 ? 'its folder' : 'their folders'}`, {
    action: { label: 'Undo', onClick: () => before.forEach(b => replace(b)) }
  })
}
function onNoteDrag(e: DragEvent, n: Note) {
  e.dataTransfer?.setData('application/x-note', n.id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

const noteMenu = (n: Note): MenuEntry[] => sel.has(n.id) && sel.selected.size > 1
  ? selectionMenu()
  : [
      { label: 'Open', icon: 'open', run: () => openNoteById(n.id, 'body') },
      { label: 'Open in new tab', icon: 'new-tab', run: () => window.open(`/notes?note=${encodeURIComponent(n.id)}`, '_blank', 'noopener') },
      { label: 'Rename', icon: 'edit', run: () => rename(n) },
      { label: 'Move to folder…', icon: 'folder', run: () => (moving.value = [n.id]) },
      { label: n.favorite ? 'Remove from favourites' : 'Add to favourites', icon: 'star', run: () => toggleFavorite(n) },
      { label: 'Select', icon: 'select', run: () => (sel.selecting ? sel.toggle(n.id) : sel.start(n.id)) },
      '-',
      { label: 'Duplicate', icon: 'duplicate', run: () => duplicate(n) },
      { label: n.archived ? 'Unarchive' : 'Archive', icon: 'folder', run: () => setArchived(n, !n.archived) },
      { label: 'Copy link', icon: 'copy', run: () => copyLink(n) },
      { label: 'Export as Markdown', icon: 'open', run: () => exportNotes('one', 'md', n) },
      { label: 'Save as template', icon: 'list', run: () => saveAsTemplate(n) },
      '-',
      { label: 'Delete', icon: 'delete', danger: true, run: () => del(n) }
    ]

function moreMenu(e: MouseEvent) {
  const n = openNote.value
  if (!n) return
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  openMenu(matchMedia('(pointer: coarse)').matches ? null : { clientX: r.right - 220, clientY: r.bottom + 4 }, [
    { label: 'Move to folder…', icon: 'folder', run: () => (moving.value = [n.id]) },
    { label: 'Version history', icon: 'refresh', run: () => (historyOpen.value = true) },
    { label: 'Duplicate', icon: 'duplicate', run: () => duplicate(n) },
    { label: 'Save as template', icon: 'list', run: () => saveAsTemplate(n) },
    { label: 'Copy link', icon: 'copy', run: () => copyLink(n) },
    { label: 'Export…', icon: 'open', run: () => (transferOpen.value = true) },
    '-',
    { label: n.archived ? 'Unarchive' : 'Archive', icon: 'folder', run: () => setArchived(n, !n.archived) },
    { label: 'Delete', icon: 'delete', danger: true, run: () => del(n) }
  ], displayTitle(n))
}

// ---------- Select several (useBulkSelect) ----------
const notesText = (n: number) => `${n} ${n === 1 ? 'note' : 'notes'}`
const sel = useBulkSelect({ items: notes, shown, onDelete: () => deleteSelected() })
const picked = computed(() => sel.selectedItems as Note[])
function deleteSelected() {
  sel.guard(`Delete ${notesText(sel.selected.size)}?`, () => {
    if (picked.value.some(n => n.id === openId.value)) closeNote()
    bulkRemove(picked.value, remove, restore, notesText)
  })
}
function archiveSelected() {
  const archived = !picked.value.every(n => n.archived)
  const before = picked.value.filter(n => !!n.archived !== archived).map(n => update(n.id, { archived }, { quiet: true })).filter((n): n is Note => !!n)
  if (!before.length) return
  if (archived && picked.value.some(n => n.id === openId.value)) closeNote()
  toast(`${notesText(before.length)} ${archived ? 'archived' : 'back in your notes'}`, { action: { label: 'Undo', onClick: () => before.forEach(b => replace(b)) } })
}
const bulkActions = computed<BulkAction[]>(() => [
  { label: allFavourite(picked.value) ? 'Unfavourite' : 'Favourite', icon: 'star', run: () => bulkFavourite(picked.value, update, replace, notesText) },
  { label: 'Move', icon: 'move', run: () => (moving.value = picked.value.map(n => n.id)) },
  { label: picked.value.length && picked.value.every(n => n.archived) ? 'Unarchive' : 'Archive', icon: 'archive', run: archiveSelected },
  { label: 'Delete', icon: 'delete', danger: true, run: deleteSelected }
])
function selectionMenu(): MenuEntry[] {
  const n = sel.selected.size
  return [
    { label: `Move ${n} to folder…`, icon: 'folder', run: () => (moving.value = picked.value.map(x => x.id)) },
    { label: `Archive ${n}`, icon: 'folder', run: archiveSelected },
    '-',
    { label: `Delete ${n}`, icon: 'delete', danger: true, run: deleteSelected }
  ]
}

// ---------- Import / export (#39) ----------
const transferOpen = ref(false)
const settingsOpen = ref(false)

const exportedNote = (n: Note) => ({ title: displayTitle(n), html: n.html, markdown: htmlToMarkdown(n.html), folder: folderPath(n), tags: n.tags, favorite: !!n.favorite, archived: !!n.archived, createdAt: n.createdAt, updatedAt: n.updatedAt })
function exportNotes(scope: 'current' | 'all' | 'one', format: 'md' | 'txt' | 'html' | 'json', one?: Note) {
  flushSave()
  const list = scope === 'all' ? sortNotes(notes.value, 'modified') : [one ?? openNote.value].filter((n): n is Note => !!n)
  if (!list.length) return
  const single = list.length === 1 && scope !== 'all'
  const base = single ? safeFileName(displayTitle(list[0]!)) : dated('notes', format).replace(/\.\w+$/, '')
  if (format === 'json') {
    downloadFile(`${base}.json`, JSON.stringify({ app: 'ousa-app', kind: 'notes', version: 1, exportedAt: new Date().toISOString(), notes: list.map(exportedNote) }, null, 2), 'application/json')
  } else if (format === 'md') {
    downloadFile(`${base}.md`, list.map(n => noteToMarkdown(n, folderPath(n))).join('\n\n'), 'text/markdown;charset=utf-8')
  } else if (format === 'txt') {
    downloadFile(`${base}.txt`, list.map(noteToText).join('\n\n— — —\n\n'), 'text/plain;charset=utf-8')
  } else {
    const html = single ? noteToHtmlFile(list[0]!, folderPath(list[0]!)) : `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>Notes</title></head><body>${list.map(n => `<article>\n${noteToHtmlFile(n, folderPath(n)).replace(/^[\s\S]*<body>|<\/body>[\s\S]*$/g, '')}</article>`).join('\n<hr>\n')}</body></html>`
    downloadFile(`${base}.html`, html, 'text/html;charset=utf-8')
  }
  logActivity('exported', '/notes', single ? displayTitle(list[0]!) : notesText(list.length))
  transferOpen.value = false
  play('success')
}

// Imported HTML goes through the editor's own schema, so only what the editor understands is kept
function cleanHtml(html: string) {
  try {
    const ext = noteExtensions()
    return generateHTML(generateJSON(html || '<p></p>', ext), ext)
  } catch {
    return importText(htmlToText(html)).html
  }
}

async function importFiles(files: File[]) {
  const incoming: ImportedNote[] = []
  let failed = 0
  for (const f of files) {
    if (f.size > 20 * 1024 * 1024) {
      failed++
      continue
    }
    try {
      const text = await f.text()
      const name = f.name.toLowerCase()
      if (name.endsWith('.json')) incoming.push(...importJson(text))
      else if (/\.html?$/.test(name)) incoming.push(importHtml(text, f.name))
      else if (/\.(md|markdown)$/.test(name)) incoming.push(importMarkdown(text, f.name))
      else incoming.push(importText(text, f.name))
    } catch {
      failed++
    }
  }
  const seen = new Set(notes.value.map(n => `${displayTitle(n).toLowerCase()}|${n.text.trim().slice(0, 300)}`))
  const now = new Date().toISOString()
  const records: Omit<Note, 'id'>[] = []
  let skipped = 0
  for (const p of incoming) {
    let html = cleanHtml(p.html)
    let d = derive(html)
    const missingTags = (p.tags ?? []).map(t => t.toLowerCase().replace(/^#/, '')).filter(t => t && !d.tags.includes(t))
    if (missingTags.length) {
      html += `<p>${missingTags.map(t => `#${t}`).join(' ')}</p>`
      d = derive(html)
    }
    const key = `${(p.title.trim() || autoTitle(d.text) || 'Untitled note').toLowerCase()}|${d.text.trim().slice(0, 300)}`
    if (seen.has(key)) {
      skipped++
      continue
    }
    seen.add(key)
    records.push({ title: p.title.trim(), html, ...d, folderId: p.folder ? ensurePath(p.folder.split(/\s*(?:→|\/)\s*/)) : '', favorite: !!p.favorite, archived: !!p.archived, createdAt: p.createdAt ?? p.updatedAt ?? now, updatedAt: p.updatedAt ?? p.createdAt ?? now })
  }
  const added = addMany(records)
  // [[Links]] in imported notes point at notes by title; connect them now that every note is here
  const byTitle = new Map(notes.value.map(n => [displayTitle(n).toLowerCase(), n.id]))
  for (const n of added) {
    if (!n.html.includes('data-note-link')) continue
    const html = n.html.replace(/<span([^>]*?)data-title="([^"]*)"([^>]*)>/g, (all, a: string, title: string, b: string) => {
      if (/data-id=/.test(all)) return all
      const id = byTitle.get(title.replace(/&quot;/g, '"').replace(/&amp;/g, '&').toLowerCase())
      return id ? `<span${a}data-id="${id}" data-title="${title}"${b}>` : all
    })
    if (html !== n.html) update(n.id, { html, ...derive(html) }, { quiet: true })
  }
  transferOpen.value = false
  if (added.length) play('success')
  const parts = [skipped && `${skipped} already here, skipped`, failed && `${failed} ${failed === 1 ? 'file' : 'files'} couldn’t be read`].filter(Boolean).join(' · ')
  if (added.length) toast.success(`${notesText(added.length)} imported`, { description: parts || undefined, action: { label: 'Undo', onClick: () => added.forEach(n => remove(n.id, { undoAdd: true })) } })
  else toast(parts ? `Nothing new to import` : 'No notes found in those files', { description: parts || undefined })
}

// ---------- Keys ----------
const searchInput = ref<HTMLInputElement>()
const typing = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"]')
function onKey(e: KeyboardEvent) {
  const mod = e.metaKey || e.ctrlKey
  // A popup, or the app menu (where letters open apps), has the keys
  if (document.querySelector('dialog[open], .fab.open')) return
  // ⌘N / Ctrl+N or Alt+N: new note (some browsers keep ⌘N for a new window; Alt+N always works)
  if ((mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'n') || (e.altKey && !mod && e.code === 'KeyN')) {
    e.preventDefault()
    newNote()
  } else if ((mod && e.shiftKey && e.key.toLowerCase() === 'n') || (e.altKey && !mod && e.code === 'KeyQ')) {
    // Quick capture: ⌘⇧N / Ctrl+Shift+N where the browser allows it, Alt+Q everywhere
    e.preventDefault()
    quickOpen.value = true
  } else if (mod && !e.shiftKey && e.key.toLowerCase() === 'f') {
    e.preventDefault()
    pane.value = 'list'
    nextTick(() => searchInput.value?.focus())
  } else if (mod && !e.shiftKey && e.key.toLowerCase() === 's') {
    e.preventDefault()
    flushSave()
    toast.success('Saved', { duration: 1200 })
  } else if (!mod && !e.altKey && !typing(e.target) && prefs.shortcuts) {
    if (e.key === '/') {
      e.preventDefault()
      searchInput.value?.focus()
    } else if (e.key.toLowerCase() === 'q') {
      e.preventDefault()
      quickOpen.value = true
    }
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// ---------- Arriving ----------
// ?note= (a copied link, Open in new tab), ?focus= (universal search), ?capture=1 (Quick note)
const arrived = ref(false)
watch(ready, (ok) => {
  if (!ok || arrived.value) return
  arrived.value = true
  const id = (route.query.note ?? route.query.focus) as string | undefined
  if (id && byId(id)) {
    if (byId(id)!.archived) active.value = NOTES_ARCHIVED
    openNoteById(id)
  } else if (id) {
    toast('That note isn’t here', { description: 'It may have been deleted. Check the Recycle Bin.' })
    router.replace({ query: { ...route.query, note: undefined, focus: undefined } })
  }
  if (route.query.capture) {
    quickOpen.value = true
    router.replace({ query: { ...route.query, capture: undefined } })
  }
}, { immediate: true })

// Switching view on a phone shows the list
watch(active, () => {
  pane.value = 'list'
})
</script>

<template>
  <ToolPage header="bar" width="1560px">
    <template #actions>
      <ClientOnly><span class="aside-tools"><BulkToggle v-if="notes.length" :select="sel" /><DataSource :sync="sync" /></span></ClientOnly>
    </template>

    <ClientOnly>
      <div class="notes-app" :data-pane="pane" :class="{ 'has-open': !!openNote }">
        <!-- ---------- 1: views, folders, tags ---------- -->
        <Step :n="1" title="Choose a folder" hint="Or a view: favourites, recent, archived." class="side-step">
        <aside class="side">
          <div class="new-row">
            <button type="button" class="btn new-btn" title="New note (A, Alt+N)" @click="newNote()">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>New note
            </button>
            <button type="button" class="btn new-more" aria-label="New note from a template, or a quick note" title="Templates and quick note" @click="newMenu">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5" /></svg>
            </button>
          </div>

          <FolderTree
            :folders="folders"
            :counts="counts.perFolder"
            :total="counts.all"
            :unfiled="counts.unfiled"
            :active="active"
            :collapsed="collapsed"
            noun="notes"
            item-type="application/x-note"
            :active-label="listTitle"
            @select="id => active = id"
            @toggle="toggleFolder"
            @add="openNewFolder"
            @edit="f => Object.assign(folderEditor, { open: true, folder: f, parentId: f.parentId })"
            @delete="deleteFolder"
            @move-folder="moveFolder"
            @drop-bookmark="(id, folderId) => moveNotes([id], folderId)"
          >
            <template #views>
              <nav class="views-nav" aria-label="Notes">
                <button v-for="v in ([[NOTES_ALL, 'All notes', counts.all, 'M5 4.5h10l4 4v11H5zM14.5 4.5V9h4.5M8.5 12.5h7M8.5 16h5'], [NOTES_FAVORITES, 'Favourites', counts.favorites, 'M12 3.8l2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.8z'], [NOTES_RECENT, 'Recent', 0, 'M12 4.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15zM12 8v4l2.5 2'], [NOTES_ARCHIVED, 'Archived', counts.archived, 'M4 5h16v4H4zM5.5 9v10h13V9M10 13h4']] as const)" :key="v[0]" type="button" class="view-row" :class="{ on: active === v[0] && !searching }" :aria-current="active === v[0] ? 'true' : undefined" @click="active = v[0]; query = ''">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="v[3]" /></svg>
                  <span>{{ v[1] }}</span>
                  <b v-if="v[2]">{{ v[2] }}</b>
                </button>
                <NuxtLink to="/trash?app=/notes" class="view-row">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5" /></svg>
                  <span>Recycle Bin</span>
                </NuxtLink>
              </nav>
              <h3 class="side-head">Folders</h3>
            </template>
          </FolderTree>

          <section v-if="allTags.length" class="tags" aria-label="Tags">
            <h3 class="side-head">Tags</h3>
            <div class="tag-cloud">
              <button v-for="[t, n] in allTags.slice(0, 30)" :key="t" type="button" class="tag" :class="{ on: parsed.tags.includes(t) }" @click="filterTag(t)">#{{ t }} <span>{{ n }}</span></button>
            </div>
          </section>

          <div class="side-tools">
            <button type="button" class="link" @click="transferOpen = true">Import / Export</button>
            <button type="button" class="link" @click="settingsOpen = true">Notes settings</button>
          </div>
        </aside>
        </Step>

        <!-- ---------- 2: the list ---------- -->
        <Step :n="2" title="Pick a note" hint="Search, sort, or start a new one." class="list-step">
        <section class="list-pane" :aria-label="listTitle">
          <div v-sticky-bar class="list-bar">
            <div class="list-head">
              <h2>{{ searching ? 'Search' : listTitle }}</h2>
              <AppSelect v-model="sort" class="sort" aria-label="Sort by" :options="SORTS" />
            </div>
            <label class="search">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
              <input ref="searchInput" v-model="query" type="search" placeholder="Search notes" aria-label="Search notes" title="Words, or folder:work tag:idea is:favorite is:archived before:2026-10-01 after:…" @keydown.enter.prevent="shown[0] && openNoteById(shown[0].id)">
              <kbd v-if="!query" aria-hidden="true">/</kbd>
            </label>
            <div class="list-tools">
              <span class="count">{{ shown.length }} {{ shown.length === 1 ? 'note' : 'notes' }}</span>
              <div class="views" role="radiogroup" aria-label="View">
                <button v-for="v in VIEWS" :key="v" type="button" role="radio" class="view-btn" :aria-checked="view === v" :title="v[0]!.toUpperCase() + v.slice(1)" @click="view = v">
                  <svg v-if="v === 'list'" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6.5h11M9 12h11M9 17.5h11" /><circle cx="4.75" cy="6.5" r="1.1" /><circle cx="4.75" cy="12" r="1.1" /><circle cx="4.75" cy="17.5" r="1.1" /></svg>
                  <svg v-else-if="v === 'grid'" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></svg>
                  <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M4 9.7h16M4 14.3h16M4 19h16" /></svg>
                  <span class="sr-only">{{ v }}</span>
                </button>
              </div>
            </div>
            <p v-if="searching && hasOperators(parsed)" class="ops">
              Filtering by<template v-if="parsed.folder"> folder “{{ parsed.folder }}”</template><template v-for="t in parsed.tags" :key="t"> #{{ t }}</template><template v-if="parsed.is.has('favorite')"> favourites</template><template v-if="parsed.is.has('archived')"> archived</template><template v-if="parsed.after"> after {{ parsed.after }}</template><template v-if="parsed.before"> before {{ parsed.before }}</template>
              · <button type="button" class="link" @click="query = ''">Clear</button>
            </p>
          </div>

          <SkeletonList v-if="!ready" label="Loading your notes" />
          <template v-else-if="shown.length">
            <ul class="note-list" :class="[view, { selecting: sel.selecting }]">
              <template v-for="(n, i) in visible" :key="n.id">
                <li v-if="groupOf(n) && groupOf(n) !== groupOf(visible[i - 1]!)" class="group-head" aria-hidden="true">{{ groupOf(n) }}</li>
                <li
                  :data-item-id="n.id"
                  class="note-row bulk-row"
                  :class="{ on: n.id === openId, 'bulk-picked': sel.has(n.id) }"
                  v-bind="menuFor(() => noteMenu(n), displayTitle(n))"
                  v-swipe-delete="() => del(n)"
                  :data-bulk="sel.selecting || undefined"
                  :draggable="!sel.selecting ? 'true' : undefined"
                  @dragstart="onNoteDrag($event, n)"
                  @click.capture="sel.onRowClick($event, n.id)"
                >
                  <BulkCheck v-if="sel.selecting" :checked="sel.has(n.id)" :label="`Select ${displayTitle(n)}`" @pick="sel.pick(n.id, $event)" />
                  <button type="button" class="note-open" :aria-current="n.id === openId ? 'true' : undefined" @click="openNoteById(n.id)">
                    <span class="note-title">
                      <svg v-if="n.favorite" class="fav" viewBox="0 0 24 24" aria-label="Favourite"><path d="M12 3.8l2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.8z" /></svg>
                      <template v-for="(p, j) in titleParts(n)" :key="j"><mark v-if="p.hit">{{ p.t }}</mark><template v-else>{{ p.t }}</template></template>
                    </span>
                    <span v-if="view !== 'compact' && notePrefs.previewLength" class="note-preview"><template v-for="(p, j) in previewParts(n)" :key="j"><mark v-if="p.hit">{{ p.t }}</mark><template v-else>{{ p.t }}</template></template></span>
                    <span class="note-meta">
                      <span v-if="n.archived" class="badge">Archived</span>
                      <span v-if="folderPath(n) && view !== 'compact'" class="meta-folder"><FolderIcon :icon="folderById(n.folderId)?.icon" :color="folderById(n.folderId)?.color" />{{ folderPath(n) }}</span>
                      <span v-if="view !== 'compact'" class="meta-tags">{{ n.tags.slice(0, 3).map(t => `#${t}`).join(' ') }}</span>
                      <time :datetime="n.updatedAt">{{ timeAgo(n.updatedAt) }}</time>
                    </span>
                  </button>
                </li>
              </template>
            </ul>
            <div v-if="shown.length > limit" ref="moreSentinel" class="more">
              <button type="button" class="btn btn-quiet btn-sm" @click="limit += PAGE">Show more ({{ shown.length - limit }} left)</button>
            </div>
          </template>

          <div v-else-if="searching" class="empty-small">
            <p>No notes match “{{ query }}”.</p>
            <button type="button" class="btn btn-quiet btn-sm" @click="query = ''">Clear search</button>
          </div>
          <div v-else-if="!notes.length" class="empty-panel">
            <EmptyState title="No notes yet" icon="notes" action="New note" @action="newNote()">
              Capture an idea, a meeting, a task, or anything you want to remember. Press <kbd>A</kbd> for a new note or <kbd>Q</kbd> for a quick one.
            </EmptyState>
          </div>
          <div v-else class="empty-small">
            <template v-if="active === NOTES_ARCHIVED">
              <p><strong>Nothing archived</strong></p>
              <p>Archive a note to take it out of your lists without deleting it. Search still finds it.</p>
            </template>
            <template v-else-if="active === NOTES_FAVORITES">
              <p><strong>No favourites yet</strong></p>
              <p>Star a note to keep it here and at the top of every list.</p>
            </template>
            <template v-else>
              <p><strong>This folder is empty</strong></p>
              <p>Create a note or move one here.</p>
              <button type="button" class="btn btn-sm" @click="newNote()">+ New note</button>
            </template>
          </div>
        </section>
        </Step>

        <!-- ---------- 3: the editor ---------- -->
        <Step :n="3" title="Write" hint="It saves by itself as you type." class="editor-step">
        <section class="editor-pane" aria-label="Note">
          <template v-if="openNote">
            <header class="editor-head">
              <button type="button" class="back" aria-label="Back to notes" @click="closeNote">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>Notes
              </button>
              <span class="status" :data-kind="status.kind" aria-live="polite">
                <span class="dot" aria-hidden="true" />{{ status.text }}
                <button v-if="status.kind === 'error' || status.kind === 'offline'" type="button" class="link" @click="sync.retry()">Retry</button>
              </span>
              <span class="head-actions">
                <button type="button" class="icon-btn" :class="{ on: openNote.favorite }" :aria-pressed="!!openNote.favorite" :aria-label="openNote.favorite ? 'Remove from favourites' : 'Add to favourites'" :title="openNote.favorite ? 'Remove from favourites' : 'Add to favourites'" @click="toggleFavorite(openNote)">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.8l2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.8z" /></svg>
                </button>
                <button type="button" class="icon-btn" aria-label="Version history" title="Version history" @click="historyOpen = true">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v3h3M12 8v4l2.5 2" /></svg>
                </button>
                <button type="button" class="icon-btn" aria-label="More actions" title="More" @click="moreMenu">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="18.5" cy="12" r="1.3" /></svg>
                </button>
              </span>
            </header>

            <div v-if="openNote.archived" class="archived-bar">
              This note is archived. <button type="button" class="link" @click="setArchived(openNote, false)">Put it back</button>
            </div>

            <div class="sheet" :style="editorStyle">
              <textarea
                ref="titleInput"
                v-model="draft.title"
                class="title-input"
                rows="1"
                :placeholder="autoTitle(openNote.text) || 'Untitled note'"
                aria-label="Title"
                @input="sizeTitle(); onEdit()"
                @keydown="onTitleKey"
                @blur="flushSave"
              />
              <div class="note-place">
                <button type="button" class="place" @click="moving = [openNote.id]">
                  <FolderIcon :icon="folderById(openNote.folderId)?.icon ?? 'folder'" :color="folderById(openNote.folderId)?.color" />
                  {{ folderPath(openNote) || 'No folder' }}
                </button>
                <button v-for="t in openNote.tags" :key="t" type="button" class="tag small" @click="filterTag(t)">#{{ t }}</button>
              </div>

              <div v-if="suggestion" class="suggest" role="note">
                <strong>Suggested</strong>
                <button v-if="suggestion.folder" type="button" class="chip" @click="acceptFolder(suggestion.folder)">Move to {{ pathText(folders, suggestion.folder.id) }}</button>
                <button v-if="suggestion.tags.length" type="button" class="chip" @click="acceptTags(suggestion.tags)">Tag {{ suggestion.tags.map(t => `#${t}`).join(' ') }}</button>
                <button v-if="suggestion.related.length" type="button" class="chip" @click="acceptRelated(suggestion.related)">Link {{ suggestion.related.map(displayTitle).join(', ') }}</button>
                <button type="button" class="link dismiss" @click="dismissed = new Set([...dismissed, openNote.id])">Not now</button>
              </div>

              <NoteEditor
                ref="editor"
                v-model="draft.html"
                :notes="linkTargets"
                :spellcheck="notePrefs.spellcheck"
                placeholder="Start writing… Type # for a heading, - for a list, [ ] for a checklist, [[ to link a note."
                @update:model-value="onEdit"
                @open-note="followLink"
                @create-note="createLinked"
                @blur="flushSave"
              />

              <section v-if="linksTo.length || linkedFrom.length" class="links">
                <div v-if="linksTo.length">
                  <h3>Links to</h3>
                  <button v-for="n in linksTo" :key="n.id" type="button" class="link-row" @click="openNoteById(n.id)">→ {{ displayTitle(n) }}</button>
                </div>
                <div v-if="linkedFrom.length">
                  <h3>Linked from</h3>
                  <button v-for="n in linkedFrom" :key="n.id" type="button" class="link-row" @click="openNoteById(n.id)">← {{ displayTitle(n) }}</button>
                </div>
              </section>

              <dl v-if="notePrefs.showDetails && details" class="details">
                <div><dt>Created</dt><dd>{{ details.created }}</dd></div>
                <div><dt>Modified</dt><dd>{{ details.modified }}</dd></div>
                <div><dt>Words</dt><dd>{{ details.words.toLocaleString() }}</dd></div>
                <div><dt>Folder</dt><dd>{{ details.folder || 'None' }}</dd></div>
              </dl>
            </div>
          </template>

          <div v-else class="editor-empty">
            <ToolIcon name="notes" class="big-icon" />
            <p><strong>Pick a note, or start a new one</strong></p>
            <p class="small">Press <kbd>A</kbd> for a new note, <kbd>Q</kbd> for a quick one, <kbd>/</kbd> to search.</p>
            <button type="button" class="btn" @click="newNote()">+ New note</button>
          </div>
        </section>
        </Step>
      </div>
      <template #fallback><SkeletonList label="Loading your notes" /></template>
    </ClientOnly>

    <FolderEditor :open="folderEditor.open" :folders="folders" :folder="folderEditor.folder" :parent-id="folderEditor.parentId" @close="folderEditor.open = false" @save="saveFolder" />

    <Modal :open="!!moving.length" :title="moving.length > 1 ? `Move ${moving.length} notes` : 'Move to folder'" @close="moving = []">
      <div class="move-list" role="listbox" aria-label="Folders">
        <button type="button" class="move-opt" @click="moveNotes(moving, NOTES_UNFILED)">No folder</button>
        <button v-for="o in flatTree(folders)" :key="o.folder.id" type="button" class="move-opt" :style="{ paddingLeft: `${0.8 + o.depth}rem` }" @click="moveNotes(moving, o.folder.id)">
          <FolderIcon :icon="o.folder.icon" :color="o.folder.color" /> {{ o.folder.name }}
        </button>
        <button type="button" class="move-opt new" @click="moving = []; openNewFolder()">+ New folder…</button>
      </div>
    </Modal>

    <QuickNote :open="quickOpen" @close="quickOpen = false" @save="saveQuick" />
    <NoteHistory :open="historyOpen" :versions="openNote ? versionsOf(openNote.id) : []" :note-title="openNote ? displayTitle(openNote) : ''" @close="historyOpen = false" @restore="restoreVersion" />
    <NoteTransfer :open="transferOpen" :has-current="!!openNote" :count="notes.length" @close="transferOpen = false" @export="(s, f) => exportNotes(s, f)" @import="importFiles" />
    <NoteSettings :open="settingsOpen" :folders="folders" @close="settingsOpen = false" />
    <BulkBar :select="sel" :actions="bulkActions" label="Selected notes" noun="notes" />
  </ToolPage>
</template>

<style scoped>
/* ---------- Layout: three panels on a computer, one at a time on a phone ---------- */
.notes-app {
  display: grid;
  grid-template-columns: 15rem minmax(17rem, 23rem) minmax(0, 1fr);
  gap: 1.25rem;
  align-items: start;
}

.side-step,
.list-step {
  position: sticky;
  top: 1rem;
  display: flex;
  flex-direction: column;
  max-height: calc(100dvh - 2rem);
}

.side,
.list-pane {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}

.side {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.new-row {
  display: flex;
}

.new-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border-radius: 12px 0 0 12px;
}

.new-more {
  padding-inline: 0.55rem;
  border-left: 1px solid color-mix(in srgb, var(--on-accent, #fff) 30%, transparent);
  border-radius: 0 12px 12px 0;
}

.new-btn svg,
.new-more svg {
  width: 1.05rem;
  height: 1.05rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.views-nav {
  display: grid;
  gap: 0.1rem;
  margin-bottom: 0.5rem;
}

.view-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  min-height: 2.4rem;
  padding: 0.4rem 0.65rem;
  font: inherit;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--ink);
  text-align: left;
  text-decoration: none;
  background: none;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
}

.view-row:hover {
  background: color-mix(in srgb, var(--ink) 6%, transparent);
}

.view-row.on {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
}

.view-row svg {
  width: 1.05rem;
  height: 1.05rem;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.9;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.view-row span {
  flex: 1;
}

.view-row b {
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  color: var(--ink-3);
}

.side-head {
  margin: 0.25rem 0.65rem 0.25rem;
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  padding: 0 0.4rem;
}

.tag {
  padding: 0.2rem 0.55rem;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ink-2);
  background: color-mix(in srgb, var(--ink) 6%, var(--surface));
  border: 0;
  border-radius: 999px;
  cursor: pointer;
}

.tag span {
  font-weight: 500;
  color: var(--ink-3);
}

.tag.on,
.tag:hover {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
}

.tag.small {
  font-size: 0.75rem;
}

.side-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1rem;
  padding: 0.5rem 0.65rem 1rem;
  font-size: 0.85rem;
}

/* ---------- List ---------- */
.list-pane {
  background: var(--surface);
  border-radius: 18px;
  box-shadow: 0 0 0 1px var(--line);
}

.list-bar {
  position: sticky;
  top: 0;
  z-index: 2;
  display: grid;
  gap: 0.55rem;
  padding: 0.85rem 0.85rem 0.6rem;
  background: var(--surface);
  border-bottom: 1px solid var(--line);
  border-radius: 18px 18px 0 0;
}

.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.list-head h2 {
  margin: 0;
  font-size: 1.15rem;
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sort {
  max-width: 11rem;
}

.search {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0 0.7rem;
  background: color-mix(in srgb, var(--ink) 4%, var(--surface));
  border: 1px solid var(--line);
  border-radius: 12px;
}

.search:focus-within {
  border-color: var(--accent);
}

.search svg {
  width: 1rem;
  height: 1rem;
  flex: none;
  fill: none;
  stroke: var(--ink-3);
  stroke-width: 2;
  stroke-linecap: round;
}

.search input {
  flex: 1;
  min-width: 0;
  height: 2.5rem;
  font: inherit;
  font-size: 16px;
  color: var(--ink);
  background: none;
  border: 0;
  outline: none;
}

.search kbd {
  padding: 0 0.35rem;
  font-size: 0.75rem;
  color: var(--ink-3);
  border: 1px solid var(--line);
  border-radius: 5px;
}

.list-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.count {
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  color: var(--ink-3);
}

.views {
  display: flex;
  gap: 0.1rem;
}

.view-btn {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  color: var(--ink-3);
  background: none;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
}

.view-btn[aria-checked='true'] {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.view-btn svg {
  width: 1.05rem;
  height: 1.05rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.9;
  stroke-linecap: round;
}

.ops {
  margin: 0;
  font-size: 0.8rem;
  color: var(--ink-2);
}

.note-list {
  margin: 0;
  padding: 0.4rem;
  list-style: none;
}

.group-head {
  padding: 0.75rem 0.7rem 0.3rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.note-row {
  border-radius: 12px;
}

.note-row + .note-row {
  margin-top: 0.1rem;
}

.note-open {
  display: grid;
  gap: 0.25rem;
  width: 100%;
  padding: 0.7rem 0.75rem;
  font: inherit;
  text-align: left;
  color: var(--ink);
  background: none;
  border: 0;
  border-radius: 12px;
  cursor: pointer;
  transition: background-color 0.12s ease-out;
}

.note-open:hover {
  background: color-mix(in srgb, var(--ink) 5%, transparent);
}

.note-row.on .note-open {
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
}

.note-title {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fav {
  width: 0.9rem;
  height: 0.9rem;
  flex: none;
  fill: var(--gold);
  stroke: none;
}

.note-preview {
  display: -webkit-box;
  overflow: hidden;
  font-size: 0.86rem;
  line-height: 1.45;
  color: var(--ink-2);
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

mark {
  color: inherit;
  background: color-mix(in srgb, var(--accent) 25%, transparent);
  border-radius: 3px;
}

.note-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2rem 0.6rem;
  font-size: 0.75rem;
  color: var(--ink-3);
}

.meta-folder {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.meta-folder :deep(svg) {
  width: 0.85rem;
  height: 0.85rem;
}

.badge {
  padding: 0.05rem 0.4rem;
  font-weight: 700;
  color: var(--ink-2);
  background: color-mix(in srgb, var(--ink) 8%, transparent);
  border-radius: 6px;
}

time {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

/* Grid: cards */
.note-list.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 12rem), 1fr));
  gap: 0.5rem;
}

.note-list.grid .group-head {
  grid-column: 1 / -1;
}

.note-list.grid .note-row + .note-row {
  margin-top: 0;
}

.note-list.grid .note-open {
  align-content: start;
  min-height: 9rem;
  box-shadow: 0 0 0 1px var(--line);
}

.note-list.grid .note-preview {
  -webkit-line-clamp: 4;
}

/* Compact: one line each */
.note-list.compact .note-open {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  padding: 0.45rem 0.7rem;
}

.note-list.compact .note-meta {
  flex-wrap: nowrap;
}

.more {
  display: flex;
  justify-content: center;
  padding: 0.75rem;
}

.empty-small {
  display: grid;
  justify-items: center;
  gap: 0.35rem;
  padding: 2rem 1rem;
  text-align: center;
  color: var(--ink-2);
}

.empty-small p {
  margin: 0;
}

.empty-panel {
  padding: 0.5rem;
}

/* ---------- Editor ---------- */
.editor-pane {
  min-width: 0;
  min-height: 70vh;
  background: var(--surface);
  border-radius: 18px;
  box-shadow: 0 0 0 1px var(--line);
}

.editor-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem 0.4rem 1rem;
}

.back {
  display: none;
  align-items: center;
  gap: 0.15rem;
  padding: 0.4rem 0.4rem 0.4rem 0;
  font: inherit;
  font-weight: 600;
  color: var(--accent);
  background: none;
  border: 0;
  cursor: pointer;
}

.back svg {
  width: 1.2rem;
  height: 1.2rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: var(--ink-3);
}

.status .dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: var(--green);
}

.status[data-kind='saving'] .dot { background: var(--blue); }
.status[data-kind='offline'] .dot,
.status[data-kind='demo'] .dot { background: var(--orange); }
.status[data-kind='error'] { color: var(--red); }
.status[data-kind='error'] .dot { background: var(--red); }

.head-actions {
  display: flex;
  gap: 0.15rem;
  margin-left: auto;
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
  color: var(--ink-2);
  background: none;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
}

.icon-btn:hover {
  color: var(--ink);
  background: color-mix(in srgb, var(--ink) 6%, transparent);
}

.icon-btn svg {
  width: 1.2rem;
  height: 1.2rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.9;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.icon-btn.on svg {
  fill: var(--gold);
  stroke: var(--gold);
}

.archived-bar {
  margin: 0 1rem 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.85rem;
  color: var(--ink-2);
  background: color-mix(in srgb, var(--ink) 5%, var(--surface));
  border-radius: 10px;
}

.sheet {
  max-width: 50rem;
  margin: 0 auto;
}

.title-input {
  display: block;
  width: 100%;
  padding: 0.5rem 1.25rem 0.2rem;
  overflow: hidden;
  font: inherit;
  font-family: var(--note-font, inherit);
  font-size: 1.75rem;
  font-weight: 750;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--ink);
  background: none;
  border: 0;
  outline: none;
  resize: none;
  text-wrap: balance;
}

.title-input::placeholder {
  color: var(--ink-3);
}

.note-place {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 1.25rem 0.5rem;
}

.place {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.6rem 0.25rem 0.45rem;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ink-2);
  background: color-mix(in srgb, var(--ink) 5%, var(--surface));
  border: 0;
  border-radius: 999px;
  cursor: pointer;
}

.place:hover {
  color: var(--ink);
}

.place :deep(svg) {
  width: 0.95rem;
  height: 0.95rem;
}

.suggest {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.5rem;
  margin: 0 1.25rem 0.6rem;
  padding: 0.55rem 0.7rem;
  font-size: 0.82rem;
  background: color-mix(in srgb, var(--accent) 7%, var(--surface));
  border-radius: 12px;
}

.suggest strong {
  color: var(--ink-2);
}

.chip {
  padding: 0.25rem 0.6rem;
  font: inherit;
  font-weight: 600;
  color: var(--accent);
  background: var(--surface);
  border: 0;
  border-radius: 999px;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent);
  cursor: pointer;
}

.dismiss {
  margin-left: auto;
}

.links {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 1rem;
  margin: 0 1.25rem 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--line);
}

.links h3 {
  margin: 0 0 0.35rem;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.link-row {
  display: block;
  padding: 0.3rem 0;
  font: inherit;
  font-weight: 600;
  color: var(--accent);
  text-align: left;
  background: none;
  border: 0;
  cursor: pointer;
}

.details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: 0.5rem 1rem;
  margin: 0 1.25rem 1.25rem;
  padding-top: 0.75rem;
  font-size: 0.78rem;
  color: var(--ink-3);
  border-top: 1px solid var(--line);
}

.details dt {
  font-weight: 600;
}

.details dd {
  margin: 0;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}

.editor-empty {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 0.5rem;
  min-height: 60vh;
  padding: 2rem;
  text-align: center;
  color: var(--ink-2);
}

.editor-empty p {
  margin: 0;
}

.big-icon {
  width: 3rem;
  height: 3rem;
  color: var(--accent);
}

kbd {
  padding: 0 0.35rem;
  font: inherit;
  font-size: 0.85em;
  border: 1px solid var(--line);
  border-radius: 5px;
}

.move-list {
  display: grid;
  gap: 0.15rem;
}

.move-opt {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.8rem;
  font: inherit;
  text-align: left;
  color: var(--ink);
  background: none;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
}

.move-opt:hover {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.move-opt.new {
  color: var(--accent);
  font-weight: 600;
}

/* Mid-size screens: folders above, list and editor side by side */
@media (max-width: 1100px) {
  .notes-app {
    grid-template-columns: minmax(16rem, 20rem) minmax(0, 1fr);
  }

  .side-step {
    grid-column: 1 / -1;
    position: static;
    max-height: none;
  }

  .side :deep(.tree-body) {
    max-height: 40vh;
    overflow-y: auto;
  }
}

/* Phones: one panel at a time — the list, then the note full screen */
@media (max-width: 760px) {
  .notes-app {
    display: block;
  }

  .side-step,
  .list-step {
    position: static;
    max-height: none;
  }

  .side,
  .list-pane {
    overflow: visible;
  }

  .side-step {
    margin-bottom: 1.25rem;
  }

  .notes-app[data-pane='editor'] .side-step,
  .notes-app[data-pane='editor'] .list-step,
  .notes-app[data-pane='list'] .editor-step {
    display: none;
  }

  /* The note gets the whole screen: its step heading would only push it down */
  .editor-step :deep(.step-head) {
    display: none;
  }

  .list-bar {
    top: 0;
  }

  .editor-pane {
    margin: 0 -1rem;
    min-height: calc(100dvh - 6rem);
    border-radius: 0;
    box-shadow: none;
  }

  .back {
    display: inline-flex;
  }

  .status {
    flex: 1;
    min-width: 0;
  }

  .title-input {
    padding-inline: 1rem;
    font-size: 1.5rem;
  }

  .note-place,
  .suggest,
  .links,
  .details {
    margin-inline: 1rem;
    padding-inline: 0;
  }

  .note-place {
    padding-inline: 1rem;
    margin-inline: 0;
  }
}
</style>
