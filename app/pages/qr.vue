<script setup lang="ts">
import { toast } from 'vue-sonner'
import jsQR from 'jsqr'
import type { CornerStyle, DotStyle, Level, PlateShape, QrDesign } from '~/utils/qrSvg'

const { play } = useSound()

const MAX_LOGO_BYTES = 2 * 1024 * 1024

// Content
const text = ref('https://github.com/ousachea/ousa-app')

// Style
const fg = ref('#1b1f2a')
const useGradient = ref(false)
const fg2 = ref('#1f5bd8')
const bg = ref('#ffffff')
const transparent = ref(false)
const dots = ref<DotStyle>('square')
const corners = ref<CornerStyle>('square')
const level = ref<Level>('M')

// Logo
const logoMode = ref<'none' | 'icon' | 'upload'>('none')
const iconId = ref(QR_ICONS[0]!.id)
const iconColor = ref('#1b1f2a')
const uploaded = ref<{ name: string, dataUrl: string }>()
const plate = ref<PlateShape>('square')
const plateColor = ref('#ffffff')
const logoSize = ref(22)

// Frame
const frameOn = ref(false)
const caption = ref('Scan me')
const frameColor = ref('#1b1f2a')
const frameTextColor = ref('#ffffff')

// Export
const size = ref(1024)

const DOTS: { value: DotStyle, label: string }[] = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'dots', label: 'Dots' }
]
const CORNERS: { value: CornerStyle, label: string }[] = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'circle', label: 'Circle' }
]
const LEVELS: { value: Level, label: string }[] = [
  { value: 'L', label: 'Low' },
  { value: 'M', label: 'Medium' },
  { value: 'Q', label: 'High' },
  { value: 'H', label: 'Max' }
]
const PLATES: { value: PlateShape, label: string }[] = [
  { value: 'square', label: 'Rounded square' },
  { value: 'circle', label: 'Circle' },
  { value: 'none', label: 'None' }
]

const hasLogo = computed(() => logoMode.value === 'icon' || (logoMode.value === 'upload' && !!uploaded.value))
const selectedIcon = computed(() => QR_ICONS.find(i => i.id === iconId.value))

const design = computed<QrDesign>(() => ({
  text: text.value,
  level: level.value,
  fg: fg.value,
  fg2: useGradient.value ? fg2.value : undefined,
  bg: transparent.value ? null : bg.value,
  dots: dots.value,
  corners: corners.value,
  logo: hasLogo.value
    ? {
        icon: logoMode.value === 'icon' ? selectedIcon.value : undefined,
        image: logoMode.value === 'upload' ? uploaded.value?.dataUrl : undefined,
        iconColor: iconColor.value,
        plate: plate.value,
        plateColor: plateColor.value,
        size: logoSize.value / 100
      }
    : undefined,
  frame: frameOn.value ? { caption: caption.value, color: frameColor.value, textColor: frameTextColor.value } : undefined
}))

const result = computed(() => {
  if (!text.value) return { error: '' }
  try {
    return { qr: buildQrSvg(design.value) }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'This text can’t be turned into a QR code' }
  }
})

const svg = computed(() => result.value.qr?.svg ?? '')
const previewUrl = computed(() => (svg.value ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.value)}` : ''))

// Scanners need a dark code on a light background with clear contrast
// ---------- Live scan check ----------
// Decode the actual rendered design the way a phone camera would, so the page can say whether it scans
const scan = ref<'idle' | 'checking' | 'ok' | 'fail'>('idle')
let scanTimer: ReturnType<typeof setTimeout> | undefined
let scanRun = 0

async function checkScan() {
  const url = previewUrl.value
  const run = ++scanRun
  if (!url) {
    scan.value = 'idle'
    return
  }
  scan.value = 'checking'
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const size = 360 // roughly what a phone sees of a code held at arm's length
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = Math.round(size * img.naturalHeight / img.naturalWidth)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff' // a transparent code is judged on white paper
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const decoded = jsQR(data.data, canvas.width, canvas.height)
    if (run !== scanRun) return
    const next = decoded?.data === text.value ? 'ok' : 'fail'
    // Toast only on the change from scanning to not scanning, not on every tweak
    if (next === 'fail' && scan.value !== 'fail') toast.warning('This design might not scan', { description: 'Try more contrast, square dots or a smaller logo.' })
    scan.value = next
  } catch {
    if (run === scanRun) scan.value = 'fail'
  }
}

watch(previewUrl, () => {
  clearTimeout(scanTimer)
  scanTimer = setTimeout(checkScan, 250)
})
onMounted(checkScan)
onBeforeUnmount(() => clearTimeout(scanTimer))

const scanWarning = computed(() => {
  if (transparent.value) return 'With a transparent background, place the code on a light surface so it scans.'
  const colors = useGradient.value ? [fg.value, fg2.value] : [fg.value]
  if (colors.some(c => isLighter(c, bg.value))) return 'The code is lighter than its background. Many scanner apps can’t read inverted codes.'
  if (colors.some(c => contrastRatio(c, bg.value) < 3)) return 'Low contrast between the code and background may make it hard to scan. Try a darker code colour.'
  return ''
})

function chooseIcon(id: string) {
  logoMode.value = 'icon'
  iconId.value = id
  play('select')
}

function onLogoPick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    toast.error('That file isn’t an image')
    play('error')
    return
  }
  if (file.size > MAX_LOGO_BYTES) {
    toast.error('Image is too large', { description: 'Use an image under 2 MB.' })
    play('error')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    uploaded.value = { name: file.name, dataUrl: String(reader.result) }
    logoMode.value = 'upload'
    play('drop')
    toast.success('Logo added', { description: 'Damage tolerance is set to Max so it still scans.' })
  }
  reader.readAsDataURL(file)
}

function removeUpload() {
  uploaded.value = undefined
  logoMode.value = 'none'
  play('delete')
}

function download(href: string, ext: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = `qr-code.${ext}`
  a.click()
}

// Draw the SVG onto a canvas to get a PNG at the chosen width
async function toPngBlob() {
  const qr = result.value.qr!
  const img = new Image()
  img.src = previewUrl.value
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = size.value
  canvas.height = Math.round(size.value * qr.height / qr.width)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Could not create the PNG')
  return blob
}

async function downloadPng() {
  try {
    const url = URL.createObjectURL(await toPngBlob())
    download(url, 'png')
    URL.revokeObjectURL(url)
    toast.success('PNG downloaded')
    play('success')
  } catch {
    toast.error('Could not create the PNG')
    play('error')
  }
}

function downloadSvg() {
  const url = URL.createObjectURL(new Blob([svg.value], { type: 'image/svg+xml' }))
  download(url, 'svg')
  URL.revokeObjectURL(url)
  toast.success('SVG downloaded')
  play('success')
}

async function copyImage() {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': toPngBlob() })])
    toast.success('Copied to clipboard')
    play('copy')
  } catch {
    toast.error('Could not copy', { description: 'Your browser blocked clipboard access.' })
    play('error')
  }
}
</script>

<template>
  <ToolPage header="bar">
    <div class="workspace">
      <Step :n="1" title="Enter your link or text" class="text">
        <textarea
          v-model="text"
          class="input"
          rows="3"
          placeholder="https://example.com"
          aria-label="Link or text"
        />
      </Step>

      <Step :n="2" title="Style it" hint="Colours and shapes. The defaults scan everywhere." class="style">
        <div class="panel group">
          <div class="row">
            <label class="field">
              <span class="field-head">Code colour</span>
              <span class="swatch input">
                <input v-model="fg" type="color">
                <span>{{ fg }}</span>
              </span>
            </label>
            <label class="field">
              <span class="field-head">Background</span>
              <span class="swatch input" :class="{ off: transparent }">
                <input v-model="bg" type="color" :disabled="transparent">
                <span>{{ transparent ? 'Transparent' : bg }}</span>
              </span>
            </label>
          </div>

          <div class="row">
            <label class="check">
              <input v-model="useGradient" type="checkbox">
              Gradient
            </label>
            <label class="check">
              <input v-model="transparent" type="checkbox">
              Transparent background
            </label>
          </div>

          <label v-if="useGradient" class="field">
            <span class="field-head">Gradient end colour</span>
            <span class="swatch input">
              <input v-model="fg2" type="color">
              <span>{{ fg2 }}</span>
            </span>
          </label>

          <div class="field">
            <span class="field-head">Dots</span>
            <div class="segmented" role="radiogroup" aria-label="Dot shape">
              <label v-for="o in DOTS" :key="o.value" :class="{ active: dots === o.value }">
                <input v-model="dots" type="radio" name="dots" :value="o.value">
                {{ o.label }}
              </label>
            </div>
          </div>

          <div class="field">
            <span class="field-head">Corners</span>
            <div class="segmented" role="radiogroup" aria-label="Corner shape">
              <label v-for="o in CORNERS" :key="o.value" :class="{ active: corners === o.value }">
                <input v-model="corners" type="radio" name="corners" :value="o.value">
                {{ o.label }}
              </label>
            </div>
          </div>

          <div class="field">
            <span class="field-head">Damage tolerance</span>
            <div class="segmented" role="radiogroup" aria-label="Damage tolerance" :class="{ locked: hasLogo }">
              <label v-for="l in LEVELS" :key="l.value" :class="{ active: (hasLogo ? 'H' : level) === l.value }">
                <input v-model="level" type="radio" name="level" :value="l.value" :disabled="hasLogo">
                {{ l.label }}
              </label>
            </div>
            <small class="hint">
              {{ hasLogo
                ? 'Set to Max while there’s a logo, because the logo covers part of the code.'
                : 'Higher still scans when part of the code is covered or scratched, but makes it denser.' }}
            </small>
          </div>
        </div>
      </Step>

      <Step :n="3" title="Add a logo or frame" hint="Optional." class="decorate">
        <div class="panel group">
          <div class="field">
            <span class="field-head">Logo</span>
            <div class="logos" role="radiogroup" aria-label="Logo">
              <button
                type="button"
                role="radio"
                class="logo-opt"
                :aria-checked="logoMode === 'none'"
                @click="logoMode = 'none'"
              >
                <span class="none">None</span>
              </button>
              <button
                v-for="icon in QR_ICONS"
                :key="icon.id"
                type="button"
                role="radio"
                class="logo-opt"
                :aria-checked="logoMode === 'icon' && iconId === icon.id"
                :aria-label="icon.label"
                :title="icon.label"
                @click="chooseIcon(icon.id)"
              >
                <!-- Built-in icon markup from QR_ICONS, never user input -->
                <svg
                  :viewBox="icon.viewBox"
                  v-bind="icon.colored ? {} : { fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }"
                  v-html="icon.markup"
                />
              </button>
              <label class="logo-opt upload" :data-checked="logoMode === 'upload'" :title="uploaded ? uploaded.name : 'Upload your own image'">
                <input type="file" accept="image/*" aria-label="Upload a logo image" @change="onLogoPick">
                <img v-if="uploaded" :src="uploaded.dataUrl" alt="">
                <span v-else class="none">Upload</span>
              </label>
            </div>
            <small v-if="uploaded" class="hint">
              Using {{ uploaded.name }}.
              <button type="button" class="link" @click="removeUpload">Remove</button>
            </small>
          </div>

          <template v-if="hasLogo">
            <label class="field">
              <span class="field-head">Logo size <output>{{ logoSize }}%</output></span>
              <input v-model.number="logoSize" type="range" min="12" max="30" step="1">
            </label>

            <div class="field">
              <span class="field-head">Logo background</span>
              <div class="segmented" role="radiogroup" aria-label="Logo background">
                <label v-for="o in PLATES" :key="o.value" :class="{ active: plate === o.value }">
                  <input v-model="plate" type="radio" name="plate" :value="o.value">
                  {{ o.label }}
                </label>
              </div>
            </div>

            <div class="row">
              <label v-if="logoMode === 'icon' && !selectedIcon?.colored" class="field">
                <span class="field-head">Icon colour</span>
                <span class="swatch input">
                  <input v-model="iconColor" type="color">
                  <span>{{ iconColor }}</span>
                </span>
              </label>
              <label v-if="plate !== 'none'" class="field">
                <span class="field-head">Plate colour</span>
                <span class="swatch input">
                  <input v-model="plateColor" type="color">
                  <span>{{ plateColor }}</span>
                </span>
              </label>
            </div>
          </template>

          <label class="check">
            <input v-model="frameOn" type="checkbox">
            Add a frame with a caption
          </label>

          <template v-if="frameOn">
            <label class="field">
              <span class="field-head">Caption</span>
              <input v-model="caption" class="input" maxlength="24">
            </label>
            <div class="row">
              <label class="field">
                <span class="field-head">Frame colour</span>
                <span class="swatch input">
                  <input v-model="frameColor" type="color">
                  <span>{{ frameColor }}</span>
                </span>
              </label>
              <label class="field">
                <span class="field-head">Caption colour</span>
                <span class="swatch input">
                  <input v-model="frameTextColor" type="color">
                  <span>{{ frameTextColor }}</span>
                </span>
              </label>
            </div>
          </template>
        </div>
      </Step>

      <Step title="Preview" v-sticky-fit class="preview">
        <div class="panel preview-panel">
          <!-- The code on a sheet of paper with printer's crop marks -->
          <div class="paper">
            <span class="crop tl" aria-hidden="true" />
            <span class="crop tr" aria-hidden="true" />
            <span class="crop bl" aria-hidden="true" />
            <span class="crop br" aria-hidden="true" />
            <div class="frame" :class="{ checker: transparent }">
              <img v-if="previewUrl" :src="previewUrl" alt="QR code preview">
              <p v-else class="empty">{{ result.error || 'Enter a link or some text in step 1 to make a QR code.' }}</p>
            </div>
          </div>

          <p v-if="previewUrl" class="scan" :data-scan="scan" role="status">
            <span class="scan-dot" aria-hidden="true" />
            <template v-if="scan === 'ok'">Scans correctly</template>
            <template v-else-if="scan === 'fail'">Might not scan. Try more contrast, square dots, or a smaller logo.</template>
            <template v-else>Checking that it scans…</template>
          </p>

          <p v-if="scanWarning && previewUrl" class="warning" role="status">{{ scanWarning }}</p>

          <label class="field export-size">
            <span class="field-head">PNG size <output>{{ size }} px</output></span>
            <input v-model.number="size" type="range" min="256" max="2048" step="64">
          </label>

          <div class="actions">
            <button type="button" class="btn" :disabled="!previewUrl" @click="downloadPng">Download PNG</button>
            <button type="button" class="btn btn-quiet" :disabled="!previewUrl" @click="downloadSvg">Download SVG</button>
            <button type="button" class="btn btn-quiet" :disabled="!previewUrl" @click="copyImage">Copy</button>
          </div>
        </div>
      </Step>
    </div>
  </ToolPage>
</template>

<style scoped>
/* Studio: the canvas on the left, the controls in a sidebar on the right */
.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
  grid-template-areas:
    'preview text'
    'preview style'
    'preview decorate';
  grid-template-rows: auto auto 1fr;
  gap: 2rem 2.5rem;
  align-items: start;
}

.text { grid-area: text; }
.style { grid-area: style; }
.decorate { grid-area: decorate; }

.preview {
  grid-area: preview;
  position: sticky;
  top: 5.5rem; /* clear of the menu button in the top-right corner */
}

.group {
  padding: 1.4rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.check {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-weight: 500;
  cursor: pointer;
}

.check input {
  width: 1.1rem;
  height: 1.1rem;
  margin: 0;
  accent-color: var(--accent);
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

.swatch.off {
  color: var(--ink-3);
  cursor: default;
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

.swatch input:disabled {
  opacity: 0.3;
  cursor: default;
}

.swatch input::-webkit-color-swatch-wrapper { padding: 0; }
.swatch input::-webkit-color-swatch {
  border: 1px solid var(--line);
  border-radius: 8px;
}

.segmented.locked label {
  cursor: not-allowed;
}

.hint {
  font-weight: 400;
  color: var(--ink-3);
}

.link {
  padding: 0;
  font: inherit;
  color: var(--ink-2);
  background: none;
  border: 0;
  text-decoration: underline;
  cursor: pointer;
}

.logos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(3.25rem, 1fr));
  gap: 0.5rem;
}

.logo-opt {
  position: relative;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  padding: 0.6rem;
  color: var(--ink);
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.logo-opt:hover {
  border-color: var(--ink-3);
}

.logo-opt[aria-checked='true'],
.logo-opt[data-checked='true'] {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
}

.logo-opt svg,
.logo-opt img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.logo-opt .none {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ink-2);
}

.upload input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}

.upload:has(input:focus-visible) {
  outline: 3px solid color-mix(in srgb, var(--accent) 55%, transparent);
  outline-offset: 2px;
}

.preview-panel {
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Paper sheet with crop marks just outside each corner */
.paper {
  position: relative;
  width: min(100%, 440px);
  padding: 1.5rem;
  background: #fff;
  box-shadow: 0 1px 1px rgb(0 0 0 / 0.08), 0 12px 28px -12px rgb(0 0 0 / 0.3);
}

.crop {
  position: absolute;
  width: 0.9rem;
  height: 0.9rem;
  border-color: #9aa1ae;
  border-style: solid;
  border-width: 0;
}

.crop.tl { top: 0.45rem; left: 0.45rem; border-top-width: 1px; border-left-width: 1px; }
.crop.tr { top: 0.45rem; right: 0.45rem; border-top-width: 1px; border-right-width: 1px; }
.crop.bl { bottom: 0.45rem; left: 0.45rem; border-bottom-width: 1px; border-left-width: 1px; }
.crop.br { bottom: 0.45rem; right: 0.45rem; border-bottom-width: 1px; border-right-width: 1px; }

.scan {
  width: min(100%, 440px);
  margin: 1rem 0 0;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ink-2);
}

.scan-dot {
  flex: none;
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  background: var(--ink-3);
}

[data-scan='ok'] { color: var(--good-ink); }
[data-scan='ok'] .scan-dot { background: var(--green); box-shadow: 0 0 0 4px color-mix(in srgb, var(--green) 20%, transparent); }
[data-scan='fail'] { color: var(--warn-ink); }
[data-scan='fail'] .scan-dot { background: var(--orange); }

.frame {
  width: 100%;
  display: grid;
  place-items: center;
  border-radius: 12px;
}

.frame.checker {
  background: repeating-conic-gradient(var(--checker-a) 0 25%, var(--checker-b) 0 50%) 0 0 / 16px 16px;
}

.frame img {
  width: 100%;
  height: auto;
  display: block;
}

.empty {
  min-height: 16rem;
  display: grid;
  place-items: center;
  max-width: 16rem;
  text-align: center;
  color: var(--ink-3);
}

.warning {
  width: min(100%, 420px);
  margin: 1rem 0 0;
  padding: 0.7rem 0.9rem;
  font-size: 0.875rem;
  color: var(--warn-ink);
  background: color-mix(in srgb, var(--orange) 10%, var(--surface));
  border-radius: 10px;
}

.export-size {
  width: min(100%, 420px);
  margin-top: 1.25rem;
}

.actions {
  width: min(100%, 420px);
  margin-top: 1rem;
  display: flex;
  gap: 0.5rem;
}

.actions .btn:first-child {
  flex: 1;
}

@media (max-width: 900px) {
  .workspace {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'text' 'style' 'decorate' 'preview';
  }

  .preview {
    position: static;
  }

  .preview-panel {
    padding: 1.25rem;
  }
}

@media (max-width: 480px) {
  .row { grid-template-columns: minmax(0, 1fr); }
  .actions { flex-wrap: wrap; }
  .actions .btn:first-child { flex-basis: 100%; }
  .actions .btn-quiet { flex: 1; }
}
</style>
