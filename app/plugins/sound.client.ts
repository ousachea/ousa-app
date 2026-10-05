export default defineNuxtPlugin(() => {
  const { play, unlock } = useSound()

  // Browsers only allow audio after a real click or key press
  const onFirstInteraction = () => {
    unlock()
    window.removeEventListener('pointerdown', onFirstInteraction)
    window.removeEventListener('keydown', onFirstInteraction)
  }
  window.addEventListener('pointerdown', onFirstInteraction)
  window.addEventListener('keydown', onFirstInteraction)

  // Pair the directional page slide with a matching sound
  const router = useRouter()
  router.afterEach((to, from, failure) => {
    if (failure || !from.name || to.path === from.path) return
    play(pageRank(to.path) >= pageRank(from.path) ? 'forward' : 'back')
  })
})
