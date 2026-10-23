// The breadcrumb trail in the top bar (SiteBar): Ousa’s Apps › the app › wherever you are inside it.
// The bar adds the app (and a tab page like Renewals under Calendar) by itself; an app with levels of
// its own (a folder and its sub-folders in Bookmarks and Notes, a section of Settings) hands over the
// rest with useBreadcrumbTrail. Each step takes you back up to it; the last is where you are.
// Browser-only: the trail comes from what's open on this device, and holds functions.

export interface Crumb {
  label: string
  /** Go up to this level; the last crumb (where you are) has none */
  go?: () => void
}

const trail = shallowRef<Crumb[]>([])
// Clicking the app's own crumb: back to the app's top level (All bookmarks, All notes…)
const root = shallowRef<(() => void) | undefined>()
// A view laid over the whole app (its settings page) shows its own trail instead of the page's, without
// the page losing its: when the view closes, the folder you were in is back in the bar
const override = shallowRef<{ crumbs: Crumb[], root?: () => void }>()

export function useBreadcrumbs() {
  return {
    trail: computed(() => override.value?.crumbs ?? trail.value),
    root: computed(() => (override.value ? override.value.root : root.value))
  }
}

/** For a view over the whole app: its trail, and what the app's crumb does, while it returns one */
export function useBreadcrumbOverride(get: () => { crumbs: Crumb[], root?: () => void } | undefined) {
  if (import.meta.server) return
  onMounted(() => watchEffect(() => (override.value = get())))
  onBeforeUnmount(() => (override.value = undefined))
}

/** The page's levels below the app, kept up to date while the page is open */
export function useBreadcrumbTrail(crumbs: () => Crumb[], onRoot?: () => void) {
  if (import.meta.server) return
  onMounted(() => {
    root.value = onRoot
    watchEffect(() => (trail.value = crumbs()))
  })
  onBeforeUnmount(() => {
    trail.value = []
    root.value = undefined
  })
}
