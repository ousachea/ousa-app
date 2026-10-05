// Single source of truth for the tools: used by the home grid, the floating nav and each page header.
export interface Tool {
  to: string
  name: string
  summary: string
  color: string
  glyph: string
}

export const TOOLS: Tool[] = [
  {
    to: '/qr',
    name: 'QR code',
    summary: 'Turn a link or text into a QR code you can download.',
    color: 'var(--blue)',
    glyph: '▦'
  },
  {
    to: '/phone',
    name: 'Phone checker',
    summary: 'Check a Cambodian number and see its network.',
    color: 'var(--red)',
    glyph: '☎'
  },
  {
    to: '/compress',
    name: 'Image compressor',
    summary: 'Make images smaller without uploading them.',
    color: 'var(--orange)',
    glyph: '⇲'
  }
]

export const SETTINGS: Tool = {
  to: '/settings',
  name: 'Settings',
  summary: 'Choose how the app sounds, or turn sound off.',
  color: 'var(--ink)',
  glyph: '⚙'
}

export const toolFor = (path: string) => [...TOOLS, SETTINGS].find(t => t.to === path)

// Page order drives the transition direction and the forward/back navigation sounds
const PAGE_ORDER = ['/', ...TOOLS.map(t => t.to), SETTINGS.to]

export function pageRank(path: string) {
  const i = PAGE_ORDER.indexOf(path)
  return i === -1 ? PAGE_ORDER.length : i
}
