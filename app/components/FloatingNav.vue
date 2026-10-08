<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { Tool } from '~/utils/tools'

const HOME: Tool = { to: '/', name: 'Home', summary: 'Back to the cube', color: 'var(--plastic)', icon: 'list' }
const LINKS = [HOME, ...TOOLS, SETTINGS]
// Shortcut key for each page: 0 is Home, then 1, 2, 3… in menu order
// Only ten digit keys exist, so pages after the tenth have no number shortcut
const keyFor = (to: string) => {
  const i = LINKS.findIndex(l => l.to === to)
  return i >= 0 && i <= 9 ? String(i) : undefined
}

// Letter shortcuts while the menu is open, picked to be easy to remember.
// M and D already toggle the menu and dark mode, so they're never given out.
const MENU_KEYS: Record<string, string> = {
  '/': 'h', // Home
  '/qr': 'q',
  '/phone': 'p',
  '/compress': 'i', // Image
  '/text': 't', // Text
  '/password': 'w', // passWords
  '/exchange': 'x', // eXchange
  '/things': 'o', // Own
  '/eat': 'e', // Eat
  '/weight': 'k', // kg
  '/countdown': 'c',
  '/renewals': 'r',
  '/bookmarks': 'b',
  '/battery': 'a', // bAttery
  '/salary': 's',
  '/gold': 'g',
  '/settings': ',' // like Settings on a Mac
}
const RESERVED = new Set(['m', 'd'])
const LETTER = new Map<string, string>() // path -> key
const BY_LETTER = new Map<string, Tool>() // key -> page
for (const t of [HOME, ...TOOLS, SETTINGS]) {
  const fixed = MENU_KEYS[t.to]
  if (fixed && !BY_LETTER.has(fixed)) {
    LETTER.set(t.to, fixed)
    BY_LETTER.set(fixed, t)
  }
}
// A new app without a chosen key gets the first free letter of its name
for (const t of TOOLS.filter(t => !LETTER.has(t.to))) {
  const lower = t.name.toLowerCase()
  const initials = lower.split(/[^a-z]+/).filter(Boolean).map(w => w[0]!)
  const letter = [...initials, ...lower.replace(/[^a-z]/g, '')].find(c => !RESERVED.has(c) && !BY_LETTER.has(c))
  if (!letter) continue
  LETTER.set(t.to, letter)
  BY_LETTER.set(letter, t)
}

const open = ref(false)
const { play } = useSound()
const root = ref<HTMLElement>()
const searchInput = ref<HTMLInputElement>()
const route = useRoute()
const router = useRouter()
const { toggle: toggleTheme } = useTheme()
const { prefs } = usePrefs()

// Account lives at the top of this menu: one sign-in syncs every app to Firebase.
// It's the same Google account as the password vault.
const { vault, signOut } = useVault()
const signedIn = computed(() => !['loading', 'signed-out'].includes(vault.status))
const signInOpen = ref(false)

function openSignIn() {
  open.value = false
  signInOpen.value = true
  play('open')
}

async function doSignOut() {
  await signOut()
  open.value = false
  play('lock')
  toast('Signed out', { description: 'New changes stay on this device until you sign in again.' })
}

// ---------- Full screen ----------
// Not every browser allows it (iPhone Safari doesn't), so the button only shows where it works
const canFullscreen = ref(false)
const isFullscreen = ref(false)
const syncFullscreen = () => (isFullscreen.value = !!document.fullscreenElement)

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen()
    play(document.fullscreenElement ? 'toggle-on' : 'toggle-off')
  } catch {
    toast.error('Full screen isn’t available here')
    play('error')
  }
  open.value = false
}

// ---------- Search and groups ----------
const query = ref('')
const matches = (t: Tool) => {
  const q = query.value.trim().toLowerCase()
  return !q || `${t.name} ${t.summary}`.toLowerCase().includes(q)
}
// Pinned apps come first and leave their usual group (CHECKLIST.md #09)
const hydrated = useHydrated()
const unseenRelease = useUnseenRelease()
const pins = computed(() => (hydrated.value ? prefs.pinnedApps : []))
const pinnedTools = computed(() => pins.value.map(p => TOOLS.find(t => t.to === p)).filter((t): t is Tool => !!t))
const unpinned = (t: Tool) => !pins.value.includes(t.to)
const groups = computed(() => [
  { name: 'Pinned', items: pinnedTools.value.filter(matches) },
  { name: 'Tools', items: TOOLS.filter(t => !t.group || t.group === 'Tools').filter(unpinned).filter(matches) },
  { name: 'Life', items: TOOLS.filter(t => t.group === 'Life').filter(unpinned).filter(matches) }
].filter(g => g.items.length))
const results = computed(() => groups.value.flatMap(g => g.items))

function openFirst() {
  const first = results.value[0]
  if (first) router.push(first.to)
}

watch(() => route.path, () => (open.value = false))
// Letters open apps, so the search box only takes the keyboard when asked (click it or press /)
watch(open, (isOpen) => {
  if (!isOpen) query.value = ''
})

function toggleMenu() {
  open.value = !open.value
  play(open.value ? 'open' : 'close')
}

function onPointerDown(e: PointerEvent) {
  if (open.value && !root.value?.contains(e.target as Node)) open.value = false
}

function goTo(index: number) {
  const link = LINKS[index]
  if (!link) return
  if (link.to === route.path) open.value = false
  else router.push(link.to)
}

// Back to the previous page in this app; if the visitor landed here directly, go home instead
function goBack() {
  if (window.history.state?.back) router.back()
  else if (route.path !== '/') router.push('/')
}

const { palette, openPalette } = usePalette()

function onKeydown(e: KeyboardEvent) {
  // ⌘K / Ctrl+K: the command palette, from anywhere (even a text field), and again to close it
  if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    if (palette.open) usePalette().closePalette()
    else {
      open.value = false
      openPalette()
    }
    return
  }
  if (palette.open) return

  if (e.key === 'Escape') {
    // Something on the page (e.g. a chart) already handled it, or a popup is closing itself
    if (e.defaultPrevented || document.querySelector('dialog[open]')) return
    if (open.value) open.value = false
    // Leave a text field so the shortcuts work again
    else if (isTyping(e.target)) (e.target as HTMLElement).blur()
    else goBack()
    return
  }

  // Never take over browser or OS shortcuts, and never steal keys while someone is typing
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || isTyping(e.target)) return
  // Single-key shortcuts can be switched off in Settings; a popup keeps its own keys
  if (!prefs.shortcuts || document.querySelector('dialog[open]')) return

  // Menu open: a letter opens its app, / jumps to search
  if (open.value) {
    if (e.key === '/') {
      e.preventDefault()
      searchInput.value?.focus()
      return
    }
    const app = BY_LETTER.get(e.key.toLowerCase())
    if (app) {
      e.preventDefault()
      if (app.to === route.path) open.value = false
      else router.push(app.to)
      return
    }
  }

  const current = LINKS.findIndex(l => l.to === route.path)
  if (/^[0-9]$/.test(e.key) && Number(e.key) < LINKS.length) goTo(Number(e.key))
  else if (e.key === ']') goTo(current + 1)
  else if (e.key === '[') goTo(current - 1)
  else if (e.key === 'm' || e.key === 'M') toggleMenu()
  // A: this page's own Add, or Quick Add where there isn't one
  else if (e.key === 'a' || e.key === 'A') {
    if (!runAddAction()) openPalette('add')
  }
  else if (e.key === 'd' || e.key === 'D') {
    toggleTheme()
    play('toggle-on')
    toast(document.documentElement.dataset.theme === 'dark' ? 'Dark mode on' : 'Light mode on', { description: 'Press D again to switch back.' })
  }
  else if (e.key === '?') {
    if (!open.value) toggleMenu()
  }
  else return

  e.preventDefault()
}

const isMac = ref(false)
onMounted(() => {
  isMac.value = /Mac|iPhone|iPad/.test(navigator.platform)
  canFullscreen.value = !!document.fullscreenEnabled
  syncFullscreen()
  // Esc or F11 can leave full screen too; keep the button's label in step
  document.addEventListener('fullscreenchange', syncFullscreen)
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', syncFullscreen)
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <nav ref="root" class="fab" :class="{ open }" aria-label="Site navigation">
    <button
      type="button"
      class="toggle"
      :class="{ live: signedIn }"
      :aria-expanded="open"
      aria-controls="fab-menu"
      :aria-label="open ? 'Close navigation' : 'Open navigation'"
      aria-keyshortcuts="M"
      :title="open ? 'Close menu (M)' : 'Open menu (M)'"
      @click="toggleMenu"
    >
      <span class="bars" aria-hidden="true" />
      <!-- Signed in and syncing: the whole button turns live green and pulses -->
      <ClientOnly>
        <span v-if="signedIn" class="visually-hidden">, synced with Firebase</span>
      </ClientOnly>
    </button>

    <div id="fab-menu" class="sheet" :inert="!open">
      <!-- Account: live sync status, or a way to sign in -->
      <ClientOnly>
        <div v-if="vault.status !== 'loading'" class="account">
          <template v-if="signedIn">
            <span class="live-dot" aria-hidden="true" />
            <span class="account-text">
              <strong>Live</strong>
              <span class="email">{{ vault.email }}</span>
            </span>
            <button type="button" class="chip" @click="doSignOut">Sign out</button>
          </template>
          <template v-else>
            <span class="cloud" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M7 18.5h10.5a4 4 0 0 0 .4-8A6 6 0 0 0 6.3 9.6 4.5 4.5 0 0 0 7 18.5z" /></svg>
            </span>
            <span class="account-text">
              <strong>Saved on this device</strong>
              <span class="email">Sign in to sync across devices</span>
            </span>
            <button type="button" class="chip primary" @click="openSignIn">Sign in</button>
          </template>
        </div>
      </ClientOnly>

      <!-- Search everything and Quick Add, for touch screens and anyone who doesn't know the keys -->
      <div class="quick">
        <button type="button" class="quick-btn" aria-keyshortcuts="Control+K Meta+K" @click="open = false; openPalette()">
          <span class="quick-icon" aria-hidden="true"><ToolIcon name="search" /></span>
          Search everything
          <kbd class="quick-kbd">{{ isMac ? '⌘' : 'Ctrl' }} K</kbd>
        </button>
        <button type="button" class="quick-btn add" aria-keyshortcuts="A" @click="open = false; openPalette('add')">
          <span class="quick-icon" aria-hidden="true"><ToolIcon name="plus" /></span>
          Add
          <kbd class="quick-kbd">A</kbd>
        </button>
      </div>

      <label class="search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
        <input
          ref="searchInput"
          v-model="query"
          type="search"
          placeholder="Jump to an app"
          aria-label="Search apps"
          aria-keyshortcuts="/"
          @keydown.enter.prevent="openFirst"
        >
        <kbd>/</kbd>
      </label>

      <div class="groups">
        <section v-for="g in groups" :key="g.name" class="group" :aria-label="g.name">
          <h2>{{ g.name }}</h2>
          <ul>
            <li v-for="t in g.items" :key="t.to">
              <NuxtLink
                :to="t.to"
                class="tile"
                :aria-current="route.path === t.to ? 'page' : undefined"
                :aria-keyshortcuts="[LETTER.get(t.to)?.toUpperCase(), keyFor(t.to)].filter(Boolean).join(' ') || undefined"
                :title="t.summary"
              >
                <span class="icon" aria-hidden="true" :style="{ '--c': t.color, '--on-c': t.onColor ?? '#fff' }">
                  <ToolIcon :name="t.icon" />
                </span>
                <span class="name">{{ t.name }}</span>
                <kbd v-if="LETTER.get(t.to)">{{ LETTER.get(t.to)!.toUpperCase() }}</kbd>
              </NuxtLink>
            </li>
          </ul>
        </section>
        <p v-if="!groups.length" class="none">No app called “{{ query }}”.</p>
      </div>

      <footer class="foot">
        <NuxtLink to="/" class="foot-link" :aria-current="route.path === '/' ? 'page' : undefined" aria-keyshortcuts="H 0">
          <AppLogo class="foot-logo" />Home<kbd>H</kbd>
        </NuxtLink>
        <NuxtLink to="/trash" class="foot-link" :aria-current="route.path === '/trash' ? 'page' : undefined">
          <span class="foot-icon" aria-hidden="true"><ToolIcon name="trash" /></span>Recycle Bin
        </NuxtLink>
        <NuxtLink to="/settings" class="foot-link" :aria-current="route.path === '/settings' ? 'page' : undefined" :aria-keyshortcuts="LETTER.get('/settings')?.toUpperCase()">
          <span class="foot-icon" aria-hidden="true"><ToolIcon name="sound" /></span>Settings
          <span v-if="hydrated && unseenRelease" class="new-dot" title="See what’s new in Settings → About">New</span>
          <kbd v-if="LETTER.get('/settings')">{{ LETTER.get('/settings')!.toUpperCase() }}</kbd>
        </NuxtLink>
        <ClientOnly>
          <button v-if="canFullscreen" type="button" class="foot-link" :aria-pressed="isFullscreen" @click="toggleFullscreen">
            <span class="foot-icon screen" aria-hidden="true">
              <svg v-if="isFullscreen" viewBox="0 0 24 24"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></svg>
              <svg v-else viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
            </span>
            {{ isFullscreen ? 'Exit full screen' : 'Full screen' }}
          </button>
        </ClientOnly>
        <p class="hint">Press a letter to open an app · <kbd>0</kbd>–<kbd>9</kbd> work anywhere · <kbd>Esc</kbd> back · <kbd>D</kbd> dark</p>
      </footer>
    </div>
  </nav>

  <!-- Outside the nav: the nav ignores pointer events so the page underneath stays clickable -->
  <Modal :open="signInOpen" title="Sign in to sync" @close="signInOpen = false">
    <p class="intro">
      Save everything you add (things, bookmarks, countdowns, gold…) to Firebase and see it on all your devices.
      Sign in with your Google account; it’s the same one your password vault uses.
    </p>
    <VaultAuth purpose="account" @done="signInOpen = false" />
  </Modal>
</template>

<style scoped>
.fab {
  position: fixed;
  /* Top-right corner; the menu drops down below the button */
  top: max(1rem, env(safe-area-inset-top));
  right: max(1.25rem, env(safe-area-inset-right));
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.6rem;
  /* The closed sheet still takes up space; don't let that invisible box block clicks on the page */
  pointer-events: none;
}

.toggle {
  position: relative;
  width: 3.5rem;
  height: 3.5rem;
  display: grid;
  place-items: center;
  color: #fff;
  background: var(--plastic);
  border: 0;
  border-radius: 18px;
  box-shadow: inset 0 0 0 1px var(--plastic-edge), 0 8px 22px rgb(var(--shadow) / 0.3);
  cursor: pointer;
  pointer-events: auto;
  transition: transform 0.2s, background-color 0.15s;
}

.toggle:hover { background: var(--plastic-hover); }

/* Live: signed in and syncing. Green button (white lines stay readable) with a ring pulsing out */
.toggle.live {
  background: #15803d;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.15), 0 8px 22px rgb(21 128 61 / 0.4);
}

.toggle.live:hover {
  background: #166534;
}

.toggle.live::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: #22c55e;
  z-index: -1;
  animation: live-pulse 2s cubic-bezier(0, 0, 0.2, 1) infinite;
}

@keyframes live-pulse {
  0% { opacity: 0.55; scale: 1; }
  70%, 100% { opacity: 0; scale: 1.45; }
}
.toggle:active { transform: scale(0.96); }

/* Hamburger that morphs into an X */
.bars,
.bars::before,
.bars::after {
  display: block;
  width: 20px;
  height: 2px;
  background: currentColor;
  border-radius: 2px;
  transition: transform 0.25s, background-color 0.2s;
}

.bars { position: relative; }

.bars::before,
.bars::after {
  content: '';
  position: absolute;
  left: 0;
}

.bars::before { transform: translateY(-6px); }
.bars::after { transform: translateY(6px); }

.open .bars { background: transparent; }
.open .bars::before { transform: rotate(45deg); }
.open .bars::after { transform: rotate(-45deg); }

/* ---------- The sheet: one card that unfolds from the button ---------- */
.sheet {
  width: min(34rem, calc(100vw - 2rem));
  max-height: calc(100dvh - 6.5rem);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 24px;
  box-shadow: 0 24px 60px -18px rgb(var(--shadow) / 0.45), 0 4px 12px rgb(var(--shadow) / 0.08);
  transform-origin: top right;
  opacity: 0;
  scale: 0.96;
  translate: 0 -6px;
  visibility: hidden;
  transition: opacity 0.16s ease-out, scale 0.2s cubic-bezier(0.2, 0, 0, 1), translate 0.2s cubic-bezier(0.2, 0, 0, 1), visibility 0s 0.2s;
}

.open .sheet {
  opacity: 1;
  scale: 1;
  translate: 0 0;
  visibility: visible;
  pointer-events: auto;
  transition-delay: 0s;
}

/* ---------- Account ---------- */
.account {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.6rem 0.6rem 0.6rem 0.85rem;
  background: var(--surface-2);
  border-radius: 16px;
}

.account-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.account-text strong {
  font-size: 0.9rem;
}

.email {
  font-size: 0.8rem;
  color: var(--ink-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cloud {
  flex: none;
  display: grid;
  color: var(--ink-2);
}

.cloud svg {
  width: 1.25rem;
  height: 1.25rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linejoin: round;
}

.chip {
  flex: none;
  min-height: 2.25rem;
  padding: 0 0.85rem;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ink);
  background: var(--surface);
  border: 0;
  border-radius: 10px;
  box-shadow: inset 0 0 0 1px var(--line);
  cursor: pointer;
  transition: background-color 0.15s, scale 0.15s;
}

.chip:hover { background: var(--line); }
.chip:active { scale: 0.96; }

.chip.primary {
  color: #fff;
  background: var(--plastic);
  box-shadow: none;
}

.chip.primary:hover { background: var(--plastic-hover); }

/* Live light: a green dot whose ring keeps pinging outward */
.live-dot {
  position: relative;
  flex: none;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: #3ddc84;
}

.live-dot::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: #3ddc84;
  animation: live-ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
}

@keyframes live-ping {
  0% { opacity: 0.75; scale: 1; }
  80%, 100% { opacity: 0; scale: 2.6; }
}

/* What's new since you last looked (Settings → About) */
.new-dot {
  padding: 0.05rem 0.4rem;
  font-size: 0.68rem;
  font-weight: 700;
  color: #fff;
  background: var(--green);
  border-radius: 999px;
}

/* ---------- Search everything / Add ---------- */
.quick {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.5rem;
}

.quick-btn {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-height: 2.75rem;
  padding: 0 0.6rem 0 0.75rem;
  font: inherit;
  font-size: 0.925rem;
  font-weight: 600;
  color: var(--ink);
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 14px;
  cursor: pointer;
  transition: background-color var(--dur-fast), border-color var(--dur-fast);
}

.quick-btn:hover {
  border-color: var(--ink-3);
}

.quick-btn.add {
  color: #fff;
  background: var(--plastic);
  border-color: var(--plastic);
}

.quick-btn.add:hover {
  background: var(--plastic-hover);
}

.quick-icon {
  display: grid;
  font-size: 1.1rem;
}

.quick-kbd {
  margin-left: auto;
}

.quick-btn.add .quick-kbd {
  color: #fff;
  background: rgb(255 255 255 / 0.12);
  border-color: rgb(255 255 255 / 0.2);
}

@media (pointer: coarse) {
  .quick-kbd {
    display: none;
  }
}

/* ---------- Search ---------- */
.search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.85rem;
  min-height: 2.75rem;
  border: 1px solid var(--line);
  border-radius: 14px;
  transition: border-color 0.15s;
}

.search:focus-within {
  border-color: var(--ink-3);
}

.search svg {
  flex: none;
  width: 1.05rem;
  height: 1.05rem;
  fill: none;
  stroke: var(--ink-3);
  stroke-width: 2;
  stroke-linecap: round;
}

.search input {
  flex: 1;
  min-width: 0;
  font: inherit;
  font-size: 1rem; /* 16px or more, so phones don't zoom in when it's tapped */
  color: var(--ink);
  background: none;
  border: 0;
  outline: none;
}

/* ---------- Groups of app tiles ---------- */
.groups {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.group h2 {
  margin: 0 0 0.35rem 0.35rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--ink-2);
}

.group ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.25rem;
}

.tile {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 2.9rem;
  padding: 0.35rem 0.5rem 0.35rem 0.35rem;
  color: var(--ink);
  text-decoration: none;
  border-radius: 12px;
  transition: background-color 0.12s;
}

.tile:hover {
  background: var(--surface-2);
}

.tile[aria-current='page'] {
  background: var(--surface-2);
  box-shadow: inset 0 0 0 1.5px var(--ink);
}

.icon {
  flex: none;
  width: 2.1rem;
  height: 2.1rem;
  display: grid;
  place-items: center;
  font-size: 1.2rem;
  color: var(--on-c);
  background: var(--c);
  border-radius: 9px;
  box-shadow: inset 0 -3px 0 rgb(0 0 0 / 0.12), inset 0 3px 5px rgb(255 255 255 / 0.25);
}

.name {
  flex: 1;
  min-width: 0;
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.2;
}

.none {
  margin: 0.5rem 0;
  text-align: center;
  font-size: 0.9rem;
  color: var(--ink-2);
}

/* ---------- Footer ---------- */
.foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.5rem;
  padding-top: 0.65rem;
  border-top: 1px solid var(--line);
}

.foot-link {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 2.4rem;
  padding: 0 0.7rem 0 0.4rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ink);
  text-decoration: none;
  border-radius: 11px;
  transition: background-color 0.12s;
}

.foot-link:hover,
.foot-link[aria-current='page'] {
  background: var(--surface-2);
}

button.foot-link {
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  background: none;
  border: 0;
  cursor: pointer;
}

button.foot-link:hover {
  background: var(--surface-2);
}

.foot-icon.screen {
  color: var(--ink);
  background: var(--surface-2);
  box-shadow: inset 0 0 0 1px var(--line);
}

.foot-icon svg {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.foot-logo {
  font-size: 1.6rem;
}

.foot-icon {
  width: 1.6rem;
  height: 1.6rem;
  display: grid;
  place-items: center;
  font-size: 1rem;
  color: #fff;
  background: var(--settings);
  border-radius: 7px;
}

.hint {
  margin: 0 0 0 auto;
  font-size: 0.75rem;
  color: var(--ink-3);
  white-space: nowrap;
}

kbd {
  min-width: 1.3rem;
  height: 1.3rem;
  padding: 0 0.3rem;
  display: inline-grid;
  place-items: center;
  font-family: inherit;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--ink-2);
  background: var(--surface-2);
  border-radius: 5px;
  box-shadow: inset 0 0 0 1px var(--line), inset 0 -2px 0 var(--line);
}

.hint kbd {
  min-width: 1.15rem;
  height: 1.15rem;
}

/* Only show key hints to people with a keyboard */
@media (pointer: coarse) {
  kbd,
  .hint {
    display: none;
  }
}

.toggle:focus-visible,
.tile:focus-visible,
.foot-link:focus-visible,
.chip:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--ink) 40%, transparent);
  outline-offset: 2px;
}

.intro {
  margin: -0.4rem 0 1rem;
  font-size: 0.925rem;
  color: var(--ink-2);
  text-wrap: pretty;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* Narrow phones: one column of tiles is easier to tap */
@media (max-width: 380px) {
  .group ul {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sheet,
  .bars,
  .bars::before,
  .bars::after {
    transition: none;
  }

  .live-dot::after,
  .toggle.live::after {
    animation: none;
  }
}
</style>
