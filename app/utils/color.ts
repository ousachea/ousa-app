// Colour maths for Color tools: parsing what people paste, converting between HEX, RGB and HSL,
// WCAG contrast, and tints and shades.
export interface Rgb { r: number, g: number, b: number }

const clamp255 = (n: number) => Math.min(255, Math.max(0, Math.round(n)))

/** #rgb, #rrggbb (with or without #), rgb(…) or hsl(…); undefined when it isn't a colour */
export function parseColor(input: string): Rgb | undefined {
  const s = input.trim().toLowerCase()
  const hex = s.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/)
  if (hex) {
    const h = hex[1]!.length === 3 ? [...hex[1]!].map(c => c + c).join('') : hex[1]!
    return { r: Number.parseInt(h.slice(0, 2), 16), g: Number.parseInt(h.slice(2, 4), 16), b: Number.parseInt(h.slice(4, 6), 16) }
  }
  const fn = s.match(/^(rgb|hsl)a?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%?[\s,]+([\d.]+)%?\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/)
  if (!fn) return
  const [a, b, c] = [Number(fn[2]), Number(fn[3]), Number(fn[4])]
  if (fn[1] === 'rgb') return a <= 255 && b <= 255 && c <= 255 ? { r: a, g: b, b: c } : undefined
  return b <= 100 && c <= 100 ? hslToRgb(a, b, c) : undefined
}

export const toHex = ({ r, g, b }: Rgb) => `#${[r, g, b].map(n => clamp255(n).toString(16).padStart(2, '0')).join('')}`

export function toHsl({ r, g, b }: Rgb) {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255]
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const l = (max + min) / 2
  const d = max - min
  if (!d) return { h: 0, s: 0, l: Math.round(l * 100) }
  const s = d / (1 - Math.abs(2 * l - 1))
  const h = max === rr ? ((gg - bb) / d) % 6 : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4
  return { h: Math.round((h * 60 + 360) % 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

export function hslToRgb(h: number, s: number, l: number): Rgb {
  const [ss, ll] = [s / 100, l / 100]
  const k = (n: number) => (n + h / 30) % 12
  const a = ss * Math.min(ll, 1 - ll)
  const f = (n: number) => 255 * (ll - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))
  return { r: clamp255(f(0)), g: clamp255(f(8)), b: clamp255(f(4)) }
}

// WCAG 2 relative luminance and contrast ratio, 1 to 21
const channel = (c: number) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
export const luminance = ({ r, g, b }: Rgb) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
export function contrast(a: Rgb, b: Rgb) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/** Black or white, whichever reads better on `bg` */
export const inkOn = (bg: Rgb) => (contrast(bg, { r: 0, g: 0, b: 0 }) >= contrast(bg, { r: 255, g: 255, b: 255 }) ? '#000000' : '#ffffff')

const mix = (a: Rgb, b: Rgb, t: number): Rgb => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t })

/** Tints to white, the colour itself, then shades to black: `steps` each side */
export function scale(c: Rgb, steps = 4) {
  const white = { r: 255, g: 255, b: 255 }
  const black = { r: 0, g: 0, b: 0 }
  const tints = Array.from({ length: steps }, (_, i) => toHex(mix(c, white, (steps - i) / (steps + 1))))
  const shades = Array.from({ length: steps }, (_, i) => toHex(mix(c, black, (i + 1) / (steps + 1))))
  return [...tints, toHex(c), ...shades]
}

/** Hue 0–360, saturation and value 0–100: the colour picker's square is saturation × value */
export function toHsv({ r, g, b }: Rgb) {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255]
  const max = Math.max(rr, gg, bb)
  const d = max - Math.min(rr, gg, bb)
  const h = !d ? 0 : max === rr ? ((gg - bb) / d) % 6 : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4
  return { h: (h * 60 + 360) % 360, s: max ? (d / max) * 100 : 0, v: max * 100 }
}

export function hsvToRgb(h: number, s: number, v: number): Rgb {
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return 255 * (v / 100) * (1 - (s / 100) * Math.max(0, Math.min(k, 4 - k, 1)))
  }
  return { r: clamp255(f(5)), g: clamp255(f(3)), b: clamp255(f(1)) }
}
