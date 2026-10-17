# Ousa’s Apps

Small tools for everyday jobs, and simple trackers for the things in your life, in one web app.
Sign in with Google to open the apps; your data then syncs across your devices, and nobody else using the same device can see it. (The CV page stays public.)

Built with [Nuxt](https://nuxt.com) (Vue 3, Nitro, Vite) and Firebase (Google sign-in and Firestore).

![The home page: a Rubik’s cube whose stickers open the apps, with the apps listed below](docs/screenshots/home.png)

**Watch the 25-second tour** (click to play):

[![The launch video: the cube shuffling next to “18 apps. One cube.”](docs/launch.jpg)](docs/launch.mp4)

## The apps

**Tools**

| App | What it does |
|---|---|
| QR code | Turn a link or text into a QR code, with colours, logo and frame, and download it |
| Phone checker | Check a Cambodian number and see its network; check a whole address book |
| Image compressor | Make images and PDFs smaller, in the browser, without uploading them |
| Text tools | Change text to any case, or compare two versions and see what changed |
| Passwords | Make strong passwords and save them, encrypted on this device |
| KHR/USD exchange | See whether an exchange rate makes you gain or lose money |
| Phone battery | See how much of your battery is left compared with when it was new |
| Salary & raise | Work out what a raise is really worth after Cambodian salary tax |
| Speed test | Test your download, upload, ping and jitter on a live dial, see what it’s good for and how close you get to your plan |

**Life**

| App | What it does |
|---|---|
| Things I own | What you own, what you paid and what it’s worth today; filter from the summary, hide categories, or leave items out of the totals |
| What should I eat? | Swipe through your saved foods and places until one sounds good |
| Weight | Log your weight and see the trend |
| Countdown | Count down to dates, with Cambodian public holidays |
| Renewals | What your subscriptions cost and when they renew |
| Bookmarks | Save links in folders and pin the ones you open every day; each site’s preview image, description and icon fill in, and duplicates are flagged |
| Notes | Fast notes with folders, checklists, links between notes and version history |
| Gold tracker | Live gold price in chi and damlung, and what your gold is worth now |
| Ambient Studio | Play your YouTube Music playlists and liked songs, over ambient scenes, a rain/fire/noise mixer made in the browser, and focus or sleep timers |

### Screenshots

Every app with saved data has example data: click its icon to try it without touching your own.

| | |
|---|---|
| ![Things I own: what everything is worth, and where the value is](docs/screenshots/things.png) | ![Notes: folders, the list and the editor side by side](docs/screenshots/notes.png) |
| **Things I own** | **Notes** |
| ![Renewals: monthly cost and the next 30 days of renewals](docs/screenshots/renewals.png) | ![Gold tracker: the live price and what your gold is worth](docs/screenshots/gold.png) |
| **Renewals** | **Gold tracker** |
| ![Bookmarks: save a link, pinned links, folders and the list with each site's preview image](docs/screenshots/bookmarks.png) | ![Weight: latest weigh-in and the trend chart](docs/screenshots/weight.png) |
| **Bookmarks** | **Weight** |
| ![QR code: a live preview with colour and shape options](docs/screenshots/qr.png) | ![Renewals in dark mode](docs/screenshots/renewals-dark.png) |
| **QR code** | **Dark mode** |
| ![Speed test: the dial after a test, with ping, download, upload and what the connection is good for](docs/screenshots/speed.png) | ![Speed test in dark mode, testing download](docs/screenshots/speed-dark.png) |
| **Speed test** | **Speed test, mid-test** |

On a phone, Notes works like Apple Notes (folders, a folder’s notes, then the note full screen), and the
apps menu opens from the top bar:

<p>
  <img src="docs/screenshots/phone-notes-list.png" width="200" alt="Notes on a phone: the list grouped by Favourites, Today and Yesterday">
  <img src="docs/screenshots/phone-notes-note.png" width="200" alt="Notes on a phone: a note open full screen with the formatting bar">
  <img src="docs/screenshots/phone-things.png" width="200" alt="Things I own on a phone">
  <img src="docs/screenshots/phone-menu.png" width="200" alt="The apps menu on a phone, three apps to a row">
</p>

Each app has its own keyboard on a phone: number fields get a keypad and text fields a full keyboard, each with the
app’s own keys on top. The 🌐 key switches a field to the phone’s keyboard, for Khmer, emoji or voice:

<p>
  <img src="docs/screenshots/phone-keypad.png" width="200" alt="Phone checker’s keypad, with Cambodian network prefixes above the digits">
  <img src="docs/screenshots/phone-things-keypad.png" width="200" alt="Things I own’s Add form with the price keypad, with price keys like 99 and 499">
  <img src="docs/screenshots/phone-bookmarks-keys.png" width="200" alt="Bookmarks with the app’s keyboard: link keys like https:// and .com above the letters, with / and . beside the space bar">
</p>

Shared across the apps: search everything (⌘K / Ctrl K), the apps menu (M), example data from each app’s icon,
each app’s own settings (the Settings button in its header), right-click or long-press menus (rows don’t repeat
their buttons), select several and act on them together, a Recycle Bin that keeps deleted things for 30 days, each app’s own keyboard on phones (a keypad with its amounts, steps or network prefixes for numbers, and a full keyboard with its own keys for text), full screen on phones from your first tap, light and dark themes, sounds, and installing it as an app
on a phone or computer.

**Import and export** live in Settings: each app’s settings popup has Import & export for that app’s data and
settings (with CSV, browser bookmarks or Markdown where the app has them, under More formats), and the main
Settings page backs up and restores everything at once. Restores always show a preview first, and a full backup can
be imported into a single app.

## Getting started

You need **Node.js 22.21+, 24.11+ or 26+** (Nuxt warns on other versions) and npm.

```bash
npm install
npm run dev
```

The app runs at http://localhost:3000. Without Firebase settings everything still works and is saved in the
browser; sign-in and sync stay off.

### Firebase (sign-in and sync)

1. In the [Firebase console](https://console.firebase.google.com), create a project, add a **web app**, enable
   **Google** sign-in under Authentication, and create a **Firestore** database.
2. Publish the rules in [`firestore.rules`](firestore.rules): each signed-in user can only read and write their own
   data under `users/{uid}`. The CV page (`/cv`) is the one public document, `public/cv`: anyone can read it, and
   only the owner's Google account can edit it (the email in the rule should match `NUXT_PUBLIC_OWNER_EMAIL`).
3. Create a `.env` file in the project root (it’s git-ignored):

   ```bash
   # Firebase web app (Project settings → Your apps). Public by design; the Firestore rules protect the data.
   NUXT_PUBLIC_FIREBASE_API_KEY=
   NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
   NUXT_PUBLIC_FIREBASE_PROJECT_ID=
   NUXT_PUBLIC_FIREBASE_APP_ID=

   # The Google account the app signs in to; Google offers it first
   NUXT_PUBLIC_OWNER_EMAIL=

   # Optional: the public address for canonical links and share images, e.g. https://ousa.app
   NUXT_PUBLIC_SITE_URL=

   # Optional, development only: use the local Firebase emulators (Firestore 8089, Auth 9099)
   # NUXT_PUBLIC_FIREBASE_EMULATOR_HOST=127.0.0.1
   ```

`.env` is only read in development. A deployed site needs the same variables set in its host’s environment.

### YouTube Music (Ambient Studio)

Ambient Studio reads your playlists and liked songs with the official YouTube Data API, using the same Google
sign-in (read-only access, asked for only when you press Connect). In the Google Cloud project behind your
Firebase app:

1. Enable **YouTube Data API v3** (APIs & Services → Library).
2. Under **OAuth consent screen → Data access**, add the `https://www.googleapis.com/auth/youtube.readonly` scope.
   While the app is in Testing, add your Google account under Test users.

Songs play in the visible YouTube player (YouTube requires it), so there’s no background audio. YouTube Music has
no public API of its own, so uploads and radio mixes aren’t available, and a few songs whose owners block playback
on other sites are skipped. The scenes, the sound mixer and the timers work without any of this.

If the app says **Offline** while your internet works, something is blocking `firestore.googleapis.com`
(an ad blocker or privacy shield, a VPN or a firewall). The Offline badge and Settings → Sync show the reason.

### Testing on a phone

Google sign-in and the password vault need https (or localhost), so phones on your Wi-Fi need a certificate:

```bash
npm run dev:lan
```

The first run makes a self-signed certificate for this Mac’s Wi-Fi address in `.certs/` (run
`sh scripts/dev-cert.sh` again if the address changes). Open the https address it prints on your phone and
accept the certificate warning.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server on http://localhost:3000 |
| `npm run dev:lan` | Development server over https on your network, for phones |
| `npm run build` | Production build in `.output/` |
| `npm run preview` | Run the production build locally |
| `npm run generate` | Pre-render a static site |
| `npm run og:images` | Re-render the share images in `public/og/` (needs a production server; see the script) |

`scripts/pwa-icons.cjs` re-renders the install icons in `public/icons/` from `public/favicon.svg`, and
`node scripts/ambient-studio-scenes.cjs` redraws Ambient Studio’s scene artwork in `public/ambient-studio/scenes/`.

## How it fits together

```
app/
  pages/          one page per app (qr.vue, notes.vue, …), plus settings, trash and the home page
  components/     shared UI: ToolPage (every app's header), SiteBar (top bar), FloatingNav (apps menu),
                  CommandPalette, ContextMenu, BulkBar, Modal, SettingRow / SettingChoice, …
  composables/    shared behaviour: useCollection (a synced list), useSync, useVault, usePrefs,
                  useAppPrefs (each app's settings), useRowMenu, useBulkSelect, useDraft, …
  utils/          the app list (tools.ts), sync engine (sync.ts), backups (backup.ts), money, dates, per-app logic
  */ambient-studio/  Ambient Studio keeps its components, composables, utils, data and types in folders of its own
  assets/css/     main.css: colours, spacing and shared styles for every app
server/
  api/            exchange rate, holidays, link previews, site logos, food photos
  routes/         robots.txt and sitemap.xml
public/           icons, share images, manifest
```

- **Adding an app:** add it to `TOOLS` in `app/utils/tools.ts` (name, summary, colour, icon, group) and create
  `app/pages/<name>.vue` wrapped in `<ToolPage>`. The home page, apps menu, search and sitemap pick it up.
- **Data:** an app’s records live in a `useCollection('<name>')` list. It’s saved on the device first, works
  offline, and syncs to Firestore when signed in. Deleted records go to the Recycle Bin.
- **Passwords** are encrypted in the browser (PBKDF2 → AES-256-GCM) and never leave it unencrypted.

[`CHECKLIST.md`](CHECKLIST.md) records each improvement, where it lives in the code, and anything left to do.

## Deploying

`npm run build` produces a Node server in `.output/` (`node .output/server/index.mjs`). Any host that runs
Node works; see the [Nuxt deployment docs](https://nuxt.com/docs/getting-started/deployment). Set the
`NUXT_PUBLIC_*` variables above in the host’s environment, and add the site’s domain to Firebase
Authentication → Settings → Authorised domains so Google sign-in works there.
