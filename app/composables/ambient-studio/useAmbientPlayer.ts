import type { AmbientYouTubeSource } from '~/types/ambient-studio'
import { errorMessage, loadYouTubeApi, YT_STATE, type YTPlayer } from '~/utils/ambient-studio/youtube'

// The one YouTube player in Ambient Studio, driven through the official IFrame Player API.
// The player stays on screen whenever it plays: switching to the scene view pauses it first.
// YouTube's audio is never pulled out or mixed; the mixer is a separate sound source.

export type PlayerStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'buffering' | 'ended' | 'blocked' | 'error'

const state = reactive({
  source: null as AmbientYouTubeSource | null,
  status: 'idle' as PlayerStatus,
  error: '',
  /** The YouTube script itself couldn't load (offline, blocked); Retry tries again */
  apiFailed: false,
  title: '',
  channel: '',
  volume: 50,
  muted: false,
  /** Position in a playlist (0-based) and its length; -1 / 0 for a single video */
  index: -1,
  count: 0,
  /** What the stage shows: the YouTube player, or the scene artwork (the video pauses) */
  view: 'scene' as 'video' | 'scene'
})

let player: YTPlayer | undefined
let ready = false
let host: HTMLElement | undefined
let pending: { source: AmbientYouTubeSource, autoplay: boolean } | null = null
let blockedTimer: number | undefined
// A watch?v=…&list=… link starts the playlist on that video once YouTube has listed it
let startOn: string | undefined

function clearBlocked() {
  window.clearTimeout(blockedTimer)
  blockedTimer = undefined
}

function readInfo() {
  if (!player) return
  try {
    const data = player.getVideoData?.()
    if (data?.title) state.title = data.title
    if (data?.author) state.channel = data.author
    const list = player.getPlaylist()
    state.count = list?.length ?? 0
    state.index = list ? player.getPlaylistIndex() : -1
  } catch {}
}

function onStateChange(e: { data: number }) {
  readInfo()
  switch (e.data) {
    case YT_STATE.PLAYING:
      clearBlocked()
      state.status = 'playing'
      state.error = ''
      state.view = 'video'
      break
    case YT_STATE.PAUSED:
      state.status = 'paused'
      break
    case YT_STATE.BUFFERING:
      clearBlocked()
      state.status = 'buffering'
      break
    case YT_STATE.ENDED:
      state.status = 'ended'
      break
    case YT_STATE.CUED:
      if (state.status !== 'blocked') state.status = 'ready'
      break
  }
  if (startOn && player && state.count) {
    const at = player.getPlaylist()?.indexOf(startOn) ?? -1
    startOn = undefined
    if (at > 0) player.playVideoAt(at)
  }
}

function onError(e: { data: number }) {
  clearBlocked()
  state.status = 'error'
  state.error = errorMessage(e.data)
}

function apply(source: AmbientYouTubeSource, autoplay: boolean) {
  if (!player) return
  clearBlocked()
  state.status = 'loading'
  state.error = ''
  state.index = -1
  state.count = 0
  startOn = source.playlistId && source.videoId ? source.videoId : undefined
  try {
    if (source.playlistId) {
      const opts = { list: source.playlistId, listType: 'playlist' as const, index: 0 }
      if (autoplay) player.loadPlaylist(opts)
      else player.cuePlaylist(opts)
    } else if (source.videoId) {
      if (autoplay) player.loadVideoById(source.videoId)
      else player.cueVideoById(source.videoId)
    }
  } catch {
    state.status = 'error'
    state.error = 'YouTube couldn’t load this.'
    return
  }
  if (autoplay) {
    state.view = 'video'
    // Browsers may refuse to start sound without a tap on the player itself
    blockedTimer = window.setTimeout(() => {
      if (state.status === 'loading' || state.status === 'ready') state.status = 'blocked'
    }, 4000)
  }
}

function create(el: HTMLElement) {
  state.apiFailed = false
  if (state.source) state.status = 'loading'
  loadYouTubeApi().then((YT) => {
    if (host !== el) return // unmounted, or mounted somewhere else, while loading
    // YouTube replaces the element it's given with its iframe, so give it one Vue doesn't own
    const target = document.createElement('div')
    el.replaceChildren(target)
    player = new YT.Player(target, {
      width: '100%',
      height: '100%',
      playerVars: { playsinline: 1, rel: 0, origin: location.origin },
      events: {
        onReady: () => {
          ready = true
          player!.setVolume(state.volume)
          if (state.muted) player!.mute()
          if (pending) {
            apply(pending.source, pending.autoplay)
            pending = null
          } else if (!state.source) state.status = 'idle'
        },
        onStateChange,
        onError
      }
    })
  }).catch((err: Error) => {
    if (host !== el) return
    state.apiFailed = true
    state.status = 'error'
    state.error = !navigator.onLine || err.message === 'network'
      ? 'Couldn’t reach YouTube. Videos need an internet connection; the sound mixer still works offline.'
      : 'YouTube’s player took too long to load. Check your connection and try again.'
  })
}

export function useAmbientPlayer() {
  /** Put the player in `el` (the stage); call from onMounted */
  function mount(el: HTMLElement) {
    host = el
    create(el)
  }

  function destroy() {
    clearBlocked()
    try {
      player?.destroy()
    } catch {}
    player = undefined
    ready = false
    host = undefined
    pending = null
    state.status = 'idle'
    state.view = 'scene'
  }

  function retry() {
    if (!host) return
    const el = host
    if (state.source) pending = { source: state.source, autoplay: false }
    create(el)
  }

  /** Load a video or playlist; with `autoplay` (after a tap) it starts straight away */
  function load(source: AmbientYouTubeSource, { autoplay = false, volume }: { autoplay?: boolean, volume?: number } = {}) {
    state.source = source
    state.title = source.title ?? ''
    state.channel = source.channel ?? ''
    if (volume !== undefined) setVolume(volume)
    if (player && ready) apply(source, autoplay)
    else pending = { source, autoplay }
  }

  /** No video for this scene */
  function clear() {
    clearBlocked()
    pending = null
    startOn = undefined
    state.source = null
    state.title = ''
    state.channel = ''
    state.error = ''
    state.index = -1
    state.count = 0
    state.view = 'scene'
    if (ready) {
      try {
        player?.stopVideo()
      } catch {}
    }
    if (!state.apiFailed) state.status = 'idle'
  }

  function play() {
    if (!state.source) return
    state.view = 'video'
    if (!player || !ready) {
      pending = { source: state.source, autoplay: true }
      return
    }
    if (state.status === 'error' || state.status === 'idle') apply(state.source, true)
    else player.playVideo()
  }

  function pause() {
    clearBlocked()
    if (ready) player?.pauseVideo()
    if (state.status === 'blocked' || state.status === 'loading') state.status = 'ready'
  }

  const isPlaying = computed(() => state.status === 'playing' || state.status === 'buffering')

  function toggle() {
    if (isPlaying.value) pause()
    else play()
  }

  function setVolume(v: number) {
    state.volume = Math.round(Math.min(100, Math.max(0, v)))
    if (ready) player?.setVolume(state.volume)
    if (state.volume > 0 && state.muted) setMuted(false)
  }

  function setMuted(muted: boolean) {
    state.muted = muted
    if (!ready) return
    if (muted) player?.mute()
    else player?.unMute()
  }

  /** The scene artwork instead of the video. YouTube has to stay visible to play, so it pauses. */
  function showScene() {
    pause()
    state.view = 'scene'
  }

  function showVideo() {
    if (state.source) state.view = 'video'
  }

  return {
    state: readonly(state),
    isPlaying,
    mount,
    destroy,
    retry,
    load,
    clear,
    play,
    pause,
    toggle,
    next: () => ready && player?.nextVideo(),
    previous: () => ready && player?.previousVideo(),
    setVolume,
    setMuted,
    toggleMute: () => setMuted(!state.muted),
    showScene,
    showVideo
  }
}
