// Demo mode for a page: the app's icon in the header switches it on and off.
// While it's on, the page shows sample data and nothing is saved, so people can try an app
// before typing anything in. It always switches off when you leave the page.
// Signed out (useSignInGate) it stays on, so an app shows its example instead of your data until you sign in.

const keyFor = (path: string) => `demo:${path}`

/** For the page header: whether this page has a demo, and whether it's on */
export function useDemoState(path: string) {
  return {
    supported: useState<boolean>(`${keyFor(path)}:supported`, () => false),
    active: useState<boolean>(keyFor(path), () => false)
  }
}

/** Call from a page (or useCollection) to give it a demo */
export function useDemo() {
  const path = useRoute().path
  const { supported, active } = useDemoState(path)
  supported.value = true

  // Locked: on, and nothing switches it off. Signing in brings your own data back.
  const gate = useSignInGate()
  const gated = isGatedPage(path)
  watch(gate.state, (state, before) => {
    if (state === 'locked' && gated) active.value = true
    else if (state === 'open' && before === 'locked' && gated) active.value = false
  }, { immediate: true })
  // (supported goes false first when the page closes, so leaving still switches it off)
  watch(active, (on) => {
    if (!on && supported.value && gated && gate.state.value === 'locked') active.value = true
  }, { flush: 'sync' })

  onBeforeUnmount(() => {
    supported.value = false
    active.value = false
  })

  return { active }
}
