<script setup lang="ts">
import type { MenuIcon, MenuItem } from '~/composables/useContextMenu'
import type { ToolIconName } from '~/utils/tools'

// The app's right-click / long-press menu (useContextMenu, CHECKLIST.md #26, #27).
// Desktop: a small menu at the pointer, kept on screen. Touch: a sheet from the bottom with big rows.
// Keyboard: arrows move, Enter picks, Esc closes; focus goes back where it was.
const { menu, closeMenu } = useContextMenu()
const { play } = useSound()
const route = useRoute()
const panel = ref<HTMLElement>()
const pos = reactive({ left: 0, top: 0 })
let returnFocus: HTMLElement | null = null

const items = computed(() => menu.items)
const actionable = computed(() => items.value.filter((i): i is MenuItem => i !== '-' && !i.disabled))

// Any icon that isn't one of the menu's own (below) is an app icon (ToolIcon: list, trash, plus…).
// Checking against a short list of app icons instead left out ones like 'list' (Save as template),
// and the missing icon broke the whole menu.
const isToolIcon = (i?: string): i is ToolIconName => !!i && !(i in MENU_ICONS)
// The menu's own icons, from the shared icon library
const MENU_ICONS: Record<MenuIcon, string> = {
  'open': 'lucide:arrow-right', 'new-tab': 'lucide:external-link', 'edit': 'lucide:pencil', 'copy': 'lucide:copy',
  'duplicate': 'lucide:copy-plus', 'delete': 'lucide:trash-2', 'restore': 'lucide:rotate-ccw', 'refresh': 'lucide:rotate-cw',
  'folder': 'lucide:folder', 'pin': 'lucide:pin', 'calendar': 'lucide:calendar', 'star': 'lucide:star', 'select': 'lucide:square-check', 'share': 'lucide:share-2'
}

watch(() => menu.open, async (open) => {
  if (!open) {
    returnFocus?.focus?.({ preventScroll: true })
    returnFocus = null
    return
  }
  returnFocus = document.activeElement as HTMLElement | null
  await nextTick()
  const el = panel.value
  if (!el) return
  if (!menu.sheet) {
    // Keep the whole menu on screen, flipping left/up near the edges
    const { width, height } = el.getBoundingClientRect()
    const pad = 8
    pos.left = Math.min(menu.x, window.innerWidth - width - pad)
    pos.top = menu.y + height > window.innerHeight - pad ? Math.max(pad, menu.y - height) : menu.y
  }
  el.querySelector<HTMLElement>('[role=menuitem]:not([aria-disabled=true])')?.focus({ preventScroll: true })
})

function run(item: MenuItem) {
  if (item.disabled) return
  closeMenu()
  play(item.danger ? 'delete' : 'select')
  item.run()
}

function onKey(e: KeyboardEvent) {
  const buttons = [...(panel.value?.querySelectorAll<HTMLElement>('[role=menuitem]:not([aria-disabled=true])') ?? [])]
  const i = buttons.indexOf(document.activeElement as HTMLElement)
  if (e.key === 'ArrowDown') buttons[(i + 1) % buttons.length]?.focus()
  else if (e.key === 'ArrowUp') buttons[(i - 1 + buttons.length) % buttons.length]?.focus()
  else if (e.key === 'Home') buttons[0]?.focus()
  else if (e.key === 'End') buttons.at(-1)?.focus()
  else if (e.key === 'Escape' || e.key === 'Tab') closeMenu()
  else return
  e.preventDefault()
  e.stopPropagation()
}

// Anything else happening closes it
function onPointerDown(e: PointerEvent) {
  if (menu.open && !panel.value?.contains(e.target as Node)) closeMenu()
}
const onScroll = () => {
  if (menu.open && !menu.sheet) closeMenu()
}
watch(() => route.fullPath, () => closeMenu())
onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown, true)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', closeMenu)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown, true)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', closeMenu)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="menu.open && menu.sheet" class="sheet-backdrop" aria-hidden="true" />
    </Transition>
    <Transition :name="menu.sheet ? 'sheet' : 'pop'">
      <div
        v-if="menu.open"
        ref="panel"
        class="context-menu"
        :class="{ sheet: menu.sheet }"
        role="menu"
        :aria-label="menu.title || 'Actions'"
        :style="menu.sheet ? undefined : { left: `${pos.left}px`, top: `${pos.top}px` }"
        @keydown="onKey"
        @contextmenu.prevent
      >
        <p v-if="menu.title && menu.sheet" class="title">{{ menu.title }}</p>
        <template v-for="(item, i) in items" :key="i">
          <hr v-if="item === '-'" role="separator">
          <button
            v-else
            type="button"
            role="menuitem"
            class="item"
            :class="{ danger: item.danger }"
            :aria-disabled="item.disabled || undefined"
            tabindex="-1"
            @click="run(item)"
          >
            <span class="icon" aria-hidden="true">
              <ToolIcon v-if="isToolIcon(item.icon)" :name="item.icon" />
              <AppIcon v-else-if="item.icon" :name="MENU_ICONS[item.icon]" />
            </span>
            <span class="label">{{ item.label }}</span>
            <kbd v-if="item.hint && !menu.sheet">{{ item.hint }}</kbd>
          </button>
        </template>
        <button v-if="menu.sheet" type="button" class="item cancel" role="menuitem" tabindex="-1" @click="closeMenu()">Cancel</button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 300;
  min-width: 13rem;
  max-width: min(20rem, calc(100vw - 1rem));
  padding: 0.3rem;
  color: var(--ink);
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: 0 18px 40px -12px rgb(var(--shadow) / 0.4), 0 0 0 1px var(--line);
  transform-origin: top left;
}

.item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 2.25rem;
  padding: 0.3rem 0.6rem;
  font: inherit;
  font-size: var(--text-base);
  text-align: left;
  color: inherit;
  background: none;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.item:hover,
.item:focus-visible {
  background: var(--surface-2);
  outline: none;
}

.item[aria-disabled='true'] {
  opacity: 0.45;
  cursor: default;
}

.item.danger {
  color: var(--bad-ink);
}

.item.danger:hover,
.item.danger:focus-visible {
  background: color-mix(in srgb, var(--red) 10%, var(--surface));
}

.icon {
  flex: none;
  width: 1.1rem;
  height: 1.1rem;
  display: grid;
  place-items: center;
  font-size: var(--text-title);
  color: var(--ink-2);
}

.danger .icon {
  color: inherit;
}

.icon svg {
  width: 100%;
  height: 100%;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.9;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

kbd {
  margin-left: 0.75rem;
}

hr {
  margin: 0.3rem 0.4rem;
  border: 0;
  border-top: 1px solid var(--line);
}

/* ---------- Touch: a sheet from the bottom ---------- */
.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 299;
  background: rgb(var(--shadow) / 0.35);
}

.context-menu.sheet {
  left: 0.5rem;
  right: 0.5rem;
  bottom: calc(max(0.5rem, env(safe-area-inset-bottom)) + var(--dock-lift));
  max-width: 34rem;
  margin: 0 auto;
  padding: 0.5rem;
  border-radius: var(--radius-xl);
  transform-origin: bottom center;
}

.sheet .title {
  margin: 0.3rem 0.75rem 0.5rem;
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet .item {
  min-height: 3rem;
  font-size: var(--text-md);
  padding-inline: 0.85rem;
}

.sheet .cancel {
  justify-content: center;
  margin-top: 0.3rem;
  font-weight: 700;
  background: var(--surface-2);
}

.sheet-enter-active {
  transition: translate var(--dur-slow) var(--ease-out), opacity var(--dur) var(--ease-out);
}

.sheet-leave-active {
  transition: translate var(--dur) var(--ease-in), opacity var(--dur-fast) var(--ease-in);
}

.sheet-enter-from,
.sheet-leave-to {
  translate: 0 100%;
  opacity: 0;
}
</style>
