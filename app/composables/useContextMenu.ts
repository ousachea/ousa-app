// One context menu for the whole app (components/ContextMenu.vue, CHECKLIST.md #26, #27).
// Right-click on desktop opens it at the pointer; a long press on a touch screen opens it as a sheet
// from the bottom. Every action in it is also available from a visible button, so it's a shortcut, never
// the only way.
import type { ToolIconName } from '~/utils/tools'

export interface MenuItem {
  label: string
  /** Line drawn in the menu's own icon set; see ContextMenu.vue */
  icon?: MenuIcon | ToolIconName
  /** Shown on the right, e.g. "E" */
  hint?: string
  danger?: boolean
  disabled?: boolean
  run: () => void
}

export type MenuIcon = 'open' | 'new-tab' | 'edit' | 'copy' | 'duplicate' | 'delete' | 'restore' | 'refresh' | 'folder' | 'pin' | 'calendar' | 'star'

/** Items, or `'-'` for a divider */
export type MenuEntry = MenuItem | '-'

const state = reactive({
  open: false,
  x: 0,
  y: 0,
  sheet: false,
  title: '',
  items: [] as MenuEntry[]
})

export function useContextMenu() {
  return {
    menu: readonly(state),
    /** Open at a mouse event (right-click), or as a bottom sheet for touch */
    openMenu(e: { clientX: number, clientY: number } | null, items: MenuEntry[], title = '') {
      state.items = items
      state.title = title
      state.sheet = !e
      state.x = e?.clientX ?? 0
      state.y = e?.clientY ?? 0
      state.open = true
    },
    closeMenu() {
      state.open = false
    }
  }
}

// One long press at a time: where it started, its timer, and whether it already opened the menu
const press = { timer: 0 as ReturnType<typeof setTimeout> | 0, x: 0, y: 0, fired: false }
const LONG_PRESS_MS = 480

/**
 * Right-click and long-press handlers for a row: `v-bind="menuFor(() => items, title)"`.
 * Shift + right-click keeps the browser's own menu (handy on links). A long press opens the sheet on
 * every touch screen (iPhone Safari never sends contextmenu); moving the finger, i.e. scrolling, cancels it.
 */
export function useRowMenu() {
  const { openMenu } = useContextMenu()
  return (items: () => MenuEntry[], title = '') => ({
    onContextmenu(e: MouseEvent) {
      if (e.shiftKey) return
      e.preventDefault()
      if (press.fired) return // already opened by the long press
      openMenu(matchMedia('(pointer: coarse)').matches ? null : e, items(), title)
    },
    onTouchstart(e: TouchEvent) {
      const t = e.touches[0]
      if (!t || e.touches.length > 1) return
      press.fired = false
      press.x = t.clientX
      press.y = t.clientY
      clearTimeout(press.timer || undefined)
      press.timer = setTimeout(() => {
        press.fired = true
        navigator.vibrate?.(8)
        useSound().play('open')
        openMenu(null, items(), title)
      }, LONG_PRESS_MS)
    },
    onTouchmove(e: TouchEvent) {
      const t = e.touches[0]
      if (t && Math.hypot(t.clientX - press.x, t.clientY - press.y) > 10) clearTimeout(press.timer || undefined)
    },
    onTouchend(e: TouchEvent) {
      clearTimeout(press.timer || undefined)
      // The finger lifting after a long press mustn't also tap whatever is under it
      if (press.fired) e.preventDefault()
    },
    onTouchcancel() {
      clearTimeout(press.timer || undefined)
    }
  })
}
