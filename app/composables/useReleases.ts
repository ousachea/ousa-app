// "What's new" indicator (CHECKLIST.md #32): a small New mark on Settings in the menu until the latest
// app-wide release has been seen in Settings → About.
const SEEN_KEY = 'ousa-app:seen-release'
const unseen = ref(false)
let started = false

export function useUnseenRelease() {
  if (!started && import.meta.client) {
    started = true
    try {
      unseen.value = localStorage.getItem(SEEN_KEY) !== APP_VERSION
    } catch {}
  }
  return readonly(unseen)
}

export function markReleaseSeen() {
  unseen.value = false
  try {
    localStorage.setItem(SEEN_KEY, APP_VERSION)
  } catch {}
}
