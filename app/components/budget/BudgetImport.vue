<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { BudgetTransaction, Draft } from '~/utils/budget/types'
import { IMPORT_FIELDS, checkImport, guessMapping, type ImportField } from '~/utils/budget/csv'
import { formatDay } from '~/utils/budget/dates'

// CSV import in three steps: pick a file, match its columns, check the preview, then import.
// Rows with problems are listed by row number and left out; rows you already have are skipped.
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const store = useBudget()
const { transactions, categories, settings, categoryById } = store
const { play } = useSound()

const fileName = ref('')
const headers = ref<string[]>([])
const rows = ref<Record<string, string>[]>([])
const mapping = reactive<Partial<Record<ImportField, string>>>({})
const dayFirst = ref(true)
const createMissing = ref(false)
const error = ref('')
const fileInput = ref<HTMLInputElement>()

watch(() => props.open, (open) => {
  if (open) reset()
})
function reset() {
  fileName.value = ''
  headers.value = []
  rows.value = []
  error.value = ''
  for (const k of Object.keys(mapping)) delete mapping[k as ImportField]
}

async function pick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  error.value = ''
  try {
    const text = await readTextFile(file, 10)
    const parsed = parseCSV(text)
    if (!parsed.length) throw new Error('That file has no rows under its header.')
    fileName.value = file.name
    rows.value = parsed
    headers.value = Object.keys(parsed[0]!)
    Object.assign(mapping, guessMapping(headers.value))
    play('open')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Couldn’t read that file.'
    play('error')
  }
}

const columnOptions = computed(() => [{ value: '', label: '— Not in this file —' }, ...headers.value.map(h => ({ value: h, label: h }))])
const fieldModel = (f: ImportField) => computed({ get: () => mapping[f] ?? '', set: (v: string) => (v ? (mapping[f] = v) : delete mapping[f]) })
const models = Object.fromEntries(IMPORT_FIELDS.map(f => [f.value, fieldModel(f.value)])) as Record<ImportField, ReturnType<typeof fieldModel>>
const missingRequired = computed(() => IMPORT_FIELDS.filter(f => f.required && !mapping[f.value]).map(f => f.label))

const checked = computed(() => (missingRequired.value.length || !rows.value.length
  ? []
  : checkImport(rows.value, {
      mapping, dayFirst: dayFirst.value, createMissing: createMissing.value, defaultCurrency: settings.value.primaryCurrency,
      categories: categories.items.value, methods: settings.value.methods, existing: transactions.items.value
    })))
const ok = computed(() => checked.value.filter(r => r.record && !r.duplicate))
const dupes = computed(() => checked.value.filter(r => r.duplicate))
const bad = computed(() => checked.value.filter(r => r.errors.length))
const creates = computed(() => [...new Set(ok.value.flatMap(r => r.creates))])

const busy = ref(false)
function runImport() {
  if (busy.value || !ok.value.length) return
  busy.value = true
  // Create the categories the file needs, then swap their placeholder ids for real ones
  const made = new Map<string, string>()
  const madeCats: string[] = []
  const resolve = (id: string) => {
    if (!id.startsWith('new:')) return id
    if (made.has(id)) return made.get(id)!
    const [, kind, parentName, subName] = id.split(':') as [string, 'expense' | 'income', string, string | undefined]
    let parentId = categories.items.value.find(c => !c.parentId && c.kind === kind && c.name.toLowerCase() === parentName.toLowerCase())?.id
    if (!parentId) {
      const c = categories.add({ kind, name: parentName, parentId: null, icon: kind === 'income' ? '➕' : '🧾', color: 'gray', order: categories.items.value.length })
      parentId = c.id
      madeCats.push(c.id)
      made.set(`new:${kind}:${parentName}`, c.id)
    }
    if (!subName) return parentId
    const parent = categoryById.value.get(parentId)
    const s = categories.add({ kind, name: subName, parentId, icon: parent?.icon ?? '🧾', color: parent?.color ?? 'gray', order: 99 })
    madeCats.push(s.id)
    made.set(id, s.id)
    return s.id
  }
  const records: Draft<BudgetTransaction>[] = ok.value.map(r => ({ ...r.record!, categoryId: resolve(r.record!.categoryId), subcategoryId: resolve(r.record!.subcategoryId) }))
  const added = transactions.addMany(records)
  play('success')
  toast.success(`Imported ${added.length} ${added.length === 1 ? 'transaction' : 'transactions'}`, {
    description: [dupes.value.length && `${dupes.value.length} you already had were skipped`, bad.value.length && `${bad.value.length} with problems were left out`].filter(Boolean).join('. ') || undefined,
    action: {
      label: 'Undo',
      onClick: () => {
        for (const t of added) transactions.remove(t.id, { undoAdd: true })
        for (const id of madeCats) categories.remove(id, { undoAdd: true })
      }
    },
    duration: 10_000
  })
  busy.value = false
  emit('close')
}

const name = (id: string) => (id.startsWith('new:') ? `${id.split(':').slice(2).join(' › ')} (new)` : categoryById.value.get(id)?.name ?? '')
</script>

<template>
  <Modal :open="open" title="Import transactions from CSV" wide @close="emit('close')">
    <div class="import">
      <section v-if="!rows.length" class="pick">
        <p>Pick a CSV file from a spreadsheet or another app. It needs a header row and, at least, a date, an amount and a category on each row. You’ll see a preview before anything is saved.</p>
        <input ref="fileInput" type="file" accept=".csv,text/csv" class="file" aria-label="CSV file" @change="pick">
        <button type="button" class="btn" @click="fileInput?.click()">Choose a CSV file</button>
        <p v-if="error" class="err" role="alert">{{ error }}</p>
        <p class="b-muted">Files are read in this browser and never uploaded. For a full backup of the budget app, use Import &amp; export in this app’s settings (the gear).</p>
      </section>

      <template v-else>
        <p class="b-muted">{{ fileName }} · {{ rows.length }} {{ rows.length === 1 ? 'row' : 'rows' }} <button type="button" class="link" @click="reset">Choose another file</button></p>

        <section aria-labelledby="map-h">
          <h3 id="map-h">Match the columns</h3>
          <div class="map">
            <label v-for="f in IMPORT_FIELDS" :key="f.value" class="field">
              <span class="field-head">{{ f.label }}<span v-if="f.required" class="req" aria-label="required">*</span></span>
              <AppSelect v-model="models[f.value].value" :aria-label="`Column for ${f.label}`" :options="columnOptions" />
            </label>
          </div>
          <div class="opts">
            <SettingRow v-model="dayFirst" title="Dates are day first" description="12/10/2026 means 12 October. Turn off for 10 December." />
            <SettingRow v-model="createMissing" title="Create categories that don’t exist yet" description="Otherwise rows with unknown categories are left out." />
          </div>
        </section>

        <p v-if="missingRequired.length" class="err" role="alert">Choose a column for {{ missingRequired.join(', ') }}.</p>

        <section v-else aria-labelledby="pre-h">
          <h3 id="pre-h">Preview</h3>
          <ul class="summary">
            <li><strong>{{ ok.length }}</strong> will be imported</li>
            <li v-if="dupes.length"><strong>{{ dupes.length }}</strong> already there, skipped</li>
            <li v-if="bad.length" class="bad-li"><strong>{{ bad.length }}</strong> with problems, left out</li>
            <li v-if="creates.length"><strong>{{ creates.length }}</strong> new {{ creates.length === 1 ? 'category' : 'categories' }}: {{ creates.join(', ') }}</li>
          </ul>
          <p class="b-muted">Duplicates are rows with the same date, type, amount, currency, category and note as one you already have, or as an earlier row in this file.</p>

          <details v-if="bad.length" open class="problems">
            <summary>Rows with problems</summary>
            <ul>
              <li v-for="r in bad.slice(0, 50)" :key="r.line">Row {{ r.line }}: {{ r.errors.join('; ') }}</li>
              <li v-if="bad.length > 50">…and {{ bad.length - 50 }} more</li>
            </ul>
          </details>

          <div class="table-wrap">
            <table>
              <thead><tr><th>Row</th><th>Date</th><th>Category</th><th>Note</th><th class="r">Amount</th><th>Status</th></tr></thead>
              <tbody>
                <tr v-for="r in checked.slice(0, 40)" :key="r.line" :class="{ dim: !r.record || r.duplicate }">
                  <td>{{ r.line }}</td>
                  <td>{{ r.record ? formatDay(r.record.date, { day: 'numeric', month: 'short', year: 'numeric' }) : '—' }}</td>
                  <td>{{ r.record ? [name(r.record.categoryId), name(r.record.subcategoryId)].filter(Boolean).join(' › ') : '—' }}</td>
                  <td>{{ r.record?.note }}</td>
                  <td class="r b-num">{{ r.record ? `${r.record.kind === 'income' ? '+' : '−'}${formatMoney(r.record.amount, r.record.currency)}` : '—' }}</td>
                  <td>
                    <span v-if="r.errors.length" class="badge bad">Problem</span>
                    <span v-else-if="r.duplicate" class="badge">Already there</span>
                    <span v-else class="badge good">New</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-if="checked.length > 40" class="b-muted">Showing the first 40 rows.</p>
          </div>
        </section>

        <div class="actions">
          <button type="button" class="btn" :disabled="!ok.length || busy || !!missingRequired.length" @click="runImport">
            Import {{ ok.length }} {{ ok.length === 1 ? 'transaction' : 'transactions' }}
          </button>
          <button type="button" class="btn btn-quiet" @click="emit('close')">Cancel</button>
        </div>
      </template>
    </div>
  </Modal>
</template>

<style scoped>
.import {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.pick {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.pick p {
  margin: 0;
}

.file {
  display: none;
}

h3 {
  margin: 0 0 0.6rem;
  font-size: 1rem;
}

.map {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 12rem), 1fr));
  gap: 0.6rem 0.75rem;
}

.req {
  color: var(--bad-ink);
  margin-left: 0.15rem;
}

.opts {
  margin-top: 0.75rem;
}

.summary {
  margin: 0 0 0.5rem;
  padding-left: 1.1rem;
}

.bad-li {
  color: var(--bad-ink);
}

.err {
  margin: 0;
  color: var(--bad-ink);
}

.problems {
  margin: 0.5rem 0;
  font-size: var(--text-sm);
}

.problems ul {
  margin: 0.4rem 0 0;
  padding-left: 1.1rem;
  color: var(--bad-ink);
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

th,
td {
  padding: 0.4rem;
  text-align: left;
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
}

.r {
  text-align: right;
}

.dim {
  opacity: 0.55;
}

.actions {
  display: flex;
  gap: 0.5rem;
}
</style>
