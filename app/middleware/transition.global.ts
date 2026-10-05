// Slide pages left when moving "forward" through the app (home → tools, in menu order)
// and right when going back, so navigation has a sense of direction.
export default defineNuxtRouteMiddleware((to, from) => {
  if (import.meta.server || to.path === from.path) return

  const name = pageRank(to.path) >= pageRank(from.path) ? 'slide-forward' : 'slide-back'
  to.meta.pageTransition = { name, mode: 'out-in' }
  from.meta.pageTransition = { name, mode: 'out-in' }
})
