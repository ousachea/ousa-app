// Pull down at the top of a page on a touch screen to refresh its data (CHECKLIST.md #26): re-sync a
// tracker with your account, fetch a fresh rate or gold price. The browser's own pull-to-reload is
// switched off while a page offers this, so a pull refreshes the data instead of reloading the app.
// It's a shortcut only: every page that has it also has a visible way to refresh or works on its own.
const TRIGGER = 72
// Close enough to the top: layout settling or a bounce can leave a few pixels
const atTop = () => window.scrollY <= 8

const state = reactive({ pull: 0, refreshing: false, active: false })

export function usePullState() {
  return readonly(state)
}

export function usePullToRefresh(onRefresh: () => unknown | Promise<unknown>) {
  let startY = 0
  let tracking = false

  function onStart(e: TouchEvent) {
    if (state.refreshing || !atTop() || e.touches.length > 1 || document.querySelector('dialog[open]')) return
    startY = e.touches[0]!.clientY
    tracking = true
  }
  function onMove(e: TouchEvent) {
    if (!tracking) return
    const dy = e.touches[0]!.clientY - startY
    if (dy <= 0 || !atTop()) {
      state.pull = 0
      return
    }
    // Resistance: the further you pull, the slower it follows
    state.pull = Math.min(TRIGGER * 1.6, dy * 0.5)
  }
  async function onEnd() {
    if (!tracking) return
    tracking = false
    if (state.pull >= TRIGGER) {
      state.refreshing = true
      state.pull = TRIGGER
      navigator.vibrate?.(8)
      try {
        await onRefresh()
      } finally {
        state.refreshing = false
        state.pull = 0
      }
    } else {
      state.pull = 0
    }
  }

  onMounted(() => {
    if (!matchMedia('(pointer: coarse)').matches) return
    state.active = true
    document.documentElement.style.overscrollBehaviorY = 'contain'
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
  })
  onBeforeUnmount(() => {
    state.active = false
    state.pull = 0
    document.documentElement.style.overscrollBehaviorY = ''
    window.removeEventListener('touchstart', onStart)
    window.removeEventListener('touchmove', onMove)
    window.removeEventListener('touchend', onEnd)
    window.removeEventListener('touchcancel', onEnd)
  })
}
