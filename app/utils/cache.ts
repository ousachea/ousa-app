// The last good answer from a web request, kept on this device so the app still shows something useful
// offline or when a service is down (CHECKLIST.md #19, #24): the market rate, holidays, gold prices.
const PREFIX = 'ousa-app:cache:'

export interface Cached<T> {
  data: T
  /** When it was fetched (ISO) */
  at: string
}

export function readCached<T>(key: string): Cached<T> | undefined {
  if (import.meta.server) return undefined
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw) as Cached<T> : undefined
  } catch {
    return undefined
  }
}

export function writeCached<T>(key: string, data: T) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ data, at: new Date().toISOString() }))
  } catch {}
}

/** "8 Oct, 14:02" for "last updated" notes */
export const cachedWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
