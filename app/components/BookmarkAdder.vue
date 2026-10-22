<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { Bookmark, NewBookmark } from '~/utils/bookmarks'
import type { Folder } from '~/utils/folders'

// Adding bookmarks, as a form that says so: a link field with a + Add button and where the bookmark
// will go ("Save to"), not a search-like address bar. One link is saved the moment you press Add (or
// Enter, or paste it): the page's title, picture and description fill in by themselves as it's read
// (CHECKLIST.md #43), and a Just added card shows it with its title, folders, note and pin to change,
// or Undo. Paste several (one per line, or a block of text with links in it) and they're listed
// together, each read in the background, to pick from and add in one go into the same folder.
// `main`: the card at the top of Bookmarks. `inline`: the add box inside an open folder, which folds
// down to one "+ Add a bookmark to <folder>" row until clicked.
const props = withDefaults(defineProps<{
  folders: readonly Folder[]
  bookmarks: readonly Bookmark[]
  /** Where new bookmarks go to start with ('' for no folder) */
  folderId?: string
  variant?: 'main' | 'inline'
  online?: boolean
  createFolder: (name: string) => string
  /** A folder name worth suggesting for a link, from where similar links are filed */
  suggestFor?: (url: string) => string | undefined
}>(), { folderId: '', variant: 'main', online: true, suggestFor: undefined })

const emit = defineEmits<{
  /** `read`: the page's details were fetched; otherwise the page fills them in later */
  save: [entries: { record: NewBookmark, read: boolean }[]]
  /** Show a bookmark that's already saved */
  show: [bookmark: Bookmark]
  /** A change made on the Just added card, to the bookmark just saved */
  edit: [id: string, patch: Partial<Bookmark>]
  /** Undo on the Just added card: take the bookmark back out */
  undo: [id: string]
}>()

const { play } = useSound()
const field = ref<HTMLTextAreaElement>()
const text = ref('')
const expanded = ref(props.variant === 'main')

// Where new bookmarks go: follows the folder that's open, and can be changed here
const target = ref(props.folderId)
watch(() => props.folderId, v => (target.value = v))
const targetFolder = computed(() => props.folders.find(f => f.id === target.value))
const FOLDER_OPTIONS = computed(() => [
  { value: '', label: 'No folder' },
  ...flatTree(props.folders).map(o => ({ value: o.folder.id, label: `${'  '.repeat(o.depth)}${o.folder.name}` }))
])

const links = computed(() => linksIn(text.value))
const many = computed(() => links.value.length > 1)
const existingFor = (url: string) => props.bookmarks.find(b => pageKey(b.url) === pageKey(url))

function focus() {
  expanded.value = true
  nextTick(() => focusField(field.value))
}
defineExpose({ focus })

const fetchPreview = (url: string) => (props.online
  ? $fetch('/api/link-preview', { query: { url } }).catch(() => undefined)
  : Promise.resolve(undefined))

// ---------- One link: saved straight away, then shown to change ----------
const duplicateOf = ref<Bookmark>()
watch(text, () => {
  duplicateOf.value = undefined
  empty.value = false
})

// The bookmark just saved, found again by its link and the moment it was made (so "add it anyway"
// beside an older copy still finds the new one). The card reads it live, so details arrive as the
// page is read in the background.
const justAdded = ref<{ url: string, createdAt: string, suggestion?: string }>()
const added = computed(() => {
  const j = justAdded.value
  return j ? props.bookmarks.find(b => b.url === j.url && b.createdAt === j.createdAt) : undefined
})
// Still waiting for the page's details (they come back with detailsAt)
const filling = computed(() => !!added.value && !added.value.detailsAt && props.online)
const imageBroken = ref(false)
const iconBroken = ref(false)
watch(() => added.value?.image, () => (imageBroken.value = false))
watch(() => added.value?.icon, () => (iconBroken.value = false))
const folderNames = computed(() => (added.value?.folders ?? []).map(id => props.folders.find(f => f.id === id)?.name).filter(Boolean).join(', '))

// The title is edited as a draft, so a title arriving from the page doesn't overwrite what you're typing
const titleDraft = ref('')
const editingTitle = ref(false)
watch(() => added.value?.title, (t) => {
  if (!editingTitle.value && t !== undefined) titleDraft.value = t
}, { immediate: true })
function saveTitle() {
  editingTitle.value = false
  const b = added.value
  const t = titleDraft.value.trim()
  if (!b) return
  if (!t) titleDraft.value = b.title
  else if (t !== b.title) emit('edit', b.id, { title: t })
}

const edit = (patch: Partial<Bookmark>) => added.value && emit('edit', added.value.id, patch)

function addOne(url: URL, force = false) {
  const existing = force ? undefined : existingFor(url.href)
  if (existing) {
    duplicateOf.value = existing
    play('warning')
    return
  }
  duplicateOf.value = undefined
  batch.value = undefined
  const createdAt = new Date().toISOString()
  emit('save', [{
    record: {
      url: url.href,
      // The address stands in for the title until the page says what it's called
      title: hostOf(url.href),
      description: '',
      note: '',
      tags: [],
      folders: target.value ? [target.value] : [],
      icon: new URL('/favicon.ico', url).href,
      pinned: false,
      visits: 0,
      createdAt
    },
    read: false
  }])
  justAdded.value = { url: url.href, createdAt, suggestion: target.value ? undefined : props.suggestFor?.(url.href) }
  text.value = ''
  nextTick(() => field.value?.focus())
}

function done() {
  justAdded.value = undefined
  nextTick(() => field.value?.focus())
}

function undo() {
  const b = added.value
  justAdded.value = undefined
  if (b) emit('undo', b.id)
  play('toggle-off')
  nextTick(() => field.value?.focus())
}

function showExisting() {
  const b = duplicateOf.value
  duplicateOf.value = undefined
  text.value = ''
  if (b) emit('show', b)
}

// ---------- Several links: read them all, add them together ----------
interface Row {
  url: string
  title: string
  icon: string
  description: string
  image: string
  siteName: string
  state: 'reading' | 'ready' | 'failed'
  include: boolean
  existing?: Bookmark
}
const batch = ref<{ rows: Row[], folders: string[] }>()
const chosen = computed(() => batch.value?.rows.filter(r => r.include) ?? [])
const stillReading = computed(() => batch.value?.rows.filter(r => r.state === 'reading').length ?? 0)
let batchRun = 0

async function readMany(urls: URL[]) {
  justAdded.value = undefined
  duplicateOf.value = undefined
  const run = ++batchRun
  const rows = reactive(urls.map<Row>((u) => {
    const existing = existingFor(u.href)
    return { url: u.href, title: hostOf(u.href), icon: new URL('/favicon.ico', u).href, description: '', image: '', siteName: '', state: 'reading', include: !existing, existing }
  }))
  batch.value = { rows, folders: target.value ? [target.value] : [] }
  play('open')
  // Four pages at a time, like importing
  const queue = [...rows]
  const worker = async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      const preview = await fetchPreview(r.url)
      if (run !== batchRun) return
      if (!preview) {
        r.state = 'failed'
        continue
      }
      Object.assign(r, {
        url: preview.url || r.url,
        title: preview.title || r.title,
        icon: preview.icon || r.icon,
        description: preview.description ?? '',
        image: preview.image ?? '',
        siteName: preview.siteName || '',
        state: 'ready'
      })
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))
}

function saveBatch() {
  const b = batch.value
  if (!b || !chosen.value.length) return
  const now = Date.now()
  emit('save', chosen.value.map((r, i) => ({
    record: {
      url: r.url,
      title: r.title.trim() || hostOf(r.url),
      description: r.description,
      note: '',
      tags: [],
      folders: [...b.folders],
      icon: r.icon,
      ...(r.image ? { image: r.image } : {}),
      ...(r.siteName ? { siteName: r.siteName } : {}),
      ...(r.state === 'ready' ? { detailsAt: new Date().toISOString() } : {}),
      pinned: false,
      visits: 0,
      // A millisecond apart, so they list in the order they were pasted
      createdAt: new Date(now - i).toISOString()
    },
    read: r.state === 'ready'
  })))
  cancel()
}

function cancel() {
  batchRun++
  batch.value = undefined
  duplicateOf.value = undefined
  text.value = ''
  nextTick(() => field.value?.focus())
}

// ---------- The field ----------
// Add with nothing typed says so under the field, rather than doing nothing
const empty = ref(false)
const shaking = ref(false)
function nudge() {
  empty.value = true
  shaking.value = false
  play('error')
  requestAnimationFrame(() => (shaking.value = true))
  focusField(field.value)
}

function submit(force = false) {
  const found = links.value
  if (!found.length) {
    if (text.value.trim()) {
      play('error')
      toast.error('That doesn’t look like a link', { description: 'Try something like nuxt.com or https://…' })
      focusField(field.value)
    } else nudge()
    return
  }
  if (found.length > 1) readMany(found)
  else addOne(found[0]!, force)
}

function onKeydown(e: KeyboardEvent) {
  // Enter adds; Shift+Enter starts a new line for another link
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    submit()
  } else if (e.key === 'Escape' && props.variant === 'inline' && !text.value) {
    e.stopPropagation()
    expanded.value = false
  }
}

// Pasting into an empty field reads straight away: one link, or every link in what was pasted
function onPaste(e: ClipboardEvent) {
  const pasted = e.clipboardData?.getData('text') ?? ''
  if (text.value.trim() || !linksIn(pasted).length) return
  e.preventDefault()
  text.value = pasted.trim()
  submit()
}

const canReadClipboard = ref(false)
onMounted(() => (canReadClipboard.value = !!navigator.clipboard?.readText))
async function pasteFromClipboard() {
  let clip = ''
  try {
    clip = (await navigator.clipboard.readText()).trim()
  } catch {
    toast.error('Couldn’t read the clipboard', { description: 'Allow clipboard access for this site, or paste with ⌘V / Ctrl+V.' })
    play('error')
    return focusField(field.value)
  }
  if (!linksIn(clip).length) {
    toast(clip ? 'The clipboard doesn’t hold a link' : 'The clipboard is empty', { description: clip ? (clip.length > 60 ? `${clip.slice(0, 60)}…` : clip) : 'Copy a link first, then press Paste.' })
    return focusField(field.value)
  }
  text.value = clip
  submit()
}

const busy = computed(() => !!(justAdded.value || batch.value || duplicateOf.value))
</script>

<template>
  <div class="adder" :class="[variant, { busy }]">
    <!-- Inside a folder: one quiet row until you want it -->
    <!-- Laid out like a bookmark (icon, title, line under it), so in the list it's one more row and in
         the grid one more card -->
    <button v-if="variant === 'inline' && !expanded" type="button" class="add-here-row" @click="focus">
      <span class="plus" aria-hidden="true"><AppIcon name="plus" /></span>
      <span class="add-here-text">
        <strong>Add a bookmark</strong>
        <span class="sub">to {{ targetFolder?.name ?? 'this folder' }} · paste one link or several</span>
      </span>
    </button>

    <form v-else class="add-form" :aria-label="variant === 'inline' ? `Add bookmarks to ${targetFolder?.name ?? 'this folder'}` : 'Add bookmarks'" @submit.prevent="submit()">
      <div class="add-row" :class="{ shake: shaking }" @animationend="shaking = false">
        <span class="lead" aria-hidden="true"><AppIcon name="link" /></span>
        <label class="sr-only" :for="`add-${variant}`">Link to add</label>
        <textarea
          :id="`add-${variant}`"
          ref="field"
          v-model="text"
          rows="1"
          inputmode="url"
          autocomplete="off"
          spellcheck="false"
          enterkeyhint="done"
          :placeholder="variant === 'inline' ? 'Paste links to add here' : 'Paste a link, or several'"
          :aria-invalid="empty || undefined"
          :aria-describedby="empty ? `add-${variant}-empty` : undefined"
          @keydown="onKeydown"
          @paste="onPaste"
        />
        <button v-if="canReadClipboard && !text.trim()" type="button" class="paste" title="Paste from the clipboard" @click="pasteFromClipboard">
          <AppIcon name="clipboard" /><span class="paste-label">Paste</span>
        </button>
        <button type="submit" class="btn add-btn">
          <AppIcon name="plus" />
          {{ many ? `Add ${links.length}` : 'Add' }}
        </button>
      </div>
      <p v-if="empty" :id="`add-${variant}-empty`" class="field-error empty-note" role="alert">Paste or type a link first, then press Add.</p>

      <div class="add-meta">
        <label class="save-to">
          <AppIcon name="folder" />
          <span>Save to</span>
          <AppSelect v-model="target" class="folder-select" aria-label="Save to folder" :options="FOLDER_OPTIONS" searchable />
        </label>
        <span v-if="many" class="found">{{ links.length }} links found</span>
        <span v-else class="tip">Tip: paste several links at once to add them together.</span>
        <button v-if="variant === 'inline'" type="button" class="link close-inline" @click="expanded = false; cancel()">Close</button>
      </div>
    </form>

    <DuplicateCard
      v-if="duplicateOf"
      class="below"
      :title="duplicateOf.title"
      :where="(duplicateOf.folders ?? []).map(id => folders.find(f => f.id === id)?.name).filter(Boolean).join(', ') || undefined"
      :detail="duplicateOf.url"
      @open="showExisting"
      @keep="submit(true)"
      @cancel="duplicateOf = undefined"
    />

    <!-- One link, saved: what it looks like, with anything you'd like to change, or Undo -->
    <Transition name="slide-down">
      <section v-if="added" class="review panel below" aria-label="Just added" @keydown.esc.stop="done">
        <div class="review-media">
          <img v-if="added.image && !imageBroken" :src="added.image" alt="" referrerpolicy="no-referrer" @error="imageBroken = true">
          <span v-else class="review-icon" :class="{ skeleton: filling && !added.icon }">
            <img v-if="added.icon && !iconBroken" :src="added.icon" alt="" referrerpolicy="no-referrer" @error="iconBroken = true">
            <span v-else>{{ (added.title[0] ?? '?').toUpperCase() }}</span>
          </span>
        </div>
        <div class="review-fields">
          <p class="kicker saved-kicker" role="status">
            <AppIcon name="check" />Saved{{ folderNames ? ` to ${folderNames}` : '' }}
            <span v-if="filling" class="filling"><span class="spinner" aria-hidden="true" />Reading the page…</span>
          </p>
          <p class="site">{{ added.siteName || hostOf(added.url) }} · <span class="url">{{ added.url }}</span></p>
          <label class="field">
            <span class="sr-only">Title</span>
            <input v-model="titleDraft" class="input title-input" aria-label="Title" @focus="editingTitle = true" @blur="saveTitle" @keydown.enter.prevent="($event.target as HTMLInputElement).blur()">
          </label>
          <p v-if="added.description" class="desc">{{ added.description }}</p>
          <label class="field">
            <span class="field-head">Note <span class="optional">Optional</span></span>
            <textarea :value="added.note" class="input" rows="2" placeholder="Why you saved it, or what to look at" @change="edit({ note: ($event.target as HTMLTextAreaElement).value.trim() })" />
          </label>
          <div class="field">
            <span class="field-head">Folders <span class="optional">Optional</span></span>
            <FolderPicker :model-value="added.folders ?? []" :folders="folders" :create-folder="createFolder" @update:model-value="f => edit({ folders: f })" />
          </div>
          <SuggestionChip
            v-if="justAdded?.suggestion && !added.folders?.length"
            label="Suggested folder"
            :value="justAdded.suggestion"
            @use="edit({ folders: [createFolder(justAdded!.suggestion!)] })"
            @ignore="justAdded!.suggestion = undefined"
          />
          <label class="pin-check">
            <input type="checkbox" :checked="added.pinned" @change="edit({ pinned: ($event.target as HTMLInputElement).checked })">
            Pin to the top
          </label>
          <div class="actions">
            <button type="button" class="btn" @click="done">Done</button>
            <button type="button" class="btn btn-quiet" @click="undo">Undo</button>
            <span class="hint">Changes save as you make them</span>
          </div>
        </div>
      </section>
    </Transition>

    <!-- Several links: a list to check, then one button adds them all -->
    <Transition name="slide-down">
      <form v-if="batch" class="batch panel below" aria-label="Add several bookmarks" @submit.prevent="saveBatch" @keydown.esc.stop="cancel">
        <div class="batch-head">
          <p class="kicker">{{ batch.rows.length }} new bookmarks</p>
          <span v-if="stillReading" class="reading-count" role="status"><span class="spinner" aria-hidden="true" /> Reading {{ batch.rows.length - stillReading }} of {{ batch.rows.length }}…</span>
        </div>
        <ul class="rows">
          <li v-for="r in batch.rows" :key="r.url" class="row" :class="{ off: !r.include }">
            <input v-model="r.include" type="checkbox" class="pick" :aria-label="`Add ${r.title}`">
            <span class="row-icon">
              <span v-if="r.state === 'reading'" class="skeleton row-skel" />
              <img v-else :src="r.icon" alt="" referrerpolicy="no-referrer" @error="($event.target as HTMLImageElement).style.visibility = 'hidden'">
            </span>
            <span class="row-text">
              <input v-model="r.title" class="row-title" :aria-label="`Title for ${r.url}`" :disabled="!r.include">
              <span class="row-url">{{ hostOf(r.url) }}
                <span v-if="r.existing" class="tag dupe">Already saved</span>
                <span v-else-if="r.state === 'failed'" class="tag">Couldn’t read the page; you can still add it</span>
              </span>
            </span>
          </li>
        </ul>
        <div class="field">
          <span class="field-head">Put them in <span class="optional">Optional</span></span>
          <FolderPicker v-model="batch.folders" :folders="folders" :create-folder="createFolder" />
        </div>
        <div class="actions">
          <button type="submit" class="btn" :disabled="!chosen.length">Add {{ chosen.length }} {{ chosen.length === 1 ? 'bookmark' : 'bookmarks' }}</button>
          <button type="button" class="btn btn-quiet" @click="cancel">Cancel</button>
          <span v-if="stillReading && chosen.length" class="hint">Any still being read get their details after they’re added.</span>
        </div>
      </form>
    </Transition>
  </div>
</template>

<style scoped>
.adder {
  width: 100%;
}

.adder.main {
  width: min(100%, 760px);
}

/* ---------- The add form: a card with a link field and a clear Add button ---------- */
.add-form {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.6rem;
  background: var(--surface);
  border-radius: var(--radius-xl);
  box-shadow: 0 0 0 1px var(--line), 0 14px 30px -18px rgb(var(--shadow) / 0.35);
}

.inline .add-form {
  box-shadow: 0 0 0 1px var(--line);
  border-radius: var(--radius-lg);
}

.add-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.25rem 0.25rem 0.7rem;
  background: var(--surface-2);
  border-radius: var(--radius-lg);
  box-shadow: inset 0 0 0 1px var(--line);
  transition: box-shadow var(--dur-fast);
}

.add-row:focus-within {
  box-shadow: inset 0 0 0 2px var(--accent);
  background: var(--surface);
}

.lead {
  flex: none;
  display: grid;
  color: var(--accent);
}

.lead svg {
  width: 1.2rem;
  height: 1.2rem;
}

textarea:not(.input) {
  flex: 1;
  min-width: 0;
  min-height: 2.6rem;
  max-height: 9rem;
  padding: 0.6rem 0;
  field-sizing: content;
  resize: none;
  font: inherit;
  font-size: var(--text-md);
  line-height: 1.4;
  color: var(--ink);
  background: none;
  border: 0;
  outline: none;
}

textarea:not(.input)::placeholder {
  color: var(--ink-3);
  /* A long hint gives way on a phone rather than hiding the buttons */
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
}

.paste {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 2.25rem;
  padding: 0 0.7rem;
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-2);
  background: var(--surface);
  border: 0;
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--line);
  cursor: pointer;
  transition: color var(--dur-fast), box-shadow var(--dur-fast);
}

.paste:hover {
  color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
}

.paste svg,
.add-btn svg,
.save-to > svg,
.plus svg {
  width: 1rem;
  height: 1rem;
}

.add-btn {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border-radius: var(--radius);
}

.add-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.9rem;
  padding: 0 0.35rem;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.save-to {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 600;
}

.save-to > svg {
  color: var(--ink-3);
}

.folder-select {
  min-width: 9rem;
}

.folder-select :deep(button) {
  min-height: 2rem;
  font-size: var(--text-sm);
}

.tip {
  color: var(--ink-3);
}

.found {
  font-weight: 700;
  color: var(--accent);
}

.close-inline {
  margin-left: auto;
}

/* ---------- Inside a folder: shaped like a bookmark until it opens into the form ----------
   The list item around it (bookmarks.vue, .add-mark) gives it the row's or card's shape */
.add-here-row {
  width: 100%;
  display: flex;
  flex-direction: var(--add-dir, row);
  align-items: var(--add-align, center);
  gap: var(--add-gap, 0.9rem);
  padding: 0;
  font: inherit;
  color: var(--ink-2);
  text-align: left;
  background: none;
  border: 0;
  cursor: pointer;
}

.add-here-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.add-here-row strong {
  color: var(--ink);
  font-weight: 700;
}

.add-here-row:hover strong {
  color: var(--accent);
}

.add-here-row .sub {
  font-size: var(--text-sm);
  color: var(--ink-3);
}

.plus {
  flex: none;
  width: var(--add-icon, 2.5rem);
  height: var(--add-icon, 2.5rem);
  display: grid;
  place-items: center;
  color: var(--on-accent, #fff);
  background: var(--accent-btn, var(--accent));
  border-radius: var(--radius);
  transition: scale var(--dur-fast);
}

.add-here-row:hover .plus {
  scale: 1.06;
}

.plus svg {
  width: 1.2rem;
  height: 1.2rem;
}

/* ---------- Check one, or several ---------- */
.below {
  margin-top: 0.75rem;
}

.review {
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
  border-radius: var(--radius);
  background: var(--surface-2);
}

.review-icon {
  width: 100%;
  aspect-ratio: 1.91;
  display: grid;
  place-items: center;
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
  border-radius: var(--radius);
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

.kicker.saved-kicker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.6rem;
  color: var(--good-ink);
}

.saved-kicker > svg {
  width: 0.95rem;
  height: 0.95rem;
  margin-right: -0.2rem;
}

.filling {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
  color: var(--ink-3);
}

.desc {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--ink-2);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  overflow: hidden;
}

.empty-note {
  margin: -0.1rem 0.35rem 0;
}

.kicker {
  margin: 0;
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--accent);
}

.site {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--ink-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.url {
  color: var(--ink-3);
}

.warn {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--warn-ink);
}

.title-input {
  font-weight: 700;
  font-size: var(--text-title);
}

.pin-check {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-weight: 600;
  cursor: pointer;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.actions .hint {
  margin-left: auto;
  font-size: var(--text-sm);
  color: var(--ink-3);
}

.batch {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  text-align: left;
}

.batch-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.reading-count {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.rows {
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 22rem;
  overflow-y: auto;
  border-radius: var(--radius);
  box-shadow: inset 0 0 0 1px var(--line);
}

.row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.55rem 0.75rem;
  transition: opacity var(--dur-fast);
}

.row + .row {
  border-top: 1px solid var(--line);
}

.row.off {
  opacity: 0.55;
}

.pick {
  flex: none;
}

.row-icon {
  flex: none;
  width: 1.75rem;
  height: 1.75rem;
  display: grid;
  place-items: center;
}

.row-icon img {
  width: 1.4rem;
  height: 1.4rem;
  object-fit: contain;
}

.row-skel {
  width: 1.4rem;
  height: 1.4rem;
  border-radius: var(--radius-xs);
}

.row-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.row-title {
  min-width: 0;
  padding: 0.1rem 0.3rem;
  margin-left: -0.3rem;
  font: inherit;
  font-weight: 600;
  color: var(--ink);
  background: none;
  border: 0;
  border-radius: var(--radius-xs);
  outline: none;
}

.row-title:focus {
  box-shadow: inset 0 0 0 1.5px var(--accent);
}

.row-url {
  font-size: var(--text-sm);
  color: var(--ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag {
  margin-left: 0.35rem;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--warn-ink);
}

.tag.dupe {
  padding: 0.05rem 0.4rem;
  color: var(--warn-ink);
  background: color-mix(in srgb, var(--orange) 14%, var(--surface));
  border-radius: var(--radius-pill);
}

.spinner {
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: adder-spin 0.7s linear infinite;
}

@keyframes adder-spin {
  to { transform: rotate(1turn); }
}

@media (max-width: 640px) {
  .review {
    grid-template-columns: minmax(0, 1fr);
  }

  .review-media img,
  .review-icon {
    aspect-ratio: 2.6;
  }

  .actions .hint,
  .tip {
    display: none;
  }

  .paste-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  .paste {
    padding: 0 0.6rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation-duration: 2s;
  }
}
</style>
