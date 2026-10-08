// False during server rendering and the first client render, true once the page has hydrated.
// Anything drawn from this device's settings (pinned apps, preferences) waits for it, so the
// server's HTML and the first client render always match. Set by plugins/hydrated.client.ts.
export const useHydrated = () => useState('app-hydrated', () => false)
