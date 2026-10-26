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
    version: '2.7.0',
    date: '2026-10-26',
    changes: [
      'Under the cube on the home page: today’s gold and riel prices, what’s coming up, this month’s spending and your focus sessions.',
      'Every app has a plain one-word name that says what it does: QR, Phone, Compress, Budget, Speed and so on.',
      'The sitemap and every app that gets live data (holidays, the exchange rate, icons) work again.',
      'On netlify.app addresses, bars along the bottom of the screen sit above Netlify’s badge instead of under it.',
      'Better on a tablet on its side: Focus keeps its dial and Start button on one screen, and Passwords puts the password beside its settings.'
    ]
  },
  {
    version: '2.6.0',
    date: '2026-10-20',
    changes: [
      'New app: 2048. Slide the tiles with the arrow keys or a swipe, undo a move, and keep your best score.',
      'A breadcrumb in the top bar shows where you are: Ousa’s Apps › the app › its folder or section. Click a step to go back to it.',
      'Opening the site on a phone starts with a splash screen.',
      'Quick sign-in: set a password in Settings → Account & sync to sign back in without the Google window.',
      'The Apps menu lists only the other apps while you’re in one, and leaves the list out on the home page, which already shows every app. Search is the button beside it.',
      'Search everything no longer gets cut off at the sides on a phone.'
    ]
  },
  {
    version: '2.5.0',
    date: '2026-10-19',
    changes: [
      'Settings → Gauges: every kind of dial the apps use, plus more you could build, with the code to copy. Click a dial for a random value, or Play to watch them all move.',
      'Settings → App features shows each app as a card with its features, or as a table you can read without turning your head. Filter by feature and tick apps to compare.',
      'Pick a font in Settings → Appearance: the app’s own Bricolage, your device’s, rounded, serif or mono. Nothing extra is downloaded.',
      'A text size slider, from Small to Huge, makes all the text bigger or smaller, and keeps a larger size you’ve set in your browser.',
      'Icons across the apps come from one library, so the same thing looks the same everywhere.',
      'Settings → Logos & icons lists every icon and brand logo the apps show, which apps use each one, and searches them all.'
    ]
  },
  {
    version: '2.4.0',
    date: '2026-10-19',
    changes: [
      'Condensed moves from the top bar into the Apps menu, next to Full screen. Shift on its own still switches it.',
      'Checkboxes have a new look in every app: a rounded square in the app’s colour with a tick, and a dash when only some are chosen.'
    ]
  },
  {
    version: '2.3.0',
    date: '2026-10-19',
    changes: [
      'Right-click opens the app’s own menu everywhere instead of the browser’s: search, back and reload, plus copy for selected text and open or copy for links. Text boxes keep the browser’s menu for spelling and paste, and Shift + right-click still shows it.',
      'Sync status lives in the Apps menu now, not on each app’s icon: Synced, Saving, Offline, Sync error or Needs setup, with the reason and Try again when something’s wrong.',
      'No more looking signed out after a dropped connection or an update: the app keeps trying and picks your session back up by itself.'
    ]
  },
  {
    version: '2.2.0',
    date: '2026-10-18',
    changes: [
      'Signed out, every app shows its example data until you sign in.',
      'Condensed, in the middle of the top bar, packs every app into a column in the middle of the window.',
      'Pages respond sooner: the fonts come from this site, and Firebase loads just after the page instead of before it.',
      'Dropdowns and pop-ups are never cut off by the card or header they sit in.',
      'Toasts are black in light mode and white in dark mode.',
      'Ambient Studio has been retired.'
    ]
  },
  {
    version: '2.1.0',
    date: '2026-10-11',
    changes: [
      'Every app’s settings now have Import & export: save that app’s data and settings to a file, and bring them back with a preview first. A full backup works there too.',
      'Import and export live only in Settings now. Apps with extra formats (CSV, browser bookmarks, Markdown) open them from there with More formats.',
      'Full backups now include each app’s own settings.',
      'Unpinning an app now sticks after a refresh. Pins (and some app settings) stopped saving after you’d moved between apps.',
      'New app: Ambient Studio, for rain, fire, lo-fi and noise to focus or fall asleep to.'
    ]
  },
  {
    version: '2.0.1',
    date: '2026-10-09',
    changes: [
      'New entries are dated today even between midnight and 7 am; they used to get yesterday’s date.',
      'Small buttons like Pin, Delete and the sync badge are easier to tap on touch screens.',
      'If this browser can’t save (storage full or blocked) you’re told once, with what to do, instead of changes quietly not being kept.',
      'Faster search and long bookmark lists; a list no longer shows “Nothing matches” under it.',
      'Link previews can no longer be pointed at the server’s own network.'
    ]
  },
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
    { version: '2.0.0', date: '2026-10-08', changes: ['My contacts: save names, numbers, emails and notes; each number shows its network, and they sync with your account.', 'Search, edit and delete contacts, or select several to copy, export or delete together.', 'Save the numbers you just checked into My contacts in one go.', 'Export check results as CSV or JSON, or copy them to paste into a spreadsheet.', 'On wide screens the checker and prefix list scroll together and no longer slide over each other.'] },
    { version: '1.2.1', date: '2026-10-07', changes: ['The page no longer runs wider than a phone screen.', 'Small buttons like Edit and Delete are easier to tap on touch screens.'] },
    { version: '1.2.0', date: '2026-10-07', changes: ['Import your contacts straight from Google with your Google sign-in.', 'On wide screens the checker sits beside your contacts, which read across in columns.', 'Network filters and search stay pinned while a long address book scrolls.'] },
    { version: '1.1.0', date: '2026-10-05', changes: ['Check a whole contacts file at once and catch numbers missing a digit.', EXAMPLE] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Check a Cambodian number and see its network.', 'Dark mode.'] }
  ],
  '/compress': [
    { version: '1.3.0', date: '2026-10-19', changes: ['A dial shows how much smaller your files got in total.'] },
    { version: '1.2.0', date: '2026-10-07', changes: [PICKERS, WIDE] },
    { version: '1.1.0', date: '2026-10-05', changes: ['Shrink PDFs too: make the photos inside smaller, or redraw each page.', 'No files handy? Try it with three example files.'] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Make images smaller without uploading them.', 'Dark mode.'] }
  ],
  '/text': [
    { version: '2.1.0', date: '2026-10-10', changes: ['A Slider view for Compare texts: the original and the changed version in one box, split by a line you drag (or move with the arrow keys), like a before-and-after photo.'] },
    { version: '2.0.0', date: '2026-10-08', changes: ['Now called Text tools.', 'Compare two versions of a text and see every word added, removed or changed, side by side on wide screens and stacked on phones.', 'Ignore capital letters or extra spaces when comparing, and swap the two sides.'] },
    { version: '1.2.0', date: '2026-10-07', changes: [WIDE] },
    { version: '1.1.0', date: '2026-10-05', changes: ['Dark mode and its own design.', EXAMPLE] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Switch text between lowercase, UPPERCASE, Title Case and Sentence case.'] }
  ],
  '/password': [
    { version: '2.1.0', date: '2026-10-19', changes: ['The strength meter is a small dial: bits of randomness on red, orange and green bands at the same cutoffs as Weak, Fair and Strong.', 'An animated eye shows and hides a saved password.', 'Icons next to each point of “How your passwords are protected”.'] },
    { version: '2.0.0', date: '2026-10-07', changes: ['Sign in with your Google account. The vault keeps its own master password, which never leaves your device.', 'On wide screens the password and its settings sit side by side.', 'Adding and editing a saved password opens in a popup.', TWO_CLICK] },
    { version: '1.2.0', date: '2026-10-06', changes: ['Reset a forgotten master password by email.', 'Master passwords can be 6 characters or more.'] },
    { version: '1.1.0', date: '2026-10-05', changes: ['Save passwords in a vault, encrypted on your device before they’re stored.'] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Generate strong passwords and see how long they’d take to crack.', 'Dark mode.'] }
  ],
  '/exchange': [
    { version: '1.4.0', date: '2026-10-19', changes: ['The result shows a dial for how far the rate is from the market: worse to the left, better to the right, about the same in the middle.'] },
    { version: '1.3.0', date: '2026-10-18', changes: ['A ⇄ button beside the amount flips between dollars to riel and riel to dollars, converting the amount so it stays the same money.'] },
    { version: '1.2.0', date: '2026-10-08', changes: ['Offline, or if the rate service is down, it uses the last rate seen on this device and says when it was from.', 'On a phone, pull down for a fresh rate.'] },
    { version: '1.1.1', date: '2026-10-07', changes: ['The page no longer runs wider than small phone screens.', 'Small buttons like Edit and Delete are easier to tap on touch screens.'] },
    { version: '1.1.0', date: '2026-10-07', changes: ['On wide screens the gain-or-loss receipt sits beside the inputs and stays in view.'] },
    { version: '1.0.0', date: '2026-10-05', changes: ['See if an exchange rate makes you gain or lose money, or track an exchange you made.'] }
  ],
  '/battery': [
    { version: '1.2.0', date: '2026-10-19', changes: ['A health dial in the results: the needle on red, orange and green bands that match Replace, Worn, Good and Excellent.'] },
    { version: '1.1.1', date: '2026-10-07', changes: ['The phone model search no longer makes iPhones zoom in when you tap it.', 'Small buttons like Edit and Delete are easier to tap on touch screens.'] },
    { version: '1.1.0', date: '2026-10-07', changes: [WIDE, 'The results stay in view, and fully reachable, while you scroll.'] },
    { version: '1.0.0', date: '2026-10-05', changes: ['See how much of your phone battery is really left compared with when it was new.'] }
  ],
  '/budget': [
    { version: '1.2.0', date: '2026-10-19', changes: ['The overall monthly budget gets a dial showing how much is used, with a mark where the month is heading while that’s still under the limit.'] },
    { version: '1.1.0', date: '2026-10-12', changes: ['A numbered “How to use Budget” guide on the dashboard ticks off each step as you do it. Hide it any time, and bring it back with How to use.', 'Every subcategory has its own icon.'] },
    { version: '1.0.0', date: '2026-10-12', changes: [
      'Log expenses in a few taps, with categories like Food › Breakfast, Lunch and Dinner, in dollars or riel.',
      'Budgets for everything, a category or a subcategory, by month, week or day, with warnings before you hit the limit.',
      'Recurring bills that show what’s due and overdue, and are only marked paid when you confirm.',
      'Income, savings goals, reports, CSV import and export, and a dashboard for the month.'
    ] }
  ],
  '/days': [
    { version: '1.1.0', date: '2026-10-24', changes: ['A Time tab: the hours between two times, less a break and past midnight too, in hours and minutes or as a decimal for timesheets.', 'Add or subtract hours and minutes from a time, and see if it lands on the next day.', 'A time picker in the app’s own style: tap an hour, then a minute.'] },
    { version: '1.0.0', date: '2026-10-24', changes: ['Count the days, weeks, months and working days between two dates.', 'Add or subtract days, weeks, months or working days from a date.', 'Working days skip weekends and Cambodian public holidays; Saturday can count as a work day.'] }
  ],
  '/focus': [
    { version: '1.1.0', date: '2026-10-24', changes: ['Progress runs round the edge of the window, with a marker at each quarter that fills as you pass it. Turn it off in Settings.'] },
    { version: '1.0.0', date: '2026-10-24', changes: ['25-minute focus sessions with 5-minute breaks, and a longer break every fourth session.', 'Set your own lengths, and choose whether the next session starts by itself.', 'The time left shows in the browser tab, with a sound when it’s up.'] }
  ],
  '/color': [
    { version: '1.1.0', date: '2026-10-24', changes: ['20 preset colours to start from in one click.', 'A gradient maker: pick a From and a To colour, linear at any angle or radial, with ready-made gradients and CSS to copy.', 'A colour picker in the app’s own style: drag for shade and hue, type a HEX, or pick from the screen.'] },
    { version: '1.0.0', date: '2026-10-24', changes: ['Pick or paste a colour and copy it as HEX, RGB or HSL.', 'Check the contrast of text on a background against WCAG AA and AAA.', 'Tints and shades of your colour, each one click to copy.'] }
  ],
  '/2048': [
    { version: '1.0.0', date: '2026-10-20', changes: ['Slide the tiles with the arrow keys, or swipe on a phone; matching numbers join into one.', 'Undo your last move (Z), keep going after 2048, and your best score is kept.', 'A game in progress is still there when you come back.'] }
  ],
  '/cv': [
    { version: '1.0.0', date: '2026-10-16', changes: ['My CV as an app: experience, selected work, skills, education and how to get in touch.', 'Save it as a PDF from the Save as PDF button.'] }
  ],
  '/claude': [
    { version: '1.1.0', date: '2026-10-19', changes: ['Set a monthly budget to see what this period cost against it on a dial, how much is left or over, and what this rate comes to in a month. On both the API spend and Claude Code tabs.'] },
    { version: '1.0.0', date: '2026-10-18', changes: ['Your Claude API spend and tokens by day and model, from Anthropic’s Usage and Cost reports (needs an Admin API key, kept only in your browser).', 'Your Claude Code sessions, tokens and estimated cost by day, project and model, read from its logs when the app runs on your computer.'] }
  ],
  '/speed': [
    { version: '2.0.0', date: '2026-10-19', changes: ['The dial is coloured by what the speed is good for: red too slow, orange browsing, yellow HD video, green 4K, blue big downloads. The fill climbs through the colours, and a strip under the dial shows which band you’re in.', 'Each use in “Good for” has its own colour, so they read apart at a glance.', 'Each test saves where and how it ran: your approximate location, IP address and provider, your device, and Wi‑Fi, mobile data or cable (detected on Android, picked by you elsewhere).', 'Past tests are grouped by day, with each day’s best speeds on its header; today’s opens by default.', 'Tidier under the dial and in Past tests: the status and button share a line, and the sort menu is smaller.'] },
    { version: '1.2.0', date: '2026-10-18', changes: ['Past tests are saved to your account when you’re signed in, so they’re on all your devices.', 'Sort past tests by newest, oldest, fastest download or upload, or lowest ping.', 'Icons show what each result is good for, in the result and beside every past test.'] },
    { version: '1.0.0', date: '2026-10-12', changes: ['Test your download, upload, ping and jitter, with a dial that follows the live speed.', 'See what your connection is good for, and how close you get to your plan’s speed.', 'Your last 30 tests stay on this device.'] }
  ],
  '/salary': [
    { version: '1.2.0', date: '2026-10-19', changes: ['The share of the raise you keep is drawn as an animated ring.'] },
    { version: '1.1.1', date: '2026-10-07', changes: ['The raise-every-year table fits a phone screen without scrolling sideways.', 'The tax band boxes no longer make iPhones zoom in, and the switches are easier to tap.', 'Small buttons like Edit and Delete are easier to tap on touch screens.'] },
    { version: '1.1.0', date: '2026-10-07', changes: [WIDE, 'The pay statement stays in view, and fully reachable, while you scroll.'] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Work out what a raise is really worth after Cambodian salary tax.'] }
  ],
  '/things': [
    { version: '3.3.0', date: '2026-10-19', changes: ['A dial beside “Worth now” shows how much of what you paid everything still holds.', 'Devices from brands like Apple, Xiaomi, Dell and DJI show the maker’s logo.'] },
    { version: '3.2.0', date: '2026-10-18', changes: ['No more automatic depreciation: what something is worth now stays at what you paid until you enter a resale price.', 'Company logos fill their tile, framed in the logo’s own colour, and Google shows its G.'] },
    { version: '3.1.0', date: '2026-10-11', changes: ['Tap a category under “Where the value is” to see only those things; tap it again to see everything.', 'Hide a category from the list with the eye beside it; tap its chip above the list to bring it back.', 'Leave something out of the totals (a work laptop, something lent out) from its right-click menu or by selecting several. It stays in the list, marked Not counted.', 'Import and export are now in Settings.'] },
    { version: '3.0.1', date: '2026-10-08', changes: ['Logos now show for Sony, Samsung, Google, Honor, Redmi, RedMagic and more brands.'] },
    { version: '3.0.0', date: '2026-10-08', changes: ['Adding starts with what kind of thing it is: phone, tablet, laptop, desktop, monitor, TV, keyboard, mouse, headphones and more.', 'Company, model and generation suggest as you type, from a list of common devices; anything else can be typed in.', 'Known models suggest their release year, RAM and screen size, and the storage sizes they came in.', 'Each item shows its company’s logo and details like 2023 · 256 GB · 8 GB RAM.', 'Filter by type, company, year, storage and generation; sort by recently added, company, type or release year.', 'A compact list view alongside the cards.', 'Adding the same device twice asks first.'] },
    { version: '2.1.0', date: '2026-10-08', changes: [TRANSFER, 'Adding something with the same name as one you have asks first.', 'Worth now and notes tuck under More details until you need them.', 'New items start in the category and currency you used last.', MENU, SWIPE, BIN, UNDO, DRAFTS, CHECK] },
    { version: '2.0.0', date: '2026-10-07', changes: ['New design: a summary showing where your value is, and cards comparing what you paid with what it’s worth now.', 'Each card shows how much of its price it still keeps.', SYNC, PICKERS, 'Search and sort stay pinned while you scroll.', TWO_CLICK] },
    { version: '1.1.0', date: '2026-10-05', changes: [EXAMPLE] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Keep track of what you own, what you paid and what it’s worth now.'] }
  ],
  '/eat': [
    { version: '2.0.0', date: '2026-10-18', changes: ['Opens on the page; Start deciding takes the deck full screen.', 'Choose prices and skip what you had lately before you swipe.', 'The pick is one big card: Let’s eat remembers it, Directions opens a place in Maps, or pick again.', 'What you had recently comes up less, and every food shows when you last had it.', 'The deck and your shortlist sit side by side; your foods and places are a searchable list below, and + Add opens a popup.'] },
    { version: '1.5.1', date: '2026-10-11', changes: ['On phones, the card you picked in “Which sounds better?” no longer stays highlighted in the next round.'] },
    { version: '1.5.0', date: '2026-10-08', changes: [BIN, UNDO, DRAFTS, CHECK] },
    { version: '1.4.0', date: '2026-10-07', changes: ['Focus mode: swipe full screen with bigger cards and nothing else in the way. The app opens in it; Done or Esc takes you back.', 'A big, centred Narrow it down button under your shortlist.', 'When you’ve gone through every card, narrowing down starts on its own, or your only pick is chosen.'] },
    { version: '1.3.1', date: '2026-10-07', changes: ['The Everything / Foods / Places filter fits on a phone, and your foods show three across.', 'Small buttons like Edit and Delete are easier to tap on touch screens.'] },
    { version: '1.3.0', date: '2026-10-07', changes: ['Use a link to any image on the web as a photo, when adding or editing. It works on every device and syncs with the item.', 'Remove a photo from the edit popup.'] },
    { version: '1.2.0', date: '2026-10-07', changes: ['Narrow it down: compare your shortlist two at a time until one is left.', 'Edit your foods and places in a popup.', 'On wide screens the cards sit beside your list.', SYNC, TWO_CLICK, 'Fixed: example data now deals a full deck of cards.'] },
    { version: '1.1.0', date: '2026-10-05', changes: ['Add photos to your foods and places.', EXAMPLE] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Swipe through your saved foods and places until one sounds good.'] }
  ],
  '/weight': [
    { version: '1.4.0', date: '2026-10-19', changes: ['Set a goal weight to see how far you’ve come from your first entry on a dial, and how much is left to go. Works for losing or gaining.'] },
    { version: '1.3.0', date: '2026-10-18', changes: ['Check your entries shows how much you gained or lost since the entry before, and over how many days when there’s a gap.', 'A total at the foot of your entries: how much you’ve gained or lost since your first entry.'] },
    { version: '1.3.0', date: '2026-10-08', changes: [BIN, UNDO, CHECK, 'On a phone, pull down to sync.'] },
    { version: '1.2.1', date: '2026-10-07', changes: ['The log form and trend use the whole phone screen, and the weight box no longer spills out.', 'Small buttons like Edit and Delete are easier to tap on touch screens.'] },
    { version: '1.2.0', date: '2026-10-07', changes: [PICKERS, 'The trend chart uses the full width.', SYNC, TWO_CLICK] },
    { version: '1.1.0', date: '2026-10-05', changes: [EXAMPLE] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Log your weight and see the trend.'] }
  ],
  '/countdown': [
    { version: '2.6.0', date: '2026-10-19', changes: ['The featured countdown’s progress is a ring that closes as the day comes.'] },
    { version: '2.5.0', date: '2026-10-18', changes: ['Dates can repeat every week, month, 3 or 6 months, or year, so a birthday only needs adding once.', 'A 30-day timeline of your dates, renewals and public holidays.', 'Dates this week get the same Today, Tomorrow and This week badges as Renewals, and an all-day date stays up for its whole day.', 'A heads-up when something is today or tomorrow.', 'Time left reads the same everywhere in Calendar, holidays included.'] },
    { version: '2.4.0', date: '2026-10-18', changes: ['Renewals is now part of Calendar: switch between Dates and Renewals under the name. Your subscriptions and links to them are where they were.'] },
    { version: '2.3.0', date: '2026-10-18', changes: ['Countdown is now called Calendar.', 'Screen saver: the time, weekday and date in big type, full screen, on slowly shifting colours. It keeps the screen awake; tap or press any key to close it.', 'Example dates to try it with: click the app’s icon. Signed out, they show until you sign in.'] },
    { version: '2.2.0', date: '2026-10-08', changes: ['Later dates are tidy rows with a date tile, how long to go (weeks or months when it’s far, days when it’s close) and a progress bar.', 'Clock digits roll smoothly as they change.'] },
    { version: '2.1.0', date: '2026-10-08', changes: ['The holiday list works offline from the last copy saved on this device.', MENU, SWIPE, BIN, UNDO, DRAFTS, CHECK] },
    { version: '2.0.0', date: '2026-10-07', changes: ['The next date gets a banner with a live clock and how much of the wait is done.', 'Add any countdown to Google Calendar, or to Apple, Outlook or your phone.', PICKERS, POPUP_EDIT, SYNC, STICKY, TWO_CLICK] },
    { version: '1.1.0', date: '2026-10-05', changes: ['Cambodian public holidays, fetched fresh each year, and a live Phnom Penh clock.'] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Count down to the dates that matter.'] }
  ],
  '/renewals': [
    { version: '2.2.0', date: '2026-10-19', changes: ['Set a monthly limit to see what everything that renews costs a month against it, on a dial that turns orange near the limit and red over it.', 'Known services show their brand’s own logo, in its colours.'] },
    { version: '2.1.0', date: '2026-10-18', changes: ['The 30-day timeline shows your dates and public holidays too, each in its own colour.', 'One heads-up a day for everything in Calendar due today or tomorrow: renewals, dates and holidays.'] },
    { version: '2.0.0', date: '2026-10-08', changes: ['Each subscription shows its service’s icon automatically; pick another, a letter, or your own image link.', 'A live countdown that gets more exact as the date nears: months, then weeks, days, hours, and minutes and seconds in the last hour.', 'Status at a glance: Safe, Upcoming, Soon, Due and Expired, in words as well as colour.', 'Prices and totals in both dollars and riel, using today’s rate.', 'See what everything costs per day, week, month, quarter, half-year or year.', 'New billing options: every 6 months, and one-off dates that expire.'] },
    { version: '1.4.0', date: '2026-10-08', changes: ['Sort by soonest, most expensive or name.', 'Give subscriptions a category; well-known services suggest one.', TRANSFER, 'New subscriptions start with the currency and billing you used last.', MENU, SWIPE, BIN, UNDO, DRAFTS, CHECK] },
    { version: '1.3.1', date: '2026-10-07', changes: ['The 30-day timeline stays readable on a phone: short names, no overlapping prices.', 'Small buttons like Edit and Delete are easier to tap on touch screens.'] },
    { version: '1.3.0', date: '2026-10-07', changes: ['Add a subscription to your calendar as a repeating event: Google Calendar, or Apple, Outlook and phones with an .ics file.', 'Billing on the 29th–31st lands on the last day of shorter months, just like real billing.'] },
    { version: '1.2.0', date: '2026-10-07', changes: ['On wide screens the 30-day timeline spans the page and subscriptions sit side by side.', PICKERS, SYNC, TWO_CLICK] },
    { version: '1.1.0', date: '2026-10-05', changes: [EXAMPLE] },
    { version: '1.0.0', date: '2026-10-05', changes: ['See what your subscriptions cost each month and year, and what renews soon.'] }
  ],
  '/notes': [
    { version: '1.4.0', date: '2026-10-20', changes: ['With a note open on a computer, the note sits in the middle of the page at its full width, and folders and the list move out to its left, past the page’s edge. They step back while you write; hover or tab into one to bring it forward.', 'Selecting notes is clearer: Select sits beside the note count, each note gets a checkbox beside its title, and a select-all box shows how many are picked. On a computer the space beside the list shows what you picked, with Favourite, Move, Archive, Export (Markdown) and Delete.','Tables: add one from the toolbar, Tab between cells, and add or remove rows and columns from the same button. They export to Markdown and import back.', 'Hover a table for a + on its right edge (add a column) and bottom edge (add a row).', 'Right-click in a table to clear the highlighted cells, merge them, or add and delete rows and columns.','Focus mode has the Centre / Wide switch too, so you can write across the whole screen.','Checklist boxes line up with their text at any text size or line spacing.', 'The ⋯ menu on a note opens again.','Export every note as Markdown in a .zip: one .md file per note, in folders like yours, ready for Obsidian and most notes apps.', 'Import Markdown files, or a .zip of them from Obsidian, Bear or this app, with their folders.', 'A file holding several notes (All notes as one .md) imports back as separate notes.', 'Import & export is in the sidebar and the New note menu.', 'The top bar shows where you are: Notes › folder › the open note.'] },
    { version: '1.3.0', date: '2026-10-19', changes: ['Notes settings are laid out like every other app’s, in three groups: Writing, Notes list and New notes.', 'A live preview shows a note in your font, text size and line spacing as you change them.'] },
    { version: '1.2.0', date: '2026-10-19', changes: ['Focus mode is calmer: bigger text in a narrower column, room to write in the middle of the screen, and soft edges at the top and bottom.', 'A small bar shows the save status and word count, with Dim, Full screen and Done; it hides while you type and the mouse brings it back.', 'Dim fades everything but the paragraph you’re writing. Switch it off from the bar; it’s remembered.', 'Notes settings open wider, and New notes go in uses the app’s own dropdown.'] },
    { version: '1.1.0', date: '2026-10-19', changes: ['Select some text, or double-click a word, and a small formatting bar appears above it: bold, italic, underline, strikethrough, code, link, bullet list, numbered list and checklist.', 'Headings, quote and code block are one dropdown named after the current style, such as Normal text or Heading 2, with each one’s Markdown shortcut beside it.', 'Focus mode shows only the title and your words, full screen. Turn it on from the note’s header, the ⋯ menu or ⌘⇧F; Esc leaves it.'] },
    { version: '1.0.0', date: '2026-10-09', changes: ['Write notes with headings, lists, checklists you can tick, quotes, code, links and images.', 'Markdown shortcuts: # for a heading, - for a list, [ ] for a checklist, > for a quote.', 'Notes save by themselves as you type, work offline and sync to your other devices.', 'Folders (the same kind as Bookmarks), #tags, favourites at the top, Recent and Archived.', 'Link notes with [[ and see which notes link back.', 'Version history: go back to how a note was earlier.', 'Templates for meetings, projects and daily notes, or save your own.', 'Quick note (Q) saves a thought without opening the editor.', 'Search titles, text, folders and tags, with filters like tag:idea or is:favorite.', 'Import and export as Markdown, text, HTML or JSON; notes are in full backups too.', 'Select several to favourite, move, archive or delete them together.', SYNC, EXAMPLE, BIN, UNDO, MENU, SWIPE] }
  ],
  '/bookmarks': [
    { version: '3.0.0', date: '2026-10-20', changes: [
      'Adding looks like adding now: a card with a link field, a + Add button and Save to, the folder it goes in, instead of a bar that looked like search.',
      'Paste several links at once (one per line, or any text with links in it) and add them together, into the same folder. Ones you already have are left unticked.',
      'An open folder starts with an Add a bookmark row, the same shape as your bookmarks in the list or grid, that saves straight into it.',
      'Pin a folder: it sits on the Pinned shelf beside your pinned links, and one tap opens it.',
      'Share a folder: anyone with the link sees its bookmarks and sub-folders, without signing in. It updates by itself, your notes stay private, and you can stop sharing any time.',
      'A folder’s path shows over the list and in the top bar (All › Work › Banking); click a step to go back up.',
      'Get site details only reads bookmarks that are missing something, and says how many that is.'
    ] },
    { version: '2.2.0', date: '2026-10-19', changes: ['With a folder open, the address bar shows that new links go into it; click the folder there to save to All bookmarks instead.', 'Add a bookmark straight into a folder with the + beside its name, or Add a bookmark here in the folder’s right-click menu.', 'An empty folder offers to add a bookmark.'] },
    { version: '2.1.0', date: '2026-10-08', changes: ['Find duplicates: bookmarks saved more than once, even under slightly different addresses (http/https, www, mobile site, trailing slash, #section, tracking codes).', 'Similar links too: the same site and title, or a page and the page just below it.', 'Pick which copy to keep and merge: folders, notes, pin and visits move onto it, and the rest go to the Recycle Bin. Or mark them as not duplicates.', 'Saving a link catches those same near-duplicates.'] },
    { version: '2.0.0', date: '2026-10-08', changes: ['Folders instead of tags, with folders inside folders. Your tags became folders automatically.', 'Give each folder an icon and a colour, and add folders from the top or bottom of the list.', 'A bookmark can be in several folders, shown as chips you can add and remove.', 'Drag a bookmark onto a folder to move it, or drag folders to reorder and nest them. Move to folder… in the right-click menu does the same.', 'Saving a link shows its title, description and preview image first, so you can edit them and choose folders.', 'The Recycle Bin link opens just your deleted bookmarks.'] },
    { version: '1.3.0', date: '2026-10-08', changes: ['A compact view: one line per bookmark.', 'Sort by recently updated or by folder.', 'Saving a link you already have asks first, and shows where it is.', 'New links suggest a folder based on the site.', 'Refresh a site’s icon from the right-click menu.', 'Drag pinned bookmarks into the order you like.', 'Import and export as JSON, CSV or your browser’s bookmarks file.', MENU, SWIPE, BIN, UNDO] },
    { version: '1.2.0', date: '2026-10-07', changes: ['Switch between a list and a grid of cards.', 'Click anywhere on a bookmark to open it in a new tab, with a clear highlight showing what will open.', 'Search and sort stay pinned while you scroll.', SYNC, TWO_CLICK] },
    { version: '1.1.0', date: '2026-10-05', changes: [EXAMPLE] },
    { version: '1.0.0', date: '2026-10-05', changes: ['Save links with tags and notes, and pin the ones you open every day.', 'Import bookmarks from your browser.'] }
  ],
  '/gold': [
    { version: '2.3.0', date: '2026-10-19', changes: ['Under the price chart, a dial shows where today’s price sits between the range’s low and high.'] },
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
