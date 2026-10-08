<script setup lang="ts" generic="T extends { id: string }">
import { toast } from 'vue-sonner'
import type { CsvColumn } from '~/utils/transfer'

// Import & export for one app (CHECKLIST.md #18): CSV and JSON for every tracker, plus any format of
// the app's own (bookmarks keep their browser HTML file). Imports skip what's already there and can
// be undone. Files never leave the browser.
export interface ExtraFormat<V> {
  label: string
  ext: string
  mime: string
  /** File text for this format */
  write?: (items: V[]) => string
  /** Records from a file of this format */
  read?: (text: string) => Omit<V, 'id'>[]
}

const props = defineProps<{
  open: boolean
  /** Shown in the title and file names, e.g. "Renewals" */
  title: string
  collection: string
  app: string
  items: T[]
  columns: CsvColumn<T>[]
  /** A CSV row (headers lower-cased) to a record, or undefined to skip it */
  fromRow: (row: Record<string, string>) => Omit<T, 'id'> | undefined
  /** A JSON record to a record, or undefined to skip it */
  fromJson: (rec: Record<string, unknown>) => Omit<T, 'id'> | undefined
  /** What makes two records the same, so an import doesn't duplicate */
  sameAs: (item: Omit<T, 'id'>) => string
  addMany: (list: Omit<T, 'id'>[]) => T[]
  remove: (id: string, opts?: { undoAdd?: boolean }) => unknown
  extra?: ExtraFormat<T>[]
  /** Called with what was imported, e.g. to fetch site icons */
  onImported?: (added: T[]) => void
}>()
const emit = defineEmits<{ close: [] }>()
const { play } = useSound()
const fileInput = ref<HTMLInputElement>()
const slug = computed(() => props.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))

function exported(format: string) {
  logActivity('exported', props.app, `${props.items.length} ${props.title.toLowerCase()} as ${format}`)
  play('copy')
  toast.success(`${props.title} exported`, { description: `${props.items.length} ${props.items.length === 1 ? 'item' : 'items'} as ${format}.` })
}

function exportCSV() {
  downloadFile(dated(slug.value, 'csv'), toCSV(props.items, props.columns), 'text/csv;charset=utf-8')
  exported('CSV')
}

function exportJSON() {
  downloadFile(dated(slug.value, 'json'), toCollectionJSON(props.collection, props.items), 'application/json')
  exported('JSON')
}

function exportExtra(f: ExtraFormat<T>) {
  downloadFile(dated(slug.value, f.ext), f.write!(props.items), f.mime)
  exported(f.label)
}

const accept = computed(() => ['.csv', '.json', ...(props.extra ?? []).filter(f => f.read).map(f => `.${f.ext}`)].join(','))

async function importFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const text = await readTextFile(file)
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const own = props.extra?.find(f => f.read && (f.ext === ext || (ext === 'htm' && f.ext === 'html')))
    let found: Omit<T, 'id'>[]
    if (own) found = own.read!(text)
    else if (ext === 'json' || /^\s*[[{]/.test(text)) found = itemsFromJSON(text, props.collection).map(props.fromJson).filter((r): r is Omit<T, 'id'> => !!r)
    else found = parseCSV(text).map(props.fromRow).filter((r): r is Omit<T, 'id'> => !!r)

    if (!found.length) {
      play('error')
      toast.error('Nothing to import in that file', { description: `Use a CSV or JSON file exported from ${props.title}, or one with the same columns.` })
      return
    }
    const have = new Set(props.items.map(i => props.sameAs(i)))
    const fresh = found.filter((r) => {
      const k = props.sameAs(r)
      if (have.has(k)) return false
      have.add(k)
      return true
    })
    const added = fresh.length ? props.addMany(fresh) : []
    props.onImported?.(added)
    play(added.length ? 'success' : 'select')
    emit('close')
    const skipped = found.length - fresh.length
    toast.success(added.length ? `${added.length} imported` : 'Nothing new to import', {
      description: skipped ? `${skipped} you already had ${skipped === 1 ? 'was' : 'were'} skipped.` : undefined,
      action: added.length ? { label: 'Undo', onClick: () => added.forEach(r => props.remove(r.id, { undoAdd: true })) } : undefined
    })
  } catch (err) {
    play('error')
    toast.error('Couldn’t read that file', { description: err instanceof SyntaxError ? 'It isn’t valid JSON.' : err instanceof Error ? err.message : undefined })
  }
}
</script>

<template>
  <Modal :open="open" :title="`Import & export ${title.toLowerCase()}`" @close="emit('close')">
    <section class="part" aria-labelledby="tx-export">
      <h3 id="tx-export">Export</h3>
      <p class="note">{{ items.length }} {{ items.length === 1 ? 'item' : 'items' }}. CSV opens in Excel or Google Sheets; JSON keeps every detail for importing back.</p>
      <div class="buttons">
        <button type="button" class="btn btn-quiet" :disabled="!items.length" @click="exportCSV">CSV</button>
        <button type="button" class="btn btn-quiet" :disabled="!items.length" @click="exportJSON">JSON</button>
        <button v-for="f in (extra ?? []).filter(f => f.write)" :key="f.ext" type="button" class="btn btn-quiet" :disabled="!items.length" @click="exportExtra(f)">{{ f.label }}</button>
      </div>
    </section>
    <section class="part" aria-labelledby="tx-import">
      <h3 id="tx-import">Import</h3>
      <p class="note">
        A CSV or JSON file<template v-for="f in (extra ?? []).filter(f => f.read)" :key="f.ext">, or {{ f.label }}</template>.
        Anything you already have is skipped, and you can undo the import.
      </p>
      <div class="buttons">
        <button type="button" class="btn" @click="fileInput?.click()">Choose a file…</button>
        <input ref="fileInput" type="file" :accept="accept" hidden @change="importFile">
      </div>
    </section>
  </Modal>
</template>

<style scoped>
.part + .part {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--line);
}

h3 {
  font-size: 1rem;
}

.note {
  margin: 0.3rem 0 0;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.8rem;
}
</style>
