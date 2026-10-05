import type { RawContact } from '~/utils/contactImport'

// Reads the signed-in user's Google Contacts with the People API, straight from the browser.
// Sign-in uses Google Identity Services' token flow: no backend, the token lives only in memory.
const GIS_SRC = 'https://accounts.google.com/gsi/client'
const SCOPE = 'https://www.googleapis.com/auth/contacts.readonly'

interface TokenResponse { access_token?: string, error?: string, error_description?: string }
interface TokenClient { requestAccessToken: (opts?: { prompt?: string }) => void }
interface GoogleOAuth {
  initTokenClient: (cfg: {
    client_id: string
    scope: string
    callback: (r: TokenResponse) => void
    error_callback?: (e: { type?: string, message?: string }) => void
  }) => TokenClient
}
declare global {
  interface Window { google?: { accounts?: { oauth2?: GoogleOAuth } } }
}

let scriptLoad: Promise<void> | undefined
function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  scriptLoad ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = GIS_SRC
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      scriptLoad = undefined
      reject(new Error('Couldn’t load Google sign-in. Check your connection or ad blocker.'))
    }
    document.head.append(s)
  })
  return scriptLoad
}

function getToken(clientId: string) {
  return new Promise<string>((resolve, reject) => {
    const client = window.google!.accounts!.oauth2!.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: r => (r.access_token ? resolve(r.access_token) : reject(new Error(r.error_description || r.error || 'Google sign-in failed'))),
      error_callback: e => reject(new Error(e.type === 'popup_closed' ? 'Sign-in window was closed' : e.message || 'Google sign-in failed'))
    })
    client.requestAccessToken()
  })
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
    if (!res.ok) throw new Error(res.status === 403 ? 'The People API isn’t enabled for this Google project' : `Google Contacts returned ${res.status}`)
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
  const clientId = useRuntimeConfig().public.googleClientId as string
  const available = computed(() => !!clientId)

  async function importFromGoogle() {
    if (!clientId) throw new Error('Google sign-in isn’t set up')
    await loadGis()
    const token = await getToken(clientId)
    return fetchConnections(token)
  }

  return { available, importFromGoogle }
}
