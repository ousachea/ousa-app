import { toast } from 'vue-sonner'
import type { MenuEntry } from '~/composables/useContextMenu'

// The browser's own right-click menu never shows: rows with a menu of their own (useRowMenu) open it,
// and anywhere else opens the app's menu with what fits where you clicked: a link, selected text, or the page.
// Text fields keep the browser's menu, for spelling suggestions and paste. Shift + right-click still gives it too.
// Touch screens are left alone: a long press there selects text or opens a row's own sheet.
const TYPING = 'input, textarea, select, [contenteditable]:not([contenteditable=false])'

export default defineNuxtPlugin(() => {
  const { openMenu } = useContextMenu()
  const { openPalette } = usePalette()
  const router = useRouter()

  const copy = (text: string, what: string) => {
    navigator.clipboard.writeText(text).then(() => toast(`${what} copied`), () => toast.error('Couldn’t copy'))
  }

  document.addEventListener('contextmenu', (e) => {
    // A row's own menu already opened
    if (e.defaultPrevented || e.shiftKey || matchMedia('(pointer: coarse)').matches) return
    const target = e.target as HTMLElement
    if (target.closest?.(TYPING)) return
    e.preventDefault()

    const items: MenuEntry[] = []
    const link = target.closest?.<HTMLAnchorElement>('a[href]')
    if (link) {
      const href = link.href
      const inApp = link.origin === location.origin
      items.push(
        { label: 'Open', icon: 'open', run: () => (inApp ? router.push(link.pathname + link.search + link.hash) : window.open(href, '_blank', 'noopener')) },
        { label: 'Open in new tab', icon: 'new-tab', run: () => window.open(href, '_blank', 'noopener') },
        { label: 'Copy link', icon: 'copy', run: () => copy(href, 'Link') },
        '-'
      )
    }
    const selected = window.getSelection()?.toString().trim()
    if (selected) items.push({ label: 'Copy', icon: 'copy', run: () => copy(selected, 'Text') }, '-')
    items.push(
      { label: 'Search everything', icon: 'search', run: () => openPalette() },
      { label: 'Back', icon: 'restore', disabled: history.length < 2, run: () => router.back() },
      { label: 'Reload', icon: 'refresh', run: () => location.reload() }
    )
    openMenu(e, items)
  })
})
