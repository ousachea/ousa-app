<script setup lang="ts">
// One piece of the CV's text (pages/cv.vue) that the owner can edit right where it sits: in Edit
// mode it turns editable, Enter or clicking away saves it, Esc puts it back. Otherwise it's plain
// text. `display` is what to show when not editing (the hero's counting-up numbers).
const props = withDefaults(defineProps<{
  path: string
  tag?: string
  numeric?: boolean
  display?: string | number
  placeholder?: string
}>(), { tag: 'span', numeric: false, display: undefined, placeholder: 'Type here' })

const { content, save } = useCvContent()
const editing = inject<Ref<boolean>>('cv-editing', ref(false))
const value = computed(() => cvGet(content.value, props.path) as string | number | undefined)
const shown = computed(() => (!editing.value && props.display !== undefined ? props.display : value.value ?? ''))

// The browser edits the element's text directly; a fresh element afterwards keeps Vue in charge of it
const rev = ref(0)
let cancelled = false

// Home and End move to the start or end of this text (on a Mac they'd otherwise scroll the whole page)
function caretTo(el: HTMLElement, end: boolean) {
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(!end)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

function onKey(e: KeyboardEvent) {
  if ((e.key === 'Home' || e.key === 'End') && !e.shiftKey) {
    e.preventDefault()
    caretTo(e.target as HTMLElement, e.key === 'End')
  } else if (e.key === 'Enter') {
    e.preventDefault()
    ;(e.target as HTMLElement).blur()
  } else if (e.key === 'Escape') {
    e.stopPropagation()
    cancelled = true
    ;(e.target as HTMLElement).blur()
  }
}

// Pasting brings in plain text only, on one line
function onPaste(e: ClipboardEvent) {
  e.preventDefault()
  const text = (e.clipboardData?.getData('text/plain') ?? '').replace(/\s*\n\s*/g, ' ')
  document.execCommand('insertText', false, text)
}

async function onBlur(e: FocusEvent) {
  const text = ((e.target as HTMLElement).innerText ?? '').replace(/\s+/g, ' ').trim()
  const before = value.value ?? ''
  const next = props.numeric ? Math.max(0, Number(text.replace(/[^\d.]/g, '')) || 0) : text
  const changed = !cancelled && String(next) !== String(before)
  cancelled = false
  rev.value++
  if (changed) await save(d => cvSet(d, props.path, next), 'Saved')
}
</script>

<template>
  <component
    :is="tag"
    :key="rev"
    v-ants class="cv-text"
    :class="{ editable: editing, empty: editing && shown === '' }"
    :contenteditable="editing ? 'plaintext-only' : undefined"
    :spellcheck="editing ? 'true' : undefined"
    :data-placeholder="editing ? placeholder : undefined"
    :role="editing ? 'textbox' : undefined"
    :aria-label="editing ? `Edit ${placeholder}` : undefined"
    @keydown="editing && onKey($event)"
    @paste="editing && onPaste($event)"
    @blur="editing && onBlur($event)"
    @click="editing && $event.stopPropagation()"
  >{{ shown }}</component>
</template>

<style scoped>
.cv-text.editable {
  border-radius: var(--radius-xs);
  /* A dashed outline whose dashes walk (v-ants) */
  --ants-width: 1.5px;
  --ants-offset: 3px;
  cursor: text;
  transition: --ants-color var(--dur-fast), background-color var(--dur-fast);
}

.cv-text.editable:hover {
  --ants-color: color-mix(in srgb, #9b5cf5 55%, transparent);
}

.cv-text.editable:focus {
  --ants-color: transparent;
  outline: 2px solid #9b5cf5;
  background: color-mix(in srgb, #9b5cf5 10%, transparent);
}

/* Something emptied: a faint hint of what goes there */
.cv-text.empty::before {
  content: attr(data-placeholder);
  opacity: 0.45;
}
</style>
