import QRCode from 'qrcode'

// Draws a QR code as SVG from the raw module matrix, so it can be styled and decorated.
// Coordinates are in "modules" (one QR square = 1 unit); the SVG scales to any size.

export type Level = 'L' | 'M' | 'Q' | 'H'
export type DotStyle = 'square' | 'rounded' | 'dots'
export type CornerStyle = 'square' | 'rounded' | 'circle'
export type PlateShape = 'square' | 'circle' | 'none'

export interface QrLogo {
  // Either an uploaded image (data URL) or a built-in icon
  image?: string
  icon?: QrIcon
  iconColor: string
  plate: PlateShape
  plateColor: string
  size: number // fraction of the code's width, 0.12–0.3
}

export interface QrFrame {
  caption: string
  color: string
  textColor: string
}

export interface QrDesign {
  text: string
  level: Level
  fg: string
  fg2?: string // gradient end colour; undefined = solid
  bg: string | null // null = transparent
  dots: DotStyle
  corners: CornerStyle
  logo?: QrLogo
  frame?: QrFrame
}

export interface QrIcon {
  id: string
  label: string
  viewBox: string
  markup: string
  // Multi-coloured icons keep their own colours instead of using the icon colour
  colored?: boolean
}

export const QR_ICONS: QrIcon[] = [
  { id: 'link', label: 'Link', viewBox: '0 0 24 24', markup: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>' },
  { id: 'wifi', label: 'Wi-Fi', viewBox: '0 0 24 24', markup: '<path d="M2.5 9a14 14 0 0 1 19 0"/><path d="M5.5 12.5a9.5 9.5 0 0 1 13 0"/><path d="M8.6 16a5 5 0 0 1 6.8 0"/><circle cx="12" cy="19.5" r="1.3" fill="currentColor" stroke="none"/>' },
  { id: 'phone', label: 'Phone', viewBox: '0 0 24 24', markup: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18.5h2"/>' },
  { id: 'mail', label: 'Email', viewBox: '0 0 24 24', markup: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>' },
  { id: 'pin', label: 'Location', viewBox: '0 0 24 24', markup: '<path d="M12 21.5s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9.5" r="2.5"/>' },
  { id: 'heart', label: 'Heart', viewBox: '0 0 24 24', markup: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>' },
  { id: 'star', label: 'Star', viewBox: '0 0 24 24', markup: '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/>' },
  {
    id: 'cube',
    label: 'Ousa’s Apps',
    viewBox: '0 0 32 32',
    colored: true,
    markup: '<rect width="32" height="32" rx="7" fill="#1b1f2a"/>'
      + [['#1f5bd8', '#d7263d', '#f7c324'], ['#179a54', '#ffffff', '#ef7d16'], ['#ef7d16', '#f7c324', '#1f5bd8']]
        .flatMap((row, y) => row.map((c, x) => `<rect x="${3 + x * 9}" y="${3 + y * 9}" width="8" height="8" rx="2" fill="${c}"/>`))
        .join('')
  }
]

// Centres of the alignment patterns for a QR version (ISO/IEC 18004 table, computed)
function alignmentPositions(version: number) {
  if (version < 2) return []
  const size = version * 4 + 17
  const count = Math.floor(version / 7) + 2
  const step = version === 32 ? 26 : Math.ceil((size - 13) / (count * 2 - 2)) * 2
  const out = [6]
  for (let i = count - 1, p = size - 7; i > 0; i--, p -= step) out.splice(1, 0, p)
  return out
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[c]!)
const r = (n: number) => Math.round(n * 1000) / 1000

export interface QrSvgResult {
  svg: string
  width: number // in modules, for aspect ratio
  height: number
}

export function buildQrSvg(d: QrDesign): QrSvgResult {
  // A logo hides part of the code, so it always gets the highest error correction
  const qr = QRCode.create(d.text, { errorCorrectionLevel: d.logo ? 'H' : d.level })
  const n = qr.modules.size
  const at = (row: number, col: number) => qr.modules.data[row * n + col] === 1

  const margin = d.frame ? 3 : 2 // room for the frame line while keeping a quiet zone inside it
  const W = n + margin * 2
  const band = d.frame ? Math.round(W * 0.16) : 0
  const H = W + band
  const paint = d.fg2 ? 'url(#qr-fill)' : d.fg

  const finders = [[0, 0], [0, n - 7], [n - 7, 0]] as const
  const inFinder = (row: number, col: number) => finders.some(([fr, fc]) => row >= fr && row < fr + 7 && col >= fc && col < fc + 7)

  // Clear the modules under the logo so its plate sits on a clean area
  let logoBox: { x: number, y: number, s: number } | undefined
  if (d.logo) {
    let s = Math.round(n * d.logo.size)
    if (s % 2 !== n % 2) s++ // keep it centred on the module grid
    const start = (n - s) / 2
    logoBox = { x: start, y: start, s }
  }
  const underLogo = (row: number, col: number) =>
    !!logoBox && row >= logoBox.y && row < logoBox.y + logoBox.s && col >= logoBox.x && col < logoBox.x + logoBox.s

  // Alignment patterns are drawn whole (ring + centre) in the corner style. Scanners rely on them to
  // correct perspective, and drawing them as loose dots made codes fail to decode in testing.
  const centres = alignmentPositions(qr.version)
  const nearFinder = (pr: number, pc: number) => (pr < 9 && pc < 9) || (pr < 9 && pc > n - 10) || (pr > n - 10 && pc < 9)
  const inAlignment = (row: number, col: number) =>
    centres.some(pr => centres.some(pc => !nearFinder(pr, pc) && Math.abs(row - pr) <= 2 && Math.abs(col - pc) <= 2))

  const parts: string[] = []
  let squares = ''
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (!at(row, col) || inFinder(row, col) || underLogo(row, col)) continue
      const x = col + margin
      const y = row + margin
      // Sizes chosen by decode testing: smaller dots or wider gaps stopped some scanners reading the code
      if (inAlignment(row, col)) continue
      if (d.dots === 'square') squares += `M${x} ${y}h1v1h-1z`
      else if (d.dots === 'dots') parts.push(`<circle cx="${x + 0.5}" cy="${y + 0.5}" r="0.46"/>`)
      else parts.push(`<rect x="${x + 0.04}" y="${y + 0.04}" width="0.92" height="0.92" rx="0.32"/>`)
    }
  }
  if (squares) parts.unshift(`<path d="${squares}"/>`)

  // Finder patterns drawn as a ring plus a centre, so their shape can change
  for (const [fr, fc] of finders) {
    const x = fc + margin
    const y = fr + margin
    if (d.corners === 'circle') {
      parts.push(`<circle cx="${x + 3.5}" cy="${y + 3.5}" r="3" fill="none" stroke="${paint}" stroke-width="1"/>`)
      parts.push(`<circle cx="${x + 3.5}" cy="${y + 3.5}" r="1.5"/>`)
    } else {
      const rx = d.corners === 'rounded' ? 1.6 : 0
      parts.push(`<rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" rx="${rx}" fill="none" stroke="${paint}" stroke-width="1"/>`)
      parts.push(`<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="${rx ? 0.8 : 0}"/>`)
    }
  }

  for (const pr of centres) {
    for (const pc of centres) {
      if (nearFinder(pr, pc)) continue
      const cx = pc + margin + 0.5
      const cy = pr + margin + 0.5
      if (d.corners === 'circle') {
        parts.push(`<circle cx="${cx}" cy="${cy}" r="2" fill="none" stroke="${paint}" stroke-width="1"/>`)
        parts.push(`<circle cx="${cx}" cy="${cy}" r="0.6"/>`)
      } else {
        const rx = d.corners === 'rounded' ? 1 : 0
        parts.push(`<rect x="${cx - 2}" y="${cy - 2}" width="4" height="4" rx="${rx}" fill="none" stroke="${paint}" stroke-width="1"/>`)
        parts.push(`<rect x="${cx - 0.5}" y="${cy - 0.5}" width="1" height="1" rx="${rx ? 0.3 : 0}"/>`)
      }
    }
  }

  const out: string[] = []
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 10}" height="${H * 10}" shape-rendering="${d.dots === 'square' && d.corners === 'square' ? 'crispEdges' : 'geometricPrecision'}">`)
  out.push('<defs>')
  if (d.fg2) {
    out.push(`<linearGradient id="qr-fill" gradientUnits="userSpaceOnUse" x1="${margin}" y1="${margin}" x2="${margin + n}" y2="${margin + n}"><stop offset="0" stop-color="${d.fg}"/><stop offset="1" stop-color="${d.fg2}"/></linearGradient>`)
  }
  if (logoBox && d.logo?.image && d.logo.plate === 'circle') {
    const c = margin + logoBox.x + logoBox.s / 2
    out.push(`<clipPath id="qr-logo-clip"><circle cx="${c}" cy="${c}" r="${r(logoBox.s * 0.36)}"/></clipPath>`)
  }
  out.push('</defs>')

  if (d.bg) out.push(`<rect width="${W}" height="${H}" rx="${d.frame ? 2.2 : 0}" fill="${d.bg}"/>`)

  if (d.frame) {
    out.push(`<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="2" fill="none" stroke="${d.frame.color}" stroke-width="1"/>`)
    out.push(`<path d="M0 ${W}h${W}v${band - 2.2}a2.2 2.2 0 0 1-2.2 2.2H2.2A2.2 2.2 0 0 1 0 ${H - 2.2}z" fill="${d.frame.color}"/>`)
    out.push(`<text x="${W / 2}" y="${r(W + band * 0.52)}" fill="${d.frame.textColor}" font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" font-weight="700" font-size="${r(band * 0.42)}" text-anchor="middle" dominant-baseline="middle">${esc(d.frame.caption)}</text>`)
  }

  out.push(`<g fill="${paint}">${parts.join('')}</g>`)

  if (logoBox && d.logo) {
    const x = margin + logoBox.x
    const y = margin + logoBox.y
    const s = logoBox.s
    const c = s / 2
    if (d.logo.plate === 'square') out.push(`<rect x="${x + 0.25}" y="${y + 0.25}" width="${s - 0.5}" height="${s - 0.5}" rx="${r(s * 0.22)}" fill="${d.logo.plateColor}"/>`)
    if (d.logo.plate === 'circle') out.push(`<circle cx="${x + c}" cy="${y + c}" r="${r(s / 2 - 0.25)}" fill="${d.logo.plateColor}"/>`)

    const inset = d.logo.plate === 'none' ? 0 : s * 0.16
    const box = `x="${r(x + inset)}" y="${r(y + inset)}" width="${r(s - inset * 2)}" height="${r(s - inset * 2)}"`
    if (d.logo.image) {
      const clip = d.logo.plate === 'circle' ? ' clip-path="url(#qr-logo-clip)"' : ''
      out.push(`<image ${box} href="${esc(d.logo.image)}" preserveAspectRatio="xMidYMid meet"${clip}/>`)
    } else if (d.logo.icon) {
      const icon = d.logo.icon
      const style = icon.colored ? '' : ` fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" color="${d.logo.iconColor}"`
      out.push(`<svg ${box} viewBox="${icon.viewBox}"${style}>${icon.markup}</svg>`)
    }
  }

  out.push('</svg>')
  return { svg: out.join(''), width: W, height: H }
}

// WCAG relative luminance and contrast, used to warn about codes that won't scan well
function luminance(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return 0
  const [rr, gg, bb] = [0, 2, 4].map(i => parseInt(m[1]!.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * rr! + 0.7152 * gg! + 0.0722 * bb!
}

export function contrastRatio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

export const isLighter = (a: string, b: string) => luminance(a) > luminance(b)
