import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut, type User } from 'firebase/auth'
import { addDoc, collection, deleteDoc, doc, getDocFromServer, getDocsFromServer, orderBy, query, setDoc, updateDoc } from 'firebase/firestore'

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

interface VaultDoc {
  ciphertext: string
  iv: string
  updatedAt: string
}

// Signing in (with Google) syncs the trackers. The vault also needs a master password, which never
// leaves this device: it encrypts every entry, and a small encrypted check value tells a wrong one apart.
// `new`: signed in, but no master password chosen yet
export type VaultStatus = 'loading' | 'signed-out' | 'locked' | 'new' | 'unlocked' | 'needs-setup'

const AUTO_LOCK_MS = 5 * 60 * 1000
// Encrypted with the vault key and stored next to the entries; decrypting it proves the master password
const CHECK_VALUE = 'ousa-vault'

const state = reactive({
  status: 'loading' as VaultStatus,
  email: '',
  items: [] as VaultItem[],
  // Rows that didn't decrypt with this key (e.g. saved under an old master password); counted, never shown
  unreadable: 0
})

// The AES key lives only in memory; reloading the page locks the vault
let key: CryptoKey | undefined
let lockTimer: ReturnType<typeof setTimeout> | undefined
let started = false

function currentUser() {
  const user = useFirebase().auth.currentUser
  if (!user) throw new Error('You’re signed out. Sign in again.')
  return user
}

const vaultRef = () => collection(useFirebase().db, 'users', currentUser().uid, 'vault')
const checkRef = () => doc(useFirebase().db, 'users', currentUser().uid, 'meta', 'vault')

function authMessage(e: unknown) {
  const code = (e as { code?: string } | null)?.code ?? ''
  if (code === 'auth/popup-blocked') return 'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.'
  if (code === 'auth/unauthorized-domain') return 'This address isn’t allowed to sign in yet. Add it under Authorized domains in Firebase.'
  if (code === 'auth/operation-not-allowed') return 'Google sign-in isn’t turned on for this Firebase project yet.'
  if (code === 'auth/network-request-failed') return 'Couldn’t reach Google. Check your connection.'
  return e instanceof Error ? e.message : 'Something went wrong. Try again.'
}

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

// Signed in but locked: has a master password been chosen yet?
async function checkSetup() {
  try {
    const snap = await getDocFromServer(checkRef())
    state.status = snap.exists() ? 'locked' : 'new'
  } catch (e) {
    if (!needsFirestoreSetup(e)) throw e
    state.status = 'needs-setup'
  }
}

async function loadItems() {
  if (!key) return checkSetup()
  let docs
  try {
    docs = (await getDocsFromServer(query(vaultRef(), orderBy('updatedAt', 'desc')))).docs
  } catch (e) {
    if (needsFirestoreSetup(e)) {
      state.status = 'needs-setup'
      return
    }
    throw e
  }
  // Rules published since the setup screen showed up
  if (state.status === 'needs-setup') state.status = 'unlocked'

  const items: VaultItem[] = []
  let unreadable = 0
  for (const snap of docs) {
    const row = snap.data() as VaultDoc
    try {
      const entry = await decryptJson<VaultEntry>(key, row)
      items.push({ ...entry, id: snap.id, updatedAt: row.updatedAt })
    } catch {
      unreadable++
    }
  }
  state.items = items.sort((a, b) => a.site.localeCompare(b.site))
  state.unreadable = unreadable
}

async function signedInAs(user: User) {
  state.email = user.email ?? ''
  try {
    await checkSetup()
  } catch {
    // Offline: assume a vault exists; unlocking will say if Firestore can't be reached
    state.status = 'locked'
  }
}

async function start() {
  if (started || import.meta.server) return
  started = true
  if (!firebaseConfigured()) {
    state.status = 'signed-out'
    return
  }
  const { auth } = useFirebase()

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      key = undefined
      state.items = []
      state.email = ''
      state.status = 'signed-out'
    } else if (state.status === 'signed-out') {
      // Signed in on another tab
      signedInAs(user)
    }
  })

  await auth.authStateReady()
  if (auth.currentUser) await signedInAs(auth.currentUser)
  else state.status = 'signed-out'

  for (const type of ['pointerdown', 'keydown'] as const) window.addEventListener(type, resetLockTimer, { passive: true })
}

export function useVault() {
  start()

  // Single-owner mode: with NUXT_PUBLIC_OWNER_EMAIL set, Google suggests that account first
  async function signIn() {
    const provider = new GoogleAuthProvider()
    const ownerEmail = (useRuntimeConfig().public.ownerEmail as string | undefined)?.trim()
    provider.setCustomParameters(ownerEmail ? { login_hint: ownerEmail } : { prompt: 'select_account' })
    try {
      const { user } = await signInWithPopup(useFirebase().auth, provider)
      await signedInAs(user)
    } catch (e) {
      if ((e as { code?: string }).code === 'auth/popup-closed-by-user') return false
      throw new Error(authMessage(e))
    }
    return true
  }

  async function unlocked(newKey: CryptoKey) {
    key = newKey
    state.status = 'unlocked'
    await loadItems()
    resetLockTimer()
  }

  // Derive the key in the browser and test it against the stored check value
  async function unlock(masterPassword: string) {
    const { key: candidate } = await deriveVaultKeys(state.email, masterPassword)
    const snap = await getDocFromServer(checkRef())
    if (!snap.exists()) {
      state.status = 'new'
      throw new Error('This vault has no master password yet. Choose one.')
    }
    try {
      await decryptJson(candidate, snap.data() as VaultDoc)
    } catch {
      throw new Error('Wrong master password.')
    }
    await unlocked(candidate)
  }

  // First time, or after forgetting it. Entries saved under an old master password
  // can't be decrypted with the new one and are counted as unreadable.
  async function setMasterPassword(masterPassword: string) {
    const { key: newKey } = await deriveVaultKeys(state.email, masterPassword)
    const check: VaultDoc = { ...(await encryptJson(newKey, CHECK_VALUE)), updatedAt: new Date().toISOString() }
    await withTimeout(setDoc(checkRef(), check))
    await unlocked(newKey)
  }

  async function signOut() {
    lock()
    await firebaseSignOut(useFirebase().auth)
  }

  async function save(entry: VaultEntry, id?: string) {
    if (!key) throw new Error('The vault is locked.')
    const row: VaultDoc = { ...(await encryptJson(key, entry)), updatedAt: new Date().toISOString() }
    if (id) await withTimeout(updateDoc(doc(vaultRef(), id), { ...row }))
    else await withTimeout(addDoc(vaultRef(), row))
    await loadItems()
  }

  async function remove(id: string) {
    await withTimeout(deleteDoc(doc(vaultRef(), id)))
    state.items = state.items.filter(item => item.id !== id)
  }

  return {
    vault: readonly(state),
    signIn,
    unlock,
    setMasterPassword,
    lock,
    signOut,
    save,
    remove,
    reload: loadItems
  }
}
