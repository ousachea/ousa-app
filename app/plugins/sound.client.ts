export default defineNuxtPlugin(() => {
  const { play, unlock, preload } = useSound()

  // Prepare the common sounds while the browser is idle, so the first click doesn't stall
  // while they're built (noticeable on old computers)
  const idle = window.requestIdleCallback ?? ((fn: () => void) => setTimeout(fn, 1500))
  idle(() => preload(['press', 'select', 'start', 'forward', 'back', 'success', 'toggle-on', 'toggle-off', 'open', 'copy', 'delete']))

  // Browsers only allow audio after a real click or key press
  const onFirstInteraction = () => {
    unlock()
    window.removeEventListener('pointerdown', onFirstInteraction)
    window.removeEventListener('keydown', onFirstInteraction)
  }
  window.addEventListener('pointerdown', onFirstInteraction)
  window.addEventListener('keydown', onFirstInteraction)

  // Opening an app (from the home page or the menu) has its own launch sound;
  // other pages pair the directional slide with a matching sound
  const router = useRouter()
  router.afterEach((to, from, failure) => {
    if (failure || !from.name || to.path === from.path) return
    if (TOOLS.some(t => t.to === to.path)) play('start')
    else play(pageRank(to.path) >= pageRank(from.path) ? 'forward' : 'back')
  })
})
