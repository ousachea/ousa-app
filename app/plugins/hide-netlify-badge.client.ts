// On a *.netlify.app address, Netlify adds its own toolbar (the Netlify Drawer on deploy previews and
// branch deploys) by appending markup just before </body>. It isn't part of the app, so hide whatever
// Netlify puts directly in <body>: its loader script's container, iframes it opens, and its custom
// elements. The app itself lives in #__nuxt and is never touched; other hosts skip all of this.
function isNetlifyChrome(el: Element) {
  if (el.id === '__nuxt' || el.id === 'teleports') return false
  // Only Netlify's own frames and scripts: a dialog teleported here could show a netlify.com favicon
  const NETLIFY_PARTS = 'iframe[src*="netlify" i], script[src*="netlify" i], [data-netlify-deploy-id]'
  return el.tagName.startsWith('NETLIFY')
    || /netlify/i.test(el.id)
    || el.matches(NETLIFY_PARTS)
    || !!el.querySelector(NETLIFY_PARTS)
}

export default defineNuxtPlugin(() => {
  if (!location.hostname.endsWith('.netlify.app')) return

  const hide = (el: Element) => {
    if (el instanceof HTMLElement && isNetlifyChrome(el)) el.style.setProperty('display', 'none', 'important')
  }
  ;[...document.body.children].forEach(hide)

  // The "Powered by Netlify" badge (#nl-badge-frame, on free sites) stays: the bars along the foot of the
  // screen sit above it instead, lifted by however much of the screen's foot it covers (--dock-lift in main.css)
  const root = document.documentElement
  let badge: Element | null = null
  const sizer = new ResizeObserver(() => fitAboveBadge())
  function fitAboveBadge() {
    const rect = badge?.isConnected ? badge.getBoundingClientRect() : undefined
    const covered = rect && rect.height ? Math.max(0, Math.round(innerHeight - rect.top)) : 0
    if (covered) root.style.setProperty('--dock-lift', `${covered}px`)
    else root.style.removeProperty('--dock-lift')
  }
  function watchBadge() {
    const found = document.getElementById('nl-badge-frame')
    if (found === badge) return
    if (badge) sizer.unobserve(badge)
    badge = found
    if (badge) sizer.observe(badge)
    fitAboveBadge()
  }
  watchBadge()
  addEventListener('resize', fitAboveBadge)

  new MutationObserver(records => {
    records.forEach(r => r.addedNodes.forEach(n => n instanceof Element && hide(n)))
    watchBadge()
  }).observe(document.body, { childList: true })
})
