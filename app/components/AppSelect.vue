<script setup lang="ts" generic="T extends string | number">
// Dropdown in the app's own style, replacing the browser's <select>.
// Keyboard: arrows move, Enter or Space picks, Esc closes, typing a letter jumps to it.
export interface SelectOption<V> { value: V, label: string }

const props = defineProps<{ options: readonly Readonly<SelectOption<T>>[], ariaLabel?: string, placeholder?: string }>()
const model = defineModel<T>({ required: true })
defineOptions({ inheritAttrs: false })

const uid = useId()
const trigger = ref<HTMLButtonElement>()
const list = ref<HTMLUListElement>()
const { open, placement, show, hide } = useAnchoredPopover(trigger, list, { matchWidth: true })
const active = ref(0)
const { play } = useSound()

const selectedIndex = computed(() => props.options.findIndex(o => o.value === model.value))
const label = computed(() => props.options[selectedIndex.value]?.label ?? props.placeholder ?? '')

function openList() {
  active.value = Math.max(0, selectedIndex.value)
  show()
  play('open')
  nextTick(() => {
    list.value?.focus({ preventScroll: true })
    scrollActive()
  })
}

function close(refocus = true) {
  hide({ refocus })
}

function pick(i: number) {
  const option = props.options[i]
  if (!option) return
  if (option.value !== model.value) {
    model.value = option.value
    play('select')
  }
  close()
}

function scrollActive() {
  list.value?.querySelector<HTMLElement>(`[data-i="${active.value}"]`)?.scrollIntoView({ block: 'nearest' })
}

function move(to: number) {
  active.value = Math.min(props.options.length - 1, Math.max(0, to))
  nextTick(scrollActive)
}

function onTriggerKey(e: KeyboardEvent) {
  if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
    e.preventDefault()
    openList()
  }
}

let typed = ''
let typedTimer: ReturnType<typeof setTimeout> | undefined

function onListKey(e: KeyboardEvent) {
  const keys: Record<string, () => void> = {
    ArrowDown: () => move(active.value + 1),
    ArrowUp: () => move(active.value - 1),
    Home: () => move(0),
    End: () => move(props.options.length - 1),
    PageDown: () => move(active.value + 6),
    PageUp: () => move(active.value - 6),
    Enter: () => pick(active.value),
    ' ': () => pick(active.value),
    // Inside a popup, Esc closes only this list, not the popup too
    Escape: () => close()
  }
  const action = keys[e.key]
  if (action) {
    e.preventDefault()
    e.stopPropagation()
    action()
    return
  }
  if (e.key === 'Tab') {
    close(false)
    return
  }
  // Type-ahead: jump to the first option starting with what was typed
  if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
    clearTimeout(typedTimer)
    typed += e.key.toLowerCase()
    typedTimer = setTimeout(() => (typed = ''), 600)
    const i = props.options.findIndex(o => o.label.toLowerCase().startsWith(typed))
    if (i !== -1) move(i)
  }
}
</script>

<template>
  <div class="app-select" v-bind="$attrs">
    <button
      ref="trigger"
      type="button"
      class="input trigger"
      :class="{ open, empty: selectedIndex === -1 }"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="`${uid}-list`"
      :aria-label="ariaLabel ? `${ariaLabel}: ${label}` : undefined"
      @click="open ? close() : openList()"
      @keydown="onTriggerKey"
    >
      <span class="value">{{ label }}</span>
      <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5" /></svg>
    </button>

    <ul
      :id="`${uid}-list`"
      ref="list"
      popover="manual"
      class="menu"
      :class="[`from-${placement}`, { 'is-open': open }]"
      role="listbox"
      tabindex="-1"
      :aria-label="ariaLabel"
      :aria-activedescendant="`${uid}-opt-${active}`"
      @keydown="onListKey"
    >
      <li
        v-for="(o, i) in options"
        :id="`${uid}-opt-${i}`"
        :key="String(o.value)"
        :data-i="i"
        role="option"
        :aria-selected="i === selectedIndex"
        :class="{ active: i === active }"
        @pointermove="active = i"
        @click="pick(i)"
      >
        <span>{{ o.label }}</span>
        <svg v-if="i === selectedIndex" class="check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.app-select {
  position: relative;
  min-width: 0;
}

.trigger {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  text-align: left;
  cursor: pointer;
}

.trigger.open {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent);
}

.value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty .value {
  color: var(--ink-3);
}

.chevron {
  flex: none;
  width: 1.1rem;
  height: 1.1rem;
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: rotate 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.open .chevron {
  rotate: 180deg;
}

/* ---------- The list ---------- */
.menu {
  position: fixed;
  inset: auto;
  margin: 0;
  max-height: min(18rem, 60vh);
  overflow-y: auto;
  overscroll-behavior: contain;
  list-style: none;
  padding: 0.35rem;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: 0 18px 40px -12px rgb(var(--shadow) / 0.35), 0 2px 6px rgb(var(--shadow) / 0.08);
  outline: none;
}

.menu.is-open {
  animation: menu-in 0.16s cubic-bezier(0.2, 0, 0, 1);
}

.menu.from-above.is-open {
  animation-name: menu-in-above;
}

li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.55rem 0.7rem;
  font-size: 0.95rem;
  border-radius: 9px;
  white-space: nowrap;
  cursor: pointer;
}

li.active {
  background: var(--surface-2);
}

li[aria-selected='true'] {
  font-weight: 600;
  color: var(--ink);
}

.check {
  flex: none;
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: var(--accent);
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

@keyframes menu-in {
  from { opacity: 0; translate: 0 -4px; scale: 0.98; }
}

@keyframes menu-in-above {
  from { opacity: 0; translate: 0 4px; scale: 0.98; }
}

@media (prefers-reduced-motion: reduce) {
  .menu.is-open { animation: none; }
  .chevron { transition: none; }
}
</style>
