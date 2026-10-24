<script setup lang="ts">
import { toast } from 'vue-sonner'

const { play } = useSound()

// The last colours used come back next time
const { prefs } = useAppPrefs('color', { color: '#4f46e5', text: '#ffffff', steps: 4, gradFrom: '#4f46e5', gradTo: '#0ea5e9', gradAngle: 135, gradKind: 'linear' })

// What's typed can be half a colour; the swatches keep the last one that parsed
const typed = ref(prefs.color)
const typedText = ref(prefs.text)
watch(typed, v => (parseColor(v) ? (prefs.color = toHex(parseColor(v)!)) : undefined))
watch(typedText, v => (parseColor(v) ? (prefs.text = toHex(parseColor(v)!)) : undefined))
const setColor = (v: string) => (typed.value = prefs.color = v)
const setText = (v: string) => (typedText.value = prefs.text = v)

// Common starting points, one click to use
const PRESETS = [
  ['Red', '#ef4444'], ['Orange', '#f97316'], ['Amber', '#f59e0b'], ['Yellow', '#eab308'], ['Lime', '#84cc16'],
  ['Green', '#22c55e'], ['Emerald', '#10b981'], ['Teal', '#14b8a6'], ['Cyan', '#06b6d4'], ['Sky', '#0ea5e9'],
  ['Blue', '#3b82f6'], ['Indigo', '#6366f1'], ['Violet', '#8b5cf6'], ['Purple', '#a855f7'], ['Fuchsia', '#d946ef'],
  ['Pink', '#ec4899'], ['Rose', '#f43f5e'], ['Slate', '#64748b'], ['Black', '#000000'], ['White', '#ffffff']
] as const

// ---------- Gradient: between two colours of its own ----------
const typedFrom = ref(prefs.gradFrom)
const typedGrad = ref(prefs.gradTo)
watch(typedFrom, v => (parseColor(v) ? (prefs.gradFrom = toHex(parseColor(v)!)) : undefined))
watch(typedGrad, v => (parseColor(v) ? (prefs.gradTo = toHex(parseColor(v)!)) : undefined))
const setGradFrom = (v: string) => (typedFrom.value = prefs.gradFrom = v)
const setGradTo = (v: string) => (typedGrad.value = prefs.gradTo = v)
const GRADIENTS = [
  ['Sunset', '#f97316', '#db2777'], ['Ocean', '#06b6d4', '#3b82f6'], ['Forest', '#84cc16', '#047857'],
  ['Grape', '#a855f7', '#6366f1'], ['Peach', '#fda4af', '#fde68a'], ['Night', '#1e293b', '#6366f1']
] as const
const gradStart = computed(() => (parseColor(prefs.gradFrom) ? prefs.gradFrom : '#4f46e5'))
const gradEnd = computed(() => (parseColor(prefs.gradTo) ? prefs.gradTo : '#0ea5e9'))
const gradient = computed(() => (prefs.gradKind === 'radial'
  ? `radial-gradient(circle, ${gradStart.value} 0%, ${gradEnd.value} 100%)`
  : `linear-gradient(${prefs.gradAngle}deg, ${gradStart.value} 0%, ${gradEnd.value} 100%)`))
function useGradient(from: string, to: string) {
  setGradFrom(from)
  setGradTo(to)
  play('select')
}
function swapGradient() {
  useGradient(gradEnd.value, gradStart.value)
}

// A hand-edited setting could hold anything; fall back rather than break the page
const rgb = computed(() => parseColor(prefs.color) ?? { r: 79, g: 70, b: 229 })
const textRgb = computed(() => parseColor(prefs.text) ?? { r: 255, g: 255, b: 255 })
const formats = computed(() => {
  const { r, g, b } = rgb.value
  const { h, s, l } = toHsl(rgb.value)
  return [
    { label: 'HEX', value: prefs.color },
    { label: 'RGB', value: `rgb(${r}, ${g}, ${b})` },
    { label: 'HSL', value: `hsl(${h}, ${s}%, ${l}%)` }
  ]
})

// WCAG 2: AA needs 4.5:1 for body text and 3:1 for large text (24px, or 19px bold); AAA 7:1 and 4.5:1
const ratio = computed(() => contrast(rgb.value, textRgb.value))
const checks = computed(() => [
  { label: 'AA', size: 'Normal text', pass: ratio.value >= 4.5 },
  { label: 'AA', size: 'Large text', pass: ratio.value >= 3 },
  { label: 'AAA', size: 'Normal text', pass: ratio.value >= 7 },
  { label: 'AAA', size: 'Large text', pass: ratio.value >= 4.5 }
])
const swatches = computed(() => scale(rgb.value, prefs.steps))

function swap() {
  const [a, b] = [prefs.color, prefs.text]
  setColor(b)
  setText(a)
  play('select')
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`Copied ${text}`)
    play('copy')
  } catch {
    toast.error('Could not copy', { description: 'Your browser blocked clipboard access.' })
    play('error')
  }
}
</script>

<template>
  <ToolPage header="bar">
    <template #settings>
      <SettingChoice v-model="prefs.steps" title="Tints and shades" description="How many lighter and darker steps either side of your colour." :options="[{ value: 3, label: '3 each' }, { value: 4, label: '4 each' }, { value: 5, label: '5 each' }]" />
    </template>

    <div class="workspace">
      <section class="panel pad stack">
        <h2 class="title">Colour</h2>
        <div class="pick">
          <ColorPicker :model-value="prefs.color" aria-label="Pick a colour" @update:model-value="setColor" />
          <label class="field grow">
            HEX, RGB or HSL
            <input v-model="typed" class="input" :class="{ bad: !parseColor(typed) }" spellcheck="false" autocomplete="off" :aria-invalid="!parseColor(typed)">
          </label>
        </div>
        <div class="presets" role="group" aria-label="Preset colours">
          <button
            v-for="[name, hex] in PRESETS"
            :key="hex"
            type="button"
            class="preset"
            :class="{ on: prefs.color === hex }"
            :style="{ background: hex }"
            :title="name"
            :aria-label="name"
            :aria-pressed="prefs.color === hex"
            @click="setColor(hex); play('select')"
          />
        </div>

        <ul class="formats">
          <li v-for="f in formats" :key="f.label">
            <span class="fmt-label">{{ f.label }}</span>
            <code>{{ f.value }}</code>
            <button type="button" class="btn btn-quiet btn-sm" :aria-label="`Copy ${f.label}`" @click="copy(f.value)">Copy</button>
          </li>
        </ul>
      </section>

      <section class="panel pad stack">
        <h2 class="title">Contrast</h2>
        <div class="preview" :style="{ background: prefs.color, color: prefs.text }">
          <p class="preview-large">Large text</p>
          <p>Normal text reads like this on your colour.</p>
        </div>
        <div class="pick">
          <ColorPicker :model-value="prefs.text" aria-label="Pick the text colour" @update:model-value="setText" />
          <label class="field grow">
            Text colour
            <input v-model="typedText" class="input" :class="{ bad: !parseColor(typedText) }" spellcheck="false" autocomplete="off" :aria-invalid="!parseColor(typedText)">
          </label>
        </div>
        <div class="chips">
          <button type="button" class="btn btn-quiet btn-sm" @click="setText(inkOn(rgb)); play('select')">Best of black or white</button>
          <button type="button" class="btn btn-quiet btn-sm" @click="swap">⇄ Swap</button>
        </div>
        <p class="ratio"><output>{{ ratio.toFixed(2) }}</output>:1</p>
        <ul class="checks">
          <li v-for="c in checks" :key="c.label + c.size" :class="{ pass: c.pass }">
            <span aria-hidden="true">{{ c.pass ? '✓' : '✕' }}</span>
            {{ c.label }} · {{ c.size }}
            <span class="sr-only">{{ c.pass ? 'passes' : 'fails' }}</span>
          </li>
        </ul>
      </section>

      <section class="panel pad stack wide">
        <h2 class="title">Gradient</h2>
        <div class="gradient" :style="{ background: gradient }" />
        <div class="grad-controls">
          <div class="pick">
            <ColorPicker :model-value="gradStart" aria-label="Pick the gradient’s start colour" @update:model-value="setGradFrom" />
            <label class="field grow">
              From
              <input v-model="typedFrom" class="input" :class="{ bad: !parseColor(typedFrom) }" spellcheck="false" autocomplete="off" :aria-invalid="!parseColor(typedFrom)">
            </label>
          </div>
          <button type="button" class="btn btn-quiet swap-stops" aria-label="Swap From and To" @click="swapGradient">⇄</button>
          <div class="pick">
            <ColorPicker :model-value="gradEnd" aria-label="Pick the gradient’s end colour" @update:model-value="setGradTo" />
            <label class="field grow">
              To
              <input v-model="typedGrad" class="input" :class="{ bad: !parseColor(typedGrad) }" spellcheck="false" autocomplete="off" :aria-invalid="!parseColor(typedGrad)">
            </label>
          </div>
        </div>
        <div class="grad-controls grad-shape">
          <div class="segmented kind" role="radiogroup" aria-label="Gradient type">
            <label v-for="k in ['linear', 'radial']" :key="k" :class="{ active: prefs.gradKind === k }">
              <input type="radio" name="color-grad-kind" :checked="prefs.gradKind === k" @change="prefs.gradKind = k; play('select')">
              {{ k === 'linear' ? 'Linear' : 'Radial' }}
            </label>
          </div>
          <label v-if="prefs.gradKind === 'linear'" class="field angle">
            <span class="field-head">Angle <output>{{ prefs.gradAngle }}°</output></span>
            <input v-model.number="prefs.gradAngle" type="range" min="0" max="355" step="5" aria-label="Angle">
          </label>
        </div>
        <div class="chips">
          <button v-for="[name, from, to] in GRADIENTS" :key="name" type="button" class="btn btn-quiet btn-sm grad-chip" @click="useGradient(from, to)">
            <span class="grad-dot" :style="{ background: `linear-gradient(135deg, ${from}, ${to})` }" aria-hidden="true" />
            {{ name }}
          </button>
        </div>
        <ul class="formats">
          <li class="css-row">
            <code>background: {{ gradient }};</code>
            <button type="button" class="btn btn-quiet btn-sm" @click="useGradient(prefs.color, gradEnd)">Start from my colour</button>
            <button type="button" class="btn btn-quiet btn-sm" @click="copy(`background: ${gradient};`)">Copy CSS</button>
          </li>
        </ul>
      </section>

      <section class="panel pad stack wide">
        <h2 class="title">Tints and shades</h2>
        <p class="hint">Click one to copy it, or double-click to use it.</p>
        <div class="swatches">
          <button
            v-for="s in swatches"
            :key="s"
            type="button"
            class="swatch"
            :class="{ base: s === prefs.color }"
            :style="{ background: s, color: inkOn(parseColor(s)!) }"
            :aria-label="`Copy ${s}`"
            @click="copy(s)"
            @dblclick="setColor(s)"
          >
            {{ s }}
          </button>
        </div>
      </section>
    </div>
  </ToolPage>
</template>

<style scoped>
.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 1.5rem;
  align-items: start;
}

.wide {
  grid-column: 1 / -1;
}

.pad {
  padding: 1.25rem;
}

.stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.title {
  margin: 0;
  font-size: var(--text-md);
}

.pick {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
}

.grow {
  flex: 1;
  min-width: 0;
}

.presets {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 0.4rem;
}

.preset {
  aspect-ratio: 1;
  min-width: 0;
  padding: 0;
  border: 1px solid rgb(var(--shadow) / 0.15);
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.1s;
}

.preset:hover {
  transform: scale(1.1);
}

.preset.on {
  outline: 2px solid var(--ink);
  outline-offset: 2px;
}

.gradient {
  height: 9rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
}

.grad-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: end;
  gap: 0.75rem 1rem;
}

.grad-shape {
  grid-template-columns: auto minmax(0, 1fr);
}

.swap-stops {
  padding-inline: 0.85rem;
}

.kind {
  min-height: 2.75rem;
}

.kind label {
  padding-inline: 0.85rem;
}

.angle input {
  width: 100%;
  accent-color: var(--accent);
}

.grad-chip {
  gap: 0.45rem;
}

.grad-dot {
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
}

.css-row code {
  font-size: var(--text-sm);
}

.input.bad {
  border-color: var(--red);
}

.formats,
.checks {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.formats li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--line);
}

.fmt-label {
  width: 2.5rem;
  font-weight: 600;
  color: var(--ink-2);
}

.formats code {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.preview {
  padding: 1rem 1.1rem;
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

.preview p {
  margin: 0;
}

.preview-large {
  font-size: 1.5rem;
  font-weight: 700;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.ratio {
  margin: 0;
  font-size: 2.25rem;
  font-weight: 700;
}

.checks {
  grid-template-columns: 1fr 1fr;
}

.checks li {
  padding: 0.45rem 0.65rem;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--red);
  background: color-mix(in srgb, var(--red) 10%, transparent);
  border-radius: var(--radius-sm);
}

.checks li.pass {
  color: var(--green);
  background: color-mix(in srgb, var(--green) 12%, transparent);
}

.hint {
  margin: -0.5rem 0 0;
  font-size: var(--text-sm);
  color: var(--ink-3);
}

.swatches {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(5.5rem, 1fr));
  gap: 0.5rem;
}

.swatch {
  min-height: 4.5rem;
  padding: 0.5rem;
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  border: 1px solid rgb(var(--shadow) / 0.12);
  border-radius: var(--radius);
  cursor: pointer;
  transition: transform 0.1s;
}

.swatch:active {
  transform: scale(0.96);
}

.swatch.base {
  outline: 3px solid var(--ink);
  outline-offset: 2px;
}

@media (max-width: 720px) {
  .workspace,
  .grad-controls {
    grid-template-columns: minmax(0, 1fr);
  }

  .swap-stops {
    justify-self: start;
  }

  .css-row {
    flex-wrap: wrap;
  }

  .css-row code {
    flex-basis: 100%;
  }
}
</style>
