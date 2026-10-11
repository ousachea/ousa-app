import { toast } from 'vue-sonner'
import type { AmbientItem, AmbientYouTubeSource } from '~/types/ambient-studio'
import { AMBIENT_PRESETS } from '~/data/ambient-studio/presets'
import { useAmbientMixer } from './useAmbientMixer'
import { useAmbientPlayer } from './useAmbientPlayer'
import { isMix, useAmbientPresets } from './useAmbientPresets'
import { useAmbientSettings } from './useAmbientSettings'
import { startAmbientStorage, useAmbientStorage } from './useAmbientStorage'
import { useAmbientTimer } from './useAmbientTimer'
import { useAmbientMusic } from './useAmbientMusic'

// What's on in the studio, and the one Play button that drives the video and the mixer together.
// Components read from here; the page calls setup() once.

export const LINK_ID = 'link'

const current = shallowRef<AmbientItem>(AMBIENT_PRESETS[0]!)

export function useAmbientStudio() {
  const { store } = useAmbientStorage()
  const { settings } = useAmbientSettings()
  const player = useAmbientPlayer()
  const mixer = useAmbientMixer()
  const library = useAmbientPresets()
  const timer = useAmbientTimer()

  const playing = computed(() => player.isPlaying.value || mixer.state.playing)
  const hasVideo = computed(() => !!player.state.source)
  const hasLayers = computed(() => mixer.state.layers.length > 0)

  /** Switch to a scene. From a tap it starts playing; restoring the last session only gets it ready. */
  function select(item: AmbientItem, { autoplay = true } = {}) {
    current.value = item
    if (item.youtube) player.load(item.youtube, { autoplay, volume: item.videoVolume || settings.value.defaultVolume })
    else player.clear()
    mixer.setMix(item.layers)
    if (autoplay && item.layers.length && !mixer.state.playing) void mixer.start()
    if (autoplay && !item.layers.length) mixer.stop()
    if (autoplay) library.addRecent(item.id)
    store.last = { id: item.id }
  }

  /** Play a pasted YouTube link over the current scene (its artwork and mixer stay) */
  function playLink(source: AmbientYouTubeSource) {
    current.value = {
      ...current.value,
      id: LINK_ID,
      name: 'Your YouTube link',
      description: 'A video or playlist you pasted, over the scene you had on.',
      youtube: source,
      tags: []
    }
    player.load(source, { autoplay: true, volume: player.state.volume || settings.value.defaultVolume })
    store.last = { id: LINK_ID, link: { ...source } }
  }

  /** The big Play button: video and mixer together */
  function togglePlay() {
    if (playing.value) {
      player.pause()
      mixer.stop()
      return
    }
    if (hasVideo.value) player.play()
    if (hasLayers.value) void mixer.start()
    if (current.value.id !== LINK_ID) library.addRecent(current.value.id)
  }

  /** Save what's playing now as a mix of your own */
  function saveMix(name: string) {
    const { id: _id, name: _name, ...rest } = current.value
    const mix = library.saveMix(name, {
      ...rest,
      description: rest.description || 'A mix you saved.',
      layers: mixer.snapshot(),
      youtube: player.state.source ? { ...player.state.source, title: player.state.title || player.state.source.title } : undefined,
      videoVolume: player.state.volume
    }, isMix(current.value) ? current.value.basePresetId : current.value.id === LINK_ID ? undefined : current.value.id)
    current.value = mix
    store.last = { id: mix.id }
    return mix
  }

  // ---------- Timers ending ----------
  let fadeBase: number | null = null
  const { play: chime } = useSound()

  function endFade(restore: boolean) {
    if (fadeBase === null) return
    if (restore) player.setVolume(fadeBase)
    fadeBase = null
  }

  function setup() {
    startAmbientStorage()
    mixer.init()
    useAmbientMusic().follow()

    // Pick up where you left off, without making a sound until you press Play
    const last = store.last
    const item = last && last.id !== LINK_ID ? library.byId(last.id) : undefined
    if (item) select(item, { autoplay: false })
    else select(current.value, { autoplay: false })
    if (last?.id === LINK_ID && last.link) {
      current.value = { ...current.value, id: LINK_ID, name: 'Your YouTube link', youtube: last.link }
      player.load(last.link)
    }
    timer.refresh()

    // Sleep and countdown timers fade the sound over their last 30 seconds
    watch(() => timer.state.remaining, (left) => {
      const t = timer.state
      if (!t.running || t.mode === 'focus' || !settings.value.stopAtEnd || !settings.value.fadeOut) return
      if (left <= 30 && left > 0) {
        if (fadeBase === null) {
          fadeBase = player.state.volume
          mixer.fadeOut(left)
        }
        if (player.isPlaying.value) player.setVolume(Math.round(fadeBase * left / 30))
      }
    })
    // Stopped or reset during the fade: bring the sound back up
    watch(() => timer.state.running, (running) => {
      if (running || fadeBase === null || timer.state.remaining === 0) return
      endFade(true)
      if (mixer.state.fading) void mixer.start()
    })

    timer.onEnd((end) => {
      chime('complete')
      if (end.mode === 'focus') {
        const done = end.phase === 'focus'
        toast(done ? 'Focus round done' : 'Break’s over', { description: done ? 'Time for a break. Stretch, look away from the screen.' : 'Ready for the next round?' })
        timer.nextPhase(settings.value.autoAdvance)
        return
      }
      const label = end.mode === 'sleep' ? 'Sleep timer' : 'Timer'
      if (settings.value.stopAtEnd) {
        player.pause()
        mixer.stop()
        endFade(true)
        toast(`${label} finished`, { description: 'The sound has stopped.' })
      } else {
        toast(`${label} finished`)
      }
      timer.reset()
    })
  }

  function teardown() {
    endFade(true)
    player.destroy()
    mixer.dispose()
    timer.dispose()
  }

  return { current: readonly(current), playing, hasVideo, hasLayers, select, playLink, togglePlay, saveMix, setup, teardown }
}
