<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { PdfMode } from '~/utils/pdfCompress'

const { play } = useSound()

type Format = 'image/webp' | 'image/jpeg' | 'image/png'

interface Item {
  id: number
  kind: 'image' | 'pdf'
  file: File
  previewUrl: string // for a PDF, a picture of its first page
  pages?: number
  imagesChanged?: number
  errorText?: string
  width: number
  height: number
  status: 'loading' | 'compressing' | 'done' | 'error'
  progress: number // 0–1, drives the progress bar for the current stage
  output?: Blob
  outputUrl?: string
  outWidth?: number
  outHeight?: number
  run: number
}

const FORMATS: { value: Format, label: string, ext: string }[] = [
  { value: 'image/webp', label: 'WebP', ext: 'webp' },
  { value: 'image/jpeg', label: 'JPEG', ext: 'jpg' },
  { value: 'image/png', label: 'PNG', ext: 'png' }
]

// PDF settings (only shown once a PDF is added)
const pdfMode = ref<PdfMode>('keep-text')
const pdfDpi = ref(150)
const pdfMaxPx = ref(2000)

const quality = ref(75)
const format = ref<Format>('image/webp')
const maxWidth = ref(0) // 0 = keep original size
const items = ref<Item[]>([])
const dragging = ref(false)
let nextId = 0

const hasPdf = computed(() => items.value.some(i => i.kind === 'pdf'))
const hasImage = computed(() => items.value.some(i => i.kind === 'image'))

const busy = computed(() => items.value.filter(i => i.status === 'loading' || i.status === 'compressing').length)

// One "complete" sound when a whole batch finishes, instead of one per image
watch(busy, (now, before) => {
  if (!before || now || !items.value.some(i => i.status === 'done')) return
  play('complete')
  const t = totals.value
  toast.success(`${t.count} ${t.count === 1 ? 'file' : 'files'} ready`, {
    description: t.saved >= 0 ? `${Math.round(t.saved * 100)}% smaller in total` : `${Math.abs(Math.round(t.saved * 100))}% larger in total. Try a lower quality.`
  })
})

// ---------- Before/after comparison ----------
const compareId = ref<number>()
const comparePos = ref(50) // % of the width showing the original
const compareItem = computed(() => {
  // The before/after slider is for pictures; a PDF's pages can't be overlaid like that
  const done = items.value.filter(i => i.kind === 'image' && i.status === 'done' && i.outputUrl)
  return done.find(i => i.id === compareId.value) ?? done[0]
})

// Press and drag anywhere on the image to move the divider
let comparing = false
function comparePointer(e: PointerEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  comparePos.value = Math.min(Math.max(((e.clientX - rect.left) / rect.width) * 100, 0), 100)
}
function onCompareDown(e: PointerEvent) {
  comparing = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  comparePointer(e)
}
function onCompareMove(e: PointerEvent) {
  if (comparing) comparePointer(e)
}
function onCompareUp() {
  comparing = false
}

function compare(item: Item) {
  if (item.status !== 'done' || item.kind !== 'image') return
  compareId.value = item.id
  play('select')
}

const totals = computed(() => {
  const done = items.value.filter(i => i.output)
  const before = done.reduce((n, i) => n + i.file.size, 0)
  const after = done.reduce((n, i) => n + i.output!.size, 0)
  return { count: done.length, before, after, saved: before ? 1 - after / before : 0 }
})

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(2)} MB`
}

function savedLabel(item: Item) {
  const ratio = 1 - item.output!.size / item.file.size
  return ratio >= 0 ? `−${Math.round(ratio * 100)}%` : `+${Math.round(-ratio * 100)}%`
}

// ---------- Staged progress ----------
// The real work takes milliseconds, so each stage runs for a short minimum time with a progress bar.
// The compress bar holds at 90% until encoding actually finishes, so it never claims to be done early.

const LOAD_MIN_MS = 500
const LOAD_MAX_MS = 1600
const LOAD_BYTES_PER_MS = 4000 // ~4 MB/s, so bigger files take visibly longer
const COMPRESS_MS = 900
const RECOMPRESS_MS = 450

let reducedMotion = false
onMounted(() => {
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
})

// Animate item.progress to `to`; stops early if a newer run has taken over the item
function tween(item: Item, run: number, to: number, ms: number) {
  return new Promise<void>((resolve) => {
    if (reducedMotion) {
      item.progress = to
      return resolve()
    }
    const from = item.progress
    const start = performance.now()
    const step = (now: number) => {
      if (run !== item.run) return resolve()
      const t = Math.min((now - start) / ms, 1)
      item.progress = from + (to - from) * (1 - (1 - t) ** 3)
      if (t < 1) requestAnimationFrame(step)
      else resolve()
    }
    requestAnimationFrame(step)
  })
}

async function encode(item: Item) {
  const bitmap = await createImageBitmap(item.file)
  const scale = maxWidth.value && bitmap.width > maxWidth.value ? maxWidth.value / bitmap.width : 1
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  // JPEG has no transparency: paint white instead of letting it turn black
  if (format.value === 'image/jpeg') {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
  }
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const blob = await new Promise<Blob | null>(resolve =>
  canvas.toBlob(resolve, format.value, quality.value / 100)
  )
  if (!blob) throw new Error('Encoding failed')
  return { blob, w, h }
}

async function encodePdf(item: Item, run: number) {
  const bytes = new Uint8Array(await item.file.arrayBuffer())
  const result = await compressPdf(
    bytes,
    { mode: pdfMode.value, quality: quality.value / 100, dpi: pdfDpi.value, maxPx: pdfMaxPx.value },
    // Real progress, page by page or photo by photo
    (p) => {
      if (run === item.run) item.progress = Math.max(item.progress, p * 0.95)
    }
  )
  item.pages = result.pages
  item.imagesChanged = result.imagesChanged
  return { blob: new Blob([result.bytes], { type: 'application/pdf' }), w: item.width, h: item.height }
}

async function compress(item: Item, { initial = false } = {}) {
  const run = ++item.run
  try {
    if (initial) {
      item.status = 'loading'
      item.progress = 0
      const ms = Math.min(LOAD_MIN_MS + item.file.size / LOAD_BYTES_PER_MS, LOAD_MAX_MS)
      await tween(item, run, 1, ms)
      if (run !== item.run) return
    }

    item.status = 'compressing'
    item.progress = 0
    const [out] = item.kind === 'pdf'
      ? [await encodePdf(item, run)]
      : await Promise.all([encode(item), tween(item, run, 0.9, initial ? COMPRESS_MS : RECOMPRESS_MS)])
    if (run !== item.run) return // settings changed mid-way; a newer run owns this item
    await tween(item, run, 1, 150)
    if (run !== item.run) return

    if (item.outputUrl) URL.revokeObjectURL(item.outputUrl)
    item.output = out.blob
    item.outputUrl = URL.createObjectURL(out.blob)
    item.outWidth = out.w
    item.outHeight = out.h
    item.status = 'done'
  } catch (e) {
    if (run !== item.run) return
    item.status = 'error'
    const message = e instanceof Error ? `${e.name} ${e.message}` : ''
    item.errorText = item.kind === 'pdf'
      ? /encrypt|password/i.test(message) ? 'This PDF is password-protected, so it can’t be changed' : 'This PDF couldn’t be read'
      : 'This file couldn’t be read as an image'
  }
}

async function addFiles(files: FileList | File[]) {
  const accepted = [...files].filter(f => f.type.startsWith('image/') || isPdf(f))
  if (accepted.length < files.length) {
    toast.warning('Some files were skipped because they aren’t images or PDFs')
    play('warning')
  }
  if (accepted.length) play('drop')

  for (const file of accepted) {
    if (isPdf(file)) {
      addPdf(file)
      continue
    }
    const item = reactive<Item>({
      id: nextId++,
      kind: 'image',
      file,
      previewUrl: URL.createObjectURL(file),
      width: 0,
      height: 0,
      status: 'loading',
      progress: 0,
      run: 0
    })
    const img = new Image()
    img.onload = () => {
      item.width = img.naturalWidth
      item.height = img.naturalHeight
    }
    img.src = item.previewUrl
    items.value.push(item)
    compress(item, { initial: true })
  }
}

function addPdf(file: File) {
  const item = reactive<Item>({
    id: nextId++,
    kind: 'pdf',
    file,
    previewUrl: '',
    width: 0,
    height: 0,
    status: 'loading',
    progress: 0,
    run: 0
  })
  items.value.push(item)
  // A picture of the first page for the list; failing that, the file still compresses
  file.arrayBuffer()
    .then(buf => pdfThumbnail(new Uint8Array(buf)))
    .then((thumb) => {
      if (thumb.blob) item.previewUrl = URL.createObjectURL(thumb.blob)
      item.pages = thumb.pages
      item.width = thumb.width
      item.height = thumb.height
    })
    .catch(() => {})
  compress(item, { initial: true })
}

// Re-encode when the settings change (debounced while dragging the slider).
// Image-only settings leave PDFs alone and PDF-only settings leave images alone.
let timer: ReturnType<typeof setTimeout> | undefined
function recompress(kind?: Item['kind']) {
  clearTimeout(timer)
  timer = setTimeout(() => items.value.filter(i => !kind || i.kind === kind).forEach(item => compress(item)), 200)
}
watch(quality, () => recompress())
watch([format, maxWidth], () => recompress('image'))
watch([pdfMode, pdfDpi, pdfMaxPx], () => recompress('pdf'))

function onDrop(e: DragEvent) {
  dragging.value = false
  if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files)
}

// Three sample files drawn in the browser: a photo, a screenshot and a PDF brochure
const loadingDemo = ref(false)
async function tryDemo() {
  if (loadingDemo.value) return
  loadingDemo.value = true
  play('press')
  try {
    await addFiles(await makeDemoFiles())
  } catch {
    toast.error('Couldn’t make the example files')
    play('error')
  } finally {
    loadingDemo.value = false
  }
}

function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) addFiles(input.files)
  input.value = ''
}

function outputName(item: Item) {
  const ext = item.kind === 'pdf' ? 'pdf' : FORMATS.find(f => f.value === format.value)!.ext
  return `${item.file.name.replace(/\.[^.]+$/, '')}-compressed.${ext}`
}

function saveFile(item: Item) {
  const a = document.createElement('a')
  a.href = item.outputUrl!
  a.download = outputName(item)
  a.click()
}

function download(item: Item) {
  saveFile(item)
  play('success')
}

async function downloadAll() {
  play('success')
  for (const item of items.value.filter(i => i.output)) {
    saveFile(item)
    // Browsers block rapid-fire downloads; space them out a little
    await new Promise(r => setTimeout(r, 250))
  }
}

function remove(item: Item) {
  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
  if (item.outputUrl) URL.revokeObjectURL(item.outputUrl)
  items.value = items.value.filter(i => i !== item)
}

function removeOne(item: Item) {
  remove(item)
  play('delete')
}

function clearAll() {
  ;[...items.value].forEach(remove)
}

function clearAllWithSound() {
  clearAll()
  play('delete')
}

onBeforeUnmount(clearAll)
</script>

<template>
  <ToolPage header="bar">
    <div class="top">
    <Step :n="1" title="Add images or PDFs" class="fill">
    <div class="drop-wrap">
    <label
      class="drop"
      :class="{ dragging }"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <input type="file" accept="image/*,application/pdf,.pdf" multiple @change="onPick">
      <span class="drop-icon" aria-hidden="true">⇲</span>
      <strong>Drop images or PDFs here, or choose files</strong>
      <span>JPEG, PNG, WebP, PDF and more. Your files stay on this device.</span>
    </label>
    <!-- Outside the label so it isn't read as part of the file picker, but shown inside the drop box -->
    <button type="button" class="btn btn-quiet btn-sm demo" :disabled="loadingDemo" @click="tryDemo">
      {{ loadingDemo ? 'Making example files…' : 'No files handy? Try 3 example files' }}
    </button>
    </div>
    </Step>

    <Step :n="2" title="Adjust the settings" hint="Changes apply to every file right away." class="fill">
    <section class="panel settings">
      <label class="field">
        <span class="field-head">Quality <output>{{ format === 'image/png' && !hasPdf ? 'Lossless' : `${quality}%` }}</output></span>
        <input v-model.number="quality" type="range" min="10" max="100" step="1" :disabled="format === 'image/png' && !hasPdf">
      </label>

      <div class="field">
        <span class="field-head">Save as</span>
        <div class="segmented" role="radiogroup" aria-label="Save as">
          <label v-for="f in FORMATS" :key="f.value" :class="{ active: format === f.value }">
            <input v-model="format" type="radio" name="format" :value="f.value">
            {{ f.label }}
          </label>
        </div>
      </div>

      <label class="field">
        <span class="field-head">Max width</span>
        <AppSelect v-model="maxWidth" aria-label="Max width" :options="[{ value: 0, label: 'Keep original size' }, { value: 3840, label: '3840 px (4K)' }, { value: 2560, label: '2560 px' }, { value: 1920, label: '1920 px (Full HD)' }, { value: 1280, label: '1280 px' }, { value: 800, label: '800 px' }]" />
      </label>

      <p v-if="format === 'image/png' && hasImage" class="hint">PNG keeps every pixel, so images only get smaller if you lower the max width.</p>

      <!-- PDF settings: only once a PDF is added -->
      <div v-if="hasPdf" class="pdf-settings">
        <h3>PDFs</h3>
        <div class="segmented" role="radiogroup" aria-label="How to compress PDFs">
          <label :class="{ active: pdfMode === 'keep-text' }">
            <input v-model="pdfMode" type="radio" name="pdf-mode" value="keep-text">
            Keep text sharp
          </label>
          <label :class="{ active: pdfMode === 'raster' }">
            <input v-model="pdfMode" type="radio" name="pdf-mode" value="raster">
            Smallest file
          </label>
        </div>
        <label v-if="pdfMode === 'keep-text'" class="field">
          <span class="field-head">Photos inside, longest side</span>
          <AppSelect v-model="pdfMaxPx" aria-label="Photos inside, longest side" :options="[{ value: 0, label: 'Keep original size' }, { value: 2400, label: '2400 px (print)' }, { value: 2000, label: '2000 px' }, { value: 1500, label: '1500 px (screen)' }, { value: 1000, label: '1000 px (smallest)' }]" />
        </label>
        <label v-else class="field">
          <span class="field-head">Page sharpness</span>
          <AppSelect v-model="pdfDpi" aria-label="Page sharpness" :options="[{ value: 200, label: 'Sharp · 200 dpi' }, { value: 150, label: 'Clear · 150 dpi' }, { value: 110, label: 'Smaller · 110 dpi' }, { value: 80, label: 'Smallest · 80 dpi' }]" />
        </label>
        <p class="hint">
          <template v-if="pdfMode === 'keep-text'">Text stays sharp and selectable; only the photos inside get smaller. Best for documents.</template>
          <template v-else>Each page becomes a picture: the smallest files, ideal for scans. Text can no longer be selected or searched.</template>
        </p>
      </div>
    </section>
    </Step>
    </div>

    <Step :n="3" title="Download" class="results">
    <p v-if="!items.length" class="waiting">Your compressed files show up here, ready to download.</p>
    <template v-else>
      <!-- Drag the handle to compare the original (left) with the compressed image (right) -->
      <figure v-if="compareItem" class="compare">
        <div
          class="compare-frame"
          @pointerdown="onCompareDown"
          @pointermove="onCompareMove"
          @pointerup="onCompareUp"
          @pointercancel="onCompareUp"
          :style="{ '--pos': `${comparePos}%`, aspectRatio: compareItem.width && compareItem.height ? `${compareItem.width} / ${compareItem.height}` : '4 / 3' }">
          <img :src="compareItem.outputUrl" alt="" class="after" draggable="false">
          <img :src="compareItem.previewUrl" alt="" class="before" draggable="false">
          <span class="divider" aria-hidden="true"><span class="handle" /></span>
          <span class="tag-left">Original · {{ formatBytes(compareItem.file.size) }}</span>
          <span class="tag-right">Compressed · {{ formatBytes(compareItem.output!.size) }}</span>
          <input
            v-model.number="comparePos"
            type="range"
            min="0"
            max="100"
            step="0.5"
            class="compare-range"
            :aria-label="`Compare original and compressed ${compareItem.file.name}`"
          >
        </div>
        <figcaption>{{ compareItem.file.name }} — drag to compare. Click any image below to compare it.</figcaption>
      </figure>

      <div class="summary">
        <p v-if="busy" class="busy" role="status">
          Compressing… {{ items.length - busy }} of {{ items.length }} done
        </p>
        <p v-else-if="totals.count">
          <strong>{{ formatBytes(totals.before) }} to {{ formatBytes(totals.after) }}</strong>
          <span :class="totals.saved >= 0 ? 'good' : 'warn'">
            {{ totals.saved >= 0 ? `${Math.round(totals.saved * 100)}% smaller` : `${Math.abs(Math.round(totals.saved * 100))}% larger` }}
          </span>
        </p>
        <div class="summary-actions">
          <button type="button" class="btn btn-quiet btn-sm" @click="clearAllWithSound">Clear all</button>
          <button type="button" class="btn btn-sm" :disabled="!totals.count" @click="downloadAll">Download all</button>
        </div>
      </div>

      <ul class="list">
        <li v-for="item in items" :key="item.id" class="item">
          <div
            class="thumb"
            :class="[item.status, item.kind, { comparing: compareItem?.id === item.id }]"
            :role="item.status === 'done' && item.kind === 'image' ? 'button' : undefined"
            :tabindex="item.status === 'done' && item.kind === 'image' ? 0 : undefined"
            :aria-label="item.status === 'done' && item.kind === 'image' ? `Compare ${item.file.name}` : undefined"
            @click="compare(item)"
            @keydown.enter="compare(item)"
          >
            <img v-if="item.kind === 'image'" :src="item.outputUrl ?? item.previewUrl" :alt="item.file.name">
            <img v-else-if="item.previewUrl" :src="item.previewUrl" :alt="`First page of ${item.file.name}`">
            <span v-if="item.kind === 'pdf'" class="pdf-badge">PDF</span>
            <Transition name="fade">
              <div v-if="item.status === 'loading' || item.status === 'compressing'" class="stage">
                <span class="stage-label">{{ item.status === 'loading' ? 'Loading' : 'Compressing' }}</span>
                <div
                  class="bar"
                  role="progressbar"
                  :aria-label="`${item.status === 'loading' ? 'Loading' : 'Compressing'} ${item.file.name}`"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  :aria-valuenow="Math.round(item.progress * 100)"
                >
                  <span :style="{ transform: `scaleX(${item.progress})` }" />
                </div>
              </div>
            </Transition>
          </div>
          <div class="info">
            <p class="name" :title="item.file.name">{{ item.file.name }}</p>
            <p class="meta">
              {{ formatBytes(item.file.size) }}
              <template v-if="item.status === 'done'">
                to <strong>{{ formatBytes(item.output!.size) }}</strong>
                <span :class="item.output!.size <= item.file.size ? 'good' : 'warn'">{{ savedLabel(item) }}</span>
              </template>
              <span v-else-if="item.status === 'loading'" class="muted">Loading {{ Math.round(item.progress * 100) }}%</span>
              <span v-else-if="item.status === 'compressing'" class="muted">Compressing {{ Math.round(item.progress * 100) }}%</span>
              <span v-else class="warn">{{ item.errorText ?? 'This file couldn’t be read' }}</span>
            </p>
            <p v-if="item.kind === 'pdf' && item.pages" class="meta muted">
              {{ item.pages }} {{ item.pages === 1 ? 'page' : 'pages' }}<template v-if="item.status === 'done' && pdfMode === 'keep-text'"> · {{ item.imagesChanged ? `${item.imagesChanged} ${item.imagesChanged === 1 ? 'photo' : 'photos'} made smaller` : 'no photos to shrink' }}</template><template v-else-if="item.status === 'done'"> · pages redrawn at {{ pdfDpi }} dpi</template>
            </p>
            <p v-else-if="item.outWidth" class="meta muted">
              {{ item.width }} × {{ item.height }}<template v-if="item.outWidth !== item.width"> to {{ item.outWidth }} × {{ item.outHeight }}</template>
            </p>
          </div>
          <div class="item-actions">
            <button type="button" class="btn btn-quiet btn-sm" :disabled="item.status !== 'done'" @click="download(item)">Download</button>
            <button type="button" class="btn btn-quiet btn-sm remove" :aria-label="`Remove ${item.file.name}`" @click="removeOne(item)">✕</button>
          </div>
        </li>
      </ul>
    </template>
    </Step>
  </ToolPage>
</template>

<style scoped>
.top {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(300px, 1fr);
  gap: 2rem 2.5rem;
  align-items: stretch;
}

/* Let the drop area and the settings panel fill their step, so both columns line up */
.fill {
  display: flex;
  flex-direction: column;
}

.fill > .drop-wrap,
.fill > .settings {
  flex: 1;
}

.drop-wrap {
  position: relative;
  display: flex;
}

.drop-wrap > .drop {
  flex: 1;
  padding-bottom: 5rem;
}

.waiting {
  margin: 0;
  padding: 2rem 1.5rem;
  text-align: center;
  color: var(--ink-3);
  border: 2px dashed var(--line);
  border-radius: 20px;
}

.drop {
  position: relative;
  justify-content: center;
  min-height: 18rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 2.75rem 1.25rem;
  text-align: center;
  background: var(--surface);
  border: 2px dashed var(--line);
  border-radius: 20px;
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s;
}

.drop:hover,
.drop.dragging {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, var(--surface));
}

.drop:has(input:focus-visible) {
  outline: 3px solid color-mix(in srgb, var(--accent) 55%, transparent);
  outline-offset: 2px;
}

.demo {
  position: absolute;
  left: 50%;
  bottom: 1.75rem;
  translate: -50% 0;
  white-space: nowrap;
}

.drop input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}

.drop-icon {
  width: 3rem;
  height: 3rem;
  margin-bottom: 0.75rem;
  display: grid;
  place-items: center;
  font-size: 1.4rem;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
  border-radius: 50%;
  transition: transform 0.2s;
}

.drop.dragging .drop-icon {
  transform: scale(1.12);
}

.drop strong {
  font-size: 1.1rem;
}

.drop > span:last-child {
  font-size: 0.9rem;
  color: var(--ink-2);
}

.settings {
  padding: 1.4rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1.25rem;
}

.hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--ink-3);
}

.pdf-settings {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid var(--line);
}

.pdf-settings h3 {
  font-size: 0.95rem;
}

.pdf-settings .segmented label {
  white-space: nowrap;
}

.results {
  margin-top: 2.5rem;
}

.summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.summary p {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  align-items: baseline;
  font-variant-numeric: tabular-nums;
}

.summary-actions {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
}

.list {
  list-style: none;
  margin: 0.9rem 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr));
  gap: 0.75rem;
}

.item {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 18px;
}

/* Before/after: the original sits on top, clipped to the left of the handle */
.compare {
  margin: 0 0 1.5rem;
}

.compare-frame {
  position: relative;
  max-height: 70vh;
  margin: 0 auto;
  overflow: hidden;
  border-radius: 18px;
  background: repeating-conic-gradient(var(--checker-a) 0 25%, var(--checker-b) 0 50%) 0 0 / 16px 16px;
  box-shadow: 0 10px 30px -12px rgb(var(--shadow) / 0.35);
  user-select: none;
}

.compare-frame img {
  /* Not draggable: the browser's own image drag would cancel the divider drag */
  pointer-events: none;
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.before {
  clip-path: inset(0 calc(100% - var(--pos)) 0 0);
}

.divider {
  position: absolute;
  top: 0;
  bottom: 0;
  left: var(--pos);
  width: 2px;
  margin-left: -1px;
  background: #fff;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 0.15);
  pointer-events: none;
}

.handle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2.5rem;
  height: 2.5rem;
  margin: -1.25rem 0 0 -1.25rem;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 10px rgb(0 0 0 / 0.3);
}

/* Two small arrows inside the handle */
.handle::before,
.handle::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 0;
  height: 0;
  margin-top: -5px;
  border: 5px solid transparent;
}

.handle::before { left: 7px; border-right-color: var(--accent); }
.handle::after { right: 7px; border-left-color: var(--accent); }

.tag-left,
.tag-right {
  position: absolute;
  top: 0.75rem;
  padding: 0.25rem 0.6rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: #fff;
  background: rgb(0 0 0 / 0.55);
  border-radius: 999px;
  backdrop-filter: blur(6px);
  pointer-events: none;
  font-variant-numeric: tabular-nums;
}

.tag-left { left: 0.75rem; }
.tag-right { right: 0.75rem; background: color-mix(in srgb, var(--accent) 85%, #000); }

/* Hidden range input: gives keyboard and screen-reader control; pointer dragging is handled on the frame */
.compare-range {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  pointer-events: none;
}

.compare-frame {
  cursor: ew-resize;
  touch-action: pan-y;
}

.compare-frame:has(.compare-range:focus-visible) {
  outline: 3px solid color-mix(in srgb, var(--accent) 55%, transparent);
  outline-offset: 3px;
}

.compare figcaption {
  margin-top: 0.6rem;
  font-size: 0.85rem;
  color: var(--ink-2);
  text-align: center;
}

.thumb.done {
  cursor: zoom-in;
}

/* PDFs can't be compared on the slider, so no zoom cursor; show the first page from the top */
.thumb.pdf {
  cursor: default;
  min-height: 4rem;
  background: var(--surface-2);
}

.thumb.pdf img {
  object-position: top;
  background: #fff;
}

.pdf-badge {
  position: absolute;
  left: 0.4rem;
  bottom: 0.4rem;
  padding: 0.1rem 0.4rem;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: #fff;
  background: #c4271f;
  border-radius: 5px;
}

.thumb.comparing {
  box-shadow: 0 0 0 3px var(--accent);
}

.thumb {
  position: relative;
  border-radius: 11px;
  overflow: hidden;
}

.thumb img {
  display: block;
  width: 100%;
  transition: filter 0.3s, opacity 0.3s;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 11px;
  outline: 1px solid rgb(var(--shadow) / 0.1);
  outline-offset: -1px;
  background: repeating-conic-gradient(var(--checker-a) 0 25%, var(--checker-b) 0 50%) 0 0 / 12px 12px;
}

/* Dim and soften the picture while it's being worked on */
.thumb.loading img,
.thumb.compressing img {
  filter: blur(2px) saturate(0.6);
  opacity: 0.55;
}

.stage {
  position: absolute;
  inset: auto 0.75rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.6rem 0.7rem;
  background: rgb(var(--shadow) / 0.55);
  border-radius: 10px;
  backdrop-filter: blur(6px);
}

.stage-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: #fff;
}

.bar {
  height: 0.35rem;
  overflow: hidden;
  background: rgb(255 255 255 / 0.25);
  border-radius: 999px;
}

.bar span {
  display: block;
  height: 100%;
  background: var(--accent);
  border-radius: inherit;
  transform-origin: left;
}

.fade-leave-active {
  transition: opacity 0.25s;
}

.fade-leave-to {
  opacity: 0;
}

.busy {
  color: var(--ink-2);
  font-weight: 600;
}

.info {
  flex: 1;
  min-width: 0;
}

.info p {
  margin: 0;
}

.name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta {
  font-size: 0.875rem;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}

.meta .good,
.meta .warn {
  margin-left: 0.35rem;
}

.muted { color: var(--ink-3); }
.good { color: var(--good-ink); font-weight: 600; }
.warn { color: var(--warn-ink); font-weight: 600; }

.item-actions {
  display: flex;
  gap: 0.4rem;
  margin-top: auto;
}

.item-actions .btn:first-child {
  flex: 1;
}

.remove {
  width: 2.1rem;
  padding: 0;
}

@media (max-width: 820px) {
  .top { grid-template-columns: minmax(0, 1fr); }
  .drop { min-height: 0; }
}
</style>
