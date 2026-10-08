# Master App Improvement & Implementation Checklist

Status key: ⬜ Not Started · 🟡 In Progress · 🟢 Completed · 🔴 Blocked · 🔵 Needs Review

An item is only 🟢 when it's implemented, existing features still work, desktop and (where relevant) mobile
have been checked, there are no console errors, and it matches the shared design system.
Each item keeps a **Notes** line saying what was done, where it lives, and anything left over.

How this maps onto the repo: "Text Tools" is `/case`, "Phone Checker" (with contacts) is `/phone`,
"Things I Own" is `/things`. Shared code lives in `app/components`, `app/composables`, `app/utils` and
`app/assets/css/main.css`.

---

# PART A — GLOBAL / SHARED IMPROVEMENTS

## #01 — Global Required-Input Validation
**Status:** 🟢
For every required form field: focus the first missing field on submit; shake the input subtly; show an
error state; show a clear validation message; no excessive animation; preserve all other entered values.
Create a reusable validation system instead of implementing it separately per app.
**Notes:** `v-validate` on a form + `v-check="message"` for page rules (`app/plugins/validate.ts`). Uses native constraints (required, min, type), treats spaces-only as empty, focuses + shakes the first problem, red outline + inline message per field, clears as you fix it, keeps everything typed. Required labels get a `*`. Applied to every form (renewals, things, countdown ×2, gold, weight, eat ×2, bookmarks ×2, vault sign-in and editor); submit buttons are no longer disabled so Enter/click explains what's missing. Tested desktop + mobile (renewals, countdown, bookmarks), no console errors.

## #02 — Global Delete UX
**Status:** 🟢
Less visually prominent delete actions: no oversized red buttons; subtle delete icons; avoid accidental
deletion; confirm only when appropriate; prefer soft-delete; permanent deletion requires confirmation.
**Notes:** Deletes are soft: `useCollection.remove` moves the record to the Recycle Bin (`useTrash`, `/trash`) and every app's toast says so with Undo (`toastDeleted`). `ConfirmDelete` is now a quiet trash icon (or quiet text link in text rows) that only turns red on hover; one click for soft deletes, two for `permanent` ones (the password vault). Settings → Confirm before delete brings back the two-click arm everywhere (pref in `usePrefs`). Permanent deletes in the bin use `ConfirmDialog` with Cancel focused. Tested desktop + mobile.

## #03 — Global Animation System
**Status:** 🟢
Consistent smooth transitions for adding, removing, modals, dropdowns, sidebars, filtering, sorting, hover,
focus, toasts, validation. Support `prefers-reduced-motion`.
**Notes:** Motion tokens in `main.css` (`--ease-out/in/spring`, `--dur-fast/dur/dur-slow`) and shared transitions: `fade`, `pop`, `slide-down`, `list` (enter/leave/move for add/remove/sort/filter), `collapse`, plus `shake` and error fade-in. Lists in bookmarks, renewals, things, countdown and the bin use `<TransitionGroup name="list">`. `prefers-reduced-motion` and a Settings override (`data-motion=reduced`, applied before paint) turn animation off; lite effects still apply.

## #04 — Global Keyboard Shortcuts
**Status:** 🟢
`A` opens Add · `Enter` submits/confirms where appropriate · `Escape` closes/cancels. Never trigger while
typing in inputs, textareas or contenteditable elements.
**Notes:** `useShortcuts.ts`: shared `isTyping`, `useAddAction(fn)` + `runAddAction()`. `A` runs the page's Add (opens the popup in renewals/things/gold/passwords, focuses the always-visible field in countdown/bookmarks/eat/weight); Quick Add takes over on pages without one (#08). Enter submits (forms no longer disable submit), Esc closes popups/menus then goes back. Shortcuts never fire while typing or with a popup open, and can be turned off (`prefs.shortcuts`). Popups now focus their first field instead of the close button. Tested on desktop.

## #05 — Shared Design System
**Status:** 🔵
Reusable components and rules for typography, colors, spacing, radius, shadows, buttons, inputs, cards,
icons, modals, toasts, badges, chips, tabs, tables, empty states.
**Notes:** Tokens in `main.css` (radius, spacing, text sizes, shadows, motion, density) and shared classes: `.btn` variants, `.input`, `.field`, `.segmented` (tabs), `.panel` (cards), `.link`/`.link.danger`, `.icon-btn`, `.chip`-style filters, `.badge` (good/warn/bad/info), `kbd`, `.sr-only`, `.skeleton`, `.empty-state`, `.field-error`. Components: `Modal`, `ConfirmDialog`, `ConfirmDelete`, `EmptyState`, `AppSelect`, `DatePicker`, `ToolIcon` (+ trash, activity, plus, search). Needs review: older pages still carry scoped copies of some of these styles; they're folded in as each app is reworked (Phase 5).

## #06 — Universal Search
**Status:** 🟢
One search across bookmarks, folders, devices, renewals, countdowns, contacts and future data; results
grouped by app/type.
**Notes:** `utils/search.ts`: one registry of sources (bookmarks, folders, things, renewals, countdowns, contacts, foods & places) read from this device, so it works offline and sends nothing anywhere; every word must match, title-start matches rank first, results grouped by type. Choosing a result opens its app with `?focus=<id>` and `plugins/focus.client.ts` scrolls to and highlights the row (`data-item-id` on each list item); folders open the bookmarks filtered to that folder. The password vault is never searched. Tested desktop + mobile.

## #07 — Command Palette
**Status:** 🟢
`Ctrl+K` / `⌘K`. Search, navigation, actions, settings, quick add (Add Bookmark, Add Device, Add Renewal,
Add Countdown, Open Recycle Bin, Open Settings, Export Data, Go to Bookmarks…).
**Notes:** `components/CommandPalette.vue` (⌘K / Ctrl+K anywhere, even in a text field; also Search everything in the menu for touch screens). Empty: Quick add, Recent, Apps (pinned first), Commands (Add…, Recycle Bin, Recent activity, Settings, Export data, Import backup, dark/light, sound, pin/unpin this app). Typing: data results, then matching apps and commands. ↑/↓/PgUp/PgDn move, Enter runs, Esc closes, combobox/listbox ARIA. Tested desktop + mobile, no console errors.

## #08 — Global Quick Add
**Status:** 🟢
`A` or `Ctrl+K → Add` shows "What do you want to add?" (Bookmark, Device, Renewal, Countdown, Contact…);
choosing one opens that form.
**Notes:** `A` on a page without its own Add (or Add in the menu / Add something… in the palette) opens "What do you want to add?": Bookmark, Device, Renewal, Countdown, Food or place, Weight, Gold purchase, Password. Choosing one opens that app with `?add=1` and `useAddAction` opens/focuses its form. Contact joins the list once contacts can be saved (#62). Tested desktop + mobile.

## #09 — Favorites / Pinning
**Status:** 🟡
Pin apps, bookmarks, devices, renewals and other frequent items; pinned items appear near the top of
relevant navigation.
**Notes:** Apps: Pin button in every app header, Pin/Unpin in the palette; pinned apps lead the menu, the home page and the palette (`prefs.pinnedApps`, with Undo). Bookmarks already pin to the top shelf (now with Undo). Still to do: pinning devices and renewals, which lands with record favourites in #66.

## #10 — Recent Activity
**Status:** 🟢
Lightweight history of Added / Edited / Deleted / Restored / Imported / Exported, grouped by day.
**Notes:** `useActivity` logs added/edited/deleted/restored/imported/exported automatically from `useCollection` (plus Recycle Bin restores and exports), newest 200 kept on this device, repeated edits within a minute merged, background bookkeeping (visit counts, fetched icons) marked quiet, demo data never logged. `ActivityFeed.vue` groups by day with time, coloured verb and app icon, Show all, and Clear history (confirmed). Shown on the home page (#activity) and as Recent in the palette.

## #11 — Undo Everything Possible
**Status:** 🟢
Undo instead of confirmation dialogs for delete, move, archive, edit, folder changes, bulk actions.
Confirm only irreversible actions.
**Notes:** Undo instead of confirmation: delete (to the Recycle Bin), edit (`update` returns the previous record, `replace` puts it back; `toastSaved`), add (`remove(id, { undoAdd: true })` skips the bin), import (bookmarks, gold), pin toggles (apps, bookmarks). Only irreversible actions confirm (delete for good, empty bin, clear history). Moving bookmarks between folders gets the same Undo when folders arrive (#35–#36).

## #12 — Autosave
**Status:** 🟢
Preserve unfinished forms ("Continue where you left off? [Continue] [Discard]") and prevent accidental
loss when navigating away.
**Notes:** `useDraft` + `DraftCard`: unfinished Add forms in renewals, things, gold (popups) and countdown, eat (inline) are kept on this device as you type and on page hide; reopening shows "Continue where you left off?" with a summary, Continue / Discard; saving clears it. Off with Settings → Autosave forms. Never used for passwords. Tested desktop + mobile.

## #13 — Better Form UX
**Status:** 🟡
Autofocus, logical tab order, Enter submits, Escape cancels, clear required indicators, inline validation,
helpful placeholders, searchable selects, autocomplete, keep data after errors, no unnecessary fields,
progressive disclosure for advanced fields.
**Notes:** Done: popups focus their first field, Enter submits everywhere (no disabled submit buttons), Esc closes, required `*` marks, inline validation (#01), data kept after errors, `AppSelect` gets a search box for lists over 10 options (countdown times, categories), `MoreFields` tucks optional fields away (Things: worth now, notes). Still to do: name autocomplete for devices and renewals (#45, #54) and a placeholder pass in the final audit.

## #14 — Smart Defaults
**Status:** 🟢
Remember last folder, type, currency, filter, sort, view, sidebar state — easy to override.
**Notes:** `useRemembered(key, default, validate)` (hydration-safe). Remembered: bookmarks folder, sort and view; things sort, last category and currency for new items; renewals sort, last currency and billing cycle; gold sort; plus existing ones (weight unit, home cube colours). Changing a control simply remembers the new choice.

## #15 — Multiple Views
**Status:** 🟢
Grid / List / Compact for list-heavy apps, same underlying data.
**Notes:** Bookmarks: List / Grid / Compact. Things I own: Cards / List (one row per thing, stacks on phones). Both remembered; a Default view setting applies until you pick one.

## #16 — Better Sorting
**Status:** 🟢
Bookmarks: recently added, recently updated, A–Z, folder. Things I Own: recently added, company, type,
release year. Renewals: soonest, most expensive, name. Others: sorting that fits their content.
**Notes:** Bookmarks: Recently added, Recently updated, Most opened, A–Z, Folder. Things I own: Highest value, Recently added (new `createdAt`), Newest/Oldest purchase, Company, Type, Release year, Name. Renewals: Soonest, Most expensive, Name. Gold keeps its sorts. All remembered.

## #17 — Data Backup & Restore
**Status:** 🟢
Export all data (pick which apps), import a backup, preview changes before modifying anything, restore.
**Notes:** Settings → Your data (`DataPanel.vue`, `utils/backup.ts`): export everything to one dated JSON (`ousa-apps-backup-YYYY-MM-DD.json`), choosing apps (with counts) and whether settings go too; shows when the last backup was made. Restore reads the file, checks it's ours, and previews per app: +new, changed, and (Replace) how many go to the bin; Merge adds/updates only, Replace makes each app match the backup and moves the rest to the Recycle Bin (confirmed first), settings optional. Passwords are never included. Writes go through `writeToCollection`/`replaceCollection` (device + Firestore when signed in). Deep link `/settings#data` (palette: Export data / Import backup). Tested desktop + mobile, including a non-backup file.

## #18 — Import / Export Per App
**Status:** 🟢
Bookmarks: JSON, CSV, HTML. Things I Own: CSV, JSON. Renewals: CSV, JSON. Contacts: CSV, JSON.
**Notes:** `TransferDialog.vue` + `utils/transfer.ts` (CSV with BOM and formula-safe cells, tolerant CSV parser, JSON envelope, dated filenames like `renewals-2026-10-08.csv`). Bookmarks: JSON, CSV, browser HTML (import and export). Things I own: CSV, JSON. Renewals: CSV, JSON. Imports accept other apps' column names, skip what you already have, log to activity and can be undone. Contacts: CSV/JSON arrive with #62–#63. Gold keeps its CSV.

## #19 — Offline-First Behavior
**Status:** 🟢
Core features work offline; show "● Offline"; internet-dependent features explain the limitation
("Website metadata unavailable offline. Your bookmark can still be saved.").
**Notes:** `useOnline` + `OfflineBadge` (● Offline pill, "You’re offline" / "Back online" toasts). Saving works offline as before; bookmarks save under their address with "Website details aren’t available offline…"; icon/description fetching waits; market rate and holidays fall back to the last copy saved on this device (`utils/cache.ts`) with a dated note and Try again; gold auto-refresh stays quiet offline. Data safety: changes are tracked as pending until Firestore confirms them, so edits and deletes made offline win on the next sync instead of being overwritten (couldn't test against a live Firebase project here; checked in code). With the service worker (#20) the whole app reloads offline. Tested by switching the browser offline.

## #20 — PWA Support
**Status:** 🟢
Installable on desktop and mobile, app icon, splash screen, standalone mode, offline support, persistent storage.
**Notes:** `public/manifest.webmanifest` (standalone, theme/background colours, shortcuts), icons generated by `scripts/pwa-icons.cjs` (192, 512, maskable 512, Apple touch 180), `public/sw.js` (network-first pages with offline fallback, cache-first hashed assets, stale-while-revalidate icons and Google Fonts, warms every app page and its files after install), `plugins/pwa.client.ts` (registers in production only, offers Reload when an update is ready, asks for persistent storage once there's data). Tested on a production build: service worker activates, 18 pages + 87 assets cached, `/renewals`, `/bookmarks`, `/settings` reload with the network off. An Install button lands in Settings → About (#31). iOS splash images aren't generated; iOS uses the background colour.

## #21 — Global Notifications / Toast System
**Status:** 🟢
One consistent toast system; no browser alerts for normal feedback.
**Notes:** One system (vue-sonner, `GooeyToaster`); no `alert/confirm/prompt` anywhere. Shared wording in `utils/notify.ts` (`toastDeleted` with Undo + Recycle Bin, `toastSaved` with Undo); success/warning/error used consistently; failures now carry a Try again/Retry action where one exists.

## #22 — Skeleton Loading
**Status:** 🟢
Replace generic "Loading…" with skeletons that resemble the real layout.
**Notes:** `SkeletonList` (rows / cards / tiles) shaped like each list, shown while trackers load and as the `ClientOnly` fallback: bookmarks, renewals, things, countdown, weight, gold, the bin. "Loading holidays…" and the exchange rate's "Loading…" are skeletons now. Shimmer stops in lite effects / reduced motion.

## #23 — Smart Empty States
**Status:** 🟢
Every major list explains what it's for and what to do next, with a primary action.
**Notes:** `EmptyState` (icon, title, what it's for, one primary action) in renewals ("No renewals yet … [+ Add renewal]"), things, countdown, bookmarks (+ import hint), weight, gold (English and Khmer), Recycle Bin and Recent activity; the palette has a no-results state with "add something new".

## #24 — Better Error Recovery
**Status:** 🟢
Friendly errors with a recovery action ("Something went wrong … [Try Again]").
**Notes:** New `app/error.vue`: "There’s nothing here" for missing pages (suggests the app you probably meant, e.g. /renewal → Open Renewals) and "Something went wrong … Everything you’ve saved is safe" with Try again / Go home and collapsible technical details. Holidays and the market rate show a plain-words failure with Try again and the last saved copy; gold price failures offer Try again; sync failures say nothing was lost (#25). Also fixed a hydration mismatch on every production page (the menu's closed sign-in popup rendered differently on server and client): `Modal` now renders its content only while open.

## #25 — Optimistic UI
**Status:** 🟢
Update the UI immediately and save in the background; on failure restore, show an error and offer retry.
**Notes:** Trackers already update the screen first and save in the background (`useCollection`). Now: a failed account save shows once "Saved on this device only … Nothing is lost" with Retry (not when simply offline, the badge covers that); the change stays and is retried on reconnect (`online` event) and on next load via pending-change tracking. Rolling back isn't used because the device copy is the source of truth; Undo covers changing your mind.

## #26 — Mobile Gestures
**Status:** 🟢
Swipe to delete/archive, pull to refresh, long press for actions — never the only way to do something.
**Notes:** Long press opens the row's actions as a bottom sheet (`useRowMenu`, works on iPhone, which never sends contextmenu; moving the finger cancels). `v-swipe-delete` (`plugins/swipe.ts`): swipe a row left, a red bin strip follows, past ~38% it deletes (to the Recycle Bin with Undo), short swipes spring back, vertical scrolling is untouched; on bookmarks, renewals, things, countdowns. `usePullToRefresh` + `PullIndicator`: pull down at the top to re-sync trackers, refetch the rate (exchange), gold price, holidays; the browser's own pull-to-reload is switched off on those pages. Every gesture has a visible button too. Tested with real touch events on mobile.

## #27 — Desktop Context Menus
**Status:** 🟢
Right-click menus with relevant actions only (e.g. bookmark: Open, Open in new tab, Edit, Move to Folder,
Copy URL, Refresh Favicon, Duplicate, Delete).
**Notes:** `ContextMenu.vue` + `useContextMenu`: right-click opens a menu at the pointer (kept on screen), arrow keys/Enter/Esc, focus returns; Shift + right-click keeps the browser's menu. Bookmarks: Open, Open in new tab, Edit, Pin, Copy link, Refresh icon, Duplicate, Delete (Move to folder joins with #35). Renewals: Edit, Duplicate, Copy details, Delete. Things: Edit, Duplicate, Delete. Countdowns: Edit, Delete. Recycle Bin: Restore, Select, Delete for good. Tested desktop.

## #28 — Drag & Drop
**Status:** 🟢
Bookmark → folder, folder → folder, reordering where appropriate, with visual drop indicators.
**Notes:** `useDragReorder` (native drag with a drop line, Alt + arrows) for pinned bookmarks and pinned apps. Bookmarks: drag a row onto a folder in the sidebar to move it there (or onto Not in a folder / All); drag a folder onto another's middle to nest it, onto its top/bottom edge to reorder, onto All to move it to the top level; cycles are refused; every move has Undo. Rows only become draggable with a mouse; phones use Move to folder… Tested desktop.

## #29 — Duplicate Detection
**Status:** 🟢
Bookmarks: duplicate URLs ("Possible duplicate … [Open Existing] [Keep Both]"). Things I Own: likely
identical devices. The user decides.
**Notes:** `DuplicateCard`: saving a link you already have (same address, ignoring www/trailing slash) shows "Possible duplicate — This already exists in Development: GitHub" with Open existing (scrolls to and highlights it) and Keep both. Things: adding a name you already have (ignoring case and spacing) shows the same card in the popup with Open it (switches to editing that one) and Keep both. Imports also skip duplicates (#18). Tested desktop + mobile.

## #30 — Smart Categorization
**Status:** 🟢
Optional folder/category suggestions (github.com → Development, Netflix → Entertainment).
**Notes:** `utils/services.ts`: ~50 known services (category, domain, brand colour) and a site→folder map. Bookmarks: the save toast offers "Add to Development" (from where you filed other links from that site, else what the site is known for, else docs → documentation); the edit popup shows "Suggested folder … Use suggestion / Ignore". Renewals: new optional Category field; known names suggest one ("Spotify Family → Music"). Nothing applies on its own. Tested.

## #31 — Global Settings Page
**Status:** 🟢
Appearance (theme, accent, density, animations) · Behavior (shortcuts, confirm before delete, default view,
autosave) · Data (export, import, backup, restore) · About (version, what's new).
**Notes:** Settings now: 1 Appearance (theme, effects, accent — each app's own colour or one of seven, applied to buttons and highlights while app headers keep their colour —, density, animations), 2 Behaviour (keyboard shortcuts, confirm before delete, autosave, default view), 3 Sync, 4 Your data (export/import/backup/restore, #17), 5–7 Sound, 8 About (version, Install app button or iPhone instructions, what's new everywhere, keyboard shortcuts list). Tested desktop + mobile.

## #32 — Changelog / What's New
**Status:** 🟢
Changelog with a small "What's New" indicator when appropriate.
**Notes:** Per-app changelogs gained 8 Oct entries for every app touched; new `APP_RELEASES` (app-wide v2.0.0) and `allReleases()`. Settings → About lists the latest updates across apps (Show all). A green New mark on Settings in the menu until About has been seen (`useUnseenRelease`), alongside the existing New badge in each app header. Palette: What’s new.

## #33 — Responsive Design
**Status:** 🟢
Check every app on desktop, laptop, tablet and mobile: sidebars, tables, forms, modals, cards, filters,
navigation, long text, countdowns.
**Notes:** Automated sweep of all 18 pages at 1440, 1024, 768 and 390 px with sample data, reporting anything wider than the screen, plus the add popups. Found and fixed one: the renewals popup's Billed / Next renewal row spilled out at 390 px (now stacks). Earlier phases already fixed compact bookmarks on phones and the menu/palette sizing. Rechecked: clean at every width.

## #34 — Accessibility
**Status:** 🟢
Keyboard navigation, visible focus, labels, accessible buttons, tooltips, screen-reader friendly controls,
reduced motion, colour never the only status indicator.
**Notes:** axe-core on all 18 pages, light and dark: from ~335 issues to 0 apart from one logo mark. Fixed: `--ink-3` raised to 4.5:1 in both themes; deeper button shades for orange/green/teal/pink/lime apps (`--*-btn`, stickers keep their colour); New badge contrast; accessible names that match visible text (version chip, example toggle, date picker); battery listbox headings and stats list structure; QR upload option; eat card heading level; EmptyState heading level; home cube no longer a button containing links. Remaining: Realme's "RM" logo badge in a faded option (logos are exempt; hidden from screen readers). Reduced motion, visible focus rings and keyboard paths for every gesture are in place.

# PART B — BOOKMARK APP

## #35 — Rename Tag → Folder
**Status:** 🟢
Replace "Tag" with "Folder"; support nested sub-folders (Work → Banking, Projects, Documentation).
**Notes:** Tags are now folders (`utils/folders.ts`, collection `bookmark-folders`): nested sub-folders, a bookmark can be in several. Existing tags convert automatically the first time (one folder per tag, icon guessed from the name), the old field is left as it was. Sidebar shows the tree (Work → Banking), list title shows the path, choosing a folder shows its bookmarks and those in its sub-folders; ⌘K finds folders by name or path. CSV/JSON/HTML import-export keep folder paths (nested in the browser file). Copy says folder everywhere. Tested desktop + mobile.

## #36 — Folder Management
**Status:** 🟢
Create, edit, rename, delete, reorder, icon, color, sub-folder.
**Notes:** `FolderEditor`: create, edit/rename, choose where it sits (searchable, can't go inside itself), icon, colour; delete keeps its bookmarks and lifts sub-folders a level, with Undo restoring everything; reorder by drag. Duplicate names in the same place are refused with a message. Actions from the ⋯ button or right-click on a folder.

## #37 — Folder Icons
**Status:** 🟢
Icon picker for folders.
**Notes:** Icon picker with 26 line icons drawn on the app's grid (folder, work, bank, code, design, docs…); new folders guess one from their name until you pick.

## #38 — Folder Colors
**Status:** 🟢
Folder colours used subtly for icon, accent, selected state.
**Notes:** 13 colours (or the Bookmarks colour), used for the folder's icon, the selected row's edge and its chips.

## #39 — Folder Chips / Selection
**Status:** 🟢
Selected folders as removable chips; search, add, remove, clear; capitalise the first letter.
**Notes:** `FolderPicker` in the review card and edit popup: chips like [ Work × ] [ Banking × ] with icon and colour, type to search (shows each folder's path), Enter adds, “Create folder “X”” makes a new one, Backspace removes the last chip, Clear empties. Names always start with a capital (`folderName`).

## #40 — Add Folder Locations
**Status:** 🟢
"+ Add Folder" at the top and bottom of the sidebar.
**Notes:** + Add folder at the top and the bottom of the sidebar (and in Move to folder…), plus Add a sub-folder on each folder.

## #41 — Bookmark Recycle Bin
**Status:** 🟢
Deleted bookmarks go to a recycle bin: select, restore selected, delete selected, restore all, delete all.
Permanent deletion needs confirmation.
**Notes:** Deleted bookmarks go to the Recycle Bin (#02): select, restore selected, delete selected (confirmed), restore all, empty (confirmed). The sidebar's Recycle Bin link opens it filtered to bookmarks (`/trash?app=/bookmarks`).

## #42 — Favicon Refresh
**Status:** 🟢
"Refresh Favicon" with loading, success, failure and offline states; keep the old icon if it fails.
**Notes:** Refresh icon in the right-click menu: loading toast, checks the new icon really loads before using it, success (with Undo), failure keeps the old icon (with Try again), offline explains and keeps it.

## #43 — Bookmark Metadata Extraction
**Status:** 🟢
Fetch title, description, OG title/description/image, favicon, domain; let the user edit before saving.
**Notes:** `/api/link-preview` now returns page title, og:title, og:description, og:image, site name and domain (still only public addresses). Saving a link shows a review card first: preview image or icon, site and address, editable title and description, folders (with a suggestion), Save / Cancel; Enter twice is still the quick path. Offline it says details aren't available and still saves. The preview image is kept on the bookmark. Tested desktop + mobile.

# PART C — THINGS I OWN

## #44 — Type-First Add Flow
**Status:** 🟢
Pick the type first: Phone, Tablet, Laptop, Desktop, Monitor, TV, Keyboard, Mouse, Headphones, Other.
**Notes:** Add starts with "What are you adding?": a grid of types (Phone, Tablet, Laptop, Desktop, Monitor, TV, Keyboard, Mouse, Headphones, Watch, Camera, Game console, Speaker/audio, Home, Vehicle, Other), then the details, with Change type. Editing goes straight to details; continuing a draft too. Tested desktop + mobile.

## #45 — Company / Model / Generation Suggestions
**Status:** 🟢
Searchable autocomplete for company, model, generation; custom values allowed.
**Notes:** `ComboInput` autocomplete for Company (catalog companies for the type first, with logos), Model (filtered by type and company, with year hints; picking one fills the company) and Generation (when the model has them). Custom values always accepted. The name writes itself ("Lenovo Legion Y700 Gen 3") until you type your own.

## #46 — Automatic Device Information
**Status:** 🟢
Suggest release year, storage, RAM, generation, display size, manufacturer, model info.
**Notes:** `utils/devices.ts` catalog (~90 common devices): "Suggested details: Released 2025 · 8.8″ screen [Use] [Ignore]" fills release year, RAM and screen size; storage sizes the model came in appear as quick picks. New optional fields: company, model, generation, release year, storage, RAM, screen; shown on cards ("Gen 3 · 2025 · 256 GB · 8.8″"), in CSV/JSON import-export and search. Only details I'm confident about are in the catalog; everything is editable.

## #47 — Device Filtering
**Status:** 🟢
Filter by type, company, year, storage, generation.
**Notes:** Filters for type, company, release year, storage and generation (only those your things have values for), remembered, with Clear filters and a "Nothing matches these filters" state; folded behind a Filters button on phones.

## #48 — TV / Monitor Types
**Status:** 🟢
**Notes:** TV and Monitor types with their own icons, colours, depreciation and screen-size detail; catalog entries for common models.

## #49 — Mouse / Keyboard Types
**Status:** 🟢
Architecture should make more categories easy to add later.
**Notes:** Mouse and Keyboard types added. Kinds of things are one registry (`THING_TYPES`: key, label, icon, colour, yearly loss, which details to ask for), used by the form, cards, breakdown, filters, estimates and imports; the old Computer type is kept for existing items.

## #50 — Company Logos
**Status:** 🟢
Show manufacturer logos automatically, generic icon fallback.
**Notes:** Company logos from each company's own site icon (no third-party logo service) on a white tile, with the type icon when it can't load; also in the Company suggestions.

# PART D — TEXT TOOLS APP (`/case`)

## #51 — Rename Text Case
**Status:** ⬜
Rename to reflect what it does; update navigation, page title, header, description, metadata.
**Notes:**

## #52 — Text Comparison
**Status:** ⬜
Original vs Modified, highlighting added, removed, changed.
**Notes:**

## #53 — Responsive Text Comparison
**Status:** ⬜
Side by side on desktop, stacked on mobile; long text stays readable.
**Notes:**

---

# PART E — RENEWALS APP

## #54 — Automatic Renewal Icons
**Status:** ⬜
Icon picked from the service name; manual replacement allowed.
**Notes:**

## #55 — Renewal Countdown
**Status:** ⬜
Countdown in months/weeks/days/hours/minutes/seconds, more precise as the date gets close.
**Notes:**

## #56 — Renewal Status
**Status:** ⬜
Safe / Upcoming / Soon / Due / Expired, shown with colour and text/icon.
**Notes:**

## #57 — USD / KHR Conversion
**Status:** ⬜
USD ↔ KHR, totals in both currencies, centralised exchange-rate logic.
**Notes:**

## #58 — Renewal Cost Calculations
**Status:** ⬜
Equivalent cost per year, half-year, quarter, month, week, day — clearly marked as equivalent.
**Notes:**

---

# PART F — COUNTDOWN APP

## #59 — Countdown Visual Redesign
**Status:** ⬜
Consistent with the ecosystem: typography, spacing, number hierarchy, cards, responsive layout.
**Notes:**

## #60 — Smooth Countdown Number Animation
**Status:** ⬜
Subtle slide/fade/flip/scale on changing numbers.
**Notes:**

---

# PART G — PHONE CHECKER APP (`/phone`)

## #61 — Fix Sticky Sidebar
**Status:** ⬜
Left sticky section must not overlap content (position, z-index, overflow, bounds, height); non-sticky on mobile.
**Notes:**

## #62 — Contact Management
**Status:** ⬜
Add, edit, delete, search, select contacts; fields: name, phone, email, notes.
**Notes:**

## #63 — Phone Checker Export
**Status:** ⬜
CSV, JSON, copy to clipboard; meaningful filenames.
**Notes:**

---

# PART H — GLOBAL DASHBOARD / HOME

## #64 — Personal Dashboard
**Status:** ⬜
Favorite apps, quick actions, recent activity, upcoming renewals, active countdowns, recent bookmarks and devices.
**Notes:**

---

# PART I — FINAL POLISH

## #65 — Smart Navigation
**Status:** ⬜
Consistent navigation to switch apps, search, add, open settings, see favorites and recent activity.
**Notes:**

## #66 — App-Level Favorites
**Status:** ⬜
Favorite individual records (bookmark, device, renewal, countdown).
**Notes:**

## #67 — Compact / Comfortable Density
**Status:** ⬜
Spacious / Comfortable / Compact, remembered.
**Notes:**

## #68 — Dark / Light / System Theme
**Status:** ⬜
Light / Dark / System; every component works in each.
**Notes:** Already implemented (`useTheme`, Settings, `D` shortcut); needs a pass over new components.

## #69 — Smart Loading & Error Recovery Review
**Status:** ⬜
Every network operation has loading, success, failure, retry and offline fallback.
**Notes:**

## #70 — Performance Optimization
**Status:** ⬜
Re-renders, images, icons, slow lists, network requests, polling, bundle size; lazy loading, caching,
virtualisation where needed, debounced search, efficient state.
**Notes:**

## #71 — Mobile UX Review
**Status:** ⬜
Touch targets, swipe actions, bottom sheets, modals, keyboard behaviour, long lists, forms, navigation, sticky elements.
**Notes:**

## #72 — Desktop UX Review
**Status:** ⬜
Shortcuts, command palette, context menus, drag & drop, multi-column layouts, hover, tooltips, large screens.
**Notes:**

## #73 — Data Integrity Review
**Status:** ⬜
Duplicates, failed saves, partial updates, import/restore conflicts, delete/restore, offline changes, backup integrity.
**Notes:**

## #74 — Security & Privacy Review
**Status:** ⬜
Local storage, user data, imported files, exports, external metadata requests, sensitive info; send no
unnecessary personal data to external services.
**Notes:**

## #75 — Final UX Audit
**Status:** ⬜
Review every app as a new user (purpose, primary action, forms, errors, animation, destructive actions,
empty/loading states, mobile, desktop, shortcuts, overlaps, broken icons, console errors, one product).
**Notes:**

---

# Implementation order

1. Foundation `#01–#05` · 2. Core navigation `#06–#16` · 3. Data safety `#17–#25` ·
4. Advanced interaction `#26–#34` · 5. Individual apps `#35–#63` · 6. Ecosystem `#64–#69` · 7. Quality `#70–#75`
