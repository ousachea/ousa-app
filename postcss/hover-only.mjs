// Touch screens keep :hover stuck on whatever was last tapped, so every :hover rule (main.css and each
// component's own) only applies where the pointer can really hover. Rules already inside a hover query,
// and ones that only use :hover inside :not() (they mean "not being pointed at"), are left alone.
function withoutNot (s) {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    if (!s.startsWith(':not(', i)) { out += s[i]; continue }
    let depth = 0
    for (i += 4; i < s.length; i++) {
      if (s[i] === '(') depth++
      else if (s[i] === ')' && --depth === 0) break
    }
  }
  return out
}
const wantsHover = s => withoutNot(s).includes(':hover')

export default function hoverOnly () {
  return {
    postcssPlugin: 'hover-only',
    Rule (rule, { AtRule }) {
      if (!rule.selector.includes(':hover')) return
      for (let p = rule.parent; p; p = p.parent) {
        if (p.type === 'atrule' && (p.name === 'keyframes' || p.params.includes('hover'))) return
      }
      const hover = rule.selectors.filter(wantsHover)
      if (!hover.length) return
      const rest = rule.selectors.filter(s => !wantsHover(s))
      const media = new AtRule({ name: 'media', params: '(hover: hover)' })
      media.append(rule.clone({ selectors: hover }))
      if (rest.length) {
        rule.selectors = rest
        rule.after(media)
      } else {
        rule.replaceWith(media)
      }
    }
  }
}
hoverOnly.postcss = true
