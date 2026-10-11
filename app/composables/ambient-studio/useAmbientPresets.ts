import type { AmbientItem, AmbientMix, AmbientPreset } from '~/types/ambient-studio'
import { AMBIENT_CATEGORIES, AMBIENT_PRESETS, categoryName } from '~/data/ambient-studio/presets'
import { AMBIENT_LIMITS, useAmbientStorage } from './useAmbientStorage'

// The library: built-in scenes plus the mixes you saved, with search, favourites and recents.

export const isMix = (item: AmbientItem): item is AmbientMix => 'custom' in item && item.custom === true

export function useAmbientPresets() {
  const { store } = useAmbientStorage()

  const all = computed<AmbientItem[]>(() => [...store.mixes, ...AMBIENT_PRESETS])
  const byId = (id: string) => all.value.find(p => p.id === id)

  /** Search names, categories, descriptions, tags and channel names; every word has to match somewhere */
  function search(query: string, category: string | null = null) {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    return all.value.filter((p) => {
      if (category === 'mine' ? !isMix(p) : category && p.category !== category) return false
      if (!words.length) return true
      const hay = [p.name, p.description, categoryName(p.category), ...p.tags, p.youtube?.title ?? '', p.youtube?.channel ?? '', isMix(p) ? 'my mix saved custom' : '']
        .join(' ')
        .toLowerCase()
      return words.every(w => hay.includes(w))
    })
  }

  /** Save the current mix as a new item in the library */
  function saveMix(name: string, from: Omit<AmbientPreset, 'id' | 'name'>, basePresetId?: string) {
    const mix: AmbientMix = {
      ...structuredClone(toRaw(from)),
      id: `mix-${Date.now().toString(36)}`,
      name: name.trim().slice(0, 80),
      tags: [...new Set([...from.tags, 'mix'])],
      custom: true,
      basePresetId,
      createdAt: Date.now()
    }
    store.mixes = [mix, ...store.mixes].slice(0, AMBIENT_LIMITS.MAX_MIXES)
    return mix
  }

  function deleteMix(id: string) {
    const index = store.mixes.findIndex(m => m.id === id)
    if (index === -1) return undefined
    const [removed] = store.mixes.splice(index, 1)
    const favorite = store.favorites.includes(id)
    store.favorites = store.favorites.filter(f => f !== id)
    store.recent = store.recent.filter(r => r.id !== id)
    return { mix: removed!, index, favorite }
  }

  /** Undo for deleteMix */
  function restoreMix({ mix, index, favorite }: NonNullable<ReturnType<typeof deleteMix>>) {
    if (store.mixes.some(m => m.id === mix.id)) return
    store.mixes.splice(Math.min(index, store.mixes.length), 0, mix)
    if (favorite) store.favorites = [mix.id, ...store.favorites]
  }

  // ---------- Favourites ----------
  const isFavorite = (id: string) => store.favorites.includes(id)
  function toggleFavorite(id: string) {
    store.favorites = isFavorite(id) ? store.favorites.filter(f => f !== id) : [id, ...store.favorites]
  }
  const favorites = computed(() => store.favorites.map(byId).filter((p): p is AmbientItem => !!p))

  // ---------- Recently played ----------
  function addRecent(id: string) {
    store.recent = [{ id, at: Date.now() }, ...store.recent.filter(r => r.id !== id)].slice(0, AMBIENT_LIMITS.MAX_RECENT)
  }
  const removeRecent = (id: string) => (store.recent = store.recent.filter(r => r.id !== id))
  const clearRecent = () => (store.recent = [])
  const recent = computed(() => store.recent.map(r => ({ ...r, item: byId(r.id) })).filter((r): r is { id: string, at: number, item: AmbientItem } => !!r.item))

  return {
    all,
    byId,
    search,
    categories: AMBIENT_CATEGORIES,
    mixes: computed(() => store.mixes),
    saveMix,
    deleteMix,
    restoreMix,
    favorites,
    isFavorite,
    toggleFavorite,
    recent,
    addRecent,
    removeRecent,
    clearRecent
  }
}
