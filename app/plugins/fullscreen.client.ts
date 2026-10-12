// Full screen by default on phones (Settings → Full screen on phones). Browsers only allow full screen
// from a tap, so it starts with the first tap anywhere on the page, and the tap still does what it was
// for. Leaving full screen (the back gesture, or the menu's button) keeps it off until the next visit
// instead of fighting you. iPhone Safari has no full screen for pages; installed to the home screen,
// the app already fills the screen there. Installed on Android, the manifest opens it full screen.
const OPTED_OUT = 'ousa-app:fullscreen-off'

export default defineNuxtPlugin(() => {
  const root = document.documentElement
  if (!root.requestFullscreen || !document.fullscreenEnabled) return
  const phone = () => matchMedia('(hover: none) and (pointer: coarse)').matches
  // Already full screen as an installed app
  const installed = () => matchMedia('(display-mode: fullscreen)').matches
  const optedOut = () => {
    try {
      return sessionStorage.getItem(OPTED_OUT) === '1'
    } catch {
      return false
    }
  }

  const { prefs } = usePrefs()
  let entered = false

  function onTap(e: Event) {
    // The menu's own full screen button does this itself
    if ((e.target as Element | null)?.closest?.('[data-fullscreen-toggle]')) return
    if (!prefs.phoneFullscreen || !phone() || installed() || optedOut() || document.fullscreenElement) return
    root.requestFullscreen({ navigationUI: 'hide' }).then(() => (entered = true)).catch(() => {})
  }

  // touchend and click both count as a tap the browser lets open full screen
  document.addEventListener('touchend', onTap, { capture: true, passive: true })
  document.addEventListener('click', onTap, { capture: true })

  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement || !entered) return
    // Left full screen on purpose: stay out for the rest of this visit
    entered = false
    try {
      sessionStorage.setItem(OPTED_OUT, '1')
    } catch {}
  })
})
