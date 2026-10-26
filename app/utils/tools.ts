export type ToolIconName =
  | 'qr' | 'phone' | 'compress' | 'case' | 'password' | 'vault' | 'exchange' | 'sound' | 'settings' | 'list'
  | 'things' | 'eat' | 'weight' | 'countdown' | 'renewals' | 'bookmarks' | 'battery' | 'salary' | 'gold'
  | 'trash' | 'activity' | 'plus' | 'search' | 'notes' | 'speed' | 'claude' | 'budget' | 'cv' | 'game'
  | 'days' | 'focus' | 'color' | 'habits' | 'tasks' | 'split' | 'electricity'

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
  /** The app's tabs, each its own page (Countdown: Dates and Renewals); shown under the app's name */
  tabs?: { to: string, label: string }[]
  /** For a tab: the app it belongs to, whose name, icon, colour and pin it shares */
  app?: string
}

export const TOOLS: Tool[] = [
  {
    to: '/qr',
    name: 'QR',
    summary: 'Turn a link or text into a QR code you can download.',
    color: 'var(--blue)',
    icon: 'qr',
    seoTitle: 'Free QR code generator with logo',
    description: 'Make a QR code for any link or text, add your logo, colours and a frame, check it scans, then download it as PNG or SVG. Free, no sign-up.'
  },
  {
    to: '/phone',
    name: 'Phone',
    summary: 'Check a Cambodian number and see its network.',
    color: 'var(--red)',
    icon: 'phone',
    seoTitle: 'Cambodian phone number checker',
    description: 'Check any Cambodian phone number: see if it’s Smart, Cellcard, Metfone or a landline, catch missing digits, and format it for WhatsApp or Telegram.',
    demo: true
  },
  {
    to: '/compress',
    name: 'Compress',
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
    name: 'Text',
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
    name: 'Exchange',
    summary: 'See if an exchange rate makes you gain or lose money.',
    color: 'var(--teal)',
    buttonColor: 'var(--teal-btn)',
    icon: 'exchange',
    seoTitle: 'KHR to USD exchange rate calculator',
    description: 'See today’s riel to dollar rate and find out if a money changer’s rate makes you gain or lose money on your exchange.'
  },
  {
    to: '/things',
    name: 'Things',
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
    name: 'Food',
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
    name: 'Countdown',
    summary: 'Count down to the dates that matter, and see when subscriptions renew.',
    color: 'var(--purple)',
    icon: 'countdown',
    group: 'Life',
    seoTitle: 'Countdown: date countdowns and Cambodian holidays',
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
    name: 'Battery',
    summary: 'See how much of your phone battery is really left compared with when it was new.',
    color: 'var(--cyan)',
    icon: 'battery',
    seoTitle: 'Phone battery health calculator',
    description: 'See how much of your phone battery is really left: capacity in mAh, wear, and hours of screen time, for iPhone, Samsung, Pixel and more.'
  },
  {
    to: '/salary',
    name: 'Salary',
    summary: 'Work out what a raise is really worth after Cambodian salary tax.',
    color: 'var(--slate)',
    icon: 'salary',
    seoTitle: 'Cambodia salary tax and raise calculator',
    description: 'Work out your take-home pay under Cambodian Tax on Salary, and how much of a raise you really keep after tax, overtime and deductions.'
  },
  {
    to: '/speed',
    name: 'Speed',
    summary: 'Test your internet download, upload and ping, and see what it’s good for.',
    color: '#a21caf',
    icon: 'speed',
    seoTitle: 'Internet speed test',
    description: 'Test your internet speed: download, upload, ping and jitter in Mbps, what your connection is good for, and how close you get to your plan.'
  },
  {
    to: '/claude',
    name: 'Claude',
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
    name: 'Gold',
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
    to: '/days',
    name: 'Days',
    summary: 'Count the days between two dates, add days or working days to one, or work out hours between two times.',
    color: 'var(--brown)',
    icon: 'days',
    seoTitle: 'Days between dates, working days and hours',
    description: 'Count the days, weeks and working days between two dates, add days or working days skipping Cambodian holidays, and count hours between two times.'
  },
  {
    to: '/focus',
    name: 'Focus',
    summary: 'Work in 25-minute focus sessions with short breaks in between.',
    color: '#e11d48',
    icon: 'focus',
    seoTitle: 'Pomodoro focus timer',
    description: 'A free Pomodoro timer: 25 minutes of focus, then a short break, and a longer one every fourth session. Set your own lengths, with a sound when time is up.'
  },
  {
    to: '/color',
    name: 'Color',
    summary: 'Pick a colour, copy it as HEX, RGB or HSL, check its contrast, and make gradients, tints and shades.',
    color: '#4f46e5',
    gradient: 'linear-gradient(135deg, #f43f5e 0%, #8b5cf6 50%, #0ea5e9 100%)',
    icon: 'color',
    seoTitle: 'Color picker, contrast checker and gradients',
    description: 'Pick or paste a colour, copy it as HEX, RGB or HSL, check text contrast against WCAG AA and AAA, make CSS gradients, and get tints and shades to copy.'
  },
  {
    to: '/split',
    name: 'Split',
    summary: 'Split a bill between friends, in dollars or riel, with service, VAT and tip shared fairly.',
    color: '#b45309',
    icon: 'split',
    seoTitle: 'Split a bill: who owes what, in dollars or riel',
    description: 'Split a restaurant or trip bill: add people and what each had, share items between some of them, add service, VAT and tip, and see everyone’s share in dollars and riel.'
  },
  {
    to: '/electricity',
    name: 'Electricity',
    summary: 'Work out an EDC bill from the kWh you used, and log your meter to see what each month costs.',
    color: '#f59e0b',
    onColor: '#1b1f2a',
    buttonColor: '#b45309',
    icon: 'electricity',
    seoTitle: 'EDC electricity bill calculator for Cambodia',
    description: 'Work out an EDC electricity bill from your kWh with Cambodia’s household block rates, in riel and dollars, and log meter readings to see each month’s use and cost.',
    demo: true
  },
  {
    to: '/habits',
    name: 'Habits',
    summary: 'Tick off small daily habits and keep your streak going.',
    color: '#0f766e',
    icon: 'habits',
    group: 'Life',
    seoTitle: 'Habit tracker with streaks',
    description: 'Track daily habits: tick each one off, see your streak and best run, fill in a day you forgot, and see the last 12 weeks at a glance. Syncs across your devices.',
    demo: true
  },
  {
    to: '/tasks',
    name: 'Tasks',
    summary: 'A to-do list with due dates, today’s tasks first, and chores that repeat.',
    color: '#1d4ed8',
    icon: 'tasks',
    group: 'Life',
    seoTitle: 'To-do list with due dates and repeating tasks',
    description: 'A simple to-do list: add tasks with a due date, see today’s and overdue ones first, and let chores repeat every day, week or month. Syncs across your devices.',
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
    name: 'CV',
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

// Renewals is Countdown's second tab: its own page and data, under Countdown's name, icon and pin.
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

/** The app a page belongs to: itself, or for a tab like Renewals, the app it's in (Countdown) */
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
