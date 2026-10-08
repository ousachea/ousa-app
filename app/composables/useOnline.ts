// Whether this device can reach the internet right now (CHECKLIST.md #19). Everything you save works
// offline (it's kept on this device and syncs later); only things that fetch from the web need this.
const online = ref(true)
let started = false

function start() {
  if (started || import.meta.server) return
  started = true
  online.value = navigator.onLine
  window.addEventListener('online', () => (online.value = true))
  window.addEventListener('offline', () => (online.value = false))
}

export function useOnline() {
  start()
  return readonly(online)
}
