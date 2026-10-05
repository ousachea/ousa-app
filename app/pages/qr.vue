<script setup lang="ts">
import QRCode from 'qrcode'
import { toast } from 'vue-sonner'

const { play } = useSound()

type Level = 'L' | 'M' | 'Q' | 'H'

const text = ref('https://github.com/ousachea/ousa-app')
const size = ref(320)
const foreground = ref('#1b1f2a')
const background = ref('#ffffff')
const level = ref<Level>('M')

const LEVELS: { value: Level, label: string }[] = [
  { value: 'L', label: 'Low' },
  { value: 'M', label: 'Medium' },
  { value: 'Q', label: 'High' },
  { value: 'H', label: 'Max' }
]

const dataUrl = ref('')
const error = ref('')

const options = computed(() => ({
  errorCorrectionLevel: level.value,
  margin: 2,
  width: size.value,
  color: { dark: foreground.value, light: background.value }
}))

async function generate() {
  if (!text.value) {
    dataUrl.value = ''
    error.value = ''
    return
  }
  try {
    dataUrl.value = await QRCode.toDataURL(text.value, options.value)
    error.value = ''
  } catch (e) {
    dataUrl.value = ''
    error.value = e instanceof Error ? e.message : 'This text can’t be turned into a QR code'
  }
}

watch([text, options], generate, { immediate: true })

function download(href: string, ext: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = `qr-code.${ext}`
  a.click()
}

function downloadPng() {
  download(dataUrl.value, 'png')
  toast.success('PNG downloaded')
  play('success')
}

async function downloadSvg() {
  const svg = await QRCode.toString(text.value, { ...options.value, type: 'svg' })
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  download(url, 'svg')
  URL.revokeObjectURL(url)
  toast.success('SVG downloaded')
  play('success')
}

async function copyImage() {
  try {
    const blob = await (await fetch(dataUrl.value)).blob()
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    toast.success('Copied to clipboard')
    play('copy')
  } catch {
    toast.error('Could not copy', { description: 'Your browser blocked clipboard access.' })
    play('error')
  }
}
</script>

<template>
  <ToolPage>
    <div class="workspace">
      <Step :n="1" title="Enter your link or text" class="text">
        <textarea
          v-model="text"
          class="input"
          rows="4"
          placeholder="https://example.com"
          aria-label="Link or text"
        />
      </Step>

      <Step :n="2" title="Style it" hint="Optional. The defaults work for most uses." class="options">
        <div class="panel options-panel">
          <label class="field">
            <span class="field-head">Size <output>{{ size }} px</output></span>
            <input v-model.number="size" type="range" min="128" max="1024" step="32">
          </label>

          <div class="colors">
            <label class="field">
              <span class="field-head">Code colour</span>
              <span class="swatch input">
                <input v-model="foreground" type="color">
                <span>{{ foreground }}</span>
              </span>
            </label>
            <label class="field">
              <span class="field-head">Background</span>
              <span class="swatch input">
                <input v-model="background" type="color">
                <span>{{ background }}</span>
              </span>
            </label>
          </div>

          <div class="field">
            <span class="field-head">Damage tolerance</span>
            <div class="segmented" role="radiogroup" aria-label="Damage tolerance">
              <label v-for="l in LEVELS" :key="l.value" :class="{ active: level === l.value }">
                <input v-model="level" type="radio" name="level" :value="l.value">
                {{ l.label }}
              </label>
            </div>
            <small class="hint">Higher still scans when part of the code is covered or scratched, but makes it denser.</small>
          </div>
        </div>
      </Step>

      <Step :n="3" title="Download or copy" class="preview">
        <div class="panel preview-panel">
          <div class="frame" :style="{ background }">
            <img v-if="dataUrl" :src="dataUrl" alt="QR code preview">
            <p v-else class="empty">{{ error || 'Enter a link or some text in step 1 to make a QR code.' }}</p>
          </div>

          <div class="actions">
            <button type="button" class="btn" :disabled="!dataUrl" @click="downloadPng">Download PNG</button>
            <button type="button" class="btn btn-quiet" :disabled="!dataUrl" @click="downloadSvg">Download SVG</button>
            <button type="button" class="btn btn-quiet" :disabled="!dataUrl" @click="copyImage">Copy</button>
          </div>
        </div>
      </Step>
    </div>
  </ToolPage>
</template>

<style scoped>
.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
  grid-template-areas:
    'text preview'
    'options preview';
  grid-template-rows: auto 1fr;
  gap: 2rem 2.5rem;
  align-items: start;
}

.text { grid-area: text; }
.options { grid-area: options; }

.preview {
  grid-area: preview;
  position: sticky;
  top: 1.5rem;
}

.preview-panel {
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.frame {
  width: min(100%, 440px);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  padding: 1rem;
  border-radius: 12px;
  box-shadow: inset 0 0 0 1px rgb(var(--shadow) / 0.08);
}

.frame img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}

.empty {
  max-width: 16rem;
  text-align: center;
  color: var(--ink-3);
}

.actions {
  width: min(100%, 440px);
  margin-top: 1.25rem;
  display: flex;
  gap: 0.5rem;
}

.actions .btn:first-child {
  flex: 1;
}

.options-panel {
  padding: 1.4rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.colors {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.swatch {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.35rem 0.6rem 0.35rem 0.4rem;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}

.swatch input {
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: none;
  cursor: pointer;
}

.swatch input::-webkit-color-swatch-wrapper { padding: 0; }
.swatch input::-webkit-color-swatch {
  border: 1px solid var(--line);
  border-radius: 8px;
}

.hint {
  font-weight: 400;
  color: var(--ink-3);
}

@media (max-width: 900px) {
  .workspace {
    grid-template-columns: 1fr;
    grid-template-areas: 'text' 'options' 'preview';
  }

  .preview {
    position: static;
  }

  .preview-panel {
    padding: 1.25rem;
  }

  .frame { width: min(100%, 320px); }
}

@media (max-width: 480px) {
  .actions { flex-wrap: wrap; }
  .actions .btn:first-child { flex-basis: 100%; }
  .actions .btn-quiet { flex: 1; }
}
</style>
