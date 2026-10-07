// Two directives for long pages.
//
// v-sticky-fit, on a column that CSS makes `position: sticky`: when the column is taller than the window,
// it pins by its bottom edge instead of its top, so every part of it can still be scrolled into view.
// CSS stays in charge of when a column is sticky (usually only on wide screens); this only adjusts `top`.
//
// v-sticky-bar, on a search/sort/filter bar: keeps it pinned under the back and menu buttons while a long
// list scrolls past, and adds `is-stuck` once it's pinned so it can show a backing (see .sticky-bar in main.css).

const BOTTOM_GAP = 16

interface Tracked { update: () => void, observer?: ResizeObserver }
const fits = new Map<HTMLElement, Tracked>()
const bars = new Set<HTMLElement>()
let listening = false

function fitColumn(el: HTMLElement) {
  el.style.top = ''
  const style = getComputedStyle(el)
  if (style.position !== 'sticky') return
  const base = Number.parseFloat(style.top) || 0
  const fit = window.innerHeight - el.offsetHeight - BOTTOM_GAP
  if (fit < base) el.style.top = `${fit}px`
}

function checkBars() {
  for (const el of bars) {
    const top = Number.parseFloat(getComputedStyle(el).top) || 0
    el.classList.toggle('is-stuck', el.getBoundingClientRect().top <= top + 1 && window.scrollY > 0)
  }
}

let frame = 0
function onChange() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(() => {
    for (const t of fits.values()) t.update()
    checkBars()
  })
}

function listen() {
  if (listening) return
  listening = true
  window.addEventListener('scroll', onChange, { passive: true })
  window.addEventListener('resize', onChange)
}

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive<HTMLElement>('sticky-fit', {
    mounted(el) {
      const tracked: Tracked = { update: () => fitColumn(el) }
      // The column grows and shrinks as its content changes (lists filling in, panels opening)
      if ('ResizeObserver' in window) {
        tracked.observer = new ResizeObserver(() => tracked.update())
        tracked.observer.observe(el)
      }
      fits.set(el, tracked)
      listen()
      tracked.update()
    },
    unmounted(el) {
      fits.get(el)?.observer?.disconnect()
      fits.delete(el)
    },
    getSSRProps: () => ({})
  })

  nuxtApp.vueApp.directive<HTMLElement>('sticky-bar', {
    mounted(el) {
      el.classList.add('sticky-bar')
      bars.add(el)
      listen()
      checkBars()
    },
    unmounted(el) {
      bars.delete(el)
    },
    getSSRProps: () => ({ class: 'sticky-bar' })
  })
})
