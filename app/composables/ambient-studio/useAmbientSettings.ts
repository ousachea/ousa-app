import { DEFAULT_AMBIENT_SETTINGS, useAmbientStorage } from './useAmbientStorage'

// Ambient Studio's own settings (ToolPage's settings popup). Resetting only touches these.

const systemReduced = ref(false)
let watching = false

export function useAmbientSettings() {
  const { store } = useAmbientStorage()

  if (import.meta.client && !watching) {
    watching = true
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    systemReduced.value = mq.matches
    mq.addEventListener('change', e => (systemReduced.value = e.matches))
  }

  /** Calm motion: this studio's setting, the app-wide Settings → Motion, or the system's */
  const reducedMotion = computed(() => {
    if (store.settings.reduceMotion || systemReduced.value) return true
    return import.meta.client && document.documentElement.dataset.motion === 'reduced'
  })

  return {
    settings: toRef(store, 'settings'),
    reducedMotion,
    resetSettings: () => (store.settings = structuredClone(DEFAULT_AMBIENT_SETTINGS))
  }
}
