// v-swipe-delete="() => del(item)": on a touch screen, swipe a row to the left to delete it
// (CHECKLIST.md #26). The row follows the finger and a red strip with a bin shows behind it; past
// THRESHOLD it slides away and the callback runs (which moves it to the Recycle Bin with Undo).
// Vertical scrolling is never blocked, and the row's own Delete button stays: this is only a shortcut.
const THRESHOLD = 0.38 // of the row's width
const LOCK_PX = 12

interface SwipeState {
  run: () => void
  startX: number
  startY: number
  dx: number
  mode: 'idle' | 'maybe' | 'swiping' | 'scrolling'
  id: number
}

const rows = new WeakMap<HTMLElement, SwipeState>()

function setOffset(el: HTMLElement, dx: number, animate = false) {
  el.style.transition = animate ? 'translate 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none'
  el.style.translate = dx ? `${dx}px 0` : ''
  el.style.setProperty('--swipe-w', `${Math.max(0, -dx)}px`)
  el.classList.toggle('swiping', dx < 0)
  el.classList.toggle('swipe-armed', -dx > el.offsetWidth * THRESHOLD)
}

function onDown(e: PointerEvent) {
  if (e.pointerType !== 'touch') return
  const el = e.currentTarget as HTMLElement
  const s = rows.get(el)
  if (!s) return
  Object.assign(s, { startX: e.clientX, startY: e.clientY, dx: 0, mode: 'maybe', id: e.pointerId })
}

function onMove(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement
  const s = rows.get(el)
  if (!s || s.id !== e.pointerId || s.mode === 'idle' || s.mode === 'scrolling') return
  const dx = e.clientX - s.startX
  const dy = e.clientY - s.startY
  if (s.mode === 'maybe') {
    if (Math.abs(dy) > LOCK_PX && Math.abs(dy) > Math.abs(dx)) {
      s.mode = 'scrolling'
      return
    }
    if (dx < -LOCK_PX && Math.abs(dx) > Math.abs(dy) * 1.4) {
      s.mode = 'swiping'
      el.setPointerCapture(e.pointerId)
    } else {
      return
    }
  }
  // Only to the left; a little resistance past the threshold
  const width = el.offsetWidth
  const raw = Math.min(0, dx)
  s.dx = -raw > width * 0.6 ? -(width * 0.6 + (-raw - width * 0.6) * 0.3) : raw
  setOffset(el, s.dx)
}

function onUp(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement
  const s = rows.get(el)
  if (!s || s.id !== e.pointerId) return
  const wasSwiping = s.mode === 'swiping'
  s.mode = 'idle'
  if (!wasSwiping) return
  // A swipe isn't a tap: don't also open the link under the finger
  el.addEventListener('click', ev => ev.preventDefault(), { capture: true, once: true })
  if (-s.dx > el.offsetWidth * THRESHOLD) {
    setOffset(el, -el.offsetWidth, true)
    navigator.vibrate?.(10)
    setTimeout(() => {
      s.run()
      // If the row is still here (e.g. Undo put it back), make sure it looks normal
      setOffset(el, 0)
    }, 200)
  } else {
    setOffset(el, 0, true)
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive<HTMLElement, () => void>('swipe-delete', {
    mounted(el, { value }) {
      rows.set(el, { run: value, startX: 0, startY: 0, dx: 0, mode: 'idle', id: -1 })
      el.classList.add('swipe-row')
      el.addEventListener('pointerdown', onDown)
      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUp)
      el.addEventListener('pointercancel', onUp)
    },
    updated(el, { value }) {
      const s = rows.get(el)
      if (s) s.run = value
    },
    unmounted(el) {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      rows.delete(el)
    },
    getSSRProps: () => ({ class: 'swipe-row' })
  })
})
