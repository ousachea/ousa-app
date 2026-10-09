<script setup lang="ts">
import type { Folder } from '~/utils/folders'
import type { MenuEntry } from '~/composables/useContextMenu'

// The bookmark folders down the side (CHECKLIST.md #35–#40, #28):
// - nested, with arrows to open and close each level (remembered by the page)
// - "+ Add folder" at the top and the bottom
// - drag a bookmark onto a folder to move it there; drag a folder onto another to put it inside,
//   or onto the top or bottom edge of one to reorder; drop on All to move it to the top level
// - right-click or the ⋯ button for edit, add a sub-folder, delete
// Every drag has a menu or button alternative.
const ALL = ALL_BOOKMARKS

const props = defineProps<{
  folders: readonly Folder[]
  /** Bookmarks directly in each folder */
  counts: Record<string, number>
  total: number
  unfiled: number
  active: string
  collapsed: readonly string[]
  /** What the folders hold, for wording and drag and drop (Bookmarks by default; Notes uses its own) */
  noun?: string
  itemType?: string
  /** Shown on phones as the current choice, for views that aren't folders (Notes: Favourites…) */
  activeLabel?: string
}>()
const emit = defineEmits<{
  'select': [id: string]
  'add': [parentId: string]
  'edit': [folder: Folder]
  'delete': [folder: Folder]
  'toggle': [id: string]
  'move-folder': [id: string, parentId: string, beforeId: string | null]
  'drop-bookmark': [bookmarkId: string, folderId: string]
}>()

const { openMenu } = useContextMenu()
const rows = computed(() => {
  const hidden = new Set<string>()
  const out: { folder: Folder, depth: number, hasChildren: boolean, total: number }[] = []
  for (const { folder, depth } of flatTree(props.folders)) {
    const parentHidden = folder.parentId && (hidden.has(folder.parentId) || props.collapsed.includes(folder.parentId))
    if (parentHidden) {
      hidden.add(folder.id)
      continue
    }
    const below = descendantsOf(props.folders, folder.id)
    out.push({
      folder,
      depth,
      hasChildren: props.folders.some(f => f.parentId === folder.id),
      total: [folder.id, ...below].reduce((n, id) => n + (props.counts[id] ?? 0), 0)
    })
  }
  return out
})

const folderMenu = (f: Folder): MenuEntry[] => [
  { label: 'Edit folder', icon: 'edit', run: () => emit('edit', f) },
  { label: 'Add a sub-folder', icon: 'folder', run: () => emit('add', f.id) },
  '-',
  { label: 'Delete folder', icon: 'delete', danger: true, run: () => emit('delete', f) }
]

function onContext(e: MouseEvent, f: Folder) {
  e.preventDefault()
  openMenu(matchMedia('(pointer: coarse)').matches ? null : e, folderMenu(f), f.name)
}

function onMore(e: MouseEvent, f: Folder) {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  openMenu(matchMedia('(pointer: coarse)').matches ? null : { clientX: r.left, clientY: r.bottom + 4 }, folderMenu(f), f.name)
}

// ---------- Drag and drop ----------
const drop = ref<{ id: string, zone: 'before' | 'into' | 'after' }>()
let draggingFolder: string | undefined

const itemType = computed(() => props.itemType ?? 'application/x-bookmark')
const noun = computed(() => props.noun ?? 'bookmarks')
const isBookmarkDrag = (e: DragEvent) => !!e.dataTransfer?.types.includes(itemType.value)
const isFolderDrag = (e: DragEvent) => e.dataTransfer?.types.includes('application/x-folder')

function onDragStart(e: DragEvent, f: Folder) {
  draggingFolder = f.id
  e.dataTransfer?.setData('application/x-folder', f.id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function zoneOf(e: DragEvent): 'before' | 'into' | 'after' {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const y = (e.clientY - r.top) / r.height
  return y < 0.25 ? 'before' : y > 0.75 ? 'after' : 'into'
}

function canDropFolder(targetId: string) {
  return !!draggingFolder && draggingFolder !== targetId && !descendantsOf(props.folders, draggingFolder).includes(targetId)
}

function onDragOver(e: DragEvent, f: Folder | null) {
  if (isBookmarkDrag(e)) {
    e.preventDefault()
    drop.value = { id: f?.id ?? ALL, zone: 'into' }
    return
  }
  if (!isFolderDrag(e)) return
  if (f && !canDropFolder(f.id)) return
  e.preventDefault()
  drop.value = { id: f?.id ?? ALL, zone: f ? zoneOf(e) : 'into' }
}

function onDrop(e: DragEvent, f: Folder | null) {
  e.preventDefault()
  const zone = drop.value?.zone ?? 'into'
  drop.value = undefined
  const bookmarkId = e.dataTransfer?.getData(itemType.value)
  if (bookmarkId) {
    emit('drop-bookmark', bookmarkId, f?.id ?? ALL)
    return
  }
  const id = e.dataTransfer?.getData('application/x-folder')
  if (!id) return
  draggingFolder = undefined
  if (!f) {
    emit('move-folder', id, '', null)
    return
  }
  if (id === f.id || descendantsOf(props.folders, id).includes(f.id)) return
  if (zone === 'into') {
    emit('move-folder', id, f.id, null)
  } else {
    const siblings = childrenOf(props.folders, f.parentId).filter(s => s.id !== id)
    const i = siblings.findIndex(s => s.id === f.id)
    const before = zone === 'before' ? f.id : siblings[i + 1]?.id ?? null
    emit('move-folder', id, f.parentId, before)
  }
}

function onDragLeave(e: DragEvent) {
  if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) drop.value = undefined
}

// Phones: the tree folds away under the current folder's name
const openOnPhone = ref(false)
const activeName = computed(() => {
  if (props.activeLabel) return props.activeLabel
  if (props.active === ALL) return `All ${noun.value}`
  if (props.active === UNFILED) return 'Not in a folder'
  return pathText(props.folders, props.active) || `All ${noun.value}`
})
watch(() => props.active, () => (openOnPhone.value = false))
</script>

<template>
  <nav class="folder-tree" :class="{ 'phone-open': openOnPhone }" aria-label="Folders">
    <button type="button" class="phone-toggle" :aria-expanded="openOnPhone" @click="openOnPhone = !openOnPhone">
      <FolderIcon icon="folder" />
      <span class="phone-current">{{ activeName }}</span>
      <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5" /></svg>
    </button>

    <div class="tree-body">
      <button type="button" class="add-folder top" @click="emit('add', '')">
        <span aria-hidden="true">+</span> Add folder
      </button>

      <!-- Notes puts its own views (All, Favourites, Recent…) here instead of All -->
      <slot v-if="$slots.views" name="views" />
      <button
        v-else
        type="button"
        class="row"
        :class="{ on: active === ALL, 'drop-into': drop?.id === ALL }"
        :aria-current="active === ALL ? 'true' : undefined"
        @click="emit('select', ALL)"
        @dragover="onDragOver($event, null)"
        @dragleave="onDragLeave"
        @drop="onDrop($event, null)"
      >
        <span class="name"><ToolIcon name="bookmarks" class="all-icon" />All</span><b>{{ total }}</b>
      </button>

      <TransitionGroup tag="div" name="list" class="rows">
        <div
          v-for="r in rows"
          :key="r.folder.id"
          class="row-wrap"
          :style="{ '--depth': r.depth }"
        >
          <button
            v-if="r.hasChildren"
            type="button"
            class="twisty"
            :aria-expanded="!collapsed.includes(r.folder.id)"
            :aria-label="`${collapsed.includes(r.folder.id) ? 'Open' : 'Close'} ${r.folder.name}`"
            @click="emit('toggle', r.folder.id)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </button>
          <button
            type="button"
            class="row"
            :class="{
              'on': active === r.folder.id,
              'drop-into': drop?.id === r.folder.id && drop.zone === 'into',
              'drop-before': drop?.id === r.folder.id && drop.zone === 'before',
              'drop-after': drop?.id === r.folder.id && drop.zone === 'after'
            }"
            :style="{ '--tag': folderColor(r.folder) }"
            :aria-current="active === r.folder.id ? 'true' : undefined"
            :title="pathText(folders, r.folder.id)"
            draggable="true"
            @click="emit('select', r.folder.id)"
            @contextmenu="onContext($event, r.folder)"
            @dragstart="onDragStart($event, r.folder)"
            @dragend="draggingFolder = undefined; drop = undefined"
            @dragover="onDragOver($event, r.folder)"
            @dragleave="onDragLeave"
            @drop="onDrop($event, r.folder)"
          >
            <span class="name"><FolderIcon :icon="r.folder.icon" :color="r.folder.color" />{{ r.folder.name }}</span>
            <b>{{ r.total }}</b>
          </button>
          <button type="button" class="more" :aria-label="`Actions for ${r.folder.name}`" title="Folder actions" @click="onMore($event, r.folder)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="18.5" cy="12" r="1.3" /></svg>
          </button>
        </div>
      </TransitionGroup>

      <button
        v-if="unfiled && folders.length"
        type="button"
        class="row muted"
        :class="{ 'on': active === UNFILED, 'drop-into': drop?.id === UNFILED }"
        :aria-current="active === UNFILED ? 'true' : undefined"
        @click="emit('select', UNFILED)"
        @dragover="(e: DragEvent) => { if (isBookmarkDrag(e)) { e.preventDefault(); drop = { id: UNFILED, zone: 'into' } } }"
        @dragleave="onDragLeave"
        @drop="(e: DragEvent) => { e.preventDefault(); drop = undefined; const id = e.dataTransfer?.getData(itemType); if (id) emit('drop-bookmark', id, UNFILED) }"
      >
        <span class="name">Not in a folder</span><b>{{ unfiled }}</b>
      </button>

      <button type="button" class="add-folder bottom" @click="emit('add', '')">
        <span aria-hidden="true">+</span> Add folder
      </button>
      <p v-if="folders.length" class="hint">Drag {{ noun }} onto a folder to move them. Drag folders to reorder or nest them.</p>
    </div>
  </nav>
</template>

<style scoped>
.folder-tree {
  display: flex;
  flex-direction: column;
}

.tree-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rows {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.row-wrap {
  position: relative;
  display: flex;
  align-items: center;
  padding-left: calc(var(--depth) * 0.9rem);
}

.row {
  flex: 1;
  min-width: 0;
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
  transition: background-color var(--dur-fast), color var(--dur-fast), box-shadow var(--dur-fast);
}

.row-wrap:has(.twisty) .row {
  padding-left: 1.6rem;
}

.name {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.all-icon {
  flex: none;
  font-size: 1.1em;
}

.row b {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}

.row:hover {
  color: var(--ink);
  background: var(--surface);
}

.row.on {
  color: var(--ink);
  background: var(--surface);
  box-shadow: inset 3px 0 0 var(--tag, var(--accent)), 0 0 0 1px var(--line);
}

.row.muted .name {
  font-style: italic;
}

/* Where a drag will land */
.row.drop-into {
  color: var(--ink);
  background: color-mix(in srgb, var(--accent) 14%, var(--surface));
  box-shadow: inset 0 0 0 2px var(--accent);
}

.row.drop-before {
  box-shadow: 0 -3px 0 var(--accent);
}

.row.drop-after {
  box-shadow: 0 3px 0 var(--accent);
}

.twisty {
  position: absolute;
  left: calc(var(--depth) * 0.9rem + 0.25rem);
  z-index: 1;
  width: 1.4rem;
  height: 1.4rem;
  display: grid;
  place-items: center;
  padding: 0;
  color: var(--ink-3);
  background: none;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}

.twisty:hover {
  color: var(--ink);
  background: var(--surface-2);
}

.twisty svg,
.more svg {
  width: 0.95rem;
  height: 0.95rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: rotate var(--dur) var(--ease-out);
}

.twisty[aria-expanded='true'] svg {
  rotate: 90deg;
}

.more {
  position: absolute;
  right: 2rem;
  width: 1.75rem;
  height: 1.75rem;
  display: grid;
  place-items: center;
  padding: 0;
  color: var(--ink-3);
  background: var(--surface);
  border: 0;
  border-radius: 7px;
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--dur-fast);
}

.more svg {
  fill: currentColor;
  stroke: none;
}

.row-wrap:hover .more,
.more:focus-visible {
  opacity: 1;
}

@media (hover: none) {
  .more {
    opacity: 1;
    background: none;
  }
}

.add-folder {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 2.1rem;
  padding: 0.3rem 0.7rem;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ink-2);
  text-align: left;
  background: none;
  border: 1px dashed var(--line);
  border-radius: 10px;
  cursor: pointer;
  transition: color var(--dur-fast), border-color var(--dur-fast);
}

.add-folder span {
  font-size: 1.1rem;
  line-height: 1;
}

.add-folder:hover {
  color: var(--ink);
  border-color: var(--ink-3);
}

.add-folder.top {
  margin-bottom: 0.35rem;
}

.add-folder.bottom {
  margin-top: 0.35rem;
}

.hint {
  margin: 0.6rem 0.5rem 0;
  font-size: var(--text-xs);
  color: var(--ink-3);
}

.phone-toggle {
  display: none;
}

/* Phones: one button showing where you are; the tree opens under it */
@media (max-width: 760px) {
  .phone-toggle {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    min-height: 2.75rem;
    padding: 0 0.9rem;
    font: inherit;
    font-weight: 600;
    color: var(--ink);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
    cursor: pointer;
  }

  .phone-current {
    flex: 1;
    min-width: 0;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chev {
    width: 1.1rem;
    height: 1.1rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: rotate var(--dur) var(--ease-out);
  }

  .phone-open .chev {
    rotate: 180deg;
  }

  .tree-body {
    display: none;
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: var(--surface-2);
    border-radius: 14px;
  }

  .phone-open .tree-body {
    display: flex;
  }

  .row {
    min-height: 2.75rem;
  }

  .hint {
    display: none;
  }
}
</style>
