// Search results open their record in place (CHECKLIST.md #06): /bookmarks?focus=<id> scrolls to the
// element marked data-item-id="<id>" once the page has drawn its list, highlights it for a moment,
// then tidies the address. Pages only need to put data-item-id on each row or card.
const WAIT_MS = 4000

function highlight(id: string) {
  const started = performance.now()
  const find = () => {
    const el = document.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(id)}"]`)
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el.classList.remove('found')
      void el.offsetWidth
      el.classList.add('found')
      setTimeout(() => el.classList.remove('found'), 2200)
      return
    }
    if (performance.now() - started < WAIT_MS) requestAnimationFrame(find)
  }
  find()
}

export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  const handle = () => {
    const route = router.currentRoute.value
    const id = route.query.focus
    if (typeof id !== 'string' || !id) return
    const { focus: _, ...rest } = route.query
    router.replace({ query: rest })
    // Let the page transition finish before scrolling
    setTimeout(() => highlight(id), 350)
  }
  router.afterEach(() => nextTick(handle))
  nuxtApp.hook('app:mounted', handle)
})
