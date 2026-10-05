<script setup lang="ts">
import { toast } from 'vue-sonner'

const { play } = useSound()

type Format = 'image/webp' | 'image/jpeg' | 'image/png'

interface Item {
  id: number
  file: File
  previewUrl: string
  width: number
  height: number
  status: 'working' | 'done' | 'error'
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

const quality = ref(75)
const format = ref<Format>('image/webp')
const maxWidth = ref(0) // 0 = keep original size
const items = ref<Item[]>([])
const dragging = ref(false)
let nextId = 0

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

async function compress(item: Item) {
  const run = ++item.run
  item.status = 'working'
  try {
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
    if (run !== item.run) return // settings changed mid-way; a newer run owns this item

    if (item.outputUrl) URL.revokeObjectURL(item.outputUrl)
    item.output = blob
    item.outputUrl = URL.createObjectURL(blob)
    item.outWidth = w
    item.outHeight = h
    item.status = 'done'
  } catch {
    if (run === item.run) item.status = 'error'
  }
}

async function addFiles(files: FileList | File[]) {
  const images = [...files].filter(f => f.type.startsWith('image/'))
  if (images.length < files.length) {
    toast.warning('Some files were skipped because they aren’t images')
    play('warning')
  }
  if (images.length) play('drop')

  for (const file of images) {
    const item = reactive<Item>({
      id: nextId++,
      file,
      previewUrl: URL.createObjectURL(file),
      width: 0,
      height: 0,
      status: 'working',
      run: 0
    })
    const img = new Image()
    img.onload = () => {
      item.width = img.naturalWidth
      item.height = img.naturalHeight
    }
    img.src = item.previewUrl
    items.value.push(item)
    compress(item)
  }
}

// Re-encode everything when the settings change (debounced while dragging the slider)
let timer: ReturnType<typeof setTimeout> | undefined
watch([quality, format, maxWidth], () => {
  clearTimeout(timer)
  timer = setTimeout(() => items.value.forEach(compress), 200)
})

function onDrop(e: DragEvent) {
  dragging.value = false
  if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files)
}

function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) addFiles(input.files)
  input.value = ''
}

function outputName(item: Item) {
  const ext = FORMATS.find(f => f.value === format.value)!.ext
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
  URL.revokeObjectURL(item.previewUrl)
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
  <ToolPage>
    <div class="top">
    <Step :n="1" title="Add images" class="fill">
    <label
      class="drop"
      :class="{ dragging }"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <input type="file" accept="image/*" multiple @change="onPick">
      <span class="drop-icon" aria-hidden="true">⇲</span>
      <strong>Drop images here, or choose files</strong>
      <span>JPEG, PNG, WebP and more. Your images stay on this device.</span>
    </label>
    </Step>

    <Step :n="2" title="Adjust the settings" hint="Changes apply to every image right away." class="fill">
    <section class="panel settings">
      <label class="field">
        <span class="field-head">Quality <output>{{ format === 'image/png' ? 'Lossless' : `${quality}%` }}</output></span>
        <input v-model.number="quality" type="range" min="10" max="100" step="1" :disabled="format === 'image/png'">
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
        <select v-model.number="maxWidth" class="input">
          <option :value="0">Keep original size</option>
          <option :value="3840">3840 px (4K)</option>
          <option :value="2560">2560 px</option>
          <option :value="1920">1920 px (Full HD)</option>
          <option :value="1280">1280 px</option>
          <option :value="800">800 px</option>
        </select>
      </label>

      <p v-if="format === 'image/png'" class="hint">PNG keeps every pixel, so it only gets smaller if you lower the max width.</p>
    </section>
    </Step>
    </div>

    <Step :n="3" title="Download" class="results">
    <p v-if="!items.length" class="waiting">Your compressed images show up here, ready to download.</p>
    <template v-else>
      <div class="summary">
        <p v-if="totals.count">
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
          <img :src="item.outputUrl ?? item.previewUrl" :alt="item.file.name">
          <div class="info">
            <p class="name" :title="item.file.name">{{ item.file.name }}</p>
            <p class="meta">
              {{ formatBytes(item.file.size) }}
              <template v-if="item.status === 'done'">
                to <strong>{{ formatBytes(item.output!.size) }}</strong>
                <span :class="item.output!.size <= item.file.size ? 'good' : 'warn'">{{ savedLabel(item) }}</span>
              </template>
              <span v-else-if="item.status === 'working'" class="muted">Compressing…</span>
              <span v-else class="warn">This file couldn’t be read as an image</span>
            </p>
            <p v-if="item.outWidth" class="meta muted">
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

.fill > .drop,
.fill > .settings {
  flex: 1;
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

.item img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 11px;
  outline: 1px solid rgb(var(--shadow) / 0.1);
  outline-offset: -1px;
  background: repeating-conic-gradient(var(--checker-a) 0 25%, var(--checker-b) 0 50%) 0 0 / 12px 12px;
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
  .top { grid-template-columns: 1fr; }
  .drop { min-height: 0; }
}
</style>
