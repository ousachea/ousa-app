import { createUISFX, type CueName, type PackName, type PlayOptions, type UISFXPlayer } from 'uisfx'

// One player for the whole app. uisfx persists pack, volume and on/off in localStorage under this key.
const PREFERENCES_KEY = 'ousa-app:sound'

let player: UISFXPlayer | undefined

const state = reactive({
  ready: false,
  enabled: true,
  pack: 'soft' as PackName,
  volume: 0.6
})

// uisfx lets explicit options win over saved preferences, so only apply our defaults when nothing is saved
function savedPreferences(): { pack?: PackName, volume?: number, enabled?: boolean } {
  try {
    return JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function getPlayer() {
  if (import.meta.server) return undefined
  if (!player) {
    const saved = savedPreferences()
    player = createUISFX({
      pack: saved.pack ?? state.pack,
      volume: saved.volume ?? state.volume,
      enabled: saved.enabled ?? state.enabled,
      preferences: { key: PREFERENCES_KEY }
    })
    // Pick up whatever the visitor chose last time
    state.enabled = player.isEnabled()
    state.pack = player.getPack()
    state.volume = player.getVolume()
    state.ready = true
  }
  return player
}

export function useSound() {
  getPlayer()

  return {
    state: readonly(state),
    // Browsers block audio until the visitor has clicked or pressed a key; a sound from a page load
    // (data arriving, a deck being dealt) would only log a warning, so it's skipped
    play: (cue: CueName, options?: PlayOptions) => {
      if (import.meta.client && navigator.userActivation && !navigator.userActivation.hasBeenActive) return null
      return getPlayer()?.play(cue, options) ?? null
    },
    unlock: () => getPlayer()?.unlock() ?? Promise.resolve(false),
    preload: (cues: CueName[]) => getPlayer()?.preload(cues).catch(() => {}) ?? Promise.resolve(),
    setEnabled(enabled: boolean) {
      getPlayer()?.setEnabled(enabled)
      state.enabled = enabled
    },
    setPack(pack: PackName) {
      getPlayer()?.setPack(pack)
      state.pack = pack
    },
    setVolume(volume: number) {
      getPlayer()?.setVolume(volume)
      state.volume = volume
    }
  }
}
