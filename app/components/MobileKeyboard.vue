<script setup lang="ts">
// Each app's own keyboard on phones (app/utils/keyboards.ts has the keys). Number and phone fields get a
// keypad in place of the phone's keyboard: the digits, plus the app's keys (amounts, steps, prefixes) in a
// row above them. Text fields keep the phone's keyboard and get the app's keys in a bar on top of it.
// It shows in the top layer (a manual popover inside whichever popup holds the field), so it sits above
// Add forms and stays clickable while they make the page behind inert. Off in Settings, or per field
// with data-keys="off".
import type { FieldKind, KeyboardKey } from '~/utils/keyboards'

type Field = HTMLInputElement | HTMLTextAreaElement

const { prefs } = usePrefs()
const { play } = useSound()
const route = useRoute()

const field = shallowRef<Field | null>(null)
const kind = ref<FieldKind>('text')
const host = shallowRef<HTMLElement | null>(null)
const root = ref<HTMLElement>()
const barTop = ref<number | null>(null)
// Each claimed field's own attributes, put back when it loses focus
const originals = new WeakMap<Field, { type: string, inputmode: string | null }>()

const isPad = computed(() => kind.value === 'number' || kind.value === 'tel')
const tool = computed(() => pageFor(route.path))
const keySet = computed(() => keySetFor(route.path, kind.value, field.value?.dataset.keys))
const decimal = computed(() => {
  const el = field.value
  if (!el || kind.value !== 'number') return false
  const step = el.getAttribute('step')
  return originals.get(el)?.inputmode === 'decimal' || step === 'any' || (!!step && !Number.isInteger(Number(step)))
})
const negative = computed(() => kind.value === 'number' && Number(field.value?.getAttribute('min') ?? 0) < 0)
const next = shallowRef<HTMLElement | null>(null)

const phone = () => matchMedia('(hover: none) and (pointer: coarse)').matches

function kindOf(el: EventTarget | null): FieldKind | null {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return null
  if (el.readOnly || el.disabled || el.dataset.keys === 'off') return null
  const mode = el.getAttribute('inputmode')
  if (el instanceof HTMLTextAreaElement) return mode === 'tel' ? 'tel' : 'text'
  // While claimed, a number field is type=text; what it was is in `originals`
  const type = originals.get(el)?.type ?? el.type
  if (type === 'number') return 'number'
  if (type === 'tel' || mode === 'tel') return 'tel'
  if (type === 'text' && (mode === 'decimal' || mode === 'numeric')) return 'number'
  if (type === 'url' || mode === 'url') return 'url'
  if (type === 'email' || mode === 'email') return 'email'
  if (type === 'search') return 'search'
  if (type === 'text') return 'text'
  return null
}

// The phone decides whether to show its keyboard as the field gets focus, so the keypad's fields are told
// not to want one on the touch that focuses them, before focus arrives
function claim(el: Field, k: FieldKind) {
  if (originals.has(el)) return
  originals.set(el, { type: el.type, inputmode: el.getAttribute('inputmode') })
  if (k !== 'number' && k !== 'tel') return
  el.setAttribute('inputmode', 'none')
  // A number field won't hold “12.” while the next digit is on its way, or say where the caret is
  if (el.type === 'number') el.type = 'text'
}

function release(el: Field) {
  const original = originals.get(el)
  if (!original) return
  originals.delete(el)
  const { type, inputmode } = original
  if (type === 'number' && el instanceof HTMLInputElement) {
    // A number field empties itself if handed “12.” or “-”, so those are tidied first
    const tidy = el.value.replace(/[.-]+$/, '')
    const changed = tidy !== el.value
    if (changed) el.value = tidy
    el.type = 'number'
    if (changed) el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  if (inputmode === null) el.removeAttribute('inputmode')
  else el.setAttribute('inputmode', inputmode)
}

function onPointerDown(e: PointerEvent) {
  if (!prefs.phoneKeyboard || e.pointerType === 'mouse' || !phone()) return
  const k = kindOf(e.target)
  if (!k) return
  const el = e.target as Field
  // Already focused (autofocus, or focused before this loaded): no focusin is coming, so open here
  if (el === document.activeElement) return attach(el, k)
  claim(el, k)
  // A touch that scrolled the page instead of focusing the field leaves it as it was
  setTimeout(() => document.activeElement !== el && release(el), 800)
}

function onFocusIn(e: FocusEvent) {
  if (!prefs.phoneKeyboard || !phone()) return
  const k = kindOf(e.target)
  if (k) attach(e.target as Field, k)
}

function attach(el: Field, k: FieldKind) {
  if (field.value === el) return
  if (field.value && field.value !== el) release(field.value)
  claim(el, k)
  field.value = el
  kind.value = k
  host.value = el.closest('dialog[open]') ?? document.body
  next.value = nextField(el)
  nextTick(open)
}

function onFocusOut(e: FocusEvent) {
  const el = e.target
  if (el !== field.value) return
  // Moving straight to another field opens it there; give that focusin a moment
  setTimeout(() => {
    if (document.activeElement === el) return
    release(el as Field)
    if (field.value === el) close()
  })
}

function open() {
  const el = root.value
  if (!el) return
  try {
    if (!el.matches(':popover-open')) el.showPopover()
  } catch {}
  place()
  if (isPad.value) requestAnimationFrame(() => field.value?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
}

function close() {
  try {
    root.value?.hidePopover()
  } catch {}
  field.value = null
  document.documentElement.classList.remove('keypad-open')
  document.documentElement.style.removeProperty('--keypad')
}

// The keypad sits at the bottom of the screen and pushes the page (and popups) up out of its way; the
// bar follows the top of the phone's keyboard, which only the visual viewport knows about
function place() {
  const el = root.value
  if (!el || !field.value) return
  const docEl = document.documentElement
  if (isPad.value) {
    barTop.value = null
    docEl.classList.add('keypad-open')
    docEl.style.setProperty('--keypad', `${el.offsetHeight}px`)
    return
  }
  docEl.classList.remove('keypad-open')
  docEl.style.removeProperty('--keypad')
  const vv = window.visualViewport
  barTop.value = vv ? vv.offsetTop + vv.height - el.offsetHeight : null
}

// The fields after this one, in page order, for the Next key
function nextField(el: Field): HTMLElement | null {
  const scope = el.closest('dialog[open]') ?? document
  const all = [...scope.querySelectorAll<HTMLElement>('input:not([type=hidden],[type=checkbox],[type=radio],[type=file],[type=range],[type=button],[type=submit],[type=color]), textarea, select')]
    .filter(f => !(f as HTMLInputElement).disabled && !(f as HTMLInputElement).readOnly && f.getClientRects().length > 0 && f.tabIndex >= 0)
  return all[all.indexOf(el) + 1] ?? null
}

// ---------- Typing ----------

function emit(el: Field, data: string | null, inputType: string) {
  el.dispatchEvent(new InputEvent('input', { bubbles: true, data, inputType }))
}

function caret(el: Field): [number, number] {
  try {
    if (el.selectionStart !== null && el.selectionEnd !== null) return [el.selectionStart, el.selectionEnd]
  } catch {}
  // Email fields don't share where the caret is; type at the end
  return [el.value.length, el.value.length]
}

function insert(text: string) {
  const el = field.value
  if (!el) return
  const [start, end] = caret(el)
  if (text === '.' && el.value.slice(0, start).concat(el.value.slice(end)).includes('.')) return
  try {
    el.setRangeText(text, start, end, 'end')
  } catch {
    el.value = el.value.slice(0, start) + text + el.value.slice(end)
  }
  emit(el, text, 'insertText')
}

function setValue(value: string) {
  const el = field.value
  if (!el) return
  el.value = value
  try {
    el.setSelectionRange(value.length, value.length)
  } catch {}
  emit(el, value, 'insertReplacementText')
}

function backspace() {
  const el = field.value
  if (!el) return
  const [start, end] = caret(el)
  if (start === end && start === 0) return
  const from = start === end ? start - 1 : start
  try {
    el.setRangeText('', from, end, 'end')
  } catch {
    el.value = el.value.slice(0, from) + el.value.slice(end)
  }
  emit(el, null, 'deleteContentBackward')
}

function feedback() {
  play('press')
  navigator.vibrate?.(6)
}

async function press(key: KeyboardKey) {
  feedback()
  const el = field.value
  if (!el) return
  if (key.action === 'paste') {
    try {
      const text = await navigator.clipboard.readText()
      if (text) insert(kind.value === 'number' ? text.replace(/[^\d.-]/g, '') : text.trim())
    } catch {}
    return
  }
  if (key.set !== undefined) return setValue(key.set)
  if (key.apply) return setValue(key.apply(el.value))
  const text = keyText(key)
  if (text) insert(text)
}

function digit(d: string) {
  feedback()
  insert(d)
}

function toggleSign() {
  feedback()
  const v = field.value?.value ?? ''
  setValue(v.startsWith('-') ? v.slice(1) : `-${v}`)
}

// Holding backspace keeps deleting, like the phone's own
let repeat: ReturnType<typeof setTimeout> | undefined
function holdBackspace() {
  feedback()
  backspace()
  repeat = setTimeout(function again() {
    backspace()
    repeat = setTimeout(again, 70)
  }, 420)
}
function stopBackspace() {
  clearTimeout(repeat)
}

function goNext() {
  feedback()
  const el = field.value
  if (next.value) return next.value.focus()
  // The last field: send its form, like the phone keyboard's Go key
  const form = el?.form
  done()
  form?.requestSubmit()
}

function done() {
  field.value?.blur()
}

// ---------- Lifecycle ----------

let ro: ResizeObserver | undefined
onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('focusin', onFocusIn)
  document.addEventListener('focusout', onFocusOut)
  window.visualViewport?.addEventListener('resize', place)
  window.visualViewport?.addEventListener('scroll', place)
  ro = new ResizeObserver(place)
  if (root.value) ro.observe(root.value)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown, true)
  document.removeEventListener('focusin', onFocusIn)
  document.removeEventListener('focusout', onFocusOut)
  window.visualViewport?.removeEventListener('resize', place)
  window.visualViewport?.removeEventListener('scroll', place)
  ro?.disconnect()
  if (field.value) release(field.value)
  close()
})

// Moving into or out of a popup takes the keyboard out of the top layer; put it back
watch(host, () => nextTick(() => field.value && open()), { flush: 'post' })
// Switched off in Settings with a field still focused
watch(() => prefs.phoneKeyboard, (on) => {
  if (on || !field.value) return
  release(field.value)
  close()
})
// Leaving the page
watch(() => route.path, () => field.value && close())
</script>

<template>
  <Teleport :to="host ?? 'body'" :disabled="!host">
    <div
      ref="root"
      popover="manual"
      class="app-keyboard"
      :class="isPad ? 'pad' : 'bar'"
      :style="{
        '--accent': tool?.buttonColor ?? tool?.color ?? 'var(--accent)',
        '--on-accent': tool?.onColor ?? '#fff',
        top: !isPad && barTop !== null ? `${barTop}px` : undefined
      }"
      role="group"
      :aria-label="`${tool?.name ?? 'App'} keyboard`"
      @pointerdown.prevent
    >
      <template v-if="field">
        <div class="keys-row">
          <span v-if="keySet.title && isPad" class="set-title">{{ keySet.title }}</span>
          <div class="chips">
            <button
              v-for="key in keySet.keys"
              :key="key.label"
              type="button"
              tabindex="-1"
              class="chip"
              :aria-label="key.aria"
              @click="press(key)"
            >
              {{ key.label }}
            </button>
          </div>
          <button v-if="!isPad" type="button" tabindex="-1" class="chip done" @click="done">
            Done
          </button>
        </div>

        <div v-if="isPad" class="pad-grid">
          <button v-for="d in ['1', '2', '3']" :key="d" type="button" tabindex="-1" class="key" @click="digit(d)">{{ d }}</button>
          <button
            type="button"
            tabindex="-1"
            class="key fn"
            aria-label="Delete"
            @pointerdown="holdBackspace"
            @pointerup="stopBackspace"
            @pointerleave="stopBackspace"
            @pointercancel="stopBackspace"
            @click="$event.detail === 0 && backspace()"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h11v14H9l-6-7z" /><path d="M12.5 9.5l5 5M17.5 9.5l-5 5" /></svg>
          </button>

          <button v-for="d in ['4', '5', '6']" :key="d" type="button" tabindex="-1" class="key" @click="digit(d)">{{ d }}</button>
          <button type="button" tabindex="-1" class="key fn small" @click="feedback(); setValue('')">Clear</button>

          <button v-for="d in ['7', '8', '9']" :key="d" type="button" tabindex="-1" class="key" @click="digit(d)">{{ d }}</button>
          <button type="button" tabindex="-1" class="key fn small" :disabled="!next && !field.form" @click="goNext">
            {{ next ? 'Next' : 'Go' }}
          </button>

          <template v-if="kind === 'tel'">
            <button type="button" tabindex="-1" class="key" @click="digit('+')">+</button>
            <button type="button" tabindex="-1" class="key" @click="digit('0')">0</button>
            <button type="button" tabindex="-1" class="key fn small" aria-label="Space" @click="digit(' ')">space</button>
          </template>
          <template v-else>
            <button type="button" tabindex="-1" class="key" :disabled="!decimal" aria-label="Decimal point" @click="digit('.')">.</button>
            <button type="button" tabindex="-1" class="key" @click="digit('0')">0</button>
            <button v-if="negative" type="button" tabindex="-1" class="key" aria-label="Plus or minus" @click="toggleSign">±</button>
            <button v-else type="button" tabindex="-1" class="key" aria-label="Two zeros" @click="digit('00')">00</button>
          </template>
          <button type="button" tabindex="-1" class="key done" @click="done">
            Done
          </button>
        </div>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.app-keyboard {
  /* The popover's own centring and frame are undone: it's a strip along the bottom of the screen */
  position: fixed;
  inset: auto 0 0 0;
  width: 100%;
  max-width: none;
  height: auto;
  margin: 0;
  padding: 0;
  overflow: visible;
  border: 0;
  border-top: 1px solid var(--line);
  color: var(--ink);
  background: color-mix(in srgb, var(--surface-2) 92%, transparent);
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  box-shadow: 0 -8px 24px rgb(var(--shadow) / 0.08);
  font-family: var(--font);
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
}

.app-keyboard:not(:popover-open) {
  display: none;
}

.app-keyboard.pad {
  padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
  animation: rise 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* Pinned to the top of the phone's keyboard by `top`, set from the visual viewport */
.app-keyboard.bar {
  bottom: auto;
}

@keyframes rise {
  from {
    transform: translateY(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-keyboard.pad {
    animation: none;
  }
}

.keys-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.5rem;
}

.set-title {
  flex: none;
  padding-left: 0.35rem;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-2);
}

.chips {
  display: flex;
  flex: 1;
  gap: 0.4rem;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
  /* Fades the last chip out, so it's clear there are more to the side */
  mask-image: linear-gradient(to right, #000 calc(100% - 1.5rem), transparent);
}

.chips::-webkit-scrollbar {
  display: none;
}

.chip {
  flex: none;
  min-height: 2.25rem;
  padding: 0 0.8rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  color: var(--ink);
  background: var(--surface);
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.chip:active,
.key:active {
  transform: scale(0.96);
  background: color-mix(in srgb, var(--accent) 14%, var(--surface));
}

.chip.done {
  border-color: transparent;
  color: var(--on-accent);
  background: var(--accent);
}

.pad-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr) 1.15fr;
  gap: 0.4rem;
  padding: 0 0.5rem 0.25rem;
}

.key {
  display: grid;
  place-items: center;
  height: 3.1rem;
  border: 0;
  border-radius: var(--radius);
  color: var(--ink);
  background: var(--surface);
  box-shadow: 0 1px 0 rgb(var(--shadow) / 0.12);
  font: inherit;
  font-size: 1.45rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  transition: transform 80ms ease, background-color 80ms ease;
}

.key:disabled {
  opacity: 0.35;
}

.key.fn {
  background: color-mix(in srgb, var(--ink) 7%, var(--surface-2));
}

.key.small {
  font-size: var(--text-sm);
  font-weight: 600;
}

.key svg {
  width: 1.5rem;
  height: 1.5rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.key.done {
  color: var(--on-accent);
  background: var(--accent);
  font-size: var(--text-sm);
  font-weight: 700;
}
</style>
