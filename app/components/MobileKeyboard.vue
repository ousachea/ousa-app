<script setup lang="ts">
// Each app's own keyboard on phones (app/utils/keyboards.ts has the keys). Number and phone fields get a
// keypad: the digits, plus the app's keys (amounts, steps, prefixes) in a row above them. Text fields get
// a full keyboard (letters, numbers and symbols) with the app's keys above it. Its 🌐 key hands a field to
// the phone's own keyboard, for Khmer, emoji or voice; the app's keys then sit in a bar on top of that,
// with a key to come back. Password fields always keep the phone's keyboard, so password managers work.
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
// Fields switched to the phone's keyboard with 🌐 stay on it while the page is open
const nativeFields = new WeakSet<Field>()
const native = ref(false)

const isPad = computed(() => kind.value === 'number' || kind.value === 'tel')
const isText = computed(() => !isPad.value && prefs.textKeyboard && !native.value)
/** The app's keyboard fills the bottom of the screen; otherwise it's a bar on the phone's keyboard */
const sheet = computed(() => isPad.value || isText.value)
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
  // While claimed, a field has inputmode=none (and number and email fields are type=text); what they
  // were is in `originals`
  const original = originals.get(el)
  const mode = original ? original.inputmode : el.getAttribute('inputmode')
  if (el instanceof HTMLTextAreaElement) return mode === 'tel' ? 'tel' : 'text'
  const type = original?.type ?? el.type
  if (type === 'number') return 'number'
  if (type === 'tel' || mode === 'tel') return 'tel'
  if (type === 'text' && (mode === 'decimal' || mode === 'numeric')) return 'number'
  if (type === 'url' || mode === 'url') return 'url'
  if (type === 'email' || mode === 'email') return 'email'
  if (type === 'search') return 'search'
  if (type === 'text') return 'text'
  return null
}

// The phone decides whether to show its keyboard as the field gets focus, so fields the app's keyboard
// types into are told not to want one on the touch that focuses them, before focus arrives
function claim(el: Field, k: FieldKind) {
  if (originals.has(el)) return
  const pad = k === 'number' || k === 'tel'
  if (!pad && (!prefs.textKeyboard || nativeFields.has(el))) return
  originals.set(el, { type: el.type, inputmode: el.getAttribute('inputmode') })
  el.setAttribute('inputmode', 'none')
  // Number and email fields don't say where the caret is (and a number field won't hold “12.” while the
  // next digit is on its way), so while the app's keyboard has them they're plain text fields
  if (el.type === 'number' || el.type === 'email') (el as HTMLInputElement).type = 'text'
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
  } else if (el instanceof HTMLInputElement && el.type !== type) {
    el.type = type
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
  native.value = nativeFields.has(el)
  layer.value = 'abc'
  shift.value = 'off'
  host.value = el.closest('dialog[open]') ?? document.body
  next.value = nextField(el)
  autoShift()
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
  if (sheet.value) requestAnimationFrame(() => field.value?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
}

function close() {
  try {
    root.value?.hidePopover()
  } catch {}
  field.value = null
  document.documentElement.classList.remove('keypad-open')
  document.documentElement.style.removeProperty('--keypad')
}

// The app's keyboard sits at the bottom of the screen and pushes the page (and popups) up out of its way;
// the bar follows the top of the phone's keyboard, which only the visual viewport knows about
function place() {
  const el = root.value
  if (!el || !field.value) return
  const docEl = document.documentElement
  if (sheet.value) {
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

// The field after this one, for the Next key: within its form if it has one (the form's last field sends
// it instead, like Enter does), else within its popup or the page
function nextField(el: Field): HTMLElement | null {
  const scope = el.form ?? el.closest('dialog[open]') ?? document
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
  // One decimal point in a number; text and links can have as many dots as they like
  if (kind.value === 'number' && text === '.' && el.value.slice(0, start).concat(el.value.slice(end)).includes('.')) return
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
  autoShift()
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

// ---------- The text keyboard ----------

type Layer = 'abc' | '123' | 'sym'
const ROWS: Record<Layer, string[]> = {
  abc: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'],
  123: ['1234567890', '-/:;()$&@"', '.,?!\''],
  sym: ['[]{}#%^*+=', '_\\|~<>€£¥•', '.,?!\'']
}
const layer = ref<Layer>('abc')
const shift = ref<'off' | 'once' | 'lock'>('off')
const pressed = ref<string | null>(null)
const rows = computed(() => ROWS[layer.value].map(row => [...row]))
const upper = computed(() => layer.value === 'abc' && shift.value !== 'off')
const show = (c: string) => (upper.value ? c.toUpperCase() : c)

// Capitals at the start of a sentence, in fields for writing (not links, emails or searches), unless the
// field says otherwise
function autoShift() {
  const el = field.value
  if (!el || !isText.value || shift.value === 'lock') return
  const writing = kind.value === 'text' && !/^(off|none)$/.test(el.getAttribute('autocapitalize') ?? '')
  shift.value = writing && /(^|[.!?]\s+|\n)$/.test(el.value.slice(0, caret(el)[0])) ? 'once' : 'off'
}

// Letters type as the finger lands, like the phone's own keyboard, and show a bubble above the key
function keyDown(c: string) {
  pressed.value = c
  // Lifting the finger anywhere clears the bubble, even if it slid off the key first
  window.addEventListener('pointerup', keyUp, { once: true })
  window.addEventListener('touchend', keyUp, { once: true })
  typeChar(c)
}
function keyUp() {
  pressed.value = null
}

function typeChar(c: string) {
  feedback()
  insert(show(c))
  if (shift.value === 'once') shift.value = 'off'
  // An apostrophe ends a symbol, like don’t or it’s, so the letters come back
  if (layer.value !== 'abc' && c === '\'') layer.value = 'abc'
  autoShift()
}

function space() {
  feedback()
  insert(' ')
  if (layer.value !== 'abc') layer.value = 'abc'
  autoShift()
}

// Tap for one capital; tap twice quickly for caps lock
let lastShift = 0
function toggleShift() {
  feedback()
  const now = performance.now()
  if (shift.value === 'once' && now - lastShift < 350) shift.value = 'lock'
  else shift.value = shift.value === 'off' ? 'once' : 'off'
  lastShift = now
}

function switchLayer(to: Layer) {
  feedback()
  layer.value = to
  if (to === 'abc') autoShift()
}

const returnLabel = computed(() => {
  if (field.value instanceof HTMLTextAreaElement) return 'return'
  if (next.value) return 'Next'
  if (field.value?.form || kind.value === 'search' || kind.value === 'url') return 'Go'
  return 'Done'
})

// Return tells the page first (searches and quick-add fields listen for Enter), then does what the
// phone's own key would: a new line, the next field, or send the form
function enter() {
  feedback()
  const el = field.value
  if (!el) return
  const ev = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true })
  el.dispatchEvent(ev)
  if (ev.defaultPrevented) return
  if (el instanceof HTMLTextAreaElement) {
    insert('\n')
    autoShift()
    return
  }
  if (next.value) return next.value.focus()
  const form = el.form
  done()
  form?.requestSubmit()
}

// 🌐: this field moves to the phone's keyboard (Khmer, emoji, voice). Focusing it again inside the tap is
// what lets the phone bring its keyboard up.
function usePhoneKeyboard() {
  const el = field.value
  if (!el) return
  feedback()
  nativeFields.add(el)
  native.value = true
  release(el)
  el.blur()
  el.focus()
  nextTick(place)
}

function useAppKeyboard() {
  const el = field.value
  if (!el) return
  feedback()
  nativeFields.delete(el)
  native.value = false
  claim(el, kind.value)
  el.blur()
  el.focus()
  autoShift()
  nextTick(open)
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
// Letters switched off in Settings with a text field focused: hand it back to the phone
watch(() => prefs.textKeyboard, (on) => {
  if (on || !field.value || isPad.value) return
  release(field.value)
  field.value.blur()
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
      :class="isPad ? 'pad' : isText ? 'pad text' : 'bar'"
      :style="{
        '--accent': tool?.buttonColor ?? tool?.color ?? 'var(--accent)',
        '--on-accent': tool?.onColor ?? '#fff',
        top: !sheet && barTop !== null ? `${barTop}px` : undefined
      }"
      role="group"
      :aria-label="`${tool?.name ?? 'App'} keyboard`"
      @pointerdown.prevent
    >
      <template v-if="field">
        <div class="keys-row">
          <span v-if="keySet.title && sheet" class="set-title">{{ keySet.title }}</span>
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
          <!-- On the phone's keyboard: a way back to the app's -->
          <button v-if="!sheet && prefs.textKeyboard" type="button" tabindex="-1" class="chip" aria-label="Use the app keyboard" @click="useAppKeyboard">
            <AppIcon name="keyboard" />
          </button>
          <button v-if="!sheet" type="button" tabindex="-1" class="chip done" @click="done">
            Done
          </button>
          <button v-if="isText" type="button" tabindex="-1" class="chip hide" aria-label="Hide keyboard" @click="done">
            <AppIcon name="chevron-down" />
          </button>
        </div>

        <div v-if="isText" class="text-grid" :class="`layer-${layer}`">
          <div v-for="(row, r) in rows" :key="`${layer}-${r}`" class="trow">
            <template v-if="r === 2">
              <button
                v-if="layer === 'abc'"
                type="button"
                tabindex="-1"
                class="key fn shift"
                :class="shift"
                :aria-label="shift === 'lock' ? 'Caps lock on' : 'Shift'"
                :aria-pressed="shift !== 'off'"
                @pointerdown="toggleShift"
                @click="$event.detail === 0 && toggleShift()"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l7.5 8H15v5H9v-5H4.5z" /><path v-if="shift === 'lock'" d="M8.5 20.5h7" /></svg>
              </button>
              <button v-else type="button" tabindex="-1" class="key fn small" @pointerdown="switchLayer(layer === '123' ? 'sym' : '123')" @click="$event.detail === 0 && switchLayer(layer === '123' ? 'sym' : '123')">
                {{ layer === '123' ? '#+=' : '123' }}
              </button>
            </template>
            <button
              v-for="c in row"
              :key="c"
              type="button"
              tabindex="-1"
              class="key letter"
              :class="{ pressed: pressed === c }"
              :data-k="show(c)"
              @pointerdown="keyDown(c)"
              @pointerup="keyUp"
              @pointerleave="keyUp"
              @pointercancel="keyUp"
              @click="$event.detail === 0 && typeChar(c)"
            >
              {{ show(c) }}
            </button>
            <button
              v-if="r === 2"
              type="button"
              tabindex="-1"
              class="key fn shift"
              aria-label="Delete"
              @pointerdown="holdBackspace"
              @pointerup="stopBackspace"
              @pointerleave="stopBackspace"
              @pointercancel="stopBackspace"
              @click="$event.detail === 0 && backspace()"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h11v14H9l-6-7z" /><path d="M12.5 9.5l5 5M17.5 9.5l-5 5" /></svg>
            </button>
          </div>
          <div class="trow bottom">
            <button type="button" tabindex="-1" class="key fn small" @pointerdown="switchLayer(layer === 'abc' ? '123' : 'abc')" @click="$event.detail === 0 && switchLayer(layer === 'abc' ? '123' : 'abc')">
              {{ layer === 'abc' ? '123' : 'ABC' }}
            </button>
            <button type="button" tabindex="-1" class="key fn" aria-label="Use your phone’s keyboard, for Khmer, emoji or voice" title="Phone keyboard: Khmer, emoji, voice" @click="usePhoneKeyboard">
              <AppIcon name="globe" />
            </button>
            <button v-if="kind === 'email'" type="button" tabindex="-1" class="key letter" :class="{ pressed: pressed === '@' }" data-k="@" @pointerdown="keyDown('@')" @pointerup="keyUp" @pointerleave="keyUp" @pointercancel="keyUp">@</button>
            <button v-if="kind === 'url'" type="button" tabindex="-1" class="key letter" :class="{ pressed: pressed === '/' }" data-k="/" @pointerdown="keyDown('/')" @pointerup="keyUp" @pointerleave="keyUp" @pointercancel="keyUp">/</button>
            <button type="button" tabindex="-1" class="key space" aria-label="Space" @pointerdown="space" @click="$event.detail === 0 && space()">space</button>
            <button v-if="kind === 'email' || kind === 'url'" type="button" tabindex="-1" class="key letter" :class="{ pressed: pressed === '.' }" data-k="." @pointerdown="keyDown('.')" @pointerup="keyUp" @pointerleave="keyUp" @pointercancel="keyUp">.</button>
            <button type="button" tabindex="-1" class="key done ret" @click="enter">
              <svg v-if="returnLabel === 'return'" viewBox="0 0 24 24" aria-label="Return"><path d="M19 6v5a3 3 0 0 1-3 3H6" /><path d="M9.5 10.5L6 14l3.5 3.5" /></svg>
              <template v-else>{{ returnLabel }}</template>
            </button>
          </div>
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
  padding-bottom: calc(max(0.5rem, env(safe-area-inset-bottom)) + 18px);
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

.chip svg {
  display: block;
  width: 1.15rem;
  height: 1.15rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.chip.hide {
  padding: 0 0.55rem;
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
  font-size: var(--text-xl);
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

/* ---------- Text keyboard ---------- */

.text-grid {
  display: grid;
  gap: 0.55rem;
  padding: 0.1rem 0.25rem 0.25rem;
}

.trow {
  display: flex;
  gap: 0.3rem;
  justify-content: center;
}

/* The middle letter row is a key shorter, so it sits half a key in, like a real keyboard */
.layer-abc .trow:nth-child(2) {
  padding-inline: 5%;
}

.text-grid .key {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  height: 2.9rem;
  padding: 0;
  border-radius: var(--radius-sm);
  font-size: var(--text-xl);
  font-weight: 450;
}

.text-grid .key.small {
  font-size: var(--text-base);
}

.text-grid .key.shift {
  flex: 1.45 1 0;
}

.layer-abc .trow:nth-child(3) .key.shift + .letter {
  margin-left: 0.35rem;
}

.layer-abc .trow:nth-child(3) .letter:last-of-type {
  margin-right: 0.35rem;
}

.text-grid .bottom .key.fn {
  flex: 1.25 1 0;
}

.text-grid .key.space {
  flex: 5 1 0;
  font-size: var(--text-base);
  color: var(--ink-2);
}

.text-grid .key.ret {
  flex: 2.2 1 0;
  font-size: var(--text-base);
}

.text-grid .key.ret svg {
  width: 1.35rem;
  height: 1.35rem;
}

/* Shift lights up while on, and fills in for caps lock */
.key.shift.once,
.key.shift.lock {
  color: var(--ink);
  background: var(--surface);
}

.key.shift.lock svg {
  fill: currentColor;
}

/* The letter under your finger, shown bigger above it */
.letter.pressed {
  background: color-mix(in srgb, var(--accent) 14%, var(--surface));
}

.letter.pressed::after {
  content: attr(data-k);
  position: absolute;
  left: 50%;
  bottom: calc(100% + 0.3rem);
  min-width: 2.7rem;
  height: 3.1rem;
  padding: 0 0.4rem;
  display: grid;
  place-items: center;
  transform: translateX(-50%);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: 0 6px 18px rgb(var(--shadow) / 0.22), 0 0 0 1px var(--line);
  color: var(--ink);
  font-size: var(--text-2xl);
  font-weight: 500;
  pointer-events: none;
  z-index: 1;
}
</style>
