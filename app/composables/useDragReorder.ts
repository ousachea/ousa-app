// Drag to reorder (CHECKLIST.md #28): native drag and drop with a line showing where it will land.
// Keyboard: focus an item and press Alt + arrow keys to move it. Touch screens keep their own ways
// (menus, buttons), since dragging fights with scrolling there.
//
//   const reorder = useDragReorder({ keyOf: b => b.id, onMove: (from, to) => … })
//   <li v-for="(b, i) in list" v-bind="reorder.bind(b, i)">
export function useDragReorder<T>(opts: {
  keyOf: (item: T) => string
  onMove: (from: number, to: number) => void
  /** Items flow left to right (a row of tiles) or top to bottom */
  axis?: 'x' | 'y'
}) {
  const dragging = ref<string>()
  const over = ref<{ key: string, side: 'before' | 'after' }>()
  let fromIndex = -1
  const axis = opts.axis ?? 'y'

  function sideOf(e: DragEvent): 'before' | 'after' {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    return axis === 'x'
      ? (e.clientX < r.left + r.width / 2 ? 'before' : 'after')
      : (e.clientY < r.top + r.height / 2 ? 'before' : 'after')
  }

  function bind(item: T, index: number) {
    const key = opts.keyOf(item)
    return {
      'draggable': 'true',
      'data-drop': over.value?.key === key ? over.value.side : undefined,
      'class': { 'is-dragging': dragging.value === key },
      'aria-keyshortcuts': 'Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight',
      onDragstart(e: DragEvent) {
        fromIndex = index
        dragging.value = key
        e.dataTransfer?.setData('text/plain', key)
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
      },
      onDragover(e: DragEvent) {
        if (!dragging.value) return
        e.preventDefault()
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
        over.value = dragging.value === key ? undefined : { key, side: sideOf(e) }
      },
      onDragleave(e: DragEvent) {
        if (over.value?.key === key && !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) over.value = undefined
      },
      onDrop(e: DragEvent) {
        e.preventDefault()
        const side = sideOf(e)
        if (fromIndex !== -1 && dragging.value !== key) {
          let to = side === 'after' ? index + 1 : index
          if (fromIndex < to) to -= 1
          if (to !== fromIndex) {
            opts.onMove(fromIndex, to)
            useSound().play('select')
          }
        }
        dragging.value = undefined
        over.value = undefined
      },
      onDragend() {
        dragging.value = undefined
        over.value = undefined
        fromIndex = -1
      },
      onKeydown(e: KeyboardEvent) {
        if (!e.altKey) return
        const back = e.key === 'ArrowUp' || e.key === 'ArrowLeft'
        const fwd = e.key === 'ArrowDown' || e.key === 'ArrowRight'
        if (!back && !fwd) return
        e.preventDefault()
        opts.onMove(index, index + (fwd ? 1 : -1))
        useSound().play('select')
        // Keep focus on the moved item once it re-renders in its new place
        const el = e.currentTarget as HTMLElement
        nextTick(() => el.focus())
      }
    }
  }

  return { bind, dragging, over }
}

/** Move one entry of an array, returning a new array */
export function moved<T>(list: readonly T[], from: number, to: number) {
  const next = [...list]
  if (from < 0 || from >= next.length) return next
  const [item] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(next.length, to)), 0, item!)
  return next
}
