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

export const CHANGELOG: Record<string, Release[]> = {
  '/qr': [
    { version: '1.2.0', date: '2026-10-07', changes: [WIDE, 'The preview stays in view while you change the style.'] },
    { version: '1.1.0', date: '2026-10-05', changes: ['Dark mode.', 'Its own design, with colours, shapes and a logo or frame for your code.'] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Turn a link or text into a QR code you can download.', 'Sound effects and smooth page transitions.'] }
  ],
  '/phone': [
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
    { version: '1.1.0', date: '2026-10-07', changes: ['On wide screens the gain-or-loss receipt sits beside the inputs and stays in view.'] },
    { version: '1.0.0', date: '2026-10-05', changes: ['See if an exchange rate makes you gain or lose money, or track an exchange you made.'] }
  ],
  '/battery': [
    { version: '1.1.0', date: '2026-10-07', changes: [WIDE, 'The results stay in view, and fully reachable, while you scroll.'] },
    { version: '1.0.0', date: '2026-10-05', changes: ['See how much of your phone battery is really left compared with when it was new.'] }
  ],
  '/salary': [
    { version: '1.1.0', date: '2026-10-07', changes: [WIDE, 'The pay statement stays in view, and fully reachable, while you scroll.'] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Work out what a raise is really worth after Cambodian salary tax.'] }
  ],
  '/things': [
    { version: '2.0.0', date: '2026-10-07', changes: ['New design: a summary showing where your value is, and cards comparing what you paid with what it’s worth now.', 'Each card shows how much of its price it still keeps.', SYNC, PICKERS, 'Search and sort stay pinned while you scroll.', TWO_CLICK] },
    { version: '1.1.0', date: '2026-10-05', changes: [EXAMPLE] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Keep track of what you own, what you paid and what it’s worth now.'] }
  ],
  '/eat': [
    { version: '1.3.0', date: '2026-10-07', changes: ['Use a link to any image on the web as a photo, when adding or editing. It works on every device and syncs with the item.', 'Remove a photo from the edit popup.'] },
    { version: '1.2.0', date: '2026-10-07', changes: ['Narrow it down: compare your shortlist two at a time until one is left.', 'Edit your foods and places in a popup.', 'On wide screens the cards sit beside your list.', SYNC, TWO_CLICK, 'Fixed: example data now deals a full deck of cards.'] },
    { version: '1.1.0', date: '2026-10-05', changes: ['Add photos to your foods and places.', EXAMPLE] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Swipe through your saved foods and places until one sounds good.'] }
  ],
  '/weight': [
    { version: '1.2.0', date: '2026-10-07', changes: [PICKERS, 'The trend chart uses the full width.', SYNC, TWO_CLICK] },
    { version: '1.1.0', date: '2026-10-05', changes: [EXAMPLE] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Log your weight and see the trend.'] }
  ],
  '/countdown': [
    { version: '2.0.0', date: '2026-10-07', changes: ['The next date gets a banner with a live clock and how much of the wait is done.', 'Add any countdown to Google Calendar, or to Apple, Outlook or your phone.', PICKERS, POPUP_EDIT, SYNC, STICKY, TWO_CLICK] },
    { version: '1.1.0', date: '2026-10-05', changes: ['Cambodian public holidays, fetched fresh each year, and a live Phnom Penh clock.'] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Count down to the dates that matter.'] }
  ],
  '/renewals': [
    { version: '1.2.0', date: '2026-10-07', changes: ['On wide screens the 30-day timeline spans the page and subscriptions sit side by side.', PICKERS, SYNC, TWO_CLICK] },
    { version: '1.1.0', date: '2026-10-05', changes: [EXAMPLE] },
    { version: '1.0.0', date: '2026-10-05', changes: ['See what your subscriptions cost each month and year, and what renews soon.'] }
  ],
  '/bookmarks': [
    { version: '1.2.0', date: '2026-10-07', changes: ['Switch between a list and a grid of cards.', 'Click anywhere on a bookmark to open it in a new tab, with a clear highlight showing what will open.', 'Search and sort stay pinned while you scroll.', SYNC, TWO_CLICK] },
    { version: '1.1.0', date: '2026-10-05', changes: [EXAMPLE] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Save links with tags and notes, and pin the ones you open every day.', 'Import bookmarks from your browser.'] }
  ],
  '/gold': [
    { version: '2.0.0', date: '2026-10-07', changes: ['Each purchase shows what you paid, what it’s worth now, and your gain or loss.', 'Sign in with Google to keep purchases and the price history on all your devices.', 'Import a CSV from “Add a purchase”; purchases already in your list are skipped.', 'The price card and purchases catch the light as you move the mouse.', PICKERS, TWO_CLICK] },
    { version: '1.1.0', date: '2026-10-05', changes: [EXAMPLE] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Live gold price per chi, damlung and gram, a unit converter, and what your gold is worth now.'] }
  ],
  '/settings': [
    { version: '2.0.0', date: '2026-10-07', changes: ['Sign in with your Google account to sync every app.', 'All the sound settings are together, and “Try it” shows the matching pop-up too.', 'Opening an app plays its own chime.'] },
    { version: '1.2.0', date: '2026-10-06', changes: ['Sign in and sync your trackers from Settings.', 'Icons for every sound style.'] },
    { version: '1.1.0', date: '2026-10-05', changes: ['Lite effects keep older computers smooth.'] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Choose light or dark mode and sound effects.'] }
  ]
}

export const releasesFor = (path: string) => CHANGELOG[path] ?? []
