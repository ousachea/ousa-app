// Each app's own settings (the gear in its header, see ToolPage's #settings slot), remembered on this
// device per app. Pages read them as defaults when they open, so a setting changes where the app starts
// without locking the controls on the page.
const stores = new Map<string, { prefs: Record<string, unknown>, defaults: Record<string, unknown> }>()

export function useAppPrefs<T extends Record<string, unknown>>(app: string, defaults: T) {
  const key = `ousa-app:app-prefs:${app}`
  let store = stores.get(key)
  if (!store) {
    const prefs = reactive({ ...defaults }) as Record<string, unknown>
    store = { prefs, defaults }
    stores.set(key, store)
    if (import.meta.client) {
      try {
        const saved = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>
        for (const k of Object.keys(defaults)) {
          if (saved[k] !== undefined && typeof saved[k] === typeof defaults[k]) prefs[k] = saved[k]
        }
      } catch {}
      watch(prefs, () => {
        try {
          localStorage.setItem(key, JSON.stringify(prefs))
        } catch {}
      }, { deep: true })
    }
  }
  const { prefs } = store
  return {
    prefs: prefs as T,
    reset: () => Object.assign(prefs, defaults)
  }
}
