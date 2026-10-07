// A panel that opens next to a trigger: dropdown lists, the date picker.
// Uses the Popover API so the panel renders in the top layer, above page content and inside
// native <dialog> popups alike, then places it under the trigger (or above when there's no room).
// Components bind `is-open` (for the entrance animation) and `from-above`/`from-below` from `open` and `placement`.
export function useAnchoredPopover(
  anchor: Ref<HTMLElement | undefined>,
  panel: Ref<HTMLElement | undefined>,
  options: { matchWidth?: boolean, gap?: number } = {}
) {
  const open = ref(false)
  const placement = ref<'below' | 'above'>('below')
  const gap = options.gap ?? 6

  function position() {
    const a = anchor.value
    const p = panel.value
    if (!a || !p) return
    const r = a.getBoundingClientRect()
    if (options.matchWidth) p.style.minWidth = `${r.width}px`
    const height = p.offsetHeight
    const width = p.offsetWidth
    const roomBelow = window.innerHeight - r.bottom - gap
    placement.value = roomBelow < height && r.top > roomBelow ? 'above' : 'below'
    const top = placement.value === 'below' ? r.bottom + gap : Math.max(8, r.top - gap - height)
    // Line up with the trigger's left edge, but never past the right side of the screen
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8)
    p.style.top = `${top}px`
    p.style.left = `${Math.max(8, left)}px`
  }

  function onOutside(e: PointerEvent) {
    const t = e.target as Node
    if (!anchor.value?.contains(t) && !panel.value?.contains(t)) hide()
  }

  function show() {
    const p = panel.value
    if (!p || open.value) return
    open.value = true
    p.showPopover?.()
    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, { capture: true, passive: true })
    document.addEventListener('pointerdown', onOutside, true)
  }

  function hide({ refocus = false } = {}) {
    if (!open.value) return
    open.value = false
    const p = panel.value
    if (p?.matches?.(':popover-open')) p.hidePopover?.()
    window.removeEventListener('resize', position)
    window.removeEventListener('scroll', position, { capture: true })
    document.removeEventListener('pointerdown', onOutside, true)
    if (refocus) anchor.value?.focus()
  }

  onBeforeUnmount(() => hide())

  return { open, placement, show, hide, toggle: () => (open.value ? hide() : show()), position }
}
