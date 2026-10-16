<script setup lang="ts">
import type { CvIconName } from './CvIcon.vue'

// One popup that edits any part of the CV (pages/cv.vue): the page hands it a list of fields and
// the current values, and gets the edited values back. Short fields sit two to a row; lists are rows
// you can add to, reorder and remove (Enter adds the next one, Backspace on an empty row removes it);
// pairs are two inputs a row, with a slider for skill levels. ⌘/Ctrl + Enter saves.
export interface CvField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'url' | 'icon' | 'lines' | 'paragraphs' | 'pairs'
  hint?: string
  placeholder?: string
  required?: boolean
  /** pairs: the two keys of each item, e.g. ['value', 'label'] */
  pair?: [string, string]
  /** pairs: what each side is called, shown as placeholders */
  pairLabels?: [string, string]
  /** pairs: the right-hand side is a level out of 100 (a skill) */
  numeric?: boolean
  /** lists: what one item is called, for the Add button ("client") */
  item?: string
}

const props = defineProps<{
  open: boolean
  title: string
  fields: CvField[]
  value: Record<string, unknown> | null
  icon?: CvIconName
  /** Shows a Delete button (editing an existing item in a list) */
  deletable?: boolean
  saving?: boolean
}>()
const emit = defineEmits<{ close: [], save: [value: Record<string, unknown>], delete: [] }>()

const ICONS: CvIconName[] = ['monitor', 'code', 'layout', 'calendar', 'clipboard', 'palette', 'bolt', 'star', 'briefcase', 'pen', 'globe', 'users', 'sparkle', 'cap', 'mail', 'quote']

type Pair = { a: string, b: string }
type Draft = Record<string, string | string[] | Pair[]>
const draft = ref<Draft>({})
const error = ref('')
const confirmingDelete = ref(false)
const formEl = ref<HTMLFormElement>()

const isList = (f: CvField) => f.type === 'lines' || f.type === 'paragraphs'
const isShort = (f: CvField) => ['text', 'number', 'url'].includes(f.type)
// Long forms and lists get the wider popup
const wide = computed(() => props.fields.length > 4 || props.fields.some(f => isList(f) || f.type === 'pairs'))

function toDraft(f: CvField, v: unknown): string | string[] | Pair[] {
  if (isList(f)) return [...((v as string[] | undefined) ?? [])]
  if (f.type === 'pairs') {
    const [a, b] = f.pair!
    return ((v as Record<string, unknown>[] | undefined) ?? []).map(item => ({ a: String(item[a] ?? ''), b: String(item[b] ?? '') }))
  }
  return v == null ? '' : String(v)
}

function fromDraft(f: CvField, v: string | string[] | Pair[]): unknown {
  if (isList(f)) return (v as string[]).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean)
  if (f.type === 'pairs') {
    const [a, b] = f.pair!
    return (v as Pair[])
      .filter(p => p.a.trim() || p.b.trim())
      .map(p => ({ [a]: p.a.trim(), [b]: f.numeric ? Math.max(0, Math.min(100, Number(p.b) || 0)) : p.b.trim() }))
  }
  if (f.type === 'number') return Number(v) || 0
  return (v as string).trim()
}

watch(() => [props.open, props.value] as const, ([open]) => {
  if (!open) return
  error.value = ''
  confirmingDelete.value = false
  draft.value = Object.fromEntries(props.fields.map(f => [f.key, toDraft(f, props.value?.[f.key])]))
}, { immediate: true })

// ---------- Lists ----------
const listOf = (key: string) => draft.value[key] as string[]
const pairsOf = (key: string) => draft.value[key] as Pair[]

function focusRow(key: string, i: number) {
  nextTick(() => formEl.value?.querySelector<HTMLElement>(`[data-row="${key}-${i}"]`)?.focus())
}

function addRow(f: CvField, at?: number) {
  const rows = draft.value[f.key] as unknown[]
  const i = at ?? rows.length
  rows.splice(i, 0, f.type === 'pairs' ? { a: '', b: f.numeric ? '80' : '' } : '')
  focusRow(f.key, i)
}

function removeRow(f: CvField, i: number) {
  ;(draft.value[f.key] as unknown[]).splice(i, 1)
}

function moveRow(f: CvField, i: number, by: -1 | 1) {
  const rows = draft.value[f.key] as unknown[]
  const j = i + by
  if (j < 0 || j >= rows.length) return
  ;[rows[i], rows[j]] = [rows[j], rows[i]]
  focusRow(f.key, j)
}

// Enter adds the next row; Backspace on an empty row removes it
function onRowKey(e: KeyboardEvent, f: CvField, i: number) {
  if (e.metaKey || e.ctrlKey) return
  const value = f.type === 'pairs' ? pairsOf(f.key)[i]!.a : listOf(f.key)[i]!
  if (e.key === 'Enter' && f.type !== 'paragraphs') {
    e.preventDefault()
    addRow(f, i + 1)
  } else if (e.key === 'Backspace' && value === '' && (f.type !== 'pairs' || pairsOf(f.key)[i]!.b === '')) {
    e.preventDefault()
    removeRow(f, i)
    focusRow(f.key, Math.max(0, i - 1))
  }
}

// ---------- Saving ----------
function submit() {
  const missing = props.fields.find(f => f.required && !String(draft.value[f.key] ?? '').trim())
  if (missing) {
    error.value = `${missing.label} can’t be empty.`
    return
  }
  const out: Record<string, unknown> = { ...(props.value ?? {}) }
  for (const f of props.fields) out[f.key] = fromDraft(f, draft.value[f.key]!)
  emit('save', out)
}

function onFormKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    submit()
  }
}

function remove() {
  if (!confirmingDelete.value) {
    confirmingDelete.value = true
    return
  }
  emit('delete')
}

const isMac = import.meta.client && /Mac|iPhone|iPad/.test(navigator.platform)
</script>

<template>
  <Modal :open="open" :title="title" :wide="wide" @close="emit('close')">
    <form ref="formEl" class="cv-editor" @submit.prevent="submit" @keydown="onFormKey">
      <p class="intro">
        <span class="intro-icon" aria-hidden="true"><CvIcon :name="icon ?? 'edit'" /></span>
        <span>Changes go live on your CV as soon as you save.</span>
      </p>

      <div class="grid">
        <template v-for="f in fields" :key="f.key">
          <!-- Icons: one of the CV's set, as stickers -->
          <fieldset v-if="f.type === 'icon'" class="group span">
            <legend class="label">{{ f.label }}</legend>
            <div class="icon-grid" role="radiogroup" :aria-label="f.label">
              <label v-for="name in ICONS" :key="name" class="icon-choice" :class="{ on: draft[f.key] === name }" :title="name">
                <input v-model="draft[f.key]" type="radio" :name="f.key" :value="name" class="sr-only">
                <CvIcon :name="name" />
              </label>
            </div>
          </fieldset>

          <!-- Lists: a row each -->
          <fieldset v-else-if="isList(f)" class="group span">
            <legend class="label">{{ f.label }}<span class="count">{{ listOf(f.key).length }}</span></legend>
            <p v-if="f.hint" class="hint">{{ f.hint }}</p>
            <TransitionGroup tag="ol" name="row" class="rows">
              <li v-for="(_, i) in listOf(f.key)" :key="i" class="row">
                <span class="row-num" aria-hidden="true">{{ i + 1 }}</span>
                <textarea
                  v-if="f.type === 'paragraphs'"
                  v-model="listOf(f.key)[i]"
                  class="input row-input"
                  rows="3"
                  :data-row="`${f.key}-${i}`"
                  :aria-label="`${f.item ?? f.label} ${i + 1}`"
                  :placeholder="f.placeholder"
                  @keydown="onRowKey($event, f, i)"
                />
                <input
                  v-else
                  v-model="listOf(f.key)[i]"
                  class="input row-input"
                  :data-row="`${f.key}-${i}`"
                  :aria-label="`${f.item ?? f.label} ${i + 1}`"
                  :placeholder="f.placeholder"
                  @keydown="onRowKey($event, f, i)"
                >
                <span class="row-tools">
                  <button type="button" :disabled="i === 0" title="Move up" :aria-label="`Move ${f.item ?? 'item'} ${i + 1} up`" @click="moveRow(f, i, -1)"><CvIcon name="arrow-right" class="up" /></button>
                  <button type="button" :disabled="i === listOf(f.key).length - 1" title="Move down" :aria-label="`Move ${f.item ?? 'item'} ${i + 1} down`" @click="moveRow(f, i, 1)"><CvIcon name="arrow-right" class="down" /></button>
                  <button type="button" class="danger" title="Remove" :aria-label="`Remove ${f.item ?? 'item'} ${i + 1}`" @click="removeRow(f, i)"><CvIcon name="trash" /></button>
                </span>
              </li>
            </TransitionGroup>
            <button type="button" class="add-row" @click="addRow(f)"><CvIcon name="plus" />Add {{ f.item ?? 'item' }}</button>
          </fieldset>

          <!-- Pairs: two inputs a row, or a skill with its level -->
          <fieldset v-else-if="f.type === 'pairs'" class="group span">
            <legend class="label">{{ f.label }}<span class="count">{{ pairsOf(f.key).length }}</span></legend>
            <p v-if="f.hint" class="hint">{{ f.hint }}</p>
            <TransitionGroup tag="ol" name="row" class="rows">
              <li v-for="(p, i) in pairsOf(f.key)" :key="i" class="row pair" :class="{ level: f.numeric }">
                <span class="row-num" aria-hidden="true">{{ i + 1 }}</span>
                <input
                  v-model="p.a"
                  class="input row-input"
                  :data-row="`${f.key}-${i}`"
                  :placeholder="f.pairLabels?.[0]"
                  :aria-label="`${f.pairLabels?.[0] ?? 'First'} ${i + 1}`"
                  @keydown="onRowKey($event, f, i)"
                >
                <span v-if="f.numeric" class="level-input">
                  <input v-model="p.b" type="range" min="0" max="100" step="1" :aria-label="`${f.pairLabels?.[1] ?? 'Level'} for ${p.a || `skill ${i + 1}`}`" :style="{ '--v': `${p.b}%` }">
                  <output>{{ p.b }}%</output>
                </span>
                <input
                  v-else
                  v-model="p.b"
                  class="input row-input"
                  :placeholder="f.pairLabels?.[1]"
                  :aria-label="`${f.pairLabels?.[1] ?? 'Second'} ${i + 1}`"
                >
                <span class="row-tools">
                  <button type="button" :disabled="i === 0" title="Move up" :aria-label="`Move ${f.item ?? 'item'} ${i + 1} up`" @click="moveRow(f, i, -1)"><CvIcon name="arrow-right" class="up" /></button>
                  <button type="button" :disabled="i === pairsOf(f.key).length - 1" title="Move down" :aria-label="`Move ${f.item ?? 'item'} ${i + 1} down`" @click="moveRow(f, i, 1)"><CvIcon name="arrow-right" class="down" /></button>
                  <button type="button" class="danger" title="Remove" :aria-label="`Remove ${f.item ?? 'item'} ${i + 1}`" @click="removeRow(f, i)"><CvIcon name="trash" /></button>
                </span>
              </li>
            </TransitionGroup>
            <button type="button" class="add-row" @click="addRow(f)"><CvIcon name="plus" />Add {{ f.item ?? 'item' }}</button>
          </fieldset>

          <!-- Single values -->
          <label v-else class="group" :class="{ span: !isShort(f) }">
            <span class="label">{{ f.label }}<span v-if="f.required" class="req" aria-hidden="true">*</span></span>
            <textarea
              v-if="f.type === 'textarea'"
              v-model="draft[f.key]"
              class="input"
              rows="3"
              :placeholder="f.placeholder"
              :required="f.required"
            />
            <input
              v-else
              v-model="draft[f.key]"
              class="input"
              :type="f.type === 'number' ? 'number' : f.type === 'url' ? 'url' : 'text'"
              :inputmode="f.type === 'number' ? 'numeric' : undefined"
              :placeholder="f.placeholder"
              :required="f.required"
            >
            <span v-if="f.hint" class="hint">{{ f.hint }}</span>
          </label>
        </template>
      </div>

      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <!-- Stays in view at the bottom of a long form -->
      <div class="actions">
        <button v-if="deletable" type="button" class="btn-x danger-btn" :class="{ confirm: confirmingDelete }" @click="remove">
          <CvIcon name="trash" />{{ confirmingDelete ? 'Click again to delete' : 'Delete' }}
        </button>
        <span class="spacer" />
        <span class="kbd-hint" aria-hidden="true"><kbd>{{ isMac ? '⌘' : 'Ctrl' }}</kbd><kbd>↵</kbd></span>
        <button type="button" class="btn-x quiet" @click="emit('close')">Cancel</button>
        <button type="submit" class="btn-x save" :disabled="saving">
          <CvIcon name="check" />{{ saving ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </form>
  </Modal>
</template>

<style scoped>
.cv-editor {
  --violet: #7c3aed;
  --accent: #7c3aed;
  --on-accent: #fff;
  --gradient: linear-gradient(180deg, #8f5cf7 0%, #7c3aed 45%, #5b21b6 100%);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  width: 100%;
  min-width: 0;
}

/* ---------- Intro: the sticker for what's being edited ---------- */
.intro {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: -0.25rem 0 0;
  padding: 0.65rem 0.8rem;
  font-size: 0.85rem;
  color: var(--ink-2);
  background: color-mix(in srgb, #7c3aed 7%, var(--surface));
  border: 1px solid color-mix(in srgb, #7c3aed 18%, var(--line));
  border-radius: 14px;
}

.intro-icon {
  width: 2.1rem;
  height: 2.1rem;
  flex: none;
  display: grid;
  place-items: center;
  font-size: 1.05rem;
  color: #fff;
  background: var(--gradient);
  border-radius: 10px;
  box-shadow:
    0 0 0 1.5px var(--plastic),
    inset 0 -2px 0 rgb(0 0 0 / 0.18),
    inset 0 2px 4px rgb(255 255 255 / 0.3);
}

/* ---------- Fields: short ones two to a row ---------- */
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem 0.85rem;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.group.span {
  grid-column: 1 / -1;
}

.label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--ink);
}

.req {
  color: var(--bad-ink);
}

.count {
  min-width: 1.35rem;
  padding: 0.05rem 0.4rem;
  font-size: 0.7rem;
  font-weight: 700;
  text-align: center;
  color: var(--violet);
  background: color-mix(in srgb, #7c3aed 12%, var(--surface));
  border-radius: 999px;
}

.hint {
  margin: -0.15rem 0 0.1rem;
  font-size: 0.78rem;
  font-weight: 400;
  color: var(--ink-3);
}

.input {
  width: 100%;
  min-width: 0;
}

textarea.input {
  resize: vertical;
  line-height: 1.5;
}

/* ---------- Lists: numbered rows ---------- */
.rows {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  display: grid;
  grid-template-columns: 1.6rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.4rem;
}

.row.pair {
  grid-template-columns: 1.6rem minmax(0, 1fr) minmax(0, 1.4fr) auto;
}

.row.pair.level {
  grid-template-columns: 1.6rem minmax(0, 1fr) minmax(0, 1fr) auto;
}

.row-num {
  font-size: 0.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: center;
  color: var(--ink-3);
}

.row-input {
  min-height: 2.5rem;
  padding-block: 0.5rem;
}

.row-tools {
  display: flex;
  gap: 0.1rem;
  opacity: 0.35;
  transition: opacity 0.15s;
}

.row:hover .row-tools,
.row:focus-within .row-tools {
  opacity: 1;
}

.row-tools button {
  width: 1.9rem;
  height: 1.9rem;
  display: grid;
  place-items: center;
  padding: 0;
  font-size: 0.95rem;
  color: var(--ink-2);
  background: none;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
}

.row-tools button:hover:not(:disabled) {
  color: var(--ink);
  background: var(--surface-2);
}

.row-tools button:disabled {
  opacity: 0.3;
  cursor: default;
}

.row-tools .danger:hover {
  color: var(--bad-ink) !important;
}

.up {
  rotate: -90deg;
}

.down {
  rotate: 90deg;
}

/* A skill's level: a purple slider and its number */
.level-input {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.level-input input {
  flex: 1;
  min-width: 0;
  height: 6px;
  appearance: none;
  background: linear-gradient(90deg, #8f5cf7, #6d28d9) 0 / var(--v) 100% no-repeat, var(--surface-2);
  border-radius: 999px;
  cursor: pointer;
}

.level-input input::-webkit-slider-thumb {
  width: 18px;
  height: 18px;
  appearance: none;
  background: #fff;
  border: 2px solid #7c3aed;
  border-radius: 50%;
  box-shadow: 0 2px 6px rgb(124 58 237 / 0.4);
}

.level-input input::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: #fff;
  border: 2px solid #7c3aed;
  border-radius: 50%;
}

.level-input output {
  min-width: 2.6rem;
  font-size: 0.85rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.add-row {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  margin-left: 2rem;
  padding: 0.55rem;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--violet);
  background: color-mix(in srgb, #7c3aed 5%, transparent);
  border: 1.5px dashed color-mix(in srgb, #7c3aed 40%, transparent);
  border-radius: 12px;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}

.add-row:hover {
  background: color-mix(in srgb, #7c3aed 10%, transparent);
  border-color: #7c3aed;
}

:root[data-theme='dark'] .add-row,
:root[data-theme='dark'] .count {
  color: #d4bfff;
}

.row-enter-active,
.row-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.row-enter-from,
.row-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ---------- Icon picker: stickers ---------- */
.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 2.9rem);
  gap: 0.5rem;
}

.icon-choice {
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  font-size: 1.25rem;
  color: var(--ink-2);
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 12px;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s, transform 0.2s cubic-bezier(0.3, 1.5, 0.6, 1);
}

.icon-choice:hover {
  color: var(--ink);
  transform: translateY(-2px);
}

.icon-choice.on {
  color: #fff;
  background: var(--gradient);
  border-color: transparent;
  box-shadow:
    0 0 0 2px var(--plastic),
    inset 0 -3px 0 rgb(0 0 0 / 0.18),
    inset 0 3px 5px rgb(255 255 255 / 0.3);
  transform: scale(1.05);
}

.icon-choice:has(:focus-visible) {
  outline: 2px solid #7c3aed;
  outline-offset: 2px;
}

.error {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--bad-ink);
}

/* ---------- Actions: stuck to the bottom of the popup ---------- */
.actions {
  position: sticky;
  z-index: 2;
  bottom: -1.4rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.25rem -1.4rem -1.4rem;
  padding: 0.9rem 1.4rem 1.4rem;
  background: var(--surface);
  border-top: 1px solid var(--line);
  border-radius: 0 0 22px 22px;
}

.spacer {
  flex: 1;
}

.kbd-hint {
  display: inline-flex;
  gap: 0.2rem;
  margin-right: 0.25rem;
}

.kbd-hint kbd {
  padding: 0.1rem 0.35rem;
  font: inherit;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--ink-3);
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 6px;
}

.btn-x {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2.6rem;
  padding: 0 1.1rem;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 700;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  transition: transform 0.12s, filter 0.15s, background-color 0.15s;
}

.btn-x:active:not(:disabled) {
  transform: scale(0.96);
}

.btn-x.quiet {
  color: var(--ink);
  background: var(--surface-2);
  box-shadow: inset 0 0 0 1px var(--line);
}

.btn-x.save {
  color: #fff;
  background: var(--gradient);
  box-shadow: 0 8px 18px -8px rgb(124 58 237 / 0.8);
}

.btn-x.save:hover:not(:disabled) {
  filter: brightness(1.08);
}

.btn-x:disabled {
  opacity: 0.6;
  cursor: progress;
}

.danger-btn {
  color: var(--bad-ink);
  background: color-mix(in srgb, var(--red) 8%, var(--surface));
}

.danger-btn.confirm {
  color: #fff;
  background: var(--red);
}

@media (max-width: 560px) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .row.pair,
  .row.pair.level {
    grid-template-columns: 1.6rem minmax(0, 1fr) auto;
  }

  /* On a phone the second input of a pair drops under the first */
  .row.pair > :nth-child(3) {
    grid-column: 2;
  }

  .row.pair .row-tools {
    grid-row: 1;
    grid-column: 3;
  }

  .kbd-hint {
    display: none;
  }

  .row-tools {
    opacity: 1;
  }
}
</style>
