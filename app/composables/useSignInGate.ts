// Every app stays closed until you sign in, so nobody else using this device sees your data.
// 'checking' while Firebase restores the session (and on the server), then 'open' or 'locked'.
// Without Firebase set up there's nothing to sign in to, so the apps stay open.
export function useSignInGate() {
  const { vault } = useVault()
  const state = computed<'checking' | 'open' | 'locked'>(() => {
    if (!firebaseConfigured()) return 'open'
    if (vault.status === 'loading') return 'checking'
    return vault.status === 'signed-out' ? 'locked' : 'open'
  })
  return { state, open: computed(() => state.value === 'open') }
}

/** Pages that keep your data out of sight while signed out: every app shows its example instead (ToolPage), and the Recycle Bin its sign-in wall. The CV is a public page with nothing saved. */
export const isGatedPage = (path: string) =>
  !(import.meta.dev && DEV_OPEN.has(path))
  && (path === TRASH.to || [...TOOLS, ...TAB_PAGES].some(t => t.to === path && !t.readOnly))

// Open without signing in while running locally (npm run dev): Eat's photos are saved into the
// project folder (server/api/eat-image), so the list is managed from here on this device
const DEV_OPEN = new Set(['/eat'])
