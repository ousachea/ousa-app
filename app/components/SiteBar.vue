<script setup lang="ts">
// The bar at the top of every page: the way back (or home) on the left, search and the apps menu on
// the right (Condensed is in the apps menu). It sits in the page like any other row, at the page's
// own width, so it never covers anything.
const props = defineProps<{ back?: boolean }>()

const router = useRouter()
const { open, toggleMenu } = useAppMenu()
const { openPalette } = usePalette()
const { vault } = useVault()
const signedIn = computed(() => !['loading', 'signed-out'].includes(vault.status))

// Breadcrumbs inside an app: Ousa’s Apps › the app (› its tab) › where you are in it (useBreadcrumbs)
const route = useRoute()
const page = computed(() => (props.back ? pageFor(route.path) : undefined))
const app = computed(() => (page.value?.app ? toolFor(page.value.app) : page.value))
const { trail, root } = useBreadcrumbs()
const deeper = computed(() => !!trail.value.length || page.value !== app.value)
function toRoot(e: MouseEvent) {
  if (!root.value || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
  e.preventDefault()
  root.value()
}

const isMac = ref(false)
onMounted(() => (isMac.value = /Mac|iPhone|iPad/.test(navigator.platform)))

// Back to wherever you came from in the app (same as Esc); straight in from outside, it goes home
function goBack(e: MouseEvent) {
  if (!props.back) return
  // Let cmd/ctrl-click open home in a new tab as a normal link would
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
  if (window.history.state?.back) {
    e.preventDefault()
    router.back()
  }
}
</script>

<template>
  <header class="site-bar">
    <nav class="crumbs" :class="{ deep: deeper }" aria-label="Breadcrumb">
      <NuxtLink
        to="/"
        class="brand"
        :aria-label="back ? 'Back, Ousa’s Apps' : 'Ousa’s Apps'"
        :title="back ? 'Back (Esc)' : undefined"
        @click="goBack"
      >
        <AppIcon v-if="back" class="chev" name="chevron-left" />
        <AppLogo class="logo" />
        <span class="brand-name">Ousa’s Apps</span>
      </NuxtLink>
      <ClientOnly>
        <ol v-if="app" class="trail">
          <li class="crumb app-crumb">
            <NuxtLink v-if="deeper" :to="app.to" class="crumb-link" @click="toRoot">{{ app.name }}</NuxtLink>
            <span v-else class="crumb-here" aria-current="page">{{ app.name }}</span>
          </li>
          <li v-if="page && page !== app" class="crumb" :class="{ mid: trail.length }">
            <span v-if="!trail.length" class="crumb-here" aria-current="page">{{ page.name }}</span>
            <NuxtLink v-else :to="page.to" class="crumb-link" @click="toRoot">{{ page.name }}</NuxtLink>
          </li>
          <li v-for="(c, i) in trail" :key="`${i}-${c.label}`" class="crumb" :class="{ mid: i < trail.length - 1 }">
            <button v-if="i < trail.length - 1 && c.go" type="button" class="crumb-link" @click="c.go()">{{ c.label }}</button>
            <span v-else class="crumb-here" aria-current="page">{{ c.label }}</span>
          </li>
        </ol>
      </ClientOnly>
    </nav>

    <div class="tools">
      <button type="button" class="bar-btn search" aria-keyshortcuts="Control+K Meta+K" title="Search everything" @click="open = false; openPalette()">
        <AppIcon name="search" />
        <span class="label">Search</span>
        <ClientOnly><kbd>{{ isMac ? '⌘' : 'Ctrl' }} K</kbd></ClientOnly>
      </button>
      <button
        type="button"
        class="bar-btn apps"
        :class="{ on: open }"
        data-app-menu-trigger
        :aria-expanded="open"
        aria-controls="fab-menu"
        aria-keyshortcuts="M"
        :title="open ? 'Close apps (M)' : 'All apps (M)'"
        @click="toggleMenu"
      >
        <!-- Nine squares, like a face of the cube; an X while the menu is open -->
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path v-if="open" class="x" d="M6 6l12 12M18 6L6 18" />
          <template v-else>
            <rect x="4" y="4" width="4" height="4" rx="1.2" /><rect x="10" y="4" width="4" height="4" rx="1.2" /><rect x="16" y="4" width="4" height="4" rx="1.2" />
            <rect x="4" y="10" width="4" height="4" rx="1.2" /><rect x="10" y="10" width="4" height="4" rx="1.2" /><rect x="16" y="10" width="4" height="4" rx="1.2" />
            <rect x="4" y="16" width="4" height="4" rx="1.2" /><rect x="10" y="16" width="4" height="4" rx="1.2" /><rect x="16" y="16" width="4" height="4" rx="1.2" />
          </template>
        </svg>
        <span class="label">Apps</span>
        <!-- Signed in and syncing -->
        <ClientOnly>
          <span v-if="signedIn" class="live" title="Synced with your account"><span class="visually-hidden">, synced</span></span>
        </ClientOnly>
      </button>
    </div>
  </header>
</template>

<style scoped>
.site-bar {
  width: 100%;
  max-width: var(--width, var(--page-width));
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  min-height: 3rem;
  padding-top: max(0px, env(safe-area-inset-top) - 1rem);
}

/* ---------- Left: back to the apps, and the breadcrumb trail ---------- */
.crumbs {
  grid-column: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}

.brand {
  flex: none;
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.5rem;
  min-width: 0;
  margin-left: -0.5rem;
  padding: 0 0.75rem 0 0.5rem;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--ink);
  text-decoration: none;
  border-radius: 12px;
  transition: background-color var(--dur-fast, 0.15s);
}

.brand:hover {
  background: color-mix(in srgb, var(--ink) 6%, transparent);
}

.brand:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.chev {
  width: 1.1rem;
  height: 1.1rem;
  margin-right: -0.15rem;
  flex: none;
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: translate 0.2s cubic-bezier(0.2, 0, 0, 1);
}

/* The arrow nudges left on hover, pointing the way you'll go */
.brand:hover .chev {
  translate: -2px 0;
}

.logo {
  flex: none;
  font-size: 1.6rem;
}

.brand-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Inside an app the bar reads like a path: Ousa’s Apps / Bookmarks / Work / Banking */
.trail {
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  align-items: center;
  font-size: 0.95rem;
  font-weight: 600;
}

.crumb {
  min-width: 0;
  display: flex;
  align-items: center;
}

/* Every step but the app gives way first when space runs out */
.app-crumb {
  flex: none;
}

.crumb::before {
  content: '/';
  flex: none;
  margin: 0 0.15rem;
  color: var(--ink-3);
  font-weight: 400;
}

.crumb-link,
.crumb-here {
  min-width: 0;
  max-width: 14rem;
  padding: 0.35rem 0.45rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 9px;
}

.crumb-link {
  font: inherit;
  color: var(--ink-2);
  text-decoration: none;
  background: none;
  border: 0;
  cursor: pointer;
  transition: background-color var(--dur-fast, 0.15s), color var(--dur-fast, 0.15s);
}

.crumb-link:hover {
  color: var(--ink);
  background: color-mix(in srgb, var(--ink) 6%, transparent);
}

.crumb-link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.crumb-here {
  color: var(--ink);
}

/* ---------- Right: search and apps ---------- */
.tools {
  grid-column: 2;
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.bar-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  height: 2.5rem;
  padding: 0 0.85rem;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ink);
  background: var(--surface);
  border: 0;
  border-radius: 12px;
  box-shadow: 0 0 0 1px var(--line);
  cursor: pointer;
  transition: background-color var(--dur-fast, 0.15s), box-shadow var(--dur-fast, 0.15s), scale 0.12s;
}

.bar-btn:hover {
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--ink) 25%, var(--line));
}

.bar-btn:active {
  scale: 0.97;
}

.bar-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.bar-btn svg {
  width: 1.1rem;
  height: 1.1rem;
  flex: none;
}

.search {
  color: var(--ink-2);
  min-width: 11rem;
}

.search svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
}

.search kbd {
  margin-left: auto;
  padding: 0.05rem 0.35rem;
  font: inherit;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--ink-3);
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 6px;
}

.apps svg {
  fill: currentColor;
}

.apps .x {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
}

/* Open: it reads as pressed, in the cube's black plastic */
.apps.on {
  color: #fff;
  background: var(--plastic);
  box-shadow: 0 0 0 1px var(--plastic-edge, transparent);
}

.live {
  position: absolute;
  top: -3px;
  right: -3px;
  width: 0.7rem;
  height: 0.7rem;
  background: #22c55e;
  border: 2px solid var(--bg);
  border-radius: 50%;
}

/* Phones: icon buttons; the labels stay for screen readers */
@media (max-width: 640px) {
  .bar-btn {
    width: 2.75rem;
    height: 2.75rem;
    padding: 0;
    justify-content: center;
  }

  .search {
    min-width: 0;
  }

  .label,
  .search kbd {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .bar-btn svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  /* With a trail, the logo stands for Ousa’s Apps, and only the app and where you are show */
  .deep .brand-name {
    display: none;
  }

  .deep .brand {
    padding-right: 0.25rem;
  }

  .trail {
    font-size: 0.9rem;
  }

  .crumb.mid {
    display: none;
  }

  .crumb-link,
  .crumb-here {
    max-width: 9rem;
    padding: 0.35rem 0.3rem;
  }
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .chev,
  .bar-btn {
    transition: none;
  }
}
</style>
