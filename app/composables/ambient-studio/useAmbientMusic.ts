import { GoogleAuthProvider, reauthenticateWithPopup, signInWithPopup, type UserCredential } from 'firebase/auth'
import { useAmbientPlayer } from './useAmbientPlayer'

// Your YouTube Music library in Ambient Studio, through official Google APIs only:
// - Sign in with the app's Google sign-in, asking for read-only YouTube access (like Phone does for contacts)
// - The YouTube Data API lists your playlists (those made in YouTube Music are YouTube playlists too) and
//   the songs you liked, and says which ones their owners let play on other sites
// - Songs play one by one in the visible YouTube player, from a queue kept here
// YouTube Music itself has no public API, so its own streams, uploads and radio aren't reachable.
// The access token stays in memory only; after a reload, Connect asks Google again (one click).

const SCOPE = 'https://www.googleapis.com/auth/youtube.readonly'
const API = 'https://www.googleapis.com/youtube/v3'
const TOKEN_LIFETIME_MS = 55 * 60 * 1000
const MAX_TRACKS = 500
export const LIKED_ID = 'liked'

export interface MusicPlaylist {
  id: string
  title: string
  count: number
  thumb?: string
}

export interface MusicTrack {
  videoId: string
  title: string
  artist: string
  thumb?: string
  /** False when the owner doesn't allow it to play outside YouTube */
  playable: boolean
}

type SetupProblem = 'api-disabled' | 'no-scope' | 'no-firebase' | 'quota' | null

const state = reactive({
  connecting: false,
  connected: false,
  email: '',
  error: '',
  /** Something to fix in Google Cloud, with steps shown in the studio */
  setup: null as SetupProblem,
  playlists: [] as MusicPlaylist[],
  loadingPlaylists: false,
  /** The playlist open in the library */
  openId: '' as string,
  openTitle: '',
  tracks: [] as MusicTrack[],
  loadingTracks: false,
  // ---------- The queue ----------
  queue: [] as MusicTrack[],
  queueTitle: '',
  position: -1,
  shuffled: false
})

let token: { value: string, uid: string, expires: number } | undefined
const trackCache = new Map<string, MusicTrack[]>()

class ApiError extends Error {
  constructor(public status: number, public reason: string, message: string) {
    super(message)
  }
}

async function getToken(interactive: boolean) {
  const { auth } = useFirebase()
  const user = auth.currentUser
  if (token && user?.uid === token.uid && Date.now() < token.expires) return token.value
  if (!interactive) throw new ApiError(401, 'signedOut', 'Connect your YouTube account first.')

  const provider = new GoogleAuthProvider()
  provider.addScope(SCOPE)
  let result: UserCredential
  try {
    if (user) {
      provider.setCustomParameters({ login_hint: user.email ?? '' })
      result = await reauthenticateWithPopup(user, provider)
    } else {
      provider.setCustomParameters({ prompt: 'select_account' })
      result = await signInWithPopup(auth, provider)
    }
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') throw new Error('The Google window was closed before signing in.')
    if (code === 'auth/user-mismatch') throw new Error('Choose the Google account you’re signed in with here.')
    if (code === 'auth/popup-blocked') throw new Error('Your browser blocked the Google window. Allow pop-ups for this site and try again.')
    throw new Error('Google sign-in didn’t work. Try again.')
  }
  const access = GoogleAuthProvider.credentialFromResult(result)?.accessToken
  if (!access) throw new ApiError(403, 'noScope', 'Google didn’t share your YouTube library. Tick the YouTube box when asked.')
  token = { value: access, uid: result.user.uid, expires: Date.now() + TOKEN_LIFETIME_MS }
  state.email = result.user.email ?? ''
  return access
}

async function api<T>(path: string, params: Record<string, string>): Promise<T> {
  const access = await getToken(false)
  const res = await fetch(`${API}/${path}?${new URLSearchParams(params)}`, { headers: { Authorization: `Bearer ${access}` } })
  if (res.ok) return res.json() as Promise<T>
  const body = await res.json().catch(() => ({})) as { error?: { message?: string, errors?: { reason?: string }[], details?: { reason?: string }[] } }
  const reason = body.error?.errors?.[0]?.reason ?? body.error?.details?.[0]?.reason ?? ''
  throw new ApiError(res.status, reason, body.error?.message ?? `YouTube answered ${res.status}`)
}

function explain(e: unknown) {
  if (e instanceof ApiError) {
    if (e.status === 401) {
      token = undefined
      state.connected = false
      return 'Your YouTube connection expired. Connect again.'
    }
    if (e.reason === 'accessNotConfigured' || e.reason === 'SERVICE_DISABLED' || /has not been used|is disabled/i.test(e.message)) {
      state.setup = 'api-disabled'
      return 'The YouTube Data API isn’t turned on for this app’s Google project yet.'
    }
    if (e.reason === 'quotaExceeded' || e.reason === 'dailyLimitExceeded') {
      state.setup = 'quota'
      return 'This app has used its YouTube allowance for today. It resets at midnight Pacific time.'
    }
    if (e.reason === 'noScope' || e.reason === 'insufficientPermissions' || e.reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT') {
      state.setup = 'no-scope'
      return 'Google didn’t give access to your YouTube library. Connect again and tick the YouTube box.'
    }
    return e.message
  }
  if (e instanceof Error && /Firebase is not configured/.test(e.message)) {
    state.setup = 'no-firebase'
    return 'Google sign-in isn’t set up for this app.'
  }
  return e instanceof Error ? e.message : 'Something went wrong talking to YouTube.'
}

interface Thumbs { default?: { url: string }, medium?: { url: string }, high?: { url: string } }
const thumbOf = (t?: Thumbs) => t?.medium?.url ?? t?.high?.url ?? t?.default?.url

async function loadPlaylists() {
  state.loadingPlaylists = true
  state.error = ''
  try {
    const out: MusicPlaylist[] = []
    let pageToken = ''
    do {
      const page = await api<{ items: { id: string, snippet: { title: string, thumbnails?: Thumbs }, contentDetails: { itemCount: number } }[], nextPageToken?: string }>('playlists', {
        part: 'snippet,contentDetails', mine: 'true', maxResults: '50', ...(pageToken ? { pageToken } : {})
      })
      for (const p of page.items) out.push({ id: p.id, title: p.snippet.title, count: p.contentDetails.itemCount, thumb: thumbOf(p.snippet.thumbnails) })
      pageToken = page.nextPageToken ?? ''
    } while (pageToken && out.length < 500)
    state.playlists = out
  } catch (e) {
    state.error = explain(e)
  } finally {
    state.loadingPlaylists = false
  }
}

/** Which videos their owners allow to play on other sites (50 per request) */
async function markPlayable(tracks: MusicTrack[]) {
  for (let i = 0; i < tracks.length; i += 50) {
    const batch = tracks.slice(i, i + 50)
    try {
      const res = await api<{ items: { id: string, status?: { embeddable?: boolean } }[] }>('videos', { part: 'status', id: batch.map(t => t.videoId).join(',') })
      const ok = new Map(res.items.map(v => [v.id, v.status?.embeddable !== false]))
      for (const t of batch) t.playable = ok.get(t.videoId) ?? false
    } catch {
      // Unknown: try to play them; the player skips any that refuse
    }
  }
}

async function fetchTracks(id: string): Promise<MusicTrack[]> {
  const cached = trackCache.get(id)
  if (cached) return cached
  const out: MusicTrack[] = []
  let pageToken = ''
  do {
    if (id === LIKED_ID) {
      const page = await api<{ items: { id: string, snippet: { title: string, channelTitle: string, thumbnails?: Thumbs } }[], nextPageToken?: string }>('videos', {
        part: 'snippet', myRating: 'like', maxResults: '50', ...(pageToken ? { pageToken } : {})
      })
      for (const v of page.items) out.push({ videoId: v.id, title: v.snippet.title, artist: cleanArtist(v.snippet.channelTitle), thumb: thumbOf(v.snippet.thumbnails), playable: true })
      pageToken = page.nextPageToken ?? ''
    } else {
      const page = await api<{ items: { snippet: { title: string, videoOwnerChannelTitle?: string, thumbnails?: Thumbs, resourceId: { videoId: string } } }[], nextPageToken?: string }>('playlistItems', {
        part: 'snippet', playlistId: id, maxResults: '50', ...(pageToken ? { pageToken } : {})
      })
      for (const it of page.items) {
        const s = it.snippet
        // Removed or private songs stay in playlists as placeholders
        if (!s.videoOwnerChannelTitle || s.title === 'Deleted video' || s.title === 'Private video') continue
        out.push({ videoId: s.resourceId.videoId, title: s.title, artist: cleanArtist(s.videoOwnerChannelTitle), thumb: thumbOf(s.thumbnails), playable: true })
      }
      pageToken = page.nextPageToken ?? ''
    }
  } while (pageToken && out.length < MAX_TRACKS)
  await markPlayable(out)
  trackCache.set(id, out)
  return out
}

// Music on YouTube comes from "Artist - Topic" channels; show just the artist
const cleanArtist = (channel: string) => channel.replace(/ - Topic$/, '')

function shuffle<T>(list: T[]) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

export function useAmbientMusic() {
  const player = useAmbientPlayer()

  async function connect() {
    if (state.connecting) return
    state.connecting = true
    state.error = ''
    state.setup = null
    try {
      await getToken(true)
      state.connected = true
      await loadPlaylists()
    } catch (e) {
      state.error = explain(e)
    } finally {
      state.connecting = false
    }
  }

  function disconnect() {
    token = undefined
    trackCache.clear()
    Object.assign(state, { connected: false, email: '', playlists: [], openId: '', openTitle: '', tracks: [], error: '', setup: null })
  }

  async function open(id: string, title: string) {
    state.openId = id
    state.openTitle = title
    state.tracks = []
    state.loadingTracks = true
    state.error = ''
    try {
      const tracks = await fetchTracks(id)
      if (state.openId === id) state.tracks = tracks
    } catch (e) {
      state.error = explain(e)
    } finally {
      state.loadingTracks = false
    }
  }

  function close() {
    state.openId = ''
    state.tracks = []
  }

  function playIndex(i: number) {
    const t = state.queue[i]
    if (!t) return
    state.position = i
    player.load({ videoId: t.videoId, title: t.title, channel: t.artist }, { autoplay: true })
  }

  /** Play a list from `start` (or shuffled); songs that can't play here are left out */
  function playList(tracks: MusicTrack[], title: string, { start, shuffled = false }: { start?: MusicTrack, shuffled?: boolean } = {}) {
    let list = tracks.filter(t => t.playable)
    if (!list.length) {
      state.error = 'None of these songs are allowed to play outside YouTube. Open the playlist in YouTube Music instead.'
      return
    }
    if (shuffled) {
      list = shuffle(list)
      if (start) list = [start, ...list.filter(t => t.videoId !== start.videoId)]
    }
    state.queue = list
    state.queueTitle = title
    state.shuffled = shuffled
    playIndex(start ? Math.max(0, list.findIndex(t => t.videoId === start.videoId)) : 0)
  }

  const hasQueue = computed(() => state.queue.length > 0 && state.position >= 0)
  const current = computed(() => (hasQueue.value ? state.queue[state.position] : undefined))
  const next = () => (state.position < state.queue.length - 1 ? playIndex(state.position + 1) : undefined)
  const previous = () => (state.position > 0 ? playIndex(state.position - 1) : undefined)

  function toggleShuffle() {
    if (!hasQueue.value) return
    const playing = current.value!
    if (state.shuffled) {
      state.shuffled = false
    } else {
      const rest = shuffle(state.queue.filter((_, i) => i !== state.position))
      state.queue = [playing, ...rest]
      state.position = 0
      state.shuffled = true
    }
  }

  function clearQueue() {
    state.queue = []
    state.position = -1
    state.queueTitle = ''
  }

  /** Keep the queue moving: next song when one ends, and skip any the player refuses. Call once from the page. */
  function follow() {
    watch(() => player.state.status, (status) => {
      if (!hasQueue.value || player.state.source?.videoId !== current.value?.videoId) return
      if (status === 'ended') next()
      if (status === 'error') {
        const failed = current.value!
        failed.playable = false
        window.setTimeout(() => {
          if (current.value?.videoId === failed.videoId) next()
        }, 1500)
      }
    })
    // Something else (a scene, a pasted link) took over the player: the queue steps aside
    watch(() => player.state.source?.videoId, (id) => {
      if (hasQueue.value && id !== current.value?.videoId) state.position = -1
    })
  }

  return {
    state: readonly(state),
    connect,
    disconnect,
    reload: loadPlaylists,
    open,
    close,
    playList,
    playIndex,
    hasQueue,
    current,
    next,
    previous,
    toggleShuffle,
    clearQueue,
    follow
  }
}
