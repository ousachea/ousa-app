<script setup lang="ts">
const LINKS = [
  { to: '/', name: 'Home', icon: undefined, color: 'var(--ink)' },
  ...TOOLS,
  SETTINGS
]
// Shortcut key for each page: 0 is Home, then 1, 2, 3… in menu order
const keyFor = (i: number) => String(i)

const open = ref(false)
const { play } = useSound()
const root = ref<HTMLElement>()
const route = useRoute()
const router = useRouter()

watch(() => route.path, () => (open.value = false))

function toggleMenu() {
  open.value = !open.value
  play(open.value ? 'open' : 'close')
}

function onPointerDown(e: PointerEvent) {
  if (open.value && !root.value?.contains(e.target as Node)) open.value = false
}

// Keys typed into these go into the field, not to the shortcuts
function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  return target instanceof HTMLInputElement
    && ['text', 'tel', 'search', 'email', 'url', 'password', 'number'].includes(target.type)
}

function goTo(index: number) {
  const link = LINKS[index]
  if (!link) return
  if (link.to === route.path) open.value = false
  else router.push(link.to)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (open.value) open.value = false
    // Leave a text field so the shortcuts work again
    else if (isTyping(e.target)) (e.target as HTMLElement).blur()
    return
  }

  // Never take over browser or OS shortcuts, and never steal keys while someone is typing
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || isTyping(e.target)) return

  const current = LINKS.findIndex(l => l.to === route.path)
  if (/^[0-9]$/.test(e.key) && Number(e.key) < LINKS.length) goTo(Number(e.key))
  else if (e.key === ']') goTo(current + 1)
  else if (e.key === '[') goTo(current - 1)
  else if (e.key === 'm' || e.key === 'M') toggleMenu()
  else if (e.key === '?') {
    if (!open.value) toggleMenu()
  }
  else return

  e.preventDefault()
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <nav ref="root" class="fab" :class="{ open }" aria-label="Site navigation">
    <ul id="fab-menu" class="menu" :inert="!open">
      <li class="hint" :style="{ '--i': LINKS.length + 1 }">
        <kbd>[</kbd> <kbd>]</kbd> previous and next page, <kbd>M</kbd> menu
      </li>
      <li v-for="(link, i) in LINKS" :key="link.to" :style="{ '--i': LINKS.length - i }">
        <NuxtLink
          :to="link.to"
          class="item"
          :aria-current="route.path === link.to ? 'page' : undefined"
          :aria-keyshortcuts="keyFor(i)"
        >
          <kbd>{{ keyFor(i) }}</kbd>
          <span class="label">{{ link.name }}</span>
          <span class="icon" aria-hidden="true" :style="{ '--c': link.color, '--on-c': 'onColor' in link ? link.onColor : '#fff' }">
            <ToolIcon v-if="link.icon" :name="link.icon" />
            <AppLogo v-else class="logo" />
          </span>
        </NuxtLink>
      </li>
    </ul>

    <button
      type="button"
      class="toggle"
      :aria-expanded="open"
      aria-controls="fab-menu"
      :aria-label="open ? 'Close navigation' : 'Open navigation'"
      aria-keyshortcuts="M"
      :title="open ? 'Close menu (M)' : 'Open menu (M)'"
      @click="toggleMenu"
    >
      <span class="bars" aria-hidden="true" />
    </button>
  </nav>
</template>

<style scoped>
.fab {
  position: fixed;
  right: max(1.25rem, env(safe-area-inset-right));
  bottom: max(1.25rem, env(safe-area-inset-bottom));
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.75rem;
  /* The hidden menu still takes up space; don't let that invisible box block clicks on the page */
  pointer-events: none;
}

.toggle {
  pointer-events: auto;
}

.menu {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.55rem;
}

.menu li {
  opacity: 0;
  transform: translateY(10px) scale(0.92);
  transform-origin: right center;
  transition: opacity 0.18s, transform 0.25s cubic-bezier(0.3, 1.4, 0.6, 1);
  transition-delay: calc(var(--i) * 30ms);
  pointer-events: none;
}

.open .menu li {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}

.item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.3rem 0.3rem 0.3rem 0.9rem;
  text-decoration: none;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: 0 6px 18px rgb(27 31 42 / 0.12);
  transition: border-color 0.15s;
}

.item:hover {
  border-color: var(--ink-3);
}

kbd {
  min-width: 1.35rem;
  height: 1.35rem;
  padding: 0 0.3rem;
  display: inline-grid;
  place-items: center;
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--ink-2);
  background: var(--surface-2);
  border-radius: 5px;
  box-shadow: inset 0 0 0 1px var(--line), inset 0 -2px 0 var(--line);
}

/* Only show key hints to people with a keyboard */
@media (pointer: coarse) {
  kbd,
  .hint {
    display: none;
  }
}

.hint {
  padding: 0.4rem 0.7rem;
  font-size: 0.8rem;
  color: var(--ink-2);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  white-space: nowrap;
}

.hint kbd {
  min-width: 1.2rem;
  height: 1.2rem;
}

.label {
  font-size: 0.9rem;
  font-weight: 600;
  white-space: nowrap;
}

.icon {
  width: 2.1rem;
  height: 2.1rem;
  display: grid;
  place-items: center;
  font-size: 1.3rem;
  color: var(--on-c);
  background: var(--c);
  border-radius: 9px;
  box-shadow: inset 0 -4px 0 rgb(0 0 0 / 0.12), inset 0 4px 6px rgb(255 255 255 / 0.25);
}

/* The app logo already is a dark tile, so it fills the icon slot */
.icon .logo {
  font-size: 2.1rem;
}

.item[aria-current='page'] {
  border-color: var(--ink);
  box-shadow: 0 0 0 1px var(--ink), 0 6px 18px rgb(27 31 42 / 0.12);
}

.toggle {
  width: 3.5rem;
  height: 3.5rem;
  display: grid;
  place-items: center;
  color: #fff;
  background: var(--ink);
  border: 0;
  border-radius: 18px;
  box-shadow: 0 8px 22px rgb(27 31 42 / 0.3);
  cursor: pointer;
  transition: transform 0.2s, background-color 0.15s;
}

.toggle:hover { background: #2d3344; }
.toggle:active { transform: scale(0.94); }

.toggle:focus-visible,
.item:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--ink) 40%, transparent);
  outline-offset: 3px;
}

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

@media (prefers-reduced-motion: reduce) {
  .menu li,
  .bars,
  .bars::before,
  .bars::after {
    transition: none;
  }
}
</style>
