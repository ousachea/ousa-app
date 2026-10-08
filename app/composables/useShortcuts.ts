// Shared keyboard behaviour (CHECKLIST.md #04). FloatingNav listens for the keys; pages say what they mean.
//
// A: the current page's Add action (registered with useAddAction), or Quick Add where a page has none.
// Enter submits forms (native), Esc closes popups and menus, then goes back.
// Single-letter shortcuts never fire while typing, and can be switched off in Settings.

/** Keys typed into these go into the field, not to the shortcuts */
export function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  return target instanceof HTMLInputElement
    && ['text', 'tel', 'search', 'email', 'url', 'password', 'number', 'date', 'time'].includes(target.type)
}

const addAction = shallowRef<(() => void) | null>(null)

/** Register what A (and Quick Add for this app) does on this page, e.g. open the Add popup */
export function useAddAction(fn: () => void) {
  onMounted(() => (addAction.value = fn))
  onBeforeUnmount(() => {
    if (addAction.value === fn) addAction.value = null
  })
}

/** Run the page's Add action; false when the page has none */
export function runAddAction() {
  if (!addAction.value) return false
  addAction.value()
  return true
}

/** Focus a field and bring it into view: the Add action on pages whose form is always on screen */
export function focusField(el: HTMLElement | null | undefined) {
  if (!el) return
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  el.focus({ preventScroll: true })
}
