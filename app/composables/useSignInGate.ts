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

/** Pages behind the sign-in wall: every app, and the Recycle Bin. The CV is a public page with nothing saved. */
export const isGatedPage = (path: string) =>
  path === TRASH.to || TOOLS.some(t => t.to === path && !t.readOnly)
