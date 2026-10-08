// Installing Ousa's Apps (CHECKLIST.md #20): Chrome and Edge offer a prompt we can show from a button;
// iPhone and iPad have no prompt, so they get instructions instead. Started by plugins/pwa.client.ts.
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const deferred = shallowRef<InstallPromptEvent>()
const installed = ref(false)
const ios = ref(false)
let started = false

export function startInstallWatch() {
  if (started || import.meta.server) return
  started = true
  const nav = navigator as Navigator & { standalone?: boolean }
  installed.value = matchMedia('(display-mode: standalone)').matches || nav.standalone === true
  ios.value = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred.value = e as InstallPromptEvent
  })
  window.addEventListener('appinstalled', () => {
    installed.value = true
    deferred.value = undefined
  })
}

export function useInstall() {
  startInstallWatch()
  return {
    installed: readonly(installed),
    canPrompt: computed(() => !!deferred.value),
    ios: readonly(ios),
    async install() {
      const e = deferred.value
      if (!e) return false
      await e.prompt()
      const { outcome } = await e.userChoice
      deferred.value = undefined
      return outcome === 'accepted'
    }
  }
}
