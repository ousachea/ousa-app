export type ToolIconName = 'qr' | 'phone' | 'compress' | 'case' | 'password' | 'sound'

// Single source of truth for the tools: used by the home grid, the floating nav and each page header.
export interface Tool {
  to: string
  name: string
  summary: string
  color: string
  /** Text colour on top of `color`; light stickers like yellow need dark text */
  onColor?: string
  icon: ToolIconName
}

export const TOOLS: Tool[] = [
  {
    to: '/qr',
    name: 'QR code',
    summary: 'Turn a link or text into a QR code you can download.',
    color: 'var(--blue)',
    icon: 'qr'
  },
  {
    to: '/phone',
    name: 'Phone checker',
    summary: 'Check a Cambodian number and see its network.',
    color: 'var(--red)',
    icon: 'phone'
  },
  {
    to: '/compress',
    name: 'Image compressor',
    summary: 'Make images smaller without uploading them.',
    color: 'var(--orange)',
    icon: 'compress'
  },
  {
    to: '/case',
    name: 'Text case converter',
    summary: 'Switch text between lowercase, UPPERCASE, Title Case and Sentence case.',
    color: 'var(--yellow)',
    onColor: 'var(--ink)',
    icon: 'case'
  },
  {
    to: '/password',
    name: 'Password generator',
    summary: 'Make a strong random password. It never leaves your browser.',
    color: 'var(--green)',
    icon: 'password'
  }
]

export const SETTINGS: Tool = {
  to: '/settings',
  name: 'Settings',
  summary: 'Choose how the app looks and sounds.',
  color: 'var(--settings)',
  icon: 'sound'
}

export const toolFor = (path: string) => [...TOOLS, SETTINGS].find(t => t.to === path)

// Page order drives the transition direction and the forward/back navigation sounds
const PAGE_ORDER = ['/', ...TOOLS.map(t => t.to), SETTINGS.to]

export function pageRank(path: string) {
  const i = PAGE_ORDER.indexOf(path)
  return i === -1 ? PAGE_ORDER.length : i
}
