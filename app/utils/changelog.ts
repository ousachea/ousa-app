// What's new in each app, newest release first. Each app has its own version:
// a new major number for a redesign, minor for new features, patch for fixes.
// Add a release here whenever an app changes; the header shows the top one and lists them all.

export interface Release {
  version: string
  date: string // yyyy-mm-dd
  changes: string[]
}

// Improvements every app picked up on 7 October 2026
const WIDE = 'Uses the full width of wide screens instead of leaving big empty margins.'
const STICKY = 'Long pages keep the important part in view while you scroll.'
const PICKERS = 'New date picker and dropdowns in the app’s own style.'
const POPUP_EDIT = 'Editing opens in a popup.'
const TWO_CLICK = 'Delete now asks for a second click, so nothing goes by accident.'
const SYNC = 'Sign in with Google to keep it in your account and see it on all your devices.'
const EXAMPLE = 'Try it with example data: click the app’s icon.'

// Improvements every tracker picked up on 8 October 2026
const BIN = 'Deleting moves things to the Recycle Bin, with Undo, so nothing is gone for good by accident.'
const UNDO = 'Undo straight after adding or changing something.'
const DRAFTS = 'Close the add form halfway and it remembers what you typed.'
const MENU = 'Right-click, or long-press on a phone, for quick actions.'
const SWIPE = 'On a phone, swipe a row left to delete it, or pull down to refresh.'
const TRANSFER = 'Import and export as CSV or JSON.'
const CHECK = 'Missing details are pointed out right where they go.'
const OFFLINE = 'Keeps working offline, with the last saved data; changes sync when you’re back.'

// Changes to the app as a whole (search, menu, settings…), newest first; shown in Settings → About
export const APP_RELEASES: Release[] = [
  {
    version: '2.0.0',
    date: '2026-10-08',
    changes: [
      'Search everything and run commands from anywhere with ⌘K or Ctrl+K.',
      'Press A on any page to add something, or pick what to add.',
      'A Recycle Bin for everything you delete, with restore and delete for good.',
      'Recent activity on the home page: what you added, changed and deleted.',
      'Pin your favourite apps to the top of the menu and home page, in any order.',
      'Back up everything to one file and restore it, with a preview first.',
      'Install it as an app on your computer or phone, and use it offline.',
      'Settings for density, animations, keyboard shortcuts, confirming deletes and autosave.',
      'Friendlier errors, loading placeholders and empty pages that say what to do next.'
    ]
  },
  { version: '1.0.0', date: '2026-10-05', changes: ['Ousa’s Apps: everyday tools and trackers in one place.'] }
]

export const CHANGELOG: Record<string, Release[]> = {
  '/qr': [
    { version: '1.2.0', date: '2026-10-07', changes: [WIDE, 'The preview stays in view while you change the style.'] },
    { version: '1.1.0', date: '2026-10-05', changes: ['Dark mode.', 'Its own design, with colours, shapes and a logo or frame for your code.'] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Turn a link or text into a QR code you can download.', 'Sound effects and smooth page transitions.'] }
  ],
  '/phone': [
    { version: '1.2.1', date: '2026-10-07', changes: ['The page no longer runs wider than a phone screen.', 'Small buttons like Edit and Delete are easier to tap on touch screens.'] },
    { version: '1.2.0', date: '2026-10-07', changes: ['Import your contacts straight from Google with your Google sign-in.', 'On wide screens the checker sits beside your contacts, which read across in columns.', 'Network filters and search stay pinned while a long address book scrolls.'] },
    { version: '1.1.0', date: '2026-10-05', changes: ['Check a whole contacts file at once and catch numbers missing a digit.', EXAMPLE] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Check a Cambodian number and see its network.', 'Dark mode.'] }
  ],
  '/compress': [
    { version: '1.2.0', date: '2026-10-07', changes: [PICKERS, WIDE] },
    { version: '1.1.0', date: '2026-10-05', changes: ['Shrink PDFs too: make the photos inside smaller, or redraw each page.', 'No files handy? Try it with three example files.'] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Make images smaller without uploading them.', 'Dark mode.'] }
  ],
  '/case': [
    { version: '1.2.0', date: '2026-10-07', changes: [WIDE] },
    { version: '1.1.0', date: '2026-10-05', changes: ['Dark mode and its own design.', EXAMPLE] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Switch text between lowercase, UPPERCASE, Title Case and Sentence case.'] }
  ],
  '/password': [
    { version: '2.0.0', date: '2026-10-07', changes: ['Sign in with your Google account. The vault keeps its own master password, which never leaves your device.', 'On wide screens the password and its settings sit side by side.', 'Adding and editing a saved password opens in a popup.', TWO_CLICK] },
    { version: '1.2.0', date: '2026-10-06', changes: ['Reset a forgotten master password by email.', 'Master passwords can be 6 characters or more.'] },
    { version: '1.1.0', date: '2026-10-05', changes: ['Save passwords in a vault, encrypted on your device before they’re stored.'] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Generate strong passwords and see how long they’d take to crack.', 'Dark mode.'] }
  ],
  '/exchange': [
    { version: '1.2.0', date: '2026-10-08', changes: ['Offline, or if the rate service is down, it uses the last rate seen on this device and says when it was from.', 'On a phone, pull down for a fresh rate.'] },
    { version: '1.1.1', date: '2026-10-07', changes: ['The page no longer runs wider than small phone screens.', 'Small buttons like Edit and Delete are easier to tap on touch screens.'] },
    { version: '1.1.0', date: '2026-10-07', changes: ['On wide screens the gain-or-loss receipt sits beside the inputs and stays in view.'] },
    { version: '1.0.0', date: '2026-10-05', changes: ['See if an exchange rate makes you gain or lose money, or track an exchange you made.'] }
  ],
  '/battery': [
    { version: '1.1.1', date: '2026-10-07', changes: ['The phone model search no longer makes iPhones zoom in when you tap it.', 'Small buttons like Edit and Delete are easier to tap on touch screens.'] },
    { version: '1.1.0', date: '2026-10-07', changes: [WIDE, 'The results stay in view, and fully reachable, while you scroll.'] },
    { version: '1.0.0', date: '2026-10-05', changes: ['See how much of your phone battery is really left compared with when it was new.'] }
  ],
  '/salary': [
    { version: '1.1.1', date: '2026-10-07', changes: ['The raise-every-year table fits a phone screen without scrolling sideways.', 'The tax band boxes no longer make iPhones zoom in, and the switches are easier to tap.', 'Small buttons like Edit and Delete are easier to tap on touch screens.'] },
    { version: '1.1.0', date: '2026-10-07', changes: [WIDE, 'The pay statement stays in view, and fully reachable, while you scroll.'] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Work out what a raise is really worth after Cambodian salary tax.'] }
  ],
  '/things': [
    { version: '2.1.0', date: '2026-10-08', changes: [TRANSFER, 'Adding something with the same name as one you have asks first.', 'Worth now and notes tuck under More details until you need them.', 'New items start in the category and currency you used last.', MENU, SWIPE, BIN, UNDO, DRAFTS, CHECK] },
    { version: '2.0.0', date: '2026-10-07', changes: ['New design: a summary showing where your value is, and cards comparing what you paid with what it’s worth now.', 'Each card shows how much of its price it still keeps.', SYNC, PICKERS, 'Search and sort stay pinned while you scroll.', TWO_CLICK] },
    { version: '1.1.0', date: '2026-10-05', changes: [EXAMPLE] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Keep track of what you own, what you paid and what it’s worth now.'] }
  ],
  '/eat': [
    { version: '1.5.0', date: '2026-10-08', changes: [BIN, UNDO, DRAFTS, CHECK] },
    { version: '1.4.0', date: '2026-10-07', changes: ['Focus mode: swipe full screen with bigger cards and nothing else in the way. The app opens in it; Done or Esc takes you back.', 'A big, centred Narrow it down button under your shortlist.', 'When you’ve gone through every card, narrowing down starts on its own, or your only pick is chosen.'] },
    { version: '1.3.1', date: '2026-10-07', changes: ['The Everything / Foods / Places filter fits on a phone, and your foods show three across.', 'Small buttons like Edit and Delete are easier to tap on touch screens.'] },
    { version: '1.3.0', date: '2026-10-07', changes: ['Use a link to any image on the web as a photo, when adding or editing. It works on every device and syncs with the item.', 'Remove a photo from the edit popup.'] },
    { version: '1.2.0', date: '2026-10-07', changes: ['Narrow it down: compare your shortlist two at a time until one is left.', 'Edit your foods and places in a popup.', 'On wide screens the cards sit beside your list.', SYNC, TWO_CLICK, 'Fixed: example data now deals a full deck of cards.'] },
    { version: '1.1.0', date: '2026-10-05', changes: ['Add photos to your foods and places.', EXAMPLE] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Swipe through your saved foods and places until one sounds good.'] }
  ],
  '/weight': [
    { version: '1.3.0', date: '2026-10-08', changes: [BIN, UNDO, CHECK, 'On a phone, pull down to sync.'] },
    { version: '1.2.1', date: '2026-10-07', changes: ['The log form and trend use the whole phone screen, and the weight box no longer spills out.', 'Small buttons like Edit and Delete are easier to tap on touch screens.'] },
    { version: '1.2.0', date: '2026-10-07', changes: [PICKERS, 'The trend chart uses the full width.', SYNC, TWO_CLICK] },
    { version: '1.1.0', date: '2026-10-05', changes: [EXAMPLE] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Log your weight and see the trend.'] }
  ],
  '/countdown': [
    { version: '2.1.0', date: '2026-10-08', changes: ['The holiday list works offline from the last copy saved on this device.', MENU, SWIPE, BIN, UNDO, DRAFTS, CHECK] },
    { version: '2.0.0', date: '2026-10-07', changes: ['The next date gets a banner with a live clock and how much of the wait is done.', 'Add any countdown to Google Calendar, or to Apple, Outlook or your phone.', PICKERS, POPUP_EDIT, SYNC, STICKY, TWO_CLICK] },
    { version: '1.1.0', date: '2026-10-05', changes: ['Cambodian public holidays, fetched fresh each year, and a live Phnom Penh clock.'] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Count down to the dates that matter.'] }
  ],
  '/renewals': [
    { version: '1.4.0', date: '2026-10-08', changes: ['Sort by soonest, most expensive or name.', 'Give subscriptions a category; well-known services suggest one.', TRANSFER, 'New subscriptions start with the currency and billing you used last.', MENU, SWIPE, BIN, UNDO, DRAFTS, CHECK] },
    { version: '1.3.1', date: '2026-10-07', changes: ['The 30-day timeline stays readable on a phone: short names, no overlapping prices.', 'Small buttons like Edit and Delete are easier to tap on touch screens.'] },
    { version: '1.3.0', date: '2026-10-07', changes: ['Add a subscription to your calendar as a repeating event: Google Calendar, or Apple, Outlook and phones with an .ics file.', 'Billing on the 29th–31st lands on the last day of shorter months, just like real billing.'] },
    { version: '1.2.0', date: '2026-10-07', changes: ['On wide screens the 30-day timeline spans the page and subscriptions sit side by side.', PICKERS, SYNC, TWO_CLICK] },
    { version: '1.1.0', date: '2026-10-05', changes: [EXAMPLE] },
    { version: '1.0.0', date: '2026-10-05', changes: ['See what your subscriptions cost each month and year, and what renews soon.'] }
  ],
  '/bookmarks': [
    { version: '1.3.0', date: '2026-10-08', changes: ['A compact view: one line per bookmark.', 'Sort by recently updated or by folder.', 'Saving a link you already have asks first, and shows where it is.', 'New links suggest a folder based on the site.', 'Refresh a site’s icon from the right-click menu.', 'Drag pinned bookmarks into the order you like.', 'Import and export as JSON, CSV or your browser’s bookmarks file.', MENU, SWIPE, BIN, UNDO] },
    { version: '1.2.0', date: '2026-10-07', changes: ['Switch between a list and a grid of cards.', 'Click anywhere on a bookmark to open it in a new tab, with a clear highlight showing what will open.', 'Search and sort stay pinned while you scroll.', SYNC, TWO_CLICK] },
    { version: '1.1.0', date: '2026-10-05', changes: [EXAMPLE] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Save links with tags and notes, and pin the ones you open every day.', 'Import bookmarks from your browser.'] }
  ],
  '/gold': [
    { version: '2.2.0', date: '2026-10-08', changes: ['Offline it keeps the last saved price quietly instead of showing errors.', 'A Try again button when the live price can’t be reached.', BIN, UNDO, DRAFTS, CHECK] },
    { version: '2.1.0', date: '2026-10-07', changes: ['Click or tap anywhere on a purchase to edit it in a popup.'] },
    { version: '2.0.0', date: '2026-10-07', changes: ['Each purchase shows what you paid, what it’s worth now, and your gain or loss.', 'Sign in with Google to keep purchases and the price history on all your devices.', 'Import a CSV from “Add a purchase”; purchases already in your list are skipped.', 'The price card and purchases catch the light as you move the mouse.', PICKERS, TWO_CLICK] },
    { version: '1.1.0', date: '2026-10-05', changes: [EXAMPLE] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Live gold price per chi, damlung and gram, a unit converter, and what your gold is worth now.'] }
  ],
  '/settings': [
    { version: '3.0.0', date: '2026-10-08', changes: ['Density and animation settings.', 'Behaviour: keyboard shortcuts, confirm before delete and autosave.', 'Your data: export everything to one file and restore it with a preview.', 'About: what’s new across every app, and install it as an app.'] },
    { version: '2.0.0', date: '2026-10-07', changes: ['Sign in with your Google account to sync every app.', 'All the sound settings are together, and “Try it” shows the matching pop-up too.', 'Opening an app plays its own chime.'] },
    { version: '1.2.0', date: '2026-10-06', changes: ['Sign in and sync your trackers from Settings.', 'Icons for every sound style.'] },
    { version: '1.1.0', date: '2026-10-05', changes: ['Lite effects keep older computers smooth.'] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Choose light or dark mode and sound effects.'] }
  ]
}

export const releasesFor = (path: string) => CHANGELOG[path] ?? []

/** Everything that changed, newest first: app-wide releases and each app's, for Settings → About */
export function allReleases() {
  const list = [
    ...APP_RELEASES.map(r => ({ ...r, app: '' })),
    ...Object.entries(CHANGELOG).flatMap(([app, releases]) => releases.map(r => ({ ...r, app })))
  ]
  return list.sort((a, b) => b.date.localeCompare(a.date) || (a.app ? 1 : -1))
}

export const APP_VERSION = APP_RELEASES[0]!.version
