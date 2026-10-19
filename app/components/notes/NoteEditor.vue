<script setup lang="ts">
import { toast } from 'vue-sonner'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import { Selection, TextSelection, type EditorState } from '@tiptap/pm/state'
import type { Editor } from '@tiptap/core'

// The Notes editor (Tiptap): formatting toolbar, Markdown shortcuts, clickable checklists, links,
// images pasted or dropped in (made smaller first), and [[ to link another note.
// Selecting text (a double-click on a word, or a drag) brings up a small formatting bar right above it.
// It reports every change (`update:modelValue`); the page decides when to save.
const props = defineProps<{
  modelValue: string
  /** Other notes, for [[ suggestions */
  notes: { id: string, title: string }[]
  placeholder?: string
  spellcheck?: boolean
  /** Focus mode: no toolbar on a computer, so only the writing shows; the bar on selected text still formats */
  bare?: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [html: string]
  'open-note': [id: string, title: string]
  'create-note': [title: string, done: (id: string) => void]
  'blur': []
}>()

const resolve = (title: string) => {
  const t = title.trim().toLowerCase()
  return props.notes.find(n => n.title.toLowerCase() === t)
}

const editor = useEditor({
  content: props.modelValue,
  extensions: noteExtensions({ placeholder: props.placeholder, resolve }),
  editorProps: {
    attributes: { 'class': 'note-body', 'aria-label': 'Note', 'spellcheck': 'true' },
    // Keep the line being typed clear of the phone's bottom toolbar
    scrollMargin: { top: 80, bottom: 120, left: 0, right: 0 },
    scrollThreshold: { top: 80, bottom: 120, left: 0, right: 0 },
    handleKeyDown: (_view, e) => onKey(e),
    handlePaste: (_view, e) => takeImages(e.clipboardData?.files),
    handleDrop: (_view, e) => takeImages((e as DragEvent).dataTransfer?.files),
    handleClickOn: (_view, _pos, node) => {
      if (node.type.name !== 'noteLink') return false
      emit('open-note', node.attrs.id as string, node.attrs.title as string)
      return true
    }
  },
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.isEmpty ? '' : editor.getHTML())
    checkSuggest()
  },
  onSelectionUpdate: () => checkSuggest(),
  onBlur: () => {
    // Let a click on a suggestion land first
    setTimeout(() => (suggest.value = undefined), 150)
    emit('blur')
  }
})

// Another note opened, or a version restored: show it (without echoing it back as a change)
watch(() => props.modelValue, (html) => {
  const e = editor.value
  if (!e || html === (e.isEmpty ? '' : e.getHTML())) return
  e.commands.setContent(html || '', { emitUpdate: false })
})
onBeforeUnmount(() => editor.value?.destroy())

// Spellcheck can be switched off in Notes settings
watch([editor, () => props.spellcheck], ([e, on]) => {
  e?.view.dom.setAttribute('spellcheck', on === false ? 'false' : 'true')
}, { immediate: true })

// ---------- Toolbar ----------
type Cmd = { key: string, label: string, title: string, /** from the shared icon library */ icon: string, run: () => void, active?: () => boolean }
const chain = () => editor.value!.chain().focus()
const is = (name: string, attrs?: Record<string, unknown>) => !!editor.value?.isActive(name, attrs)
const mod = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'

// ---------- Text style: one named dropdown for what kind of block the line is ----------
// Each also has a Markdown shortcut, shown beside it
const STYLES = [
  { label: 'Normal text', md: '', run: () => chain().setParagraph().run(), active: () => is('paragraph') },
  { label: 'Heading 1', md: '#', run: () => chain().setHeading({ level: 1 }).run(), active: () => is('heading', { level: 1 }) },
  { label: 'Heading 2', md: '##', run: () => chain().setHeading({ level: 2 }).run(), active: () => is('heading', { level: 2 }) },
  { label: 'Heading 3', md: '###', run: () => chain().setHeading({ level: 3 }).run(), active: () => is('heading', { level: 3 }) },
  { label: 'Quote', md: '>', run: () => chain().toggleBlockquote().run(), active: () => is('blockquote') },
  { label: 'Code block', md: '```', run: () => chain().toggleCodeBlock().run(), active: () => is('codeBlock') }
]
// A quote holds paragraphs, so it's checked before Normal text
const styleName = () => (STYLES.slice(1).find(s => s.active()) ?? STYLES[0]!).label
const { openMenu } = useContextMenu()
function openStyles(e: MouseEvent) {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const current = styleName()
  openMenu(matchMedia('(pointer: coarse)').matches ? null : { clientX: r.left, clientY: r.bottom + 4 }, STYLES.map(s => ({
    label: s.label,
    hint: s.label === current ? '✓' : s.md,
    run: s.run
  })), 'Text style')
}

const TOOLS: (Cmd | '|')[] = [
  { key: 'bold', label: 'Bold', title: `Bold (${mod}B)`, icon: 'lucide:bold', run: () => chain().toggleBold().run(), active: () => is('bold') },
  { key: 'italic', label: 'Italic', title: `Italic (${mod}I)`, icon: 'lucide:italic', run: () => chain().toggleItalic().run(), active: () => is('italic') },
  { key: 'underline', label: 'Underline', title: `Underline (${mod}U)`, icon: 'lucide:underline', run: () => chain().toggleUnderline().run(), active: () => is('underline') },
  { key: 'strike', label: 'Strikethrough', title: `Strikethrough (${mod}⇧S)`, icon: 'lucide:strikethrough', run: () => chain().toggleStrike().run(), active: () => is('strike') },
  { key: 'code', label: 'Inline code', title: `Inline code (${mod}E)`, icon: 'lucide:code', run: () => chain().toggleCode().run(), active: () => is('code') },
  { key: 'link', label: 'Link', title: `Link (${mod}K with text selected)`, icon: 'lucide:link', run: () => setLink(), active: () => is('link') },
  '|',
  { key: 'bullets', label: 'Bullet list', title: 'Bullet list (- )', icon: 'lucide:list', run: () => chain().toggleBulletList().run(), active: () => is('bulletList') },
  { key: 'numbers', label: 'Numbered list', title: 'Numbered list (1. )', icon: 'lucide:list-ordered', run: () => chain().toggleOrderedList().run(), active: () => is('orderedList') },
  { key: 'tasks', label: 'Checklist', title: 'Checklist ([ ] )', icon: 'lucide:list-checks', run: () => chain().toggleTaskList().run(), active: () => is('taskList') },
  { key: 'hr', label: 'Divider', title: 'Divider (---)', icon: 'lucide:minus', run: () => chain().setHorizontalRule().run() },
  { key: 'image', label: 'Image', title: 'Add an image (or paste / drop one)', icon: 'lucide:image', run: () => imageInput.value?.click() }
]

// ---------- On selected text ----------
// With a mouse only: phones have their own bar above the keyboard, and their own menu on a selection
const BUBBLE_KEYS = ['bold', 'italic', 'underline', 'strike', 'code', 'link', '|', 'bullets', 'numbers', 'tasks']
const BUBBLE: (Cmd | '|')[] = BUBBLE_KEYS.map(k => (k === '|' ? '|' : TOOLS.find((t): t is Cmd => t !== '|' && t.key === k)!))
const showBubble = ({ editor: e, state }: { editor: Editor, state: EditorState }) => {
  const sel = state.selection
  return e.isEditable && sel instanceof TextSelection && !sel.empty && !!state.doc.textBetween(sel.from, sel.to).trim()
    && !e.isActive('codeBlock') && matchMedia('(pointer: fine)').matches
}

// ---------- Links ----------
function setLink() {
  const e = editor.value
  if (!e) return
  const current = e.getAttributes('link').href as string | undefined
  const url = window.prompt('Link address (leave empty to remove the link)', current ?? 'https://')
  if (url === null) return
  if (!url.trim() || url.trim() === 'https://') {
    chain().extendMarkRange('link').unsetLink().run()
    return
  }
  const href = /^[a-z][\w+.-]*:/i.test(url.trim()) ? url.trim() : `https://${url.trim()}`
  if (!/^(https?|mailto|tel):/i.test(href)) {
    toast.error('That isn’t a web, email or phone link.')
    return
  }
  if (e.state.selection.empty && !current) chain().insertContent({ type: 'text', text: url.trim(), marks: [{ type: 'link', attrs: { href } }] }).run()
  else chain().extendMarkRange('link').setLink({ href }).run()
}

// ---------- Images ----------
const imageInput = ref<HTMLInputElement>()
function takeImages(files?: FileList | null) {
  const images = [...(files ?? [])].filter(f => f.type.startsWith('image/'))
  if (!images.length) return false
  for (const f of images) addImage(f)
  return true
}
async function addImage(file: File) {
  try {
    const src = await imageToDataUrl(file)
    chain().setImage({ src, alt: file.name.replace(/\.[^.]+$/, '') }).run()
  } catch (e) {
    toast.error('Couldn’t add the image', { description: e instanceof Error ? e.message : undefined })
  }
}
function onPickImage(e: Event) {
  const input = e.target as HTMLInputElement
  takeImages(input.files)
  input.value = ''
}

// ---------- [[ suggestions ----------
const suggest = ref<{ query: string, from: number, x: number, y: number, top: number, active: number }>()
const suggestions = computed(() => {
  const s = suggest.value
  if (!s) return []
  const q = s.query.trim().toLowerCase()
  const list = props.notes.filter(n => !q || n.title.toLowerCase().includes(q))
    .sort((a, b) => Number(b.title.toLowerCase().startsWith(q)) - Number(a.title.toLowerCase().startsWith(q)))
    .slice(0, 6)
  const exact = list.some(n => n.title.toLowerCase() === q)
  return [...list.map(n => ({ ...n, create: false })), ...(q && !exact ? [{ id: '', title: s.query.trim(), create: true }] : [])]
})

// Kept on screen near the cursor
const suggestLeft = computed(() => (suggest.value ? Math.max(8, Math.min(suggest.value.x, window.innerWidth - 272)) : 0))
// Under the caret, or above it when the caret is near the bottom of the screen, so the list is never cut off
const suggestStyle = computed(() => {
  const s = suggest.value
  if (!s) return {}
  const roomBelow = window.innerHeight - s.y - 14
  const roomAbove = s.top - 14
  const above = roomBelow < 256 && roomAbove > roomBelow
  return above
    ? { left: `${suggestLeft.value}px`, bottom: `${window.innerHeight - s.top + 6}px`, maxHeight: `${Math.min(256, roomAbove)}px` }
    : { left: `${suggestLeft.value}px`, top: `${s.y + 6}px`, maxHeight: `${Math.min(256, Math.max(120, roomBelow))}px` }
})

function checkSuggest() {
  const e = editor.value
  if (!e || !e.state.selection.empty) {
    suggest.value = undefined
    return
  }
  const { $from } = e.state.selection
  const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - 80), $from.parentOffset, undefined, '￼')
  const m = /\[\[([^[\]\n]{0,60})$/.exec(before)
  if (!m) {
    suggest.value = undefined
    return
  }
  const at = e.view.coordsAtPos($from.pos)
  suggest.value = { query: m[1]!, from: $from.pos - m[0].length, x: at.left, y: at.bottom, top: at.top, active: suggest.value?.active ?? 0 }
}

function pick(i: number) {
  const s = suggest.value
  const choice = suggestions.value[i]
  const e = editor.value
  if (!s || !choice || !e) return
  const to = e.state.selection.from
  const insert = (id: string, title: string) => e.chain().focus().insertContentAt({ from: s.from, to }, [{ type: 'noteLink', attrs: { id, title } }, { type: 'text', text: ' ' }]).run()
  suggest.value = undefined
  if (choice.create) emit('create-note', choice.title, id => insert(id, choice.title))
  else insert(choice.id, choice.title)
}

function onKey(e: KeyboardEvent): boolean {
  const s = suggest.value
  if (s && suggestions.value.length) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const n = suggestions.value.length
      s.active = (s.active + (e.key === 'ArrowDown' ? 1 : n - 1)) % n
      return true
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      pick(s.active)
      return true
    }
    if (e.key === 'Escape') {
      suggest.value = undefined
      e.stopPropagation()
      return true
    }
  }
  // ⌘K / Ctrl+K: a link when there's something to link; otherwise the app's command palette
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k' && editor.value && (!editor.value.state.selection.empty || editor.value.isActive('link'))) {
    e.preventDefault()
    e.stopPropagation()
    setLink()
    return true
  }
  return false
}

// ---------- Phones: the formatting bar rides on top of the keyboard ----------
// The bar is fixed to the bottom of the screen; when the on-screen keyboard opens, the visible area
// shrinks (visualViewport) and the bar moves up with it, so it's never hidden behind the keyboard.
const keyboard = ref(0)
function onViewport() {
  const vv = window.visualViewport
  if (!vv) return
  keyboard.value = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
}
onMounted(() => {
  window.visualViewport?.addEventListener('resize', onViewport)
  window.visualViewport?.addEventListener('scroll', onViewport)
})
onBeforeUnmount(() => {
  window.visualViewport?.removeEventListener('resize', onViewport)
  window.visualViewport?.removeEventListener('scroll', onViewport)
})

// ---------- Focus ----------
// Straight away, not on the next frame like Tiptap's focus command, so fast typing after Enter in the
// title lands in the note. Asked before the editor is on the page (a note just opened), it waits for it.
function focusAt(where: 'start' | 'end' = 'end', tries = 0) {
  const e = editor.value
  if (!e || !e.view.dom.isConnected) {
    if (tries < 30) requestAnimationFrame(() => focusAt(where, tries + 1))
    return
  }
  e.view.focus()
  e.view.dispatch(e.state.tr.setSelection(where === 'start' ? Selection.atStart(e.state.doc) : Selection.atEnd(e.state.doc)).scrollIntoView())
}

// ---------- Counts ----------
const words = ref(0)
const chars = ref(0)
function count() {
  const text = editor.value?.getText() ?? ''
  words.value = wordCount(text)
  chars.value = text.replace(/\s/g, '').length
}
watch(editor, (e) => {
  if (!e) return
  count()
  e.on('update', count)
})

defineExpose({
  focus: focusAt,
  /** Words in the note, kept current (focus mode shows them) */
  words,
  /** The current HTML right now (to save before leaving) */
  html: () => (editor.value?.isEmpty ? '' : editor.value?.getHTML() ?? '')
})
</script>

<template>
  <div class="note-editor" :class="{ bare }" :style="{ '--keyboard': `${keyboard}px` }">
    <div class="toolbar" role="toolbar" aria-label="Formatting">
      <button type="button" class="style-btn" aria-haspopup="menu" :aria-label="`Text style: ${styleName()}`" title="Text style" @mousedown.prevent @click="openStyles">
        <span>{{ styleName() }}</span>
        <AppIcon name="chevron-down" />
      </button>
      <span class="sep" aria-hidden="true" />
      <template v-for="(t, i) in TOOLS" :key="t === '|' ? `sep${i}` : t.key">
        <span v-if="t === '|'" class="sep" aria-hidden="true" />
        <button
          v-else
          type="button"
          class="tool"
          :class="{ on: t.active?.() }"
          :aria-pressed="t.active ? !!t.active() : undefined"
          :aria-label="t.label"
          :title="t.title"
          @mousedown.prevent
          @click="t.run()"
        >
          <AppIcon v-if="t.icon" :name="t.icon" />
          <span v-else class="tool-text">{{ t.label }}</span>
        </button>
      </template>
      <input ref="imageInput" type="file" accept="image/*" multiple hidden @change="onPickImage">
    </div>

    <BubbleMenu v-if="editor" :editor="editor" :should-show="showBubble" :options="{ placement: 'top', offset: 8, flip: true, shift: { padding: 8 } }" class="bubble" role="toolbar" aria-label="Format selected text">
      <button type="button" class="style-btn" aria-haspopup="menu" :aria-label="`Text style: ${styleName()}`" title="Text style" @mousedown.prevent @click="openStyles">
        <span>{{ styleName() }}</span>
        <AppIcon name="chevron-down" />
      </button>
      <span class="sep" aria-hidden="true" />
      <template v-for="(t, i) in BUBBLE" :key="t === '|' ? `bsep${i}` : t.key">
        <span v-if="t === '|'" class="sep" aria-hidden="true" />
        <button
          v-else
          type="button"
          class="tool"
          :class="{ on: t.active?.() }"
          :aria-pressed="t.active ? !!t.active() : undefined"
          :aria-label="t.label"
          :title="t.title"
          @mousedown.prevent
          @click="t.run()"
        >
          <AppIcon v-if="t.icon" :name="t.icon" />
          <span v-else class="tool-text">{{ t.label }}</span>
        </button>
      </template>
    </BubbleMenu>

    <EditorContent :editor="editor" class="content" />

    <p class="counts" aria-live="off">
      {{ words.toLocaleString() }} {{ words === 1 ? 'word' : 'words' }} · {{ chars.toLocaleString() }} characters<template v-if="words >= 400"> · ~{{ readingMinutes(words) }} min read</template>
    </p>

    <Teleport to="body">
      <ul
        v-if="suggest && suggestions.length"
        class="note-suggest"
        role="listbox"
        aria-label="Link to a note"
        :style="suggestStyle"
      >
        <li
          v-for="(s, i) in suggestions"
          :key="s.create ? ':create' : s.id"
          role="option"
          :aria-selected="i === suggest.active"
          :class="{ on: i === suggest.active }"
          @mousedown.prevent="pick(i)"
        >
          <template v-if="s.create">+ New note “{{ s.title }}”</template>
          <template v-else>{{ s.title }}</template>
        </li>
      </ul>
    </Teleport>
  </div>
</template>

<style scoped>
.note-editor {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.toolbar {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.15rem;
  /* The first button's label (centred in its 2.25rem button) lines up with the text at 1.25rem */
  padding: 0.35rem 0.95rem 0.35rem 0.55rem;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--line);
}

.tool {
  display: grid;
  place-items: center;
  min-width: 2.25rem;
  height: 2.25rem;
  padding: 0 0.3rem;
  font: inherit;
  color: var(--ink-2);
  background: none;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  transition-property: background-color, color, scale;
  transition-duration: 0.12s;
  transition-timing-function: ease-out;
}

.tool:hover {
  color: var(--ink);
  background: color-mix(in srgb, var(--ink) 7%, transparent);
}

.tool:active {
  scale: 0.96;
}

.tool.on {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.tool svg {
  width: 1.1rem;
  height: 1.1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* The text style dropdown, named after the current style */
.style-btn {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
  min-width: 7.5rem;
  height: 2.25rem;
  padding: 0 0.4rem 0 0.65rem;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ink);
  background: none;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.12s;
}

.style-btn:hover {
  background: color-mix(in srgb, var(--ink) 7%, transparent);
}

.style-btn svg {
  flex: none;
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.bubble .style-btn {
  min-width: 0;
  height: 2rem;
}

.tool-text {
  font-size: 0.78rem;
  font-weight: 700;
}

.sep {
  width: 1px;
  height: 1.3rem;
  margin: 0 0.25rem;
  background: var(--line);
}

.content {
  flex: 1;
  min-height: 0;
}

/* The bar on selected text */
.bubble {
  z-index: 350;
  display: flex;
  align-items: center;
  gap: 0.1rem;
  padding: 0.25rem;
  background: var(--surface);
  border-radius: 12px;
  box-shadow: 0 0 0 1px var(--line), 0 12px 28px -8px rgb(var(--shadow) / 0.35);
}

.bubble .tool {
  min-width: 2rem;
  height: 2rem;
}

.bubble .sep {
  margin: 0 0.15rem;
}

/* Focus mode on a computer: only the words */
@media (min-width: 761px) {
  .note-editor.bare .toolbar {
    display: none;
  }
}

.counts {
  margin: 0;
  padding: 0.5rem 1.25rem 0.75rem;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: var(--ink-3);
}

/* ---------- The note itself ---------- */
.content :deep(.note-body) {
  /* Enough room to click into an empty note, without a big gap under a short one */
  min-height: 14rem;
  padding: 1rem 1.25rem 2rem;
  font-size: var(--note-size, 1.0625rem);
  line-height: var(--note-leading, 1.65);
  font-family: var(--note-font, inherit);
  color: var(--ink);
  outline: none;
  overflow-wrap: anywhere;
  text-wrap: pretty;
}

.content :deep(.note-body > * + *) {
  margin-top: 0.6em;
}

.content :deep(.note-body h1) { font-size: 1.6em; line-height: 1.2; margin-top: 1em; text-wrap: balance; }
.content :deep(.note-body h2) { font-size: 1.3em; line-height: 1.25; margin-top: 1em; text-wrap: balance; }
.content :deep(.note-body h3) { font-size: 1.1em; line-height: 1.3; margin-top: 0.9em; }
.content :deep(.note-body p) { margin: 0; }
.content :deep(.note-body ul),
.content :deep(.note-body ol) { padding-left: 1.4em; margin: 0; }
.content :deep(.note-body li > p) { margin: 0.15em 0; }

.content :deep(.note-body blockquote) {
  margin: 0;
  padding-left: 1em;
  color: var(--ink-2);
  border-left: 3px solid color-mix(in srgb, var(--accent) 50%, var(--line));
}

.content :deep(.note-body code) {
  padding: 0.1em 0.35em;
  font-size: 0.9em;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  background: color-mix(in srgb, var(--ink) 7%, transparent);
  border-radius: 5px;
}

.content :deep(.note-body pre) {
  padding: 0.85em 1em;
  overflow-x: auto;
  background: color-mix(in srgb, var(--ink) 6%, var(--surface));
  border-radius: 10px;
}

.content :deep(.note-body pre code) {
  padding: 0;
  background: none;
}

.content :deep(.note-body hr) {
  margin: 1.4em 0;
  border: 0;
  border-top: 1px solid var(--line);
}

.content :deep(.note-body a) {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.content :deep(.note-body img) {
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: 10px;
  outline: 1px solid oklch(0 0 0 / 0.1);
  outline-offset: -1px;
}

.content :deep(.note-body img.ProseMirror-selectednode) {
  outline: 2px solid var(--accent);
}

/* Checklists: a real checkbox to click, and done items fade */
.content :deep(ul[data-type='taskList']) {
  padding-left: 0.1em;
  list-style: none;
}

.content :deep(ul[data-type='taskList'] > li) {
  display: flex;
  align-items: flex-start;
  gap: 0.55em;
}

.content :deep(ul[data-type='taskList'] > li > label) {
  flex: none;
  margin-top: 0.25em;
  user-select: none;
}

.content :deep(ul[data-type='taskList'] > li > label input) {
  width: 1.05em;
  height: 1.05em;
  margin: 0;
  accent-color: var(--accent);
  cursor: pointer;
}

.content :deep(ul[data-type='taskList'] > li > div) {
  flex: 1;
  min-width: 0;
}

.content :deep(ul[data-type='taskList'] > li[data-checked='true'] > div) {
  color: var(--ink-3);
  text-decoration: line-through;
}

/* [[Note links]] */
.content :deep(.note-link) {
  padding: 0.05em 0.4em;
  font-weight: 600;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  border-radius: 6px;
  cursor: pointer;
}

.content :deep(.note-link:not([data-id]))::after {
  content: ' ?';
  opacity: 0.6;
}

.content :deep(p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  color: var(--ink-3);
  pointer-events: none;
}

/* Phones: the formatting bar sits at the bottom, above the keyboard, and scrolls sideways */
@media (max-width: 760px) {
  .note-editor {
    flex-direction: column-reverse;
  }

  .toolbar {
    position: fixed;
    z-index: 60;
    top: auto;
    left: 0;
    right: 0;
    bottom: var(--keyboard, 0px);
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    /* Wider phone buttons: the first label still lines up with the text at 1rem */
    padding-left: 0.1rem;
    padding-bottom: max(0.35rem, env(safe-area-inset-bottom));
    border-top: 1px solid var(--line);
    border-bottom: 0;
  }

  .tool {
    min-width: 2.75rem;
    height: 2.75rem;
    flex: none;
  }

  .style-btn {
    flex: none;
    height: 2.75rem;
  }

  .counts {
    order: -1;
    padding-inline: 1rem;
  }

  .content :deep(.note-body) {
    padding: 0.75rem 1rem 2rem;
    min-height: 40vh;
  }

  /* Room for the fixed bar under the last lines */
  .note-editor {
    padding-bottom: calc(3.5rem + env(safe-area-inset-bottom));
  }
}
</style>

<style>
.note-suggest {
  position: fixed;
  z-index: 400;
  width: 16rem;
  max-height: 16rem;
  margin: 0;
  padding: 0.3rem;
  overflow-y: auto;
  list-style: none;
  background: var(--surface);
  border-radius: 12px;
  box-shadow: 0 0 0 1px rgb(var(--shadow) / 0.1), 0 12px 28px rgb(var(--shadow) / 0.2);
}

.note-suggest li {
  padding: 0.5rem 0.65rem;
  font-size: 0.9rem;
  border-radius: 8px;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-suggest li.on {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}
</style>
