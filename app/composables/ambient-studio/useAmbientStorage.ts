import type { AmbientLast, AmbientMix, AmbientRecent, AmbientSettings, AmbientStoreV1 } from '~/types/ambient-studio'
import { AMBIENT_LAYERS } from '~/data/ambient-studio/presets'

// Everything Ambient Studio keeps on this device, under one versioned key of its own.
// The server renders the defaults; the saved copy is read once the page has mounted, so the
// first client render matches the server's HTML. Nothing here touches other apps' keys.

export const AMBIENT_STORAGE_KEY = 'ousa-app:ambient-studio'
const VERSION = 1
const MAX_RECENT = 12
const MAX_MIXES = 100

export const DEFAULT_AMBIENT_SETTINGS: AmbientSettings = {
  defaultVolume: 50,
  masterVolume: 0.8,
  effects: true,
  reduceMotion: false,
  timer: { focus: 25, shortBreak: 5, longBreak: 15, rounds: 4, sleep: 30 },
  stopAtEnd: true,
  fadeOut: true,
  autoAdvance: true
}

const defaults = (): AmbientStoreV1 => ({
  version: VERSION,
  favorites: [],
  recent: [],
  mixes: [],
  settings: structuredClone(DEFAULT_AMBIENT_SETTINGS),
  last: null
})

const store = reactive<AmbientStoreV1>(defaults())
const loaded = ref(false)
let started = false

// ---------- Reading saved data defensively: anything odd falls back to the default ----------

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const num = (v: unknown, min: number, max: number, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback)
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)
const str = (v: unknown, max = 200) => (typeof v === 'string' && v.length <= max ? v : undefined)
const LAYER_IDS = new Set<string>(AMBIENT_LAYERS.map(l => l.id))
const ID = /^[\w-]{1,64}$/

function readSettings(v: unknown): AmbientSettings {
  const d = DEFAULT_AMBIENT_SETTINGS
  if (!isObj(v)) return structuredClone(d)
  const t = isObj(v.timer) ? v.timer : {}
  return {
    defaultVolume: num(v.defaultVolume, 0, 100, d.defaultVolume),
    masterVolume: num(v.masterVolume, 0, 1, d.masterVolume),
    effects: bool(v.effects, d.effects),
    reduceMotion: bool(v.reduceMotion, d.reduceMotion),
    timer: {
      focus: num(t.focus, 1, 180, d.timer.focus),
      shortBreak: num(t.shortBreak, 1, 60, d.timer.shortBreak),
      longBreak: num(t.longBreak, 1, 90, d.timer.longBreak),
      rounds: num(t.rounds, 1, 12, d.timer.rounds),
      sleep: num(t.sleep, 1, 600, d.timer.sleep)
    },
    stopAtEnd: bool(v.stopAtEnd, d.stopAtEnd),
    fadeOut: bool(v.fadeOut, d.fadeOut),
    autoAdvance: bool(v.autoAdvance, d.autoAdvance)
  }
}

function readSource(v: unknown) {
  if (!isObj(v)) return undefined
  const videoId = str(v.videoId, 11)
  const playlistId = str(v.playlistId, 64)
  if (!(videoId && /^[\w-]{11}$/.test(videoId)) && !(playlistId && /^[\w-]{10,64}$/.test(playlistId))) return undefined
  return { videoId, playlistId, title: str(v.title), channel: str(v.channel) }
}

function readMix(v: unknown): AmbientMix | undefined {
  if (!isObj(v) || !str(v.id) || !ID.test(v.id as string) || !str(v.name, 80)) return undefined
  const layers = Array.isArray(v.layers)
    ? v.layers.filter(isObj).filter(l => LAYER_IDS.has(l.id as string)).map(l => ({ id: l.id as AmbientMix['layers'][number]['id'], volume: num(l.volume, 0, 1, 0.5), muted: bool(l.muted, false) }))
    : []
  return {
    id: v.id as string,
    name: v.name as string,
    description: str(v.description, 300) ?? '',
    category: (str(v.category) ?? 'focus') as AmbientMix['category'],
    tags: Array.isArray(v.tags) ? v.tags.filter((t): t is string => typeof t === 'string').slice(0, 20) : [],
    artwork: str(v.artwork)?.startsWith('/ambient-studio/') ? v.artwork as string : '/ambient-studio/scenes/brown-noise-room.svg',
    tint: /^#[0-9a-f]{6}$/i.test(str(v.tint) ?? '') ? v.tint as string : '#c9b8a6',
    youtube: readSource(v.youtube),
    layers: [...new Map(layers.map(l => [l.id, l])).values()],
    videoVolume: num(v.videoVolume, 0, 100, 50),
    effect: (['none', 'rain', 'droplets', 'embers', 'dust', 'clouds', 'stars', 'city'].includes(v.effect as string) ? v.effect : 'none') as AmbientMix['effect'],
    custom: true,
    basePresetId: str(v.basePresetId),
    createdAt: num(v.createdAt, 0, Number.MAX_SAFE_INTEGER, Date.now())
  }
}

function readLast(v: unknown): AmbientLast | null {
  if (!isObj(v) || !str(v.id) || !ID.test(v.id as string)) return null
  if (v.id === 'link') {
    const link = readSource(v.link)
    return link ? { id: 'link', link } : null
  }
  return { id: v.id as string }
}

/** Turn whatever was saved (any version, or junk) into a valid current store */
export function readAmbientStore(raw: unknown): AmbientStoreV1 {
  if (!isObj(raw) || raw.version !== VERSION) return defaults()
  const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && ID.test(x)))] : [])
  const recent: AmbientRecent[] = Array.isArray(raw.recent)
    ? raw.recent.filter(isObj).filter(r => typeof r.id === 'string' && ID.test(r.id)).map(r => ({ id: r.id as string, at: num(r.at, 0, Number.MAX_SAFE_INTEGER, 0) }))
    : []
  const mixes = Array.isArray(raw.mixes) ? raw.mixes.map(readMix).filter((m): m is AmbientMix => !!m) : []
  // One entry per scene, newest first
  const seen = new Set<string>()
  const uniqueRecent = recent.sort((a, b) => b.at - a.at).filter(r => !seen.has(r.id) && !!seen.add(r.id))
  return {
    version: VERSION,
    favorites: ids(raw.favorites),
    recent: uniqueRecent.slice(0, MAX_RECENT),
    mixes: [...new Map(mixes.map(m => [m.id, m])).values()].slice(0, MAX_MIXES),
    settings: readSettings(raw.settings),
    last: readLast(raw.last)
  }
}

function load() {
  try {
    const raw = localStorage.getItem(AMBIENT_STORAGE_KEY)
    Object.assign(store, raw ? readAmbientStore(JSON.parse(raw)) : defaults())
  } catch {
    Object.assign(store, defaults())
  }
}

let saveTimer: number | undefined
let writing = false
function save() {
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    try {
      writing = true
      localStorage.setItem(AMBIENT_STORAGE_KEY, JSON.stringify(store))
    } catch {} finally {
      writing = false
    }
  }, 250)
}

/** Read the saved copy and keep it saved; call once the page has mounted */
export function startAmbientStorage() {
  if (import.meta.server) return
  if (!started) {
    started = true
    load()
    // Its own scope: started from the page, it would otherwise stop saving once you leave and come back
    effectScope(true).run(() => watch(store, save, { deep: true }))
    // Another tab changed it
    window.addEventListener('storage', (e) => {
      if (e.key === AMBIENT_STORAGE_KEY && !writing) load()
    })
  }
  loaded.value = true
}

export function useAmbientStorage() {
  return {
    store,
    /** True once this device's saved copy has been read */
    loaded: readonly(loaded),
    /** Forget everything Ambient Studio saved (and nothing else) */
    resetAll() {
      Object.assign(store, defaults())
      try {
        localStorage.removeItem(AMBIENT_STORAGE_KEY)
      } catch {}
    }
  }
}

export const AMBIENT_LIMITS = { MAX_RECENT, MAX_MIXES }
