import { toast } from 'vue-sonner'

// Installable app and offline support (CHECKLIST.md #20). The service worker (public/sw.js) only runs
// in production builds; in development it would fight hot reloading.
export default defineNuxtPlugin(() => {
  if (import.meta.dev || !('serviceWorker' in navigator)) return

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      // A new version finished downloading while the app was open: offer to switch
      reg.addEventListener('updatefound', () => {
        const next = reg.installing
        next?.addEventListener('statechange', () => {
          if (next.state === 'installed' && navigator.serviceWorker.controller) {
            toast('A new version is ready', { description: 'Reload to get the latest.', duration: Infinity, action: { label: 'Reload', onClick: () => location.reload() } })
          }
        })
      })
    } catch {}
  })

  // Ask the browser to keep this site's data even when the device runs low on space,
  // once there's something worth keeping
  const persist = () => navigator.storage?.persist?.().catch(() => false)
  setTimeout(() => {
    try {
      if (Object.keys(localStorage).some(k => /^ousa-app:(bookmarks|things|renewals|countdown|contacts|gold|weight|eat)$/.test(k))) persist()
    } catch {}
  }, 4000)
})
