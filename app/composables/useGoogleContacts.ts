import { GoogleAuthProvider, reauthenticateWithPopup, signInWithPopup, type UserCredential } from 'firebase/auth'
import type { RawContact } from '~/utils/contactImport'

// Reads the user's Google Contacts with the People API, straight from the browser.
// Uses the app's Firebase Google sign-in, asking for read-only contacts access only when importing.
// The access token lives only in memory and is reused until it's about to expire.
const SCOPE = 'https://www.googleapis.com/auth/contacts.readonly'
// Google access tokens last an hour; stop reusing one a little before that
const TOKEN_LIFETIME_MS = 55 * 60 * 1000

let cached: { token: string, uid: string, expires: number } | undefined

async function getToken() {
  const { auth } = useFirebase()
  const user = auth.currentUser
  if (cached && user?.uid === cached.uid && Date.now() < cached.expires) return cached.token

  const provider = new GoogleAuthProvider()
  provider.addScope(SCOPE)
  let result: UserCredential
  try {
    // Signed in: confirm the same account with the extra permission. Signed out: this also signs in, so trackers sync too.
    if (user) {
      provider.setCustomParameters({ login_hint: user.email ?? '' })
      result = await reauthenticateWithPopup(user, provider)
    } else {
      provider.setCustomParameters({ prompt: 'select_account' })
      result = await signInWithPopup(auth, provider)
    }
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') throw new Error('Sign-in window was closed')
    if (code === 'auth/user-mismatch') throw new Error('Choose the Google account you’re signed in with.')
    if (code === 'auth/popup-blocked') throw new Error('Your browser blocked the Google window. Allow pop-ups for this site and try again.')
    throw e
  }

  const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken
  if (!token) throw new Error('Google didn’t share your contacts. Tick the contacts box when asked.')
  cached = { token, uid: result.user.uid, expires: Date.now() + TOKEN_LIFETIME_MS }
  return token
}

interface Person {
  names?: { displayName?: string }[]
  organizations?: { name?: string }[]
  phoneNumbers?: { value?: string, canonicalForm?: string }[]
}

async function fetchConnections(token: string) {
  const out: RawContact[] = []
  let pageToken = ''
  // Paged 1000 at a time; stop at 10 pages so a huge address book can't spin forever
  for (let page = 0; page < 10; page++) {
    const url = new URL('https://people.googleapis.com/v1/people/me/connections')
    url.searchParams.set('personFields', 'names,phoneNumbers,organizations')
    url.searchParams.set('pageSize', '1000')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) {
      // A token Google no longer accepts (revoked or expired early): forget it so the next try asks again
      if (res.status === 401) cached = undefined
      throw new Error(res.status === 403 ? 'The People API isn’t enabled for this Google project' : `Google Contacts returned ${res.status}`)
    }
    const data = await res.json() as { connections?: Person[], nextPageToken?: string }
    for (const p of data.connections ?? []) {
      const numbers = (p.phoneNumbers ?? []).map(n => n.canonicalForm || n.value || '').filter(Boolean)
      if (numbers.length) out.push({ name: p.names?.[0]?.displayName || p.organizations?.[0]?.name || '', numbers })
    }
    if (!data.nextPageToken) break
    pageToken = data.nextPageToken
  }
  return out
}

export function useGoogleContacts() {
  const available = computed(() => firebaseConfigured())

  async function importFromGoogle() {
    if (!firebaseConfigured()) throw new Error('Google sign-in isn’t set up')
    return fetchConnections(await getToken())
  }

  return { available, importFromGoogle }
}
