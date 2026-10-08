<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { Tool, ToolIconName } from '~/utils/tools'
import type { AddOption, PaletteMode } from '~/composables/usePalette'

// ⌘K / Ctrl+K: search everything, jump to any app, run a command, or add something (CHECKLIST.md #06–#08).
// Arrow keys move, Enter opens, Esc closes. Everything it searches lives on this device.
const { palette, closePalette, setMode } = usePalette()
const router = useRouter()
const route = useRoute()
const { play } = useSound()
const { theme, toggle: toggleTheme } = useTheme()
const sound = useSound()
const { prefs } = usePrefs()
const { log } = useActivity()

const dialog = ref<HTMLDialogElement>()
const input = ref<HTMLInputElement>()
const listEl = ref<HTMLElement>()
const query = ref('')
const active = ref(0)

interface Entry {
  id: string
  title: string
  subtitle?: string
  icon: ToolIconName
  color: string
  onColor?: string
  hint?: string
  run: () => void
}

interface Section { title: string, entries: Entry[] }

const iconOf = (t: Tool | undefined): Pick<Entry, 'icon' | 'color' | 'onColor'> =>
  t ? { icon: t.icon, color: t.color, onColor: t.onColor } : { icon: 'list', color: 'var(--plastic)' }

const appPath = (to: string) => to.split('?')[0]!

function go(to: string) {
  closePalette()
  router.push(to)
}

function addTo(opt: AddOption) {
  closePalette()
  const url = new URL(opt.app, 'http://x')
  url.searchParams.set('add', '1')
  router.push(url.pathname + url.search)
}

// ---------- Entries ----------
const addEntries = computed<Entry[]>(() => ADD_OPTIONS.map(o => ({
  id: `add:${o.label}`,
  title: palette.mode === 'add' ? o.label : `Add ${o.label.toLowerCase()}`,
  subtitle: o.hint,
  ...iconOf(pageFor(appPath(o.app))),
  run: () => addTo(o)
})))

const HOME: Tool = { to: '/', name: 'Home', summary: 'Your dashboard', color: 'var(--plastic)', icon: 'list' }
const appEntries = computed<Entry[]>(() => {
  const pinned = prefs.pinnedApps.map(p => TOOLS.find(t => t.to === p)).filter(Boolean) as Tool[]
  const rest = TOOLS.filter(t => !prefs.pinnedApps.includes(t.to))
  return [HOME, ...pinned, ...rest, TRASH, SETTINGS].map(t => ({
    id: `go:${t.to}`,
    title: t.name,
    subtitle: t.summary,
    ...iconOf(t),
    hint: prefs.pinnedApps.includes(t.to) ? 'Pinned' : undefined,
    run: () => go(t.to)
  }))
})

const current = computed(() => toolFor(route.path))
const commandEntries = computed<Entry[]>(() => {
  const list: Entry[] = [
    { id: 'cmd:add', title: 'Add something…', subtitle: 'Bookmark, device, renewal, countdown…', icon: 'plus', color: 'var(--green)', run: () => switchTo('add') },
    { id: 'cmd:trash', title: 'Open Recycle Bin', subtitle: 'Restore something you deleted', ...iconOf(TRASH), run: () => go('/trash') },
    { id: 'cmd:activity', title: 'Recent activity', subtitle: 'What you added, changed and deleted', icon: 'activity', color: 'var(--slate)', run: () => go('/#activity') },
    { id: 'cmd:settings', title: 'Open Settings', subtitle: 'Theme, density, shortcuts, backup', ...iconOf(SETTINGS), run: () => go('/settings') },
    { id: 'cmd:export', title: 'Export data', subtitle: 'Download a backup of everything', icon: 'list', color: 'var(--teal)', run: () => go('/settings?section=data') },
    { id: 'cmd:import', title: 'Import backup', subtitle: 'Restore from a backup file', icon: 'list', color: 'var(--teal)', run: () => go('/settings?section=data') },
    {
      id: 'cmd:theme',
      title: theme.resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
      icon: 'sound',
      color: 'var(--plastic)',
      hint: 'D',
      run: () => {
        toggleTheme()
        play('toggle-on')
        closePalette()
      }
    },
    {
      id: 'cmd:sound',
      title: sound.state.enabled ? 'Turn sound effects off' : 'Turn sound effects on',
      icon: 'sound',
      color: 'var(--plastic)',
      run: () => {
        sound.setEnabled(!sound.state.enabled)
        if (sound.state.enabled) play('toggle-on')
        toast(sound.state.enabled ? 'Sound effects on' : 'Sound effects off')
        closePalette()
      }
    }
  ]
  const app = current.value
  if (app && TOOLS.includes(app)) {
    const pinned = prefs.pinnedApps.includes(app.to)
    list.push({
      id: 'cmd:pin',
      title: pinned ? `Unpin ${app.name}` : `Pin ${app.name}`,
      subtitle: pinned ? 'Take it off the top of the menu and home page' : 'Keep it at the top of the menu and home page',
      ...iconOf(app),
      run: () => {
        togglePinnedApp(app.to)
        closePalette()
      }
    })
  }
  return list
})

// Recent activity, newest first, one line per thing
const recentEntries = computed<Entry[]>(() => {
  const seen = new Set<string>()
  const out: Entry[] = []
  for (const a of log.value) {
    const k = `${a.app}:${a.label}`
    if (seen.has(k) || a.kind === 'deleted') continue
    seen.add(k)
    const tool = pageFor(a.app)
    out.push({ id: `recent:${a.id}`, title: a.label, subtitle: `${ACTIVITY_VERB[a.kind]} in ${tool?.name ?? a.app}`, ...iconOf(tool), run: () => go(a.app) })
    if (out.length >= 4) break
  }
  return out
})

const sections = computed<Section[]>(() => {
  const q = query.value.trim()
  if (palette.mode === 'add') {
    const entries = q ? addEntries.value.filter(e => matchScore(q, e.title, e.subtitle)) : addEntries.value
    return entries.length ? [{ title: 'What do you want to add?', entries }] : []
  }

  if (!q) {
    return [
      { title: 'Quick add', entries: addEntries.value.slice(0, 4) },
      { title: 'Recent', entries: recentEntries.value },
      { title: 'Apps', entries: appEntries.value },
      { title: 'Commands', entries: commandEntries.value }
    ].filter(s => s.entries.length)
  }

  const out: Section[] = []
  for (const g of searchEverything(q)) {
    out.push({
      title: g.group,
      entries: g.hits.map(h => ({ id: h.key, title: h.title, subtitle: h.subtitle, ...iconOf(pageFor(h.app)), run: () => go(h.to) }))
    })
  }
  const rank = (list: Entry[]) => list
    .map(e => ({ e, s: matchScore(q, e.title, e.subtitle) }))
    .filter(x => x.s)
    .sort((a, b) => b.s - a.s)
    .map(x => x.e)
  const apps = rank(appEntries.value)
  const commands = rank([...commandEntries.value, ...addEntries.value])
  if (apps.length) out.push({ title: 'Apps', entries: apps.slice(0, 5) })
  if (commands.length) out.push({ title: 'Commands', entries: commands.slice(0, 6) })
  return out
})

const flat = computed(() => sections.value.flatMap(s => s.entries))
const activeEntry = computed(() => flat.value[active.value])
watch([query, () => palette.mode], () => (active.value = 0))

function switchTo(mode: PaletteMode) {
  setMode(mode)
  query.value = ''
  nextTick(() => input.value?.focus())
}

function run(entry: Entry | undefined) {
  if (!entry) return
  play('select')
  entry.run()
}

function move(delta: number) {
  const n = flat.value.length
  if (!n) return
  active.value = (active.value + delta + n) % n
  nextTick(() => listEl.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }))
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') move(1)
  else if (e.key === 'ArrowUp') move(-1)
  else if (e.key === 'PageDown') move(5)
  else if (e.key === 'PageUp') move(-5)
  else if (e.key === 'Enter') run(activeEntry.value)
  // A search box would only clear itself on Esc; one press closes the palette
  else if (e.key === 'Escape') closePalette()
  // Backspace on an empty box steps back from Quick Add to search
  else if (e.key === 'Backspace' && !query.value && palette.mode === 'add') switchTo('search')
  else return
  e.preventDefault()
}

// ---------- Open and close ----------
watch(() => palette.open, (open) => {
  const el = dialog.value
  if (!el) return
  if (open && !el.open) {
    query.value = ''
    active.value = 0
    el.showModal()
    play('open')
    nextTick(() => input.value?.focus())
  } else if (!open && el.open) {
    el.close()
  }
})

function onClose() {
  if (palette.open) closePalette()
}

function onBackdrop(e: MouseEvent) {
  if (e.target === dialog.value) closePalette()
}

const placeholder = computed(() => palette.mode === 'add' ? 'What do you want to add?' : 'Search everything or type a command…')
const isMac = ref(false)
onMounted(() => (isMac.value = /Mac|iPhone|iPad/.test(navigator.platform)))
</script>

<template>
  <dialog ref="dialog" class="palette" aria-label="Search and commands" @close="onClose" @click="onBackdrop">
    <div class="box">
      <div class="bar">
        <span class="lead" aria-hidden="true">
          <ToolIcon :name="palette.mode === 'add' ? 'plus' : 'search'" />
        </span>
        <button v-if="palette.mode === 'add'" type="button" class="mode" title="Back to search (Backspace)" @click="switchTo('search')">
          Add <span aria-hidden="true">×</span><span class="sr-only">, back to search</span>
        </button>
        <input
          ref="input"
          v-model="query"
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="palette-list"
          :aria-expanded="true"
          :aria-activedescendant="activeEntry ? `pal-${activeEntry.id}` : undefined"
          :placeholder="placeholder"
          autocomplete="off"
          spellcheck="false"
          enterkeyhint="go"
          @keydown="onKey"
        >
        <kbd class="esc">esc</kbd>
      </div>

      <div id="palette-list" ref="listEl" class="list" role="listbox" :aria-label="placeholder">
        <section v-for="s in sections" :key="s.title" role="group" :aria-label="s.title">
          <h3>{{ s.title }}</h3>
          <div
            v-for="entry in s.entries"
            :id="`pal-${entry.id}`"
            :key="entry.id"
            role="option"
            class="option"
            :aria-selected="activeEntry?.id === entry.id"
            @pointermove="active = flat.indexOf(entry)"
            @click="run(entry)"
          >
            <span class="icon" aria-hidden="true" :style="{ '--c': entry.color, '--on-c': entry.onColor ?? '#fff' }"><ToolIcon :name="entry.icon" /></span>
            <span class="text">
              <span class="title">{{ entry.title }}</span>
              <span v-if="entry.subtitle" class="sub">{{ entry.subtitle }}</span>
            </span>
            <span v-if="entry.hint" class="hint">{{ entry.hint }}</span>
            <span class="enter" aria-hidden="true">↵</span>
          </div>
        </section>
        <div v-if="!sections.length" class="none">
          <strong>Nothing found for “{{ query }}”</strong>
          <span>Try a different word, or <button type="button" class="link" @click="switchTo('add')">add something new</button>.</span>
        </div>
      </div>

      <footer class="foot" aria-hidden="true">
        <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
        <span><kbd>↵</kbd> open</span>
        <span v-if="palette.mode === 'search'"><kbd>A</kbd> on any page adds</span>
        <span class="right"><kbd>{{ isMac ? '⌘' : 'Ctrl' }}</kbd><kbd>K</kbd> anywhere</span>
      </footer>
    </div>
  </dialog>
</template>

<style scoped>
.palette {
  width: min(640px, calc(100vw - 1.5rem));
  max-height: min(560px, calc(100dvh - 6rem));
  margin: max(1rem, 12dvh) auto auto;
  padding: 0;
  color: var(--ink);
  background: var(--surface);
  border: 0;
  border-radius: 20px;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.palette[open] {
  display: flex;
  animation: palette-in var(--dur) var(--ease-out);
}

.palette::backdrop {
  background: rgb(var(--shadow) / 0.4);
  backdrop-filter: blur(3px);
}

.palette[open]::backdrop {
  animation: fade var(--dur) ease-out;
}

.box {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.bar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.9rem;
  border-bottom: 1px solid var(--line);
}

.lead {
  display: grid;
  font-size: 1.2rem;
  color: var(--ink-3);
}

.mode {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.6rem;
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 700;
  color: #fff;
  background: var(--green);
  border: 0;
  border-radius: var(--radius-pill);
  cursor: pointer;
}

input {
  flex: 1;
  min-width: 0;
  min-height: 2.75rem;
  padding: 0;
  font: inherit;
  font-size: 1.1rem;
  color: var(--ink);
  background: none;
  border: 0;
  outline: none;
}

input::-webkit-search-cancel-button {
  display: none;
}

.list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0.35rem 0.5rem 0.6rem;
}

h3 {
  margin: 0.6rem 0.6rem 0.3rem;
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 3rem;
  padding: 0.4rem 0.6rem;
  border-radius: var(--radius);
  cursor: pointer;
}

.option[aria-selected='true'] {
  background: var(--surface-2);
  box-shadow: inset 0 0 0 1px var(--line);
}

.icon {
  flex: none;
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  font-size: 1.05rem;
  color: var(--on-c);
  background: var(--c);
  border-radius: 9px;
  box-shadow: 0 0 0 2px var(--plastic), 0 0 0 3px var(--plastic-edge);
}

.text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.title {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub {
  font-size: var(--text-sm);
  color: var(--ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hint {
  flex: none;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--ink-3);
}

.enter {
  flex: none;
  width: 1.5rem;
  text-align: center;
  color: var(--ink-3);
  opacity: 0;
}

.option[aria-selected='true'] .enter {
  opacity: 1;
}

.none {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 2rem 1rem;
  text-align: center;
  color: var(--ink-2);
}

.none strong {
  color: var(--ink);
}

.foot {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1rem;
  padding: 0.55rem 0.9rem;
  font-size: var(--text-xs);
  color: var(--ink-3);
  border-top: 1px solid var(--line);
  background: var(--surface-2);
}

.foot kbd {
  margin-right: 0.2rem;
}

.foot .right {
  margin-left: auto;
}

/* Touch screens have no arrow keys or Esc: drop the key hints */
@media (pointer: coarse) {
  .foot,
  .esc {
    display: none;
  }

  .palette {
    margin-top: max(0.75rem, env(safe-area-inset-top));
    max-height: calc(100dvh - 1.5rem);
  }
}

@keyframes palette-in {
  from {
    opacity: 0;
    translate: 0 -8px;
    scale: 0.985;
  }
}

@keyframes fade {
  from { opacity: 0; }
}
</style>
