// The apps menu (FloatingNav) is opened from the Apps button in the top bar (SiteBar), or with M.
// One open/closed state shared by both.
export function useAppMenu() {
  const open = useState('app-menu-open', () => false)
  return {
    open,
    toggleMenu() {
      open.value = !open.value
      useSound().play(open.value ? 'open' : 'close')
    }
  }
}
