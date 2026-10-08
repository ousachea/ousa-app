// A choice remembered on this device: last sort, filter, view, currency, category… (CHECKLIST.md #14).
// Starts at `initial` (so the server's HTML matches), then picks up the saved value once mounted.
// Defaults stay easy to override: changing the control simply remembers the new choice.
const PREFIX = 'ousa-app:remember:'

// `fallback`: what to use when nothing was ever chosen here, e.g. the default view from Settings
export function useRemembered<T>(key: string, initial: T, isValid: (v: unknown) => boolean = () => true, fallback?: () => T) {
  const value = ref(initial) as Ref<T>
  onMounted(() => {
    let found = false
    try {
      const raw = localStorage.getItem(PREFIX + key)
      if (raw !== null) {
        const saved: unknown = JSON.parse(raw)
        if (isValid(saved)) {
          value.value = saved as T
          found = true
        }
      }
    } catch {}
    if (!found && fallback) value.value = fallback()
    watch(value, (v) => {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(v))
      } catch {}
    }, { deep: true })
  })
  return value
}
