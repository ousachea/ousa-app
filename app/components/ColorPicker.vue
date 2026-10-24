<script setup lang="ts">
// Colour picker in the app's own style, replacing <input type="color">. Works with #rrggbb strings.
// Drag in the square for saturation and brightness and along the strip for hue, or type a HEX.
// Keyboard: arrows nudge the focused slider by 1 (Shift by 10), Esc closes.
const props = defineProps<{ ariaLabel?: string }>()
const model = defineModel<string>({ default: '#000000' })

const uid = useId()
const trigger = ref<HTMLButtonElement>()
const panel = ref<HTMLDivElement>()
const { open, placement, show, hide } = useAnchoredPopover(trigger, panel)
const { play } = useSound()

// Kept as HSV while picking so the hue survives dragging to grey or black, where RGB loses it
const hsv = reactive({ h: 0, s: 0, v: 0 })
const current = computed(() => toHex(hsvToRgb(hsv.h, hsv.s, hsv.v)))
function syncFromModel() {
  const c = parseColor(model.value)
  if (c && toHex(c) !== current.value) Object.assign(hsv, toHsv(c))
}
watch(model, syncFromModel, { immediate: true })
const set = (patch: Partial<typeof hsv>) => {
  Object.assign(hsv, patch)
  model.value = current.value
}

const typed = ref('')
watch(current, v => (typed.value = v), { immediate: true })
function commitTyped() {
  const c = parseColor(typed.value)
  if (c) set(toHsv(c))
  else typed.value = current.value
}

const clamp = (n: number, max: number) => Math.min(max, Math.max(0, n))

// Dragging: the pointer's spot in the square or strip, captured so it keeps tracking outside it
function drag(e: PointerEvent, apply: (x: number, y: number) => void) {
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)
  el.focus({ preventScroll: true })
  const move = (ev: PointerEvent) => {
    const r = el.getBoundingClientRect()
    apply(clamp((ev.clientX - r.left) / r.width, 1), clamp((ev.clientY - r.top) / r.height, 1))
  }
  move(e)
  el.onpointermove = move
  el.onpointerup = el.onpointercancel = () => (el.onpointermove = el.onpointerup = el.onpointercancel = null)
}
const dragSv = (e: PointerEvent) => drag(e, (x, y) => set({ s: x * 100, v: (1 - y) * 100 }))
const dragHue = (e: PointerEvent) => drag(e, x => set({ h: x * 359.99 }))

function keySv(e: KeyboardEvent) {
  const d = e.shiftKey ? 10 : 1
  const moves: Record<string, Partial<typeof hsv>> = {
    ArrowLeft: { s: clamp(hsv.s - d, 100) },
    ArrowRight: { s: clamp(hsv.s + d, 100) },
    ArrowUp: { v: clamp(hsv.v + d, 100) },
    ArrowDown: { v: clamp(hsv.v - d, 100) }
  }
  if (!moves[e.key]) return
  e.preventDefault()
  set(moves[e.key]!)
}
function keyHue(e: KeyboardEvent) {
  const d = (e.shiftKey ? 10 : 1) * (e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : 0)
  if (!d) return
  e.preventDefault()
  set({ h: clamp(hsv.h + d, 359.99) })
}

// Chrome and Edge can pick a colour from anywhere on screen
const canEyedrop = ref(false)
onMounted(() => (canEyedrop.value = 'EyeDropper' in window))
async function eyedrop() {
  try {
    const { sRGBHex } = await new (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper().open()
    const c = parseColor(sRGBHex)
    if (c) set(toHsv(c))
    play('success')
  } catch {} // Esc closes the screen picker without a colour
}

function openPicker() {
  syncFromModel()
  show()
  play('open')
  nextTick(() => panel.value?.querySelector<HTMLElement>('.sv')?.focus({ preventScroll: true }))
}
function close() {
  hide({ refocus: true })
}
function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  // Inside a popup, Esc closes only the picker
  e.preventDefault()
  e.stopPropagation()
  close()
}
</script>

<template>
  <div class="color-picker">
    <button
      ref="trigger"
      type="button"
      class="trigger"
      :class="{ open }"
      :style="{ '--swatch': model }"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-controls="`${uid}-panel`"
      :aria-label="`${props.ariaLabel ?? 'Colour'}: ${model}`"
      @click="open ? close() : openPicker()"
    />

    <div
      :id="`${uid}-panel`"
      ref="panel"
      popover="manual"
      class="picker"
      :class="[`from-${placement}`, { 'is-open': open }]"
      role="dialog"
      :aria-label="props.ariaLabel ?? 'Choose a colour'"
      @keydown="onKey"
    >
      <div
        class="sv"
        :style="{ '--hue': `hsl(${hsv.h} 100% 50%)` }"
        role="slider"
        tabindex="0"
        aria-label="Saturation and brightness"
        :aria-valuenow="Math.round(hsv.s)"
        :aria-valuetext="`Saturation ${Math.round(hsv.s)}%, brightness ${Math.round(hsv.v)}%`"
        @pointerdown="dragSv"
        @keydown="keySv"
      >
        <span class="thumb" :style="{ left: `${hsv.s}%`, top: `${100 - hsv.v}%`, background: current }" />
      </div>
      <div
        class="hue"
        role="slider"
        tabindex="0"
        aria-label="Hue"
        aria-valuemin="0"
        aria-valuemax="360"
        :aria-valuenow="Math.round(hsv.h)"
        @pointerdown="dragHue"
        @keydown="keyHue"
      >
        <span class="thumb" :style="{ left: `${(hsv.h / 360) * 100}%`, background: `hsl(${hsv.h} 100% 50%)` }" />
      </div>
      <div class="row">
        <span class="preview" :style="{ background: current }" aria-hidden="true" />
        <input v-model="typed" class="input hex" spellcheck="false" autocomplete="off" aria-label="HEX" @keydown.enter.prevent="commitTyped" @blur="commitTyped">
        <button v-if="canEyedrop" type="button" class="icon-btn drop" aria-label="Pick a colour from the screen" @click="eyedrop">
          <AppIcon name="pipette" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.color-picker {
  flex: none;
}

.trigger {
  display: block;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  cursor: pointer;
  transition: border-color var(--dur-fast), box-shadow var(--dur-fast);
}

/* The colour sits inset in the well, so white and near-white still show an edge */
.trigger::after {
  content: '';
  display: block;
  height: 100%;
  margin: 0;
  border: 4px solid var(--surface);
  border-radius: var(--radius);
  background: var(--swatch);
  box-shadow: inset 0 0 0 1px rgb(var(--shadow) / 0.12);
  background-clip: padding-box;
}

.trigger:hover {
  border-color: var(--ink-3);
}

.trigger.open {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent);
}

.picker {
  position: fixed;
  inset: auto;
  margin: 0;
  width: 16.5rem;
  padding: 0.75rem;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-xl);
  box-shadow: 0 22px 48px -14px rgb(var(--shadow) / 0.38), 0 2px 6px rgb(var(--shadow) / 0.08);
}

.picker.is-open {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  animation: pick-in 0.18s cubic-bezier(0.2, 0, 0, 1);
}

.picker.from-above.is-open {
  animation-name: pick-in-above;
}

.sv,
.hue {
  position: relative;
  touch-action: none;
  cursor: crosshair;
}

.sv {
  aspect-ratio: 4 / 3;
  border-radius: var(--radius);
  background:
    linear-gradient(to top, #000, transparent),
    linear-gradient(to right, #fff, var(--hue));
}

.hue {
  height: 0.9rem;
  border-radius: 999px;
  background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
  cursor: ew-resize;
}

.sv:focus-visible,
.hue:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.thumb {
  position: absolute;
  width: 1.1rem;
  height: 1.1rem;
  border: 3px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 0.25), 0 2px 6px rgb(0 0 0 / 0.3);
  translate: -50% -50%;
  pointer-events: none;
}

.hue .thumb {
  top: 50%;
}

.row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.preview {
  flex: none;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px rgb(var(--shadow) / 0.15);
}

.hex {
  flex: 1;
  min-width: 0;
  min-height: 2.25rem;
  padding-block: 0.35rem;
  font-size: var(--text-base);
  font-variant-numeric: tabular-nums;
}

.drop {
  flex: none;
}

@keyframes pick-in {
  from { opacity: 0; translate: 0 -4px; scale: 0.98; }
}

@keyframes pick-in-above {
  from { opacity: 0; translate: 0 4px; scale: 0.98; }
}

@media (prefers-reduced-motion: reduce) {
  .picker.is-open { animation: none; }
}
</style>
