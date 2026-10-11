import type { AmbientCategoryId } from '~/types/ambient-studio'

// Which part of the library is showing, and the search and category filter in Browse.
// Shared by the sidebar, the tabs on smaller screens and the library itself.

export type AmbientView = 'music' | 'home' | 'browse' | 'favorites' | 'recent' | 'mixes'

const ui = reactive({
  view: 'music' as AmbientView,
  query: '',
  category: null as AmbientCategoryId | 'mine' | null
})

export function useAmbientView() {
  function go(view: AmbientView) {
    ui.view = view
  }

  function browse(category: AmbientCategoryId | 'mine' | null = null) {
    ui.category = category
    ui.query = ''
    ui.view = 'browse'
  }

  return { ui, go, browse }
}
