import { InputRule, mergeAttributes, Node, type Extensions } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Placeholder } from '@tiptap/extensions'
import Image from '@tiptap/extension-image'

// The Notes editor's building blocks (Tiptap). Only the Notes page imports this, so the editor's code
// stays out of every other page. Markdown-style shortcuts come with the starter kit: "# " heading,
// "- " bullets, "1. " numbers, "[ ] " checklist, "> " quote, "```" code block, "---" divider,
// **bold**, *italic*, `code`, ~~strike~~.

/** A [[link]] to another note: an inline chip that opens it. Stored as <span data-note-link data-id data-title> */
export const NoteLink = Node.create<{ resolve: (title: string) => { id: string, title: string } | undefined }>({
  name: 'noteLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { resolve: () => undefined }
  },

  addAttributes() {
    return {
      id: {
        default: '',
        parseHTML: el => el.getAttribute('data-id') ?? '',
        renderHTML: attrs => (attrs.id ? { 'data-id': attrs.id } : {})
      },
      title: {
        default: '',
        parseHTML: el => el.getAttribute('data-title') || el.textContent || '',
        renderHTML: attrs => ({ 'data-title': attrs.title })
      }
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-note-link]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-note-link': '', 'class': 'note-link' }), node.attrs.title as string]
  },

  renderText({ node }) {
    return `[[${node.attrs.title}]]`
  },

  // Typing [[Some title]] turns it into a link (to that note when one has the title)
  addInputRules() {
    return [
      new InputRule({
        find: /\[\[([^[\]\n]{1,120})\]\]$/,
        handler: ({ state, range, match }) => {
          const title = match[1]!.trim()
          if (!title) return
          const found = this.options.resolve(title)
          state.tr.replaceWith(range.from, range.to, this.type.create({ id: found?.id ?? '', title: found?.title ?? title }))
        }
      })
    ]
  }
})

export function noteExtensions(opts: { placeholder?: string, resolve?: (title: string) => { id: string, title: string } | undefined } = {}): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: true, linkOnPaste: true, defaultProtocol: 'https' }
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Image.configure({ allowBase64: true }),
    Placeholder.configure({ placeholder: opts.placeholder ?? 'Start writing…' }),
    NoteLink.configure({ resolve: opts.resolve ?? (() => undefined) })
  ]
}

// ---------- Images ----------

/** Largest an image may be once it's been made smaller (bytes of data URL) */
export const IMAGE_MAX_BYTES = 350_000

/**
 * Shrink a picture to fit 1600px (then smaller if needed) as WebP/JPEG, so it can live inside the
 * note and sync with it. Firestore keeps each note under 1 MB, so very big images are refused.
 */
export async function imageToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Only images can go in a note.')
  const bitmap = await createImageBitmap(file)
  try {
    for (const max of [1600, 1200, 900, 640]) {
      const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(bitmap.width * scale)
      canvas.height = Math.round(bitmap.height * scale)
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.82, 0.7]) {
        let url = canvas.toDataURL('image/webp', quality)
        if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', quality)
        if (url.length <= IMAGE_MAX_BYTES) return url
      }
    }
  } finally {
    bitmap.close()
  }
  throw new Error('That image is too detailed to keep in a note, even made smaller.')
}
