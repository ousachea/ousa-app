<script setup lang="ts">
import type { Folder } from '~/utils/folders'

// While a finger drags an item by its grip (useTouchItemDrag): the folders slide up from the bottom
// to drop it on, and a chip under the finger says what's moving. The sidebar is folded away on
// phones, so the tray brings the folders to the finger instead.
const props = defineProps<{
  drag: { active: boolean, label: string, accent: string, x: number, y: number, over?: string }
  folders: readonly Folder[]
  /** Offer "Not in a folder" as a target too */
  unfiled?: boolean
}>()

const rows = computed(() => flatTree(props.folders))
</script>

<template>
  <Teleport to="body">
    <Transition name="tray">
      <div v-if="drag.active" class="drop-tray" :style="{ '--accent': drag.accent || undefined }" role="status" aria-live="polite">
        <p class="tray-head">Drop on a folder to move {{ drag.label }}</p>
        <ul class="tray-list" data-drop-scroll>
          <li
            v-for="r in rows"
            :key="r.folder.id"
            class="tray-folder"
            :class="{ over: drag.over === r.folder.id }"
            :style="{ '--depth': r.depth, '--tag': folderColor(r.folder) }"
            :data-drop-folder="r.folder.id"
          >
            <FolderIcon :icon="r.folder.icon" :color="r.folder.color" />{{ r.folder.name }}
          </li>
          <li v-if="unfiled" class="tray-folder muted" :class="{ over: drag.over === UNFILED }" :data-drop-folder="UNFILED">
            Not in a folder
          </li>
        </ul>
      </div>
    </Transition>
    <div v-if="drag.active" class="drag-chip" :style="{ 'translate': `${drag.x}px ${drag.y}px`, '--accent': drag.accent || undefined }" aria-hidden="true">
      {{ drag.label }}
    </div>
  </Teleport>
</template>

<style scoped>
.drop-tray {
  position: fixed;
  z-index: 60;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 55dvh;
  display: flex;
  flex-direction: column;
  padding: 0.9rem 1rem calc(1rem + env(safe-area-inset-bottom));
  background: var(--surface);
  border-radius: 20px 20px 0 0;
  box-shadow: 0 -10px 40px rgb(var(--shadow) / 0.22), 0 0 0 1px var(--line);
}

.tray-head {
  margin: 0 0 0.6rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ink-2);
  text-align: center;
}

.tray-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.tray-folder {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-height: 3rem;
  padding: 0 0.9rem 0 calc(0.9rem + var(--depth, 0) * 1.1rem);
  font-weight: 600;
  border: 2px dashed var(--line);
  border-radius: 12px;
  transition: background-color 0.12s, border-color 0.12s, scale 0.12s;
}

.tray-folder.muted {
  color: var(--ink-2);
}

.tray-folder.over {
  border-style: solid;
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 14%, var(--surface));
  scale: 1.02;
}

/* Follows the finger, a little above it so the finger doesn't hide it */
.drag-chip {
  position: fixed;
  z-index: 61;
  top: 0;
  left: 0;
  max-width: 14rem;
  margin: -3.2rem 0 0 -1rem;
  padding: 0.45rem 0.8rem;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--on-accent, #fff);
  background: var(--accent);
  border-radius: 999px;
  box-shadow: 0 6px 18px rgb(var(--shadow) / 0.3);
  pointer-events: none;
}

.tray-enter-active,
.tray-leave-active {
  transition: translate 0.22s cubic-bezier(0.2, 0, 0, 1), opacity 0.22s;
}

.tray-enter-from,
.tray-leave-to {
  translate: 0 100%;
  opacity: 0;
}
</style>
