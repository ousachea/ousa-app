import type { AmbientYouTubeSource } from '~/types/ambient-studio'

// YouTube links and the official IFrame Player API, for Ambient Studio.
// Only public videos and playlists whose owners allow embedding can play here; the player
// reports anything else as an error (see errorMessage).

const VIDEO_ID = /^[\w-]{11}$/
const PLAYLIST_ID = /^[\w-]{10,64}$/
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtube-nocookie.com', 'youtube-nocookie.com'])

export type ParsedLink =
  | { ok: true, source: AmbientYouTubeSource }
  | { ok: false, error: string }

/** Read a pasted YouTube or YouTube Music link (or a bare video id) into what the player can load */
export function parseYouTubeLink(input: string): ParsedLink {
  const text = input.trim()
  if (!text) return { ok: false, error: 'Paste a YouTube link first.' }
  if (VIDEO_ID.test(text)) return { ok: true, source: { videoId: text } }

  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`)
  } catch {
    return { ok: false, error: 'That doesn’t look like a link. Paste the address of a YouTube video or playlist.' }
  }
  if (!HOSTS.has(url.hostname.toLowerCase())) {
    return { ok: false, error: 'Only YouTube and YouTube Music links can play here.' }
  }

  const parts = url.pathname.split('/').filter(Boolean)
  let videoId: string | undefined
  if (url.hostname.endsWith('youtu.be')) videoId = parts[0]
  else if (parts[0] === 'watch') videoId = url.searchParams.get('v') ?? undefined
  else if (['embed', 'shorts', 'live', 'v'].includes(parts[0] ?? '') && parts[1] !== 'videoseries') videoId = parts[1]

  const list = url.searchParams.get('list') ?? undefined
  if (list === 'LM' || list === 'WL' || list === 'LL') {
    return { ok: false, error: 'That’s one of your private lists (Liked or Watch later). Only public playlists can play here; open it in YouTube Music instead.' }
  }
  // Mixes YouTube makes for you (RD…) change for every person and usually refuse to embed
  const playlistId = list && PLAYLIST_ID.test(list) && !list.startsWith('RD') ? list : undefined

  if (videoId && !VIDEO_ID.test(videoId)) return { ok: false, error: 'That video link looks cut off. Copy it again from YouTube.' }
  if (!videoId && !playlistId) {
    if (list?.startsWith('RD')) return { ok: false, error: 'YouTube’s automatic mixes can’t be embedded. Paste a single video or a public playlist.' }
    return { ok: false, error: 'There’s no video or playlist in that link. Open the video on YouTube and copy its address.' }
  }
  return { ok: true, source: { videoId, playlistId } }
}

export function youtubeUrl(source: AmbientYouTubeSource, music = false) {
  const host = music ? 'https://music.youtube.com' : 'https://www.youtube.com'
  if (source.videoId) return `${host}/watch?v=${source.videoId}${source.playlistId ? `&list=${source.playlistId}` : ''}`
  return `${host}/playlist?list=${source.playlistId}`
}

/** Plain-language reasons for the player's error codes */
export function errorMessage(code: number) {
  switch (code) {
    case 2: return 'YouTube didn’t accept that video or playlist id.'
    case 5: return 'This video can’t play in your browser’s player.'
    case 100: return 'This video was removed or made private.'
    case 101:
    case 150:
    case 153: return 'This video can’t play outside YouTube: its owner doesn’t allow it, or it’s been removed. Try opening it on YouTube.'
    default: return 'YouTube couldn’t play this.'
  }
}

// ---------- The IFrame Player API, loaded once ----------

// The few parts of the YouTube IFrame Player API that Ambient Studio uses
export interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  stopVideo(): void
  loadVideoById(id: string): void
  cueVideoById(id: string): void
  loadPlaylist(opts: { list: string, listType: 'playlist', index?: number }): void
  cuePlaylist(opts: { list: string, listType: 'playlist', index?: number }): void
  nextVideo(): void
  previousVideo(): void
  playVideoAt(index: number): void
  setVolume(v: number): void
  getVolume(): number
  mute(): void
  unMute(): void
  isMuted(): boolean
  getPlayerState(): number
  getPlaylist(): string[] | null
  getPlaylistIndex(): number
  getVideoData?(): { title?: string, author?: string, video_id?: string }
  destroy(): void
}

interface YTNamespace {
  Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer
  PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 }
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

export const YT_STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const

let loading: Promise<YTNamespace> | undefined

/** Load https://www.youtube.com/iframe_api once, however many players ask for it */
export function loadYouTubeApi(timeoutMs = 15000): Promise<YTNamespace> {
  if (import.meta.server) return Promise.reject(new Error('client only'))
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (loading) return loading
  loading = new Promise<YTNamespace>((resolve, reject) => {
    const timer = window.setTimeout(() => fail(new Error('timeout')), timeoutMs)
    function fail(err: Error) {
      window.clearTimeout(timer)
      loading = undefined // let the next attempt try again
      reject(err)
    }
    // Keep any handler someone else set, and call it too
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      window.clearTimeout(timer)
      if (window.YT?.Player) resolve(window.YT)
      else fail(new Error('missing'))
    }
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const s = document.createElement('script')
      s.src = 'https://www.youtube.com/iframe_api'
      s.async = true
      s.onerror = () => {
        s.remove()
        fail(new Error('network'))
      }
      document.head.append(s)
    }
  })
  return loading
}
