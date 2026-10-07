<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { Bookmark } from '~/utils/bookmarks'

const { play } = useSound()
// Demo: a few pinned daily sites, tagged reading, and a note
const demoMark = (url: string, title: string, tags: string[], extra: Partial<Bookmark> = {}): Omit<Bookmark, 'id'> => ({
  url, title, tags, description: '', note: '', icon: new URL('/favicon.ico', url).href, pinned: false, visits: 0, createdAt: new Date(isoDaysAgo(Math.round(Math.random() * 90))).toISOString(), ...extra
})
const DEMO = (): Omit<Bookmark, 'id'>[] => [
  demoMark('https://github.com/', 'GitHub', ['dev'], { pinned: true, visits: 42, icon: 'https://github.com/fluidicon.png' }),
  demoMark('https://nuxt.com/', 'Nuxt', ['dev', 'docs'], { pinned: true, visits: 18, icon: 'https://nuxt.com/icon.png', note: 'Docs for the framework this app is built on' }),
  demoMark('https://developer.mozilla.org/', 'MDN Web Docs', ['dev', 'docs'], { visits: 9, description: 'Resources for developers, by developers.' }),
  demoMark('https://www.figma.com/', 'Figma', ['design'], { pinned: true, visits: 12 }),
  demoMark('https://fonts.google.com/', 'Google Fonts', ['design'], { description: 'Making the web more beautiful, fast, and open through great typography.' }),
  demoMark('https://www.khmertimeskh.com/', 'Khmer Times', ['news', 'khmer'], { visits: 5 }),
  demoMark('https://www.youtube.com/', 'YouTube', [], { visits: 30 })
]
const { items, ready, sync, add, addMany, update, remove, restore } = useCollection<Bookmark>('bookmarks', undefined, { demo: DEMO })

// ---------- Save a link ----------
const linkInput = ref('')
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

async function save() {
  const raw = linkInput.value.trim()
  if (!raw || saving.value) return
  const url = parseLink(raw)
  if (!url) {
    toast.error('That doesn’t look like a link', { description: 'Try something like nuxt.com or https://…' })
    play('error')
    return
  }
  const existing = items.value.find(b => urlKey(b.url) === urlKey(url.href))
  if (existing) {
    toast('Already saved', { description: existing.title, action: { label: 'Edit', onClick: () => edit(existing) } })
    linkInput.value = ''
    flash(existing.id)
    return
  }

  saving.value = true
  // Read the page's title and icon; if the site won't say, save it under its domain name
  const preview = await $fetch('/api/link-preview', { query: { url: url.href } }).catch(() => undefined)
  saving.value = false

  const finalUrl = preview?.url || url.href
  const record = add({
    url: finalUrl,
    title: preview?.title || hostOf(finalUrl),
    description: preview?.description ?? '',
    note: '',
    tags: activeTag.value && activeTag.value !== UNSORTED ? [activeTag.value] : [],
    icon: preview?.icon || new URL('/favicon.ico', finalUrl).href,
    pinned: false,
    visits: 0,
    createdAt: new Date().toISOString()
  })
  linkInput.value = ''
  play('success')
  toast.success('Bookmark saved', {
    description: record.title,
    action: { label: 'Add tags', onClick: () => edit(record) }
  })
  flash(record.id)
}

// ---------- Browse ----------
const UNSORTED = ':unsorted'
const query = ref('')
const activeTag = ref<string>() // undefined = all
const sort = ref<'newest' | 'opened' | 'az'>('newest')

// List or grid of cards, remembered on this device
const VIEW_KEY = 'ousa-app:bookmarks-view'
const view = ref<'list' | 'grid'>('list')
onMounted(() => {
  try {
    if (localStorage.getItem(VIEW_KEY) === 'grid') view.value = 'grid'
  } catch {}
})
function setView(next: 'list' | 'grid') {
  if (view.value === next) return
  view.value = next
  play('select')
  try {
    localStorage.setItem(VIEW_KEY, next)
  } catch {}
}
const searchInput = ref<HTMLInputElement>()

const tags = computed(() => {
  const counts = new Map<string, number>()
  for (const b of items.value) for (const t of b.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
  return [...counts].sort((a, b) => a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count }))
})
const unsortedCount = computed(() => items.value.filter(b => !b.tags.length).length)

// A tag that no longer exists (its last bookmark was deleted or retagged) drops back to All
watch(tags, (list) => {
  if (activeTag.value && activeTag.value !== UNSORTED && !list.some(t => t.name === activeTag.value)) activeTag.value = undefined
})

const pinned = computed(() => items.value.filter(b => b.pinned))

const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = items.value.filter((b) => {
    if (activeTag.value === UNSORTED ? b.tags.length : activeTag.value && !b.tags.includes(activeTag.value)) return false
    if (!q) return true
    return [b.title, b.url, b.note, b.description, ...b.tags].some(f => f.toLowerCase().includes(q))
  })
  if (sort.value === 'az') return list.sort((a, b) => a.title.localeCompare(b.title))
  if (sort.value === 'opened') return list.sort((a, b) => b.visits - a.visits || (b.lastOpened ?? '').localeCompare(a.lastOpened ?? ''))
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
})

const listTitle = computed(() => activeTag.value === UNSORTED ? 'No tag' : activeTag.value ? `#${activeTag.value}` : 'All bookmarks')

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
  update(b.id, { visits: (b.visits ?? 0) + 1, lastOpened: new Date().toISOString() })
}

function togglePin(b: Bookmark) {
  update(b.id, { pinned: !b.pinned })
  play(b.pinned ? 'toggle-off' : 'toggle-on')
  toast(b.pinned ? 'Unpinned' : 'Pinned to the top', { description: b.title })
}

function del(b: Bookmark) {
  const removed = remove(b.id)
  play('delete')
  toast(`${b.title} deleted`, { action: { label: 'Undo', onClick: () => removed && restore(removed) } })
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
const form = reactive({ url: '', title: '', note: '', tags: '', pinned: false })
const formTags = computed(() => [...new Set(form.tags.split(',').map(normaliseTag).filter(Boolean))])
const suggestions = computed(() => tags.value.map(t => t.name).filter(t => !formTags.value.includes(t)).slice(0, 12))

function edit(b: Bookmark) {
  editingId.value = b.id
  Object.assign(form, { url: b.url, title: b.title, note: b.note, tags: b.tags.join(', '), pinned: b.pinned })
  play('select')
}

function addSuggestion(t: string) {
  form.tags = [...formTags.value, t].join(', ')
}

function saveEdit() {
  const id = editingId.value
  const url = parseLink(form.url.trim())
  if (!id || !url) return
  const before = items.value.find(b => b.id === id)
  update(id, {
    url: url.href,
    title: form.title.trim() || hostOf(url.href),
    note: form.note.trim(),
    tags: formTags.value,
    pinned: form.pinned,
    // A new address means a new site icon
    ...(before && hostOf(before.url) !== hostOf(url.href) ? { icon: new URL('/favicon.ico', url).href } : {})
  })
  editingId.value = undefined
  play('success')
  toast.success('Changes saved')
}

// ---------- Import / export ----------
const fileInput = ref<HTMLInputElement>()

async function importFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const found = parseBrowserBookmarks(await file.text())
    const have = new Set(items.value.map(b => urlKey(b.url)))
    const fresh = found.filter((b) => {
      const k = urlKey(b.url)
      if (have.has(k)) return false
      have.add(k)
      return true
    })
    if (!found.length) {
      toast.error('No bookmarks in that file', { description: 'Export them from your browser as an HTML file.' })
      play('error')
      return
    }
    if (fresh.length) enrich(addMany(fresh))
    play('success')
    toast.success(`${fresh.length} ${fresh.length === 1 ? 'bookmark' : 'bookmarks'} imported`, {
      description: found.length > fresh.length ? `${found.length - fresh.length} you already had were skipped.` : 'Folders became tags.'
    })
  } catch {
    toast.error('Couldn’t read that file')
    play('error')
  }
}

// Imported links only have a name; fill in each site's icon and description in the background,
// a few at a time, keeping the title the browser had
async function enrich(list: Bookmark[]) {
  const queue = [...list]
  const worker = async () => {
    for (let b = queue.shift(); b; b = queue.shift()) {
      const preview = await $fetch('/api/link-preview', { query: { url: b.url } }).catch(() => undefined)
      if (preview && items.value.some(i => i.id === b!.id)) update(b.id, { icon: preview.icon, description: preview.description })
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))
}

function exportFile() {
  const blob = new Blob([exportBrowserBookmarks(items.value)], { type: 'text/html' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `bookmarks-${new Date().toISOString().slice(0, 10)}.html`
  a.click()
  URL.revokeObjectURL(a.href)
  play('copy')
  toast.success('Bookmarks exported', { description: 'Import the file into any browser.' })
}
</script>

<template>
  <ToolPage header="bar">
    <template #actions><ClientOnly><DataSource :sync="sync" /></ClientOnly></template>

    <!-- The address bar: paste, press Enter, done -->
    <form class="omnibox" aria-label="Save a link" @submit.prevent="save">
      <span class="omni-icon" aria-hidden="true"><ToolIcon name="bookmarks" /></span>
      <input
        v-model="linkInput"
        type="text"
        inputmode="url"
        autocomplete="off"
        spellcheck="false"
        placeholder="Paste a link to save it"
        aria-label="Link to save"
        :disabled="saving"
      >
      <button type="submit" class="btn" :disabled="!linkInput.trim() || saving">{{ saving ? 'Reading page…' : 'Save' }}</button>
    </form>

    <ClientOnly>
      <!-- Pinned: the sites you open every day, as big tiles -->
      <section v-if="pinned.length" class="shelf" aria-label="Pinned">
        <a
          v-for="b in pinned"
          :key="b.id"
          :href="b.url"
          target="_blank"
          rel="noopener"
          class="tile"
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
        <!-- Tags down the side, like the spines on a shelf -->
        <aside v-sticky-fit class="side" aria-label="Tags">
          <nav class="tags">
            <button type="button" class="tag-row" :class="{ on: !activeTag }" :aria-pressed="!activeTag" @click="activeTag = undefined">
              <span>All</span><b>{{ items.length }}</b>
            </button>
            <button
              v-for="t in tags"
              :key="t.name"
              type="button"
              class="tag-row"
              :class="{ on: activeTag === t.name }"
              :style="{ '--tag': tagColor(t.name) }"
              :aria-pressed="activeTag === t.name"
              @click="activeTag = t.name"
            >
              <span><i class="swatch" aria-hidden="true" />{{ t.name }}</span><b>{{ t.count }}</b>
            </button>
            <button v-if="unsortedCount && tags.length" type="button" class="tag-row muted" :class="{ on: activeTag === UNSORTED }" :aria-pressed="activeTag === UNSORTED" @click="activeTag = UNSORTED">
              <span>No tag</span><b>{{ unsortedCount }}</b>
            </button>
          </nav>

          <div class="side-tools">
            <button type="button" class="link" @click="fileInput?.click()">Import from browser</button>
            <button v-if="items.length" type="button" class="link" @click="exportFile">Export</button>
            <input ref="fileInput" type="file" accept=".html,.htm,text/html" hidden @change="importFile">
          </div>
        </aside>

        <section class="main" :aria-label="listTitle">
          <div v-sticky-bar class="toolbar">
            <h2>{{ listTitle }}</h2>
            <label class="search">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
              <input ref="searchInput" v-model="query" type="search" placeholder="Search" aria-label="Search bookmarks" @keydown.enter.prevent="openFirst">
              <kbd v-if="!query" aria-hidden="true">/</kbd>
            </label>
            <AppSelect v-model="sort" class="sort" aria-label="Sort by" :options="[{ value: 'newest', label: 'Newest' }, { value: 'opened', label: 'Most opened' }, { value: 'az', label: 'A–Z' }]" />
            <div class="views" role="radiogroup" aria-label="View">
              <button type="button" role="radio" class="view-btn" :aria-checked="view === 'list'" title="List" @click="setView('list')">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6.5h11M9 12h11M9 17.5h11" /><circle cx="4.75" cy="6.5" r="1.1" /><circle cx="4.75" cy="12" r="1.1" /><circle cx="4.75" cy="17.5" r="1.1" /></svg>
                <span class="sr-only">List</span>
              </button>
              <button type="button" role="radio" class="view-btn" :aria-checked="view === 'grid'" title="Grid" @click="setView('grid')">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></svg>
                <span class="sr-only">Grid</span>
              </button>
            </div>
          </div>

          <ul v-if="shown.length" class="marks" :class="view">
            <li v-for="b in shown" :id="`bm-${b.id}`" :key="b.id" class="mark" :class="{ flash: flashId === b.id }">
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
                <span v-if="b.tags.length" class="mark-tags">
                  <button v-for="t in b.tags" :key="t" type="button" class="chip" :style="{ '--tag': tagColor(t) }" @click="activeTag = t">#{{ t }}</button>
                </span>
              </div>
              <div class="mark-actions">
                <button type="button" class="icon-btn" :class="{ on: b.pinned }" :aria-pressed="b.pinned" :aria-label="b.pinned ? `Unpin ${b.title}` : `Pin ${b.title}`" :title="b.pinned ? 'Unpin' : 'Pin to the top'" @click="togglePin(b)">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h10a1 1 0 0 1 1 1v16l-6-4.2-6 4.2v-16a1 1 0 0 1 1-1z" /></svg>
                </button>
                <button type="button" class="icon-btn" :aria-label="`Edit ${b.title}`" title="Edit" @click="edit(b)">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg>
                </button>
                <ConfirmDelete class="icon-btn danger" :name="b.title" icon @confirm="del(b)">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15M10 7V4.5h4V7M6.5 7l1 13h9l1-13" /></svg>
                </ConfirmDelete>
              </div>
            </li>
          </ul>

          <div v-else-if="ready && items.length" class="empty">
            <p>Nothing matches{{ query ? ` “${query}”` : '' }}.</p>
            <button type="button" class="btn btn-quiet btn-sm" @click="query = ''; activeTag = undefined">Show everything</button>
          </div>

          <div v-else-if="ready" class="empty first">
            <h3>No bookmarks yet</h3>
            <p>Paste a link above to save it. The page title and icon are filled in for you.</p>
            <p>Already have bookmarks in your browser? <button type="button" class="link" @click="fileInput?.click()">Import them</button>, and their folders become tags.</p>
          </div>
        </section>
      </div>
    </ClientOnly>

    <Modal :open="!!editingId" title="Edit bookmark" @close="editingId = undefined">
      <form class="edit" @submit.prevent="saveEdit">
        <label class="field">
          <span class="field-head">Title</span>
          <input v-model="form.title" class="input">
        </label>
        <label class="field">
          <span class="field-head">Link</span>
          <input v-model="form.url" class="input" inputmode="url" spellcheck="false" required>
        </label>
        <label class="field">
          <span class="field-head">Note <span class="optional">Optional</span></span>
          <textarea v-model="form.note" class="input" rows="3" placeholder="Why you saved it, or what to look at" />
        </label>
        <label class="field">
          <span class="field-head">Tags <span class="optional">Separate with commas</span></span>
          <input v-model="form.tags" class="input" placeholder="design, reading">
        </label>
        <div v-if="suggestions.length" class="suggest" aria-label="Your tags">
          <button v-for="t in suggestions" :key="t" type="button" class="chip" :style="{ '--tag': tagColor(t) }" @click="addSuggestion(t)">+ {{ t }}</button>
        </div>
        <label class="pin-check">
          <input v-model="form.pinned" type="checkbox">
          Pin to the top
        </label>
        <div class="edit-actions">
          <button type="submit" class="btn" :disabled="!parseLink(form.url.trim())">Save changes</button>
          <button type="button" class="btn btn-quiet" @click="editingId = undefined">Cancel</button>
        </div>
      </form>
    </Modal>
  </ToolPage>
</template>

<style scoped>
/* ---------- Address bar ---------- */
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
  .marks.list .mark {
    flex-wrap: wrap;
    column-gap: 0.75rem;
    row-gap: 0.2rem;
  }

  .marks.list .mark-body {
    flex-basis: calc(100% - 3.25rem);
  }

  .marks.list .mark-actions {
    width: 100%;
    padding-left: 2.6rem;
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
