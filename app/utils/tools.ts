export type ToolIconName =
  | 'qr' | 'phone' | 'compress' | 'case' | 'password' | 'vault' | 'exchange' | 'sound' | 'list'
  | 'things' | 'eat' | 'weight' | 'countdown' | 'renewals' | 'phrases' | 'bookmarks'

export type ToolGroup = 'Tools' | 'Life'

// Single source of truth for the tools: used by the home grid, the floating nav and each page header.
export interface Tool {
  to: string
  name: string
  summary: string
  color: string
  /** Text colour on top of `color`; light stickers like yellow need dark text */
  onColor?: string
  icon: ToolIconName
  group?: ToolGroup
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
    name: 'Passwords',
    summary: 'Make strong passwords and save them, encrypted on this device.',
    color: 'var(--green)',
    icon: 'password'
  },
  {
    to: '/exchange',
    name: 'KHR/USD exchange',
    summary: 'See if an exchange rate makes you gain or lose money.',
    color: 'var(--teal)',
    icon: 'exchange'
  },
  {
    to: '/things',
    name: 'Things I own',
    summary: 'Keep track of what you own, what you paid and what it’s all worth.',
    color: 'var(--brown)',
    icon: 'things',
    group: 'Life'
  },
  {
    to: '/eat',
    name: 'What should I eat?',
    summary: 'Swipe through your saved foods and places until one sounds good.',
    color: 'var(--pink)',
    icon: 'eat',
    group: 'Life'
  },
  {
    to: '/weight',
    name: 'Weight',
    summary: 'Log your weight and see the trend.',
    color: 'var(--lime)',
    icon: 'weight',
    group: 'Life'
  },
  {
    to: '/countdown',
    name: 'Countdown',
    summary: 'Count down to the dates that matter.',
    color: 'var(--purple)',
    icon: 'countdown',
    group: 'Life'
  },
  {
    to: '/renewals',
    name: 'Renewals',
    summary: 'See what your subscriptions cost and when they renew.',
    color: 'var(--indigo)',
    icon: 'renewals',
    group: 'Life'
  },
  {
    to: '/phrases',
    name: 'Phrase bank',
    summary: 'Save useful English and Khmer phrases for work.',
    color: 'var(--sky)',
    icon: 'phrases',
    group: 'Life'
  },
  {
    to: '/bookmarks',
    name: 'Bookmarks',
    summary: 'Save links with tags and notes, and pin the ones you open every day.',
    color: 'var(--rust)',
    icon: 'bookmarks',
    group: 'Life'
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
