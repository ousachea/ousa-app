// Demo mode for a page: the app's icon in the header switches it on and off.
// While it's on, the page shows sample data and nothing is saved, so people can try an app
// before typing anything in. It always switches off when you leave the page.

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

  onBeforeUnmount(() => {
    active.value = false
    supported.value = false
  })

  return { active }
}
