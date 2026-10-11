// Shared types for Ambient Studio (/ambient-studio). Kept apart from the rest of the app.

export type AmbientCategoryId =
  | 'focus' | 'rain' | 'cozy' | 'nature' | 'ocean' | 'night'
  | 'scifi' | 'lofi' | 'sleep' | 'noise'

export interface AmbientCategory {
  id: AmbientCategoryId
  name: string
  blurb: string
}

/** The sound layers the mixer can build; each one is synthesised in the browser (utils/ambient-studio/synth.ts) */
export type AmbientLayerId =
  | 'rain' | 'thunder' | 'wind' | 'fire' | 'ocean' | 'birds'
  | 'fan' | 'white' | 'pink' | 'brown'

export interface AmbientLayerDef {
  id: AmbientLayerId
  name: string
  /** One line on how it sounds */
  hint: string
}

/** One layer in a mix: how loud, and whether it's muted */
export interface AmbientLayerMix {
  id: AmbientLayerId
  volume: number // 0–1
  muted?: boolean
}

export type AmbientEffect = 'none' | 'rain' | 'droplets' | 'embers' | 'dust' | 'clouds' | 'stars' | 'city'

/** What the YouTube player plays: one video, or a public playlist (optionally starting on a video) */
export interface AmbientYouTubeSource {
  videoId?: string
  playlistId?: string
  /** Title shown before the player reports the real one */
  title?: string
  channel?: string
}

export interface AmbientPreset {
  id: string
  name: string
  description: string
  category: AmbientCategoryId
  tags: string[]
  /** Local artwork under public/ambient-studio/scenes */
  artwork: string
  /** Light scene colour: the studio's accent while this preset is on */
  tint: string
  youtube?: AmbientYouTubeSource
  layers: AmbientLayerMix[]
  /** YouTube volume, 0–100 */
  videoVolume: number
  effect: AmbientEffect
}

/** A mix the listener saved: a preset's scene plus their own layers and video */
export interface AmbientMix extends AmbientPreset {
  custom: true
  basePresetId?: string
  createdAt: number
}

export type AmbientItem = AmbientPreset | AmbientMix

export interface AmbientRecent {
  id: string
  at: number
}

export interface AmbientTimerDefaults {
  focus: number // minutes
  shortBreak: number
  longBreak: number
  /** Focus rounds before a long break */
  rounds: number
  sleep: number
}

export interface AmbientSettings {
  /** YouTube volume a scene starts at when it doesn't set its own, 0–100 */
  defaultVolume: number
  /** Mixer master volume, 0–1 */
  masterVolume: number
  effects: boolean
  /** Calmer motion inside the studio, on top of the system and app-wide setting */
  reduceMotion: boolean
  timer: AmbientTimerDefaults
  /** When a sleep or countdown timer ends: stop the mixer and pause the video */
  stopAtEnd: boolean
  /** Fade the mixer out over the last 30 seconds instead of cutting it */
  fadeOut: boolean
  /** Start the break straight after a focus round ends (and the next round after a break) */
  autoAdvance: boolean
}

export interface AmbientLast {
  /** Preset or mix id, or 'link' for a pasted YouTube link */
  id: string
  link?: AmbientYouTubeSource
}

export interface AmbientStoreV1 {
  version: 1
  favorites: string[]
  recent: AmbientRecent[]
  mixes: AmbientMix[]
  settings: AmbientSettings
  last: AmbientLast | null
}
