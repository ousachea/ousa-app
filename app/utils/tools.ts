export type ToolIconName =
  | 'qr' | 'phone' | 'compress' | 'case' | 'password' | 'vault' | 'exchange' | 'sound' | 'settings' | 'list'
  | 'things' | 'eat' | 'weight' | 'countdown' | 'renewals' | 'bookmarks' | 'battery' | 'salary' | 'gold'
  | 'trash' | 'activity' | 'plus' | 'search' | 'notes' | 'speed' | 'claude' | 'budget' | 'cv' | 'game'

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
  /** Paints the app's icon tile instead of `color` (which still sets its text, buttons and borders) */
  gradient?: string
  /** A page to read, with nothing saved: no Settings or Import & export */
  readOnly?: boolean
  /** The app's tabs, each its own page (Calendar: Dates and Renewals); shown under the app's name */
  tabs?: { to: string, label: string }[]
  /** For a tab: the app it belongs to, whose name, icon, colour and pin it shares */
  app?: string
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
    color: 'var(--plum)',
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
    to: '/budget',
    name: 'Budget',
    summary: 'Track spending, budgets, bills, income and savings goals, in dollars or riel.',
    color: '#047857',
    icon: 'budget',
    group: 'Life',
    seoTitle: 'Budget planner and expense tracker in dollars and riel',
    description: 'Log daily expenses and income in dollars or riel, set monthly budgets, track recurring bills and savings goals, and see where your money goes.',
    demo: true
  },
  {
    to: '/countdown',
    name: 'Calendar',
    summary: 'Count down to the dates that matter, and see when subscriptions renew.',
    color: 'var(--purple)',
    icon: 'countdown',
    group: 'Life',
    seoTitle: 'Calendar: countdowns, Cambodian holidays, renewals and a clock screen saver',
    description: 'Count down to birthdays, trips and deadlines, see Cambodian public holidays and what your subscriptions cost and when they renew, plus a full-screen clock.',
    demo: true,
    tabs: [{ to: '/countdown', label: 'Dates' }, { to: '/renewals', label: 'Renewals' }]
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
    to: '/notes',
    name: 'Notes',
    summary: 'Write things down fast, then find them again.',
    color: 'var(--sky)',
    icon: 'notes',
    group: 'Life',
    seoTitle: 'Fast personal notes with folders, checklists and links',
    description: 'Quick notes and longer ones with checklists, folders, tags, links between notes and version history. Works offline and syncs to your other devices.',
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
    to: '/speed',
    name: 'Speed test',
    summary: 'Test your internet download, upload and ping, and see what it’s good for.',
    color: '#a21caf',
    icon: 'speed',
    seoTitle: 'Internet speed test',
    description: 'Test your internet speed: download, upload, ping and jitter in Mbps, what your connection is good for, and how close you get to your plan.'
  },
  {
    to: '/claude',
    name: 'Claude usage',
    summary: 'What you spend on the Claude API, and how much you use Claude Code.',
    color: '#c2410c',
    icon: 'claude',
    seoTitle: 'Claude API spend and Claude Code usage',
    description: 'See your Claude API spend and tokens by day and model from Anthropic’s Usage and Cost reports, and your Claude Code sessions, tokens and estimated cost by project.',
    // Nothing of yours is saved here: the Admin key stays in the browser and the logs stay on your computer
    readOnly: true
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
  },
  {
    to: '/2048',
    name: '2048',
    summary: 'Slide the tiles, join matching numbers, and reach 2048.',
    color: '#e8590c',
    gradient: 'linear-gradient(135deg, #ffa94d 0%, #f76707 55%, #d9480f 100%)',
    icon: 'game',
    group: 'Life',
    seoTitle: '2048 game: play free in your browser',
    description: 'Play 2048: slide the tiles with the arrow keys or a swipe, join matching numbers and reach 2048. Undo a move, keep your best score, works offline.'
  },
  {
    to: '/cv',
    name: 'Ousa',
    summary: 'My CV: UX/UI, web design and project management, from discovery to delivery.',
    color: '#7c3aed',
    gradient: 'linear-gradient(135deg, #b06cf7 0%, #7c3aed 55%, #5b21b6 100%)',
    icon: 'cv',
    group: 'Life',
    seoTitle: 'Ousa Chea: UX/UI designer and digital project manager in Phnom Penh',
    description: 'Ousa Chea’s CV: 8+ years designing, building and delivering websites and digital products for banks, NGOs and hotels in Cambodia. Available for projects.',
    readOnly: true
  }
]

export const SETTINGS: Tool = {
  to: '/settings',
  name: 'Settings',
  summary: 'Choose how the app looks and sounds.',
  description: 'Theme, accent colour, density, effects, sounds and shortcuts, plus backups and syncing your data with Firebase.',
  color: 'var(--settings)',
  icon: 'settings'
}

// Pages that belong to the whole app rather than one tool; kept out of search results
export const TRASH: Tool = {
  to: '/trash',
  name: 'Recycle Bin',
  summary: 'Deleted things wait here for 30 days, so you can put them back.',
  color: 'var(--slate)',
  icon: 'trash'
}

// Renewals is Calendar's second tab: its own page and data, under Calendar's name, icon and pin.
// Kept out of TOOLS so it isn't listed as an app of its own; its name and icon still label its
// records in activity, search and the Recycle Bin.
export const RENEWALS: Tool = {
  to: '/renewals',
  name: 'Renewals',
  summary: 'See what your subscriptions cost and when they renew.',
  color: 'var(--indigo)',
  icon: 'renewals',
  group: 'Life',
  seoTitle: 'Subscription and renewal tracker',
  description: 'See what your subscriptions cost each month and year, and what renews in the next 30 days, so nothing charges you by surprise.',
  demo: true,
  app: '/countdown'
}

/** Tabs that are pages of their own, inside an app in TOOLS */
export const TAB_PAGES: Tool[] = [RENEWALS]

export const toolFor = (path: string) => [...TOOLS, ...TAB_PAGES, SETTINGS].find(t => t.to === path)

/** Any page with a name and icon, including the Recycle Bin */
export const pageFor = (path: string) => [...TOOLS, ...TAB_PAGES, SETTINGS, TRASH].find(t => t.to === path)

/** The app a page belongs to: itself, or for a tab like Renewals, the app it's in (Calendar) */
export const appFor = (path: string) => {
  const page = toolFor(path)
  return page?.app ? toolFor(page.app) : page
}

// Page order drives the transition direction and the forward/back navigation sounds; an app's tabs sit in order
const PAGE_ORDER = ['/', ...TOOLS.flatMap(t => t.tabs?.map(tab => tab.to) ?? [t.to]), SETTINGS.to]

export function pageRank(path: string) {
  const i = PAGE_ORDER.indexOf(path)
  return i === -1 ? PAGE_ORDER.length : i
}
