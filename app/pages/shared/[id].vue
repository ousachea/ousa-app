<script setup lang="ts">
import type { SharedBookmark, SharedFolder, SharePayload } from '~/utils/share'

// A bookmark folder someone shared (Bookmarks → Share…): its bookmarks and sub-folders, to look
// through and open, without signing in. Read-only; the owner's app keeps it up to date.
const route = useRoute()
const id = computed(() => String(route.params.id ?? ''))
const { data, error, status } = await useFetch(() => `/api/share/${id.value}`, { key: () => `share-${id.value}` })

const share = computed(() => (data.value?.share as SharePayload | null | undefined) ?? undefined)
const root = computed(() => share.value?.folders.find(f => f.id === share.value!.rootId))
const updated = computed(() => (data.value?.updatedAt ? new Date(data.value.updatedAt) : undefined))

useHead({ title: () => (root.value ? `${root.value.name} · shared bookmarks` : 'Shared bookmarks') })
useSeoMeta({
  robots: 'noindex, nofollow',
  description: () => (root.value ? `${share.value!.bookmarks.length} bookmarks in ${root.value.name}, shared from Ousa’s Apps.` : 'Shared bookmarks from Ousa’s Apps.')
})

// Which folder you're looking at inside the share; ?f= keeps it in the address so Back works
const current = computed(() => {
  const f = typeof route.query.f === 'string' ? route.query.f : ''
  return share.value?.folders.some(x => x.id === f) ? f : share.value?.rootId ?? ''
})
const router = useRouter()
const open = (folderId: string) => router.push({ query: folderId === share.value?.rootId ? {} : { f: folderId } })

const folders = computed(() => (share.value?.folders ?? []) as SharedFolder[])
const trail = computed(() => ancestorsOf(folders.value, current.value))
const subfolders = computed(() => childrenOf(folders.value, current.value))
const inView = computed(() => new Set([current.value, ...descendantsOf(folders.value, current.value)]))
const countIn = (folderId: string) => {
  const ids = new Set([folderId, ...descendantsOf(folders.value, folderId)])
  return (share.value?.bookmarks ?? []).filter(b => b.folders.some(x => ids.has(x))).length
}

const query = ref('')
const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  return (share.value?.bookmarks ?? []).filter((b: SharedBookmark) => {
    if (!b.folders.some(x => inView.value.has(x))) return false
    return !q || [b.title, b.url, b.description, b.siteName].some(v => v?.toLowerCase().includes(q))
  })
})

// Dressed in the Bookmarks app's colour
const BOOKMARKS = toolFor('/bookmarks')
const brokenIcons = ref(new Set<string>())
const nameOf = (fid: string) => folders.value.find(f => f.id === fid)?.name
const dateText = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
</script>

<template>
  <main class="shared" :style="{ '--accent': BOOKMARKS?.color }">
    <SiteBar />

    <div v-if="status === 'pending'" class="state">
      <SkeletonList label="Loading the shared folder" />
    </div>

    <div v-else-if="error || !share || !root" class="state empty-panel">
      <EmptyState title="This folder isn’t shared any more" icon="bookmarks">
        The link may be old, or whoever shared it has stopped sharing. Ask them for a new link.
      </EmptyState>
    </div>

    <template v-else>
      <header class="head">
        <span class="kicker"><AppIcon name="users" /> Shared bookmarks</span>
        <h1><FolderIcon :icon="root.icon" :color="root.color" />{{ root.name }}</h1>
        <p class="meta">
          {{ share.bookmarks.length }} {{ share.bookmarks.length === 1 ? 'bookmark' : 'bookmarks' }}
          <template v-if="folders.length > 1"> in {{ folders.length - 1 }} {{ folders.length === 2 ? 'sub-folder' : 'sub-folders' }}</template>
          <template v-if="updated"> · updated {{ dateText(updated) }}</template>
        </p>
      </header>

      <!-- Where you are inside the share: Root / Sub-folder / … -->
      <nav v-if="trail.length > 1" class="path" aria-label="Folder path">
        <template v-for="(f, i) in trail" :key="f.id">
          <AppIcon v-if="i" class="sep" name="chevron-right" />
          <button v-if="i < trail.length - 1" type="button" class="step" @click="open(f.id)">{{ f.name }}</button>
          <span v-else class="here" aria-current="location"><FolderIcon :icon="f.icon" :color="f.color" />{{ f.name }}</span>
        </template>
      </nav>

      <div v-if="subfolders.length" class="subs">
        <button v-for="f in subfolders" :key="f.id" type="button" class="sub" @click="open(f.id)">
          <FolderIcon :icon="f.icon" :color="f.color" />
          <span class="sub-name">{{ f.name }}</span>
          <b>{{ countIn(f.id) }}</b>
        </button>
      </div>

      <label class="search">
        <AppIcon name="search" />
        <input v-model="query" type="search" placeholder="Search these bookmarks" aria-label="Search these bookmarks">
      </label>

      <ul v-if="shown.length" class="marks">
        <li v-for="b in shown" :key="b.url" class="mark">
          <span class="icon">
            <img v-if="b.icon && !brokenIcons.has(b.icon)" :src="b.icon" alt="" loading="lazy" referrerpolicy="no-referrer" @error="brokenIcons = new Set(brokenIcons).add(b.icon)">
            <span v-else aria-hidden="true">{{ (b.title.trim()[0] ?? '?').toUpperCase() }}</span>
          </span>
          <div class="body">
            <a :href="b.url" target="_blank" rel="noopener noreferrer" class="title">{{ b.title }}<AppIcon class="ext" name="external-link" /><span class="sr-only"> (opens in a new tab)</span></a>
            <span class="host">{{ b.siteName && b.siteName.toLowerCase() !== b.title.toLowerCase() ? `${b.siteName} · ` : '' }}{{ hostOf(b.url) }}<template v-if="current === share.rootId && b.folders[0] && b.folders[0] !== share.rootId"> · {{ nameOf(b.folders[0]) }}</template></span>
            <p v-if="b.description" class="desc">{{ b.description }}</p>
          </div>
          <img v-if="b.image" class="thumb" :src="b.image" alt="" loading="lazy" referrerpolicy="no-referrer" @error="($event.target as HTMLImageElement).remove()">
        </li>
      </ul>
      <p v-else class="none">{{ query ? `Nothing here matches “${query}”.` : 'This folder is empty.' }}</p>

      <p class="foot">Shared from <NuxtLink to="/bookmarks">Bookmarks</NuxtLink> in Ousa’s Apps. Save and share your own links, free.</p>
    </template>
  </main>
</template>

<style scoped>
.shared {
  --width: 860px;
  width: 100%;
  max-width: var(--width);
  margin: 0 auto;
  padding: 1rem 1rem 4rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.state {
  margin-top: 2rem;
}

.head {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.kicker {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-3);
}

h1 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: clamp(1.8rem, 6vw, 2.6rem);
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.meta {
  margin: 0;
  color: var(--ink-2);
}

.path {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.1rem;
  font-weight: 600;
}

.step {
  padding: 0.2rem 0.4rem;
  font: inherit;
  color: var(--ink-3);
  background: none;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
}

.step:hover {
  color: var(--ink);
  background: var(--surface-2);
}

.sep {
  width: 1rem;
  height: 1rem;
  color: var(--ink-3);
}

.here {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.4rem;
}

.subs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  gap: 0.5rem;
}

.sub {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.7rem 0.85rem;
  font: inherit;
  font-weight: 600;
  color: var(--ink);
  text-align: left;
  background: var(--surface);
  border: 0;
  border-radius: 14px;
  box-shadow: 0 0 0 1px var(--line);
  cursor: pointer;
  transition: box-shadow var(--dur-fast);
}

.sub:hover {
  box-shadow: 0 0 0 1.5px var(--ink-3);
}

.sub-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub b {
  font-size: var(--text-sm);
  color: var(--ink-3);
}

.search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.75rem;
  padding: 0 0.85rem;
  background: var(--surface);
  border-radius: 14px;
  box-shadow: 0 0 0 1px var(--line);
}

.search:focus-within {
  box-shadow: 0 0 0 2px var(--accent);
}

.search svg {
  color: var(--ink-3);
}

.search input {
  flex: 1;
  min-width: 0;
  font: inherit;
  font-size: 1rem;
  color: var(--ink);
  background: none;
  border: 0;
  outline: none;
}

.marks {
  margin: 0;
  padding: 0;
  list-style: none;
  background: var(--surface);
  border-radius: 18px;
  box-shadow: 0 0 0 1px var(--line);
  overflow: hidden;
}

.mark {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  padding: 0.9rem 1rem;
}

.mark + .mark {
  border-top: 1px solid var(--line);
}

.mark:hover {
  background: var(--surface-2);
}

.icon {
  flex: none;
  width: 2.25rem;
  height: 2.25rem;
  display: grid;
  place-items: center;
  font-weight: 700;
  color: var(--accent);
  background: var(--surface-2);
  border-radius: 10px;
  overflow: hidden;
}

.icon img {
  width: 1.5rem;
  height: 1.5rem;
  object-fit: contain;
}

.body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.title {
  font-weight: 700;
  color: var(--ink);
  text-decoration: none;
}

/* The whole row opens the link */
.title::after {
  content: '';
  position: absolute;
  inset: 0;
}

.title:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}

.ext {
  width: 0.85rem;
  height: 0.85rem;
  margin-left: 0.3rem;
  vertical-align: -0.05em;
  color: var(--ink-3);
}

.host {
  font-size: var(--text-sm);
  color: var(--ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.desc {
  margin: 0.2rem 0 0;
  font-size: var(--text-sm);
  color: var(--ink-2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.thumb {
  flex: none;
  width: 6.5rem;
  aspect-ratio: 1.91;
  object-fit: cover;
  border-radius: 10px;
  background: var(--surface-2);
}

.none {
  margin: 1rem 0;
  text-align: center;
  color: var(--ink-2);
}

.foot {
  margin: 1rem 0 0;
  text-align: center;
  font-size: var(--text-sm);
  color: var(--ink-3);
}

.foot a {
  color: var(--ink-2);
}

@media (max-width: 560px) {
  .thumb {
    display: none;
  }
}
</style>
