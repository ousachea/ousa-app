import { toast } from 'vue-sonner'

// Select several records and act on them together (bookmarks, things, renewals…). Pages keep their
// own rows and actions; this holds the selection and the behaviour every app shares:
// - Select (button), a row's checkbox, or right-click → Select starts it
// - while selecting, a click anywhere on a row picks it instead of opening or editing it
// - Shift-click picks a range; ⌘/Ctrl+A picks everything shown; Delete/Backspace runs onDelete; Esc stops
// - started from a row, unticking the last one stops it again
// - picked records the current filter hides are counted, so actions never surprise
// <BulkBar> shows the count and the actions; <BulkCheck> is the per-row checkbox.

export interface BulkAction {
  label: string
  icon: 'pin' | 'star' | 'move' | 'copy' | 'delete' | 'archive'
  run: () => void
  danger?: boolean
  /** Ask first (with this title) for 10 or more, or when Confirm before delete is on */
  confirm?: string
}

/** Must-confirm size for a batch (prefs can ask for every one) */
const CONFIRM_AT = 10

export interface BulkSelectOptions<T extends { id: string }> {
  /** Every record, so deleted ones drop out of the selection */
  items: Ref<T[]>
  /** What the page shows right now, in order (for Select all, ranges and the hidden count) */
  shown: Ref<T[]>
  /** An element inside the page, to borrow its accent colour for the bar (it's moved to <body>) */
  accentFrom?: Ref<HTMLElement | undefined>
  /** The Delete key while selecting */
  onDelete?: () => void
}

export function useBulkSelect<T extends { id: string }>(opts: BulkSelectOptions<T>) {
  const { prefs } = usePrefs()
  const selecting = ref(false)
  const selected = ref(new Set<string>())
  const accent = ref('')
  let fromRow = false
  let lastPicked: string | undefined

  const selectedItems = computed(() => opts.items.value.filter(r => selected.value.has(r.id)))
  const allShownSelected = computed(() => opts.shown.value.length > 0 && opts.shown.value.every(r => selected.value.has(r.id)))
  const hiddenCount = computed(() => {
    if (!selected.value.size) return 0
    const visible = new Set(opts.shown.value.map(r => r.id))
    return [...selected.value].filter(id => !visible.has(id)).length
  })

  function start(first?: string) {
    const el = opts.accentFrom?.value ?? document.querySelector<HTMLElement>('main.tool .body') ?? undefined
    if (el) accent.value = getComputedStyle(el).getPropertyValue('--accent').trim()
    selecting.value = true
    fromRow = !!first
    selected.value = new Set(first ? [first] : [])
    lastPicked = first
  }

  function stop() {
    selecting.value = false
    selected.value = new Set()
    lastPicked = undefined
  }

  function toggle(id: string, range = false) {
    const next = new Set(selected.value)
    const order = opts.shown.value.map(r => r.id)
    const from = lastPicked ? order.indexOf(lastPicked) : -1
    const to = order.indexOf(id)
    if (range && from >= 0 && to >= 0) {
      const on = !next.has(id)
      for (const x of order.slice(Math.min(from, to), Math.max(from, to) + 1)) {
        if (on) next.add(x)
        else next.delete(x)
      }
    } else if (!next.delete(id)) {
      next.add(id)
    }
    lastPicked = id
    selected.value = next
    if (!next.size && fromRow) stop()
  }

  /** A row's checkbox: starts selecting from that row, or toggles it (Shift for a range) */
  function pick(id: string, e?: MouseEvent) {
    if (!selecting.value) start(id)
    else toggle(id, !!e?.shiftKey)
  }

  /** On a row as @click.capture: while selecting, the click picks the row and goes no further */
  function onRowClick(e: MouseEvent, id: string) {
    if (!selecting.value || (e.target as HTMLElement).closest('.bulk-check, .pick-box')) return
    e.preventDefault()
    // Immediate: some rows open or edit on their own click handler (Gold's purchase cards)
    e.stopImmediatePropagation()
    toggle(id, e.shiftKey)
  }

  // Big batches (or anyone who asked to confirm deletes) are asked first; <BulkBar> shows the dialog
  const confirming = ref<{ title: string, run: () => void } | null>(null)
  function guard(title: string, run: () => void) {
    if (!selected.value.size) return
    if (prefs.confirmDelete || selected.value.size >= CONFIRM_AT) confirming.value = { title, run }
    else run()
  }

  function toggleAll() {
    selected.value = allShownSelected.value ? new Set() : new Set(opts.shown.value.map(r => r.id))
  }

  // Records deleted meanwhile (here or on another device) drop out; nothing left ends it
  watch(opts.items, (list) => {
    if (!list.length && selecting.value) stop()
    if (!selected.value.size) return
    const ids = new Set(list.map(r => r.id))
    const kept = [...selected.value].filter(id => ids.has(id))
    if (kept.length !== selected.value.size) selected.value = new Set(kept)
  })

  // ---------- Keys ----------
  const { menu } = useContextMenu()
  function popupOpen() {
    if (menu.open || document.querySelector('dialog[open]')) return true
    // Dropdowns are native popovers (AppSelect); older browsers don't know :popover-open
    try {
      return !!document.querySelector(':popover-open')
    } catch {
      return false
    }
  }
  function onKey(e: KeyboardEvent) {
    // A dialog, menu or dropdown that's open gets the key first (Esc closes it, not select mode)
    if (!selecting.value || popupOpen()) return
    const typing = (e.target as HTMLElement | null)?.closest('input:not([type=checkbox]), textarea, select, [contenteditable]')
    if (e.key === 'Escape') {
      // Handled here, so the app-wide Esc (go back) leaves the page alone
      e.preventDefault()
      stop()
    } else if (typing) {
      return
    } else if ((e.metaKey || e.ctrlKey) && e.key?.toLowerCase() === 'a') {
      e.preventDefault()
      selected.value = new Set(opts.shown.value.map(r => r.id))
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected.value.size && opts.onDelete) {
      e.preventDefault()
      opts.onDelete()
    }
  }
  // Capture phase: runs before the app-wide shortcuts in FloatingNav
  onMounted(() => window.addEventListener('keydown', onKey, true))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey, true))

  return reactive({
    selecting,
    selected,
    selectedItems,
    allShownSelected,
    hiddenCount,
    accent,
    confirming,
    guard,
    shownCount: computed(() => opts.shown.value.length),
    start,
    stop,
    toggle,
    pick,
    onRowClick,
    toggleAll,
    has: (id: string) => selecting.value && selected.value.has(id)
  })
}

export type BulkSelect = ReturnType<typeof useBulkSelect>

/** Delete several to the Recycle Bin with one Undo for all of them */
export function bulkRemove<T extends { id: string }>(list: T[], remove: (id: string) => T | undefined, restore: (item: T) => void, what: (n: number) => string) {
  const removed = list.map(r => remove(r.id)).filter((r): r is T => !!r)
  if (!removed.length) return
  useSound().play('delete')
  toastDeleted(what(removed.length), () => removed.forEach(r => restore(r)))
}

/** Star several, or unstar them when every one is already starred; one Undo for all */
export function bulkFavourite<T extends { id: string, favorite?: boolean }>(
  list: T[],
  update: (id: string, patch: Partial<T>, opts?: { quiet?: boolean }) => T | undefined,
  replace: (item: T) => void,
  what: (n: number) => string
) {
  const on = !list.every(r => r.favorite)
  const targets = list.filter(r => !!r.favorite !== on)
  if (!targets.length) return
  const before = targets.map(r => update(r.id, { favorite: on } as Partial<T>, { quiet: true })).filter((r): r is T => !!r)
  useSound().play(on ? 'toggle-on' : 'toggle-off')
  toast(`${what(targets.length)} ${on ? 'added to' : 'removed from'} favourites`, {
    action: { label: 'Undo', onClick: () => before.forEach(r => replace(r)) }
  })
}

/** Whether the selection is all starred (the Favourite button then says Unfavourite) */
export const allFavourite = (list: { favorite?: boolean }[]) => list.length > 0 && list.every(r => r.favorite)
