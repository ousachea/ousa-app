// v-ants: a dashed border whose dashes walk round the edge, like marching ants.
//
// Put it on anything with a dashed border. The element keeps its own CSS: while its border is dashed
// (hover colours and all), an SVG copy of that border is drawn on top with the dashes moving, and the
// browser's own border is hidden (see .ants-on in main.css). When a state makes the border solid, or
// removes it, the element's own border shows again.
//
// Dashed outlines can't be hidden that way, so those set --ants-width, --ants-color and --ants-offset
// (like outline-width, outline-color and outline-offset) instead of an outline.

const NS = 'http://www.w3.org/2000/svg'

interface Ants { svg: SVGSVGElement, rect: SVGRectElement, observer?: ResizeObserver }
const all = new Map<HTMLElement, Ants>()

const px = (v: string, of = 0) => (v.endsWith('%') ? (Number.parseFloat(v) / 100) * of : Number.parseFloat(v) || 0)

// How fast the dashes walk, in pixels a second, the same on every border whatever its dash size
const SPEED = 16

// The colour the border is heading to. Hover colours fade in, and the dashes fade with them from
// the start rather than catching up once the border's own fade has finished
function borderColor(el: HTMLElement, s: CSSStyleDeclaration) {
  for (const a of el.getAnimations()) {
    if (a instanceof CSSTransition && a.transitionProperty === 'border-top-color') {
      const end = (a.effect as KeyframeEffect | null)?.getKeyframes().at(-1)?.borderTopColor
      if (typeof end === 'string') return end
    }
  }
  return s.borderTopColor
}

function draw(el: HTMLElement) {
  const ants = all.get(el)
  if (!ants) return
  const s = getComputedStyle(el)
  const custom = !!s.getPropertyValue('--ants-width').trim()
  const dashed = s.borderTopStyle === 'dashed' && px(s.borderTopWidth) > 0
  el.classList.toggle('ants-on', dashed && !custom)
  if (!custom && !dashed) {
    ants.svg.style.display = 'none'
    return
  }

  const border = px(s.borderTopWidth)
  const line = custom ? px(s.getPropertyValue('--ants-width')) : border
  // Moving dashes on a faint 1px line are hard to follow, so they're drawn a touch bolder
  const w = Math.max(line, 1.5)
  // Distance of the line's outer edge outside the border box (negative: inside it)
  const out = custom ? px(s.getPropertyValue('--ants-offset')) + line : 0
  const width = el.offsetWidth + 2 * out
  const height = el.offsetHeight + 2 * out
  const radius = Math.min(px(s.borderTopLeftRadius, el.offsetWidth), el.offsetWidth / 2, el.offsetHeight / 2)

  Object.assign(ants.svg.style, {
    display: '',
    // The SVG sits in the padding box, so step back over the border (and out to an outline)
    left: `${-border - out}px`,
    top: `${-border - out}px`,
    width: `${width}px`,
    height: `${height}px`
  })
  // Centred on the element's own line, so a bolder stroke spreads evenly either side of it
  const inset = line / 2
  const rw = Math.max(0, width - line)
  const rh = Math.max(0, height - line)
  const rr = Math.max(0, Math.min(radius + out - inset, rw / 2, rh / 2))
  const r = ants.rect
  r.setAttribute('x', String(inset))
  r.setAttribute('y', String(inset))
  r.setAttribute('width', String(rw))
  r.setAttribute('height', String(rh))
  r.setAttribute('rx', String(rr))

  // Round caps add half the width to each end of a dash, so the gap allows for them. The pattern is
  // stretched a little so a whole number of dashes fits the way round: otherwise where the line
  // meets itself there's an odd short dash, or a long gap, that sits still while the rest walk
  const dash = Math.max(6, w * 3)
  const gap = Math.max(5, w * 2.5) + w
  // The browser's own measure of the line, so the fit matches how it draws the corners
  const length = r.getTotalLength()
  const fit = length > 0 ? length / (Math.max(1, Math.round(length / (dash + gap))) * (dash + gap)) : 1
  const step = (dash + gap) * fit
  r.style.strokeDasharray = `${(dash * fit).toFixed(3)} ${(gap * fit).toFixed(3)}`
  r.style.setProperty('--ants-step', `${(-step).toFixed(3)}px`)
  r.style.animationDuration = `${(step / SPEED).toFixed(3)}s`
  r.style.strokeWidth = `${w}px`

  // A pale border's colour is deepened a little towards the muted text colour. An outline's colour
  // is read live so it can fade on hover; it's already strong, and may be transparent
  const color = custom ? '' : borderColor(el, s)
  const seen = !/^(transparent|rgba\(.*, 0\))$/.test(color)
  r.style.stroke = custom ? 'var(--ants-color)' : seen ? `color-mix(in srgb, ${color}, var(--ink-3) 50%)` : color
}

// Borders change with hover, focus, dragging and classes; one redraw a frame covers them all
let frame = 0
function redraw() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(() => {
    for (const el of all.keys()) draw(el)
  })
}

let listening = false
function listen() {
  if (listening) return
  listening = true
  for (const type of ['pointerover', 'pointerout', 'focusin', 'focusout', 'click', 'keyup', 'dragstart', 'dragenter', 'dragleave', 'dragend', 'drop', 'transitionend'])
    document.addEventListener(type, redraw, { capture: true, passive: true })
  // Theme switches change the colours
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true })
}

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive<HTMLElement>('ants', {
    mounted(el) {
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
      const svg = document.createElementNS(NS, 'svg')
      svg.classList.add('ants')
      svg.setAttribute('aria-hidden', 'true')
      const rect = document.createElementNS(NS, 'rect')
      svg.append(rect)
      el.append(svg)
      const ants: Ants = { svg, rect }
      if ('ResizeObserver' in window) {
        ants.observer = new ResizeObserver(() => draw(el))
        ants.observer.observe(el)
      }
      all.set(el, ants)
      listen()
      draw(el)
    },
    updated: () => redraw(),
    unmounted(el) {
      const ants = all.get(el)
      ants?.observer?.disconnect()
      ants?.svg.remove()
      all.delete(el)
    },
    getSSRProps: () => ({})
  })
})
