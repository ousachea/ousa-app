// Touch screens: drag items onto a folder by their grip (FolderDropTray shows the folders to drop on).
// The browser's own drag and drop doesn't work with fingers, so this follows the pointer itself and
// finds the folder under it with [data-drop-folder]. A mouse keeps the native drag (FolderTree).
//
//   const touchDrag = useTouchItemDrag((ids, folderId) => …)
//   <button class="grip" @pointerdown="touchDrag.start($event, ids, label)">
export function useTouchItemDrag(onDrop: (ids: string[], folderId: string) => void) {
  const drag = reactive({
    active: false,
    ids: [] as string[],
    label: '',
    /** The app's colour, read off the grip: the tray is teleported outside the page that sets it */
    accent: '',
    x: 0,
    y: 0,
    over: undefined as string | undefined
  })
  // Near the top or bottom of the tray's list it scrolls, so long folder lists are all reachable
  let scroller: HTMLElement | null = null
  let raf = 0

  function folderAt(x: number, y: number) {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    scroller = el?.closest<HTMLElement>('[data-drop-scroll]') ?? null
    return el?.closest<HTMLElement>('[data-drop-folder]')?.dataset.dropFolder
  }

  function autoScroll() {
    raf = 0
    if (!drag.active || !scroller) return
    const r = scroller.getBoundingClientRect()
    const edge = 40
    const step = drag.y < r.top + edge ? -8 : drag.y > r.bottom - edge ? 8 : 0
    if (!step) return
    scroller.scrollTop += step
    drag.over = folderAt(drag.x, drag.y)
    raf = requestAnimationFrame(autoScroll)
  }

  function start(e: PointerEvent, ids: string[], label: string) {
    if (e.pointerType === 'mouse' || !ids.length) return
    e.stopPropagation()
    const handle = e.currentTarget as HTMLElement
    const sx = e.clientX
    const sy = e.clientY
    handle.setPointerCapture(e.pointerId)

    const move = (ev: PointerEvent) => {
      if (!drag.active) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return
        Object.assign(drag, { active: true, ids, label, accent: getComputedStyle(handle).getPropertyValue('--accent').trim() })
        navigator.vibrate?.(8)
        useSound().play('open')
      }
      drag.x = ev.clientX
      drag.y = ev.clientY
      drag.over = folderAt(ev.clientX, ev.clientY)
      if (!raf) raf = requestAnimationFrame(autoScroll)
    }
    const end = (ev: PointerEvent) => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', end)
      handle.removeEventListener('pointercancel', end)
      const target = ev.type === 'pointerup' && drag.active ? drag.over : undefined
      const moved = [...drag.ids]
      Object.assign(drag, { active: false, ids: [], over: undefined })
      if (target) onDrop(moved, target)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', end)
    handle.addEventListener('pointercancel', end)
  }

  return { drag: readonly(drag), start }
}
