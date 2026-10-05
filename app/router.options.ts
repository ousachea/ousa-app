import type { RouterConfig } from 'nuxt/schema'

// Restore the scroll position when going back or forward. Pages slide in and out, so the browser's
// own restore would run while the old page is still on screen; wait for the new page to finish arriving.
export default <RouterConfig>{
  scrollBehavior(to, from, savedPosition) {
    // Same page, only the query changed (e.g. the Passwords tabs): stay where you are
    if (to.path === from.path) return false

    const nuxtApp = useNuxtApp()
    const target = savedPosition ?? (to.hash ? { el: to.hash, top: 96 } : { top: 0 })

    return new Promise((resolve) => {
      let done = false
      const finish = () => {
        if (done) return
        done = true
        // One frame later so content rendered after mount has its height
        requestAnimationFrame(() => resolve(target))
      }
      nuxtApp.hooks.hookOnce('page:transition:finish', finish)
      // Fallback in case no transition runs (e.g. the first visit)
      setTimeout(finish, 700)
    })
  }
}
