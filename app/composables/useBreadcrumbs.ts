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

export function useBreadcrumbs() {
  return { trail: readonly(trail), root: readonly(root) }
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
