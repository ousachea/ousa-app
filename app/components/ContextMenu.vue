<script setup lang="ts">
import type { MenuItem } from '~/composables/useContextMenu'
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

const TOOL_ICONS = new Set(['trash', 'activity', 'plus', 'search', 'renewals', 'bookmarks', 'things', 'countdown'])
const isToolIcon = (i?: string): i is ToolIconName => !!i && TOOL_ICONS.has(i)

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
              <svg v-else-if="item.icon" viewBox="0 0 24 24">
                <path v-if="item.icon === 'open'" d="M5 12h14M13 6l6 6-6 6" />
                <path v-else-if="item.icon === 'new-tab'" d="M14 5h5v5M19 5l-8 8M17 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4" />
                <path v-else-if="item.icon === 'edit'" d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4" />
                <path v-else-if="item.icon === 'copy'" d="M9 9h10v10H9zM5 15V5h10" />
                <path v-else-if="item.icon === 'duplicate'" d="M8 8h11v11H8zM5 16V5h11M13.5 11v5M11 13.5h5" />
                <path v-else-if="item.icon === 'delete'" d="M4.5 7h15M10 7V4.5h4V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5" />
                <path v-else-if="item.icon === 'restore'" d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4" />
                <path v-else-if="item.icon === 'refresh'" d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4h-4" />
                <path v-else-if="item.icon === 'folder'" d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
                <path v-else-if="item.icon === 'pin'" d="M9 4h6l-1 5 3 3v2H7v-2l3-3zM12 14v6" />
                <path v-else-if="item.icon === 'select'" d="M6 4.5h12A1.5 1.5 0 0 1 19.5 6v12a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5zM8.5 12l2.5 2.5 4.5-5" />
                <path v-else-if="item.icon === 'calendar'" d="M4 6.5h16v13H4zM4 10.5h16M8.5 4v4M15.5 4v4" />
                <path v-else-if="item.icon === 'star'" d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z" />
              </svg>
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
  border-radius: 14px;
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
  font-size: 0.925rem;
  text-align: left;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 9px;
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
  font-size: 1.1rem;
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
  bottom: max(0.5rem, env(safe-area-inset-bottom));
  max-width: 34rem;
  margin: 0 auto;
  padding: 0.5rem;
  border-radius: 20px;
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
  font-size: 1rem;
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
