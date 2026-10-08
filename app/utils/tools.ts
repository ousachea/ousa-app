export type ToolIconName =
  | 'qr' | 'phone' | 'compress' | 'case' | 'password' | 'vault' | 'exchange' | 'sound' | 'list'
  | 'things' | 'eat' | 'weight' | 'countdown' | 'renewals' | 'bookmarks' | 'battery' | 'salary' | 'gold'
  | 'trash' | 'activity' | 'plus' | 'search'

export type ToolGroup = 'Tools' | 'Life'

// Single source of truth for the tools: used by the home grid, the floating nav and each page header.
export interface Tool {
  to: string
  name: string
  summary: string
  color: string
  /** Text colour on top of `color`; light stickers like yellow need dark text */
  onColor?: string
  /** A deeper shade for buttons when white text on `color` would be hard to read */
  buttonColor?: string
  icon: ToolIconName
  group?: ToolGroup
  /** Page title for search results and link previews, worded the way people search */
  seoTitle?: string
  /** Meta description, ~120–160 characters */
  description?: string
  /** Has a demo: sample data behind the app icon (or demo files, for the compressor) */
  demo?: boolean
}

export const TOOLS: Tool[] = [
  {
    to: '/qr',
    name: 'QR code',
    summary: 'Turn a link or text into a QR code you can download.',
    color: 'var(--blue)',
    icon: 'qr',
    seoTitle: 'Free QR code generator with logo',
    description: 'Make a QR code for any link or text, add your logo, colours and a frame, check it scans, then download it as PNG or SVG. Free, no sign-up.'
  },
  {
    to: '/phone',
    name: 'Phone checker',
    summary: 'Check a Cambodian number and see its network.',
    color: 'var(--red)',
    icon: 'phone',
    seoTitle: 'Cambodian phone number checker',
    description: 'Check any Cambodian phone number: see if it’s Smart, Cellcard, Metfone or a landline, catch missing digits, and format it for WhatsApp or Telegram.',
    demo: true
  },
  {
    to: '/compress',
    name: 'Image compressor',
    summary: 'Make images and PDFs smaller without uploading them.',
    color: 'var(--orange)',
    buttonColor: 'var(--orange-btn)',
    icon: 'compress',
    seoTitle: 'Compress images and PDFs in your browser',
    description: 'Make JPG, PNG, WebP and PDF files smaller without uploading them. Keep PDF text sharp or shrink scans, compare before and after, and download.',
    demo: true
  },
  {
    to: '/text',
    name: 'Text tools',
    summary: 'Change text to any case, or compare two versions and see exactly what changed.',
    color: 'var(--yellow)',
    onColor: '#1b1f2a',
    icon: 'case',
    seoTitle: 'Text case converter and text compare',
    description: 'Change text to lowercase, UPPERCASE, Title Case or Sentence case, or compare two texts side by side and see every word added, removed or changed.',
    demo: true
  },
  {
    to: '/password',
    name: 'Passwords',
    summary: 'Make strong passwords and save them, encrypted on this device.',
    color: 'var(--green)',
    buttonColor: 'var(--green-btn)',
    icon: 'password',
    seoTitle: 'Strong password generator and saver',
    description: 'Generate strong passwords, see how long they’d take to crack, and save them in an encrypted vault that only you can unlock.'
  },
  {
    to: '/exchange',
    name: 'KHR/USD exchange',
    summary: 'See if an exchange rate makes you gain or lose money.',
    color: 'var(--teal)',
    buttonColor: 'var(--teal-btn)',
    icon: 'exchange',
    seoTitle: 'KHR to USD exchange rate calculator',
    description: 'See today’s riel to dollar rate and find out if a money changer’s rate makes you gain or lose money on your exchange.'
  },
  {
    to: '/things',
    name: 'Things I own',
    summary: 'Keep track of what you own, what you paid and what it’s all worth.',
    color: 'var(--brown)',
    icon: 'things',
    group: 'Life',
    seoTitle: 'Things I own: track what your stuff is worth',
    description: 'Keep a list of your phone, laptop and everything else you own, what you paid, and an estimate of what it’s worth today.',
    demo: true
  },
  {
    to: '/eat',
    name: 'What should I eat?',
    summary: 'Swipe through your saved foods and places until one sounds good.',
    color: 'var(--pink)',
    buttonColor: 'var(--pink-btn)',
    icon: 'eat',
    group: 'Life',
    seoTitle: 'What should I eat? Food picker',
    description: 'Can’t decide what to eat? Swipe through your favourite foods and places until one sounds good, with your own photos.',
    demo: true
  },
  {
    to: '/weight',
    name: 'Weight',
    summary: 'Log your weight and see the trend.',
    color: 'var(--lime)',
    buttonColor: 'var(--lime-btn)',
    icon: 'weight',
    group: 'Life',
    seoTitle: 'Weight tracker with trend chart',
    description: 'Log your weight and see the trend over weeks and months on a clear chart, with your progress toward a goal.',
    demo: true
  },
  {
    to: '/countdown',
    name: 'Countdown',
    summary: 'Count down to the dates that matter.',
    color: 'var(--purple)',
    icon: 'countdown',
    group: 'Life',
    seoTitle: 'Countdown to dates and Cambodian holidays',
    description: 'Count down to birthdays, trips and deadlines, see every Cambodian public holiday coming up, and the live time in Phnom Penh.'
  },
  {
    to: '/renewals',
    name: 'Renewals',
    summary: 'See what your subscriptions cost and when they renew.',
    color: 'var(--indigo)',
    icon: 'renewals',
    group: 'Life',
    seoTitle: 'Subscription and renewal tracker',
    description: 'See what your subscriptions cost each month and year, and what renews in the next 30 days, so nothing charges you by surprise.',
    demo: true
  },
  {
    to: '/bookmarks',
    name: 'Bookmarks',
    summary: 'Save links in folders, and pin the ones you open every day.',
    color: 'var(--rust)',
    icon: 'bookmarks',
    group: 'Life',
    seoTitle: 'Bookmark manager with folders',
    description: 'Save links in nested folders with notes, pin the sites you open every day, and import or export your browser bookmarks.',
    demo: true
  },
  {
    to: '/battery',
    name: 'Phone battery',
    summary: 'See how much of your phone battery is really left compared with when it was new.',
    color: 'var(--cyan)',
    icon: 'battery',
    seoTitle: 'Phone battery health calculator',
    description: 'See how much of your phone battery is really left: capacity in mAh, wear, and hours of screen time, for iPhone, Samsung, Pixel and more.'
  },
  {
    to: '/salary',
    name: 'Salary & raise',
    summary: 'Work out what a raise is really worth after Cambodian salary tax.',
    color: 'var(--slate)',
    icon: 'salary',
    seoTitle: 'Cambodia salary tax and raise calculator',
    description: 'Work out your take-home pay under Cambodian Tax on Salary, and how much of a raise you really keep after tax, overtime and deductions.'
  },
  {
    to: '/gold',
    name: 'Gold tracker',
    summary: 'Live gold price in chi and damlung, and what your gold is worth now.',
    color: 'var(--gold)',
    onColor: '#1b1f2a',
    icon: 'gold',
    group: 'Life',
    seoTitle: 'Gold price in chi and damlung today',
    description: 'Live gold price per chi, damlung and gram for Cambodia, a gold unit converter, and what your gold purchases are worth now.',
    demo: true
  }
]

export const SETTINGS: Tool = {
  to: '/settings',
  name: 'Settings',
  summary: 'Choose how the app looks and sounds.',
  description: 'Choose light or dark mode, lighter effects for older computers, sound effects, and sync your data with Firebase.',
  color: 'var(--settings)',
  icon: 'sound'
}

// Pages that belong to the whole app rather than one tool; kept out of search results
export const TRASH: Tool = {
  to: '/trash',
  name: 'Recycle Bin',
  summary: 'Deleted things wait here for 30 days, so you can put them back.',
  color: 'var(--slate)',
  icon: 'trash'
}

export const toolFor = (path: string) => [...TOOLS, SETTINGS].find(t => t.to === path)

/** Any page with a name and icon, including the Recycle Bin */
export const pageFor = (path: string) => [...TOOLS, SETTINGS, TRASH].find(t => t.to === path)

// Page order drives the transition direction and the forward/back navigation sounds
const PAGE_ORDER = ['/', ...TOOLS.map(t => t.to), SETTINGS.to]

export function pageRank(path: string) {
  const i = PAGE_ORDER.indexOf(path)
  return i === -1 ? PAGE_ORDER.length : i
}
