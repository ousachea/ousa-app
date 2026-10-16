// Remembers the page the visitor just left, so the home page can light up the app they came back from
export default defineNuxtRouteMiddleware((to, from) => {
  if (import.meta.server || to.path === from.path) return
  useState<string | null>('came-from').value = from.path
})
