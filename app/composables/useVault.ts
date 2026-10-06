import type { PostgrestError } from '@supabase/supabase-js'

// What's stored inside each encrypted blob. The database only ever sees ciphertext.
export interface VaultEntry {
  site: string
  url?: string
  username: string
  password: string
  notes?: string
}

export interface VaultItem extends VaultEntry {
  id: string
  updatedAt: string
}

interface VaultRow {
  id: string
  ciphertext: string
  iv: string
  updated_at: string
}

// `recovery`: opened from a reset email, signed in but waiting for a new master password
export type VaultStatus = 'loading' | 'signed-out' | 'locked' | 'unlocked' | 'needs-setup' | 'recovery'

const AUTO_LOCK_MS = 5 * 60 * 1000

const state = reactive({
  status: 'loading' as VaultStatus,
  email: '',
  items: [] as VaultItem[],
  // Rows that didn't decrypt with this key (e.g. corrupted); counted, never shown
  unreadable: 0,
  // Set when a reset link failed (expired, used, or opened in another browser)
  resetError: ''
})

// The AES key lives only in memory; reloading the page locks the vault
let key: CryptoKey | undefined
let lockTimer: ReturnType<typeof setTimeout> | undefined
let started = false

const isMissingTable = (error: PostgrestError | null) => error?.code === 'PGRST205' || error?.code === '42P01'

function resetLockTimer() {
  clearTimeout(lockTimer)
  if (state.status === 'unlocked') lockTimer = setTimeout(lock, AUTO_LOCK_MS)
}

function lock() {
  key = undefined
  state.items = []
  state.unreadable = 0
  clearTimeout(lockTimer)
  if (state.status === 'unlocked') state.status = 'locked'
}

async function loadItems() {
  if (!key) return
  const { data, error } = await useSupabase()
    .from('vault_items')
    .select('id, ciphertext, iv, updated_at')
    .order('updated_at', { ascending: false })

  if (isMissingTable(error)) {
    state.status = 'needs-setup'
    return
  }
  if (error) throw new Error(error.message)

  const items: VaultItem[] = []
  let unreadable = 0
  for (const row of (data ?? []) as VaultRow[]) {
    try {
      const entry = await decryptJson<VaultEntry>(key, row)
      items.push({ ...entry, id: row.id, updatedAt: row.updated_at })
    } catch {
      unreadable++
    }
  }
  state.items = items.sort((a, b) => a.site.localeCompare(b.site))
  state.unreadable = unreadable
}

async function start() {
  if (started || import.meta.server) return
  started = true
  const supabase = useSupabase()
  // Subscribe before reading the session so the reset link's PASSWORD_RECOVERY event isn't missed
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      key = undefined
      state.items = []
      state.email = ''
      state.status = 'signed-out'
    } else if (event === 'PASSWORD_RECOVERY') {
      key = undefined
      state.email = session.user.email ?? ''
      state.status = 'recovery'
    }
  })

  const { data } = await supabase.auth.getSession()
  if (state.status !== 'recovery') {
    state.email = data.session?.user.email ?? ''
    state.status = data.session ? 'locked' : 'signed-out'
  }

  // A reset link that couldn't sign in: Supabase sends error details, or the code had no matching verifier
  const params = new URLSearchParams(location.search + '&' + location.hash.slice(1))
  if (!data.session && location.pathname === '/settings' && (params.has('error_description') || params.has('code'))) {
    state.resetError = params.get('error_code') === 'otp_expired'
      ? 'That reset link has expired. Ask for a new one.'
      : 'That reset link didn’t work here. Open it in the same browser where you asked for it, or ask for a new one.'
  }

  for (const type of ['pointerdown', 'keydown'] as const) window.addEventListener(type, resetLockTimer, { passive: true })
}

export function useVault() {
  start()

  // Derive keys in the browser, then sign in with the derived auth secret (never the master password)
  async function signIn(email: string, masterPassword: string) {
    const keys = await deriveVaultKeys(email, masterPassword)
    const { error } = await useSupabase().auth.signInWithPassword({ email: normalizeEmail(email), password: keys.authSecret })
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Wrong email or master password.' : error.message)
    key = keys.key
    state.email = normalizeEmail(email)
    state.status = 'unlocked'
    await loadItems()
    resetLockTimer()
  }

  async function signUp(email: string, masterPassword: string) {
    const keys = await deriveVaultKeys(email, masterPassword)
    const { data, error } = await useSupabase().auth.signUp({
      email: normalizeEmail(email),
      password: keys.authSecret,
      // Send the confirmation link back to the address this page is on, not only Supabase's Site URL
      options: { emailRedirectTo: `${location.origin}/settings` }
    })
    if (error) throw new Error(error.message)
    // Projects with "Confirm email" on return no session until the link in the email is clicked
    if (!data.session) return { needsConfirmation: true }
    key = keys.key
    state.email = normalizeEmail(email)
    state.status = 'unlocked'
    await loadItems()
    resetLockTimer()
    return { needsConfirmation: false }
  }

  // Emails a link back to Settings; the PKCE code only works in this browser
  async function requestReset(email: string) {
    state.resetError = ''
    const { error } = await useSupabase().auth.resetPasswordForEmail(normalizeEmail(email), {
      redirectTo: `${location.origin}/settings`
    })
    if (error) throw new Error(error.message)
  }

  // After a reset link: the new master password replaces the derived Supabase password.
  // Vault entries saved under the old one can't be decrypted any more and are counted as unreadable.
  async function setNewMasterPassword(masterPassword: string) {
    const keys = await deriveVaultKeys(state.email, masterPassword)
    const { error } = await useSupabase().auth.updateUser({ password: keys.authSecret })
    if (error) throw new Error(error.message)
    key = keys.key
    state.status = 'unlocked'
    await loadItems()
    resetLockTimer()
  }

  // Unlocking re-checks the master password with Supabase, so a wrong one is rejected
  const unlock = (masterPassword: string) => signIn(state.email, masterPassword)

  async function signOut() {
    lock()
    await useSupabase().auth.signOut()
  }

  async function save(entry: VaultEntry, id?: string) {
    if (!key) throw new Error('The vault is locked.')
    const blob = await encryptJson(key, entry)
    const supabase = useSupabase()
    const { error } = id
      ? await supabase.from('vault_items').update({ ...blob, updated_at: new Date().toISOString() }).eq('id', id)
      : await supabase.from('vault_items').insert(blob)
    if (error) throw new Error(error.message)
    await loadItems()
  }

  async function remove(id: string) {
    const { error } = await useSupabase().from('vault_items').delete().eq('id', id)
    if (error) throw new Error(error.message)
    state.items = state.items.filter(item => item.id !== id)
  }

  return {
    vault: readonly(state),
    signIn,
    signUp,
    unlock,
    lock,
    signOut,
    requestReset,
    setNewMasterPassword,
    save,
    remove,
    reload: loadItems
  }
}
