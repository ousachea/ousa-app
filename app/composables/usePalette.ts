// The command palette (⌘K / Ctrl+K) and Quick Add share one popup (components/CommandPalette.vue).
// mode 'search': search everything, jump to an app, run a command.
// mode 'add': "What do you want to add?" (A on a page without its own Add, or Add… in the palette).
export type PaletteMode = 'search' | 'add'

const state = reactive({ open: false, mode: 'search' as PaletteMode })

export function usePalette() {
  return {
    palette: readonly(state),
    openPalette(mode: PaletteMode = 'search') {
      state.mode = mode
      state.open = true
    },
    closePalette() {
      state.open = false
    },
    setMode(mode: PaletteMode) {
      state.mode = mode
    }
  }
}

export interface AddOption {
  label: string
  /** App that owns the form; opened with ?add=1 */
  app: string
  hint: string
}

// What Quick Add offers, in the order people reach for them (CHECKLIST.md #08)
export const ADD_OPTIONS: AddOption[] = [
  { label: 'Note', app: '/notes', hint: 'Write something down' },
  { label: 'Bookmark', app: '/bookmarks', hint: 'Save a link' },
  { label: 'Device', app: '/things', hint: 'Something you own' },
  { label: 'Renewal', app: '/renewals', hint: 'A subscription or bill' },
  { label: 'Countdown', app: '/countdown', hint: 'A date to count down to' },
  { label: 'Contact', app: '/phone', hint: 'A name and number' },
  { label: 'Food or place', app: '/eat', hint: 'Somewhere or something to eat' },
  { label: 'Weight', app: '/weight', hint: 'Log today’s weight' },
  { label: 'Gold purchase', app: '/gold', hint: 'Gold you bought' },
  { label: 'Password', app: '/password?tab=saved', hint: 'Save a login in your vault' }
]
