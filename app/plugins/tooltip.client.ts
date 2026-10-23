// Hover hints: every `title` in the apps shows as one designed tooltip (.app-tip in
// main.css) instead of the browser's plain box, without touching any page's markup. While the pointer is
// on a control, or keyboard focus is, its title moves to data-tip so the browser's own box never appears,
// and goes back the moment it leaves, so Vue's patches and screen readers see the page as written.
// While a tip shows, the control is described by it; one whose only name was its title keeps that name.
// Touch has no hover, so taps never show one. After one tip, the next shows without the wait.
export default defineNuxtPlugin(() => {
  const DELAY = 450
  const WARM = 400
  const GAP = 8
  const EDGE = 8

  const tip = document.createElement('div')
  tip.className = 'app-tip'
  tip.id = 'app-tip'
  tip.setAttribute('role', 'tooltip')
  document.body.append(tip)

  let owner: HTMLElement | undefined
  let shown = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let warmUntil = 0
  // A tip dismissed by a click stays away until the pointer leaves that control
  let dismissed: HTMLElement | undefined

  // A title set while we hold the control (a Show/Hide label flipping on click) is taken over too
  const watcher = new MutationObserver(() => {
    if (!owner?.hasAttribute('title')) return
    adopt(owner)
    if (shown) place()
  })

  const hasName = (el: HTMLElement) => el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby') || !!el.textContent?.trim()

  function adopt(el: HTMLElement) {
    const title = el.getAttribute('title')
    if (title !== null) {
      el.dataset.tip = title
      el.removeAttribute('title')
    }
    tip.textContent = el.dataset.tip ?? ''
  }

  function release(el: HTMLElement) {
    watcher.disconnect()
    if (el.dataset.tip !== undefined) {
      el.setAttribute('title', el.dataset.tip)
      delete el.dataset.tip
    }
    if (el.dataset.tipLabel) {
      el.removeAttribute('aria-label')
      delete el.dataset.tipLabel
    }
    const ids = (el.getAttribute('aria-describedby') ?? '').split(' ').filter(id => id && id !== tip.id)
    if (ids.length) el.setAttribute('aria-describedby', ids.join(' '))
    else el.removeAttribute('aria-describedby')
  }

  // Above the control, or below when there's no room; nudged in from the sides, the arrow still on target.
  // All the reads, then all the writes, and it moves by translate only.
  function place() {
    if (!owner?.isConnected) return hide()
    const r = owner.getBoundingClientRect()
    const w = tip.offsetWidth
    const h = tip.offsetHeight
    const below = r.top - h - GAP < EDGE
    const cx = r.left + r.width / 2
    const x = Math.min(Math.max(cx - w / 2, EDGE), innerWidth - w - EDGE)
    const y = below ? r.bottom + GAP : r.top - h - GAP
    tip.dataset.side = below ? 'below' : 'above'
    tip.style.setProperty('--tip-x', `${Math.round(x)}px`)
    tip.style.setProperty('--tip-y', `${Math.round(y)}px`)
    tip.style.setProperty('--tip-arrow', `${Math.round(Math.min(Math.max(cx - x, 10), w - 10))}px`)
  }

  function show() {
    if (!owner || !tip.textContent) return
    if (!hasName(owner)) {
      owner.setAttribute('aria-label', tip.textContent)
      owner.dataset.tipLabel = '1'
    } else {
      owner.setAttribute('aria-describedby', [owner.getAttribute('aria-describedby'), tip.id].filter(Boolean).join(' '))
    }
    place()
    tip.classList.add('shown')
    shown = true
  }

  function hold(el: HTMLElement, wait: number) {
    if (owner === el) return
    hide()
    owner = el
    adopt(el)
    watcher.observe(el, { attributes: true, attributeFilter: ['title'] })
    timer = setTimeout(show, Date.now() < warmUntil ? 0 : wait)
  }

  function hide() {
    clearTimeout(timer)
    if (!owner) return
    if (shown) warmUntil = Date.now() + WARM
    release(owner)
    tip.classList.remove('shown')
    owner = undefined
    shown = false
  }

  const holderOf = (target: EventTarget | null) => {
    const el = (target as Element | null)?.closest?.('[title], [data-tip]')
    return el instanceof HTMLElement && !el.closest('[data-no-tip], iframe') ? el : undefined
  }

  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return
    const el = holderOf(e.target)
    if (!el) return hide()
    if (el !== dismissed) hold(el, DELAY)
  })
  document.addEventListener('pointerout', (e) => {
    const to = e.relatedTarget as Node | null
    if (owner && !(to && owner.contains(to))) hide()
    if (dismissed && !(to && dismissed.contains(to))) dismissed = undefined
  })
  document.addEventListener('focusin', (e) => {
    const el = holderOf(e.target)
    if (el && el === e.target && el.matches(':focus-visible')) hold(el, 0)
  })
  document.addEventListener('focusout', () => hide())
  document.addEventListener('pointerdown', () => {
    dismissed = owner
    hide()
  }, true)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && shown) hide()
  }, true)
  addEventListener('scroll', hide, { capture: true, passive: true })
  addEventListener('resize', hide, { passive: true })
})
