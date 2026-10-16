// Run a state change (switch view, tab, filter or sort) as a smooth cross-fade instead of a jump
// (CHECKLIST.md #03), using the browser's View Transitions API. Falls back to an instant change where
// it isn't supported, when motion is reduced (system or Settings), on lite effects, or in a hidden tab.
export function viewTransition(update: () => unknown) {
  if (import.meta.server) return void update()
  const root = document.documentElement
  const still = !document.startViewTransition
    || root.dataset.motion === 'reduced'
    || root.dataset.effects === 'lite'
    || document.visibilityState !== 'visible'
    || matchMedia('(prefers-reduced-motion: reduce)').matches
  if (still) return void update()
  document.startViewTransition(async () => {
    await update()
    await nextTick()
  })
}

// The same, for a v-model: `const view = smoothRef(useRemembered('x-view', 'list'))`. Only changes
// made through the returned ref cross-fade; the source's own updates (like a saved choice loading) don't.
export function smoothRef<T>(source: Ref<T>): WritableComputedRef<T> {
  return computed({
    get: () => source.value,
    set: v => v === source.value || viewTransition(() => (source.value = v))
  })
}
