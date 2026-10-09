// Notes: the record, and everything about a note that isn't the editor itself: titles, previews,
// tags, links between notes, search, sorting, templates, and Markdown/HTML/text import and export.
// A note's body is the editor's HTML (`html`); `text` is a plain copy kept alongside it so lists,
// search and counts never have to parse HTML.

export interface Note {
  id: string
  /** What you typed as the title; '' means it's taken from the first line (see displayTitle) */
  title: string
  html: string
  text: string
  /** A note folder's id, '' for none */
  folderId: string
  /** #hashtags found in the text, lower-case */
  tags: string[]
  /** Ids of the notes this one links to with [[…]] */
  links: string[]
  favorite?: boolean
  archived?: boolean
  createdAt: string
  updatedAt: string
}

/** An earlier state of a note, kept for Version history */
export interface NoteVersion {
  id: string
  noteId: string
  title: string
  html: string
  at: string
}

export interface NoteTemplate {
  id: string
  name: string
  html: string
}

export type NoteSort = 'modified' | 'created' | 'oldest' | 'az' | 'za'
export type NoteView = 'list' | 'grid' | 'compact'

/** Sidebar choices besides folders */
export const NOTES_ALL = ''
export const NOTES_FAVORITES = ':favorites'
export const NOTES_RECENT = ':recent'
export const NOTES_ARCHIVED = ':archived'
export const NOTES_UNFILED = ':unfiled'

// ---------- Text ----------

const BLOCKS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'LI', 'BLOCKQUOTE', 'PRE', 'DIV', 'HR', 'UL', 'OL'])

/** The note's plain text: one line per paragraph, list item or heading; checklist items as ☐ / ☑ */
export function htmlToText(html: string): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out: string[] = []
  let line = ''
  const flush = () => {
    out.push(line)
    line = ''
  }
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      line += node.textContent ?? ''
      return
    }
    if (!(node instanceof HTMLElement)) return
    if (node.tagName === 'BR') return flush()
    if (node.tagName === 'IMG') {
      line += node.getAttribute('alt') ? `[${node.getAttribute('alt')}]` : ''
      return
    }
    const block = BLOCKS.has(node.tagName)
    if (block && line.trim()) flush()
    if (node.tagName === 'LI' && node.dataset.type === 'taskItem') line += node.dataset.checked === 'true' ? '☑ ' : '☐ '
    node.childNodes.forEach(walk)
    if (block && line.trim()) flush()
    else if (block) line = ''
  }
  doc.body.childNodes.forEach(walk)
  if (line.trim()) flush()
  return out.map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n')
}

/** The first meaningful line, without list or heading marks, cut at a word near 80 characters */
export function autoTitle(text: string): string {
  const first = text.split('\n').map(l => l.replace(/^([#>*\-☐☑•]|\d+[.)])+\s*/, '').trim()).find(Boolean) ?? ''
  if (first.length <= 80) return first
  const cut = first.slice(0, 80)
  const space = cut.lastIndexOf(' ')
  return `${(space > 40 ? cut.slice(0, space) : cut).trim()}…`
}

export const displayTitle = (n: Pick<Note, 'title' | 'text'>) => n.title.trim() || autoTitle(n.text) || 'Untitled note'

/** A couple of lines under the title; skips the first line when the title came from it */
export function previewOf(n: Pick<Note, 'title' | 'text'>, length = 160): string {
  const lines = n.text.split('\n')
  if (!n.title.trim() && lines.length) lines.shift()
  const s = lines.join(' ').replace(/\s+/g, ' ').trim()
  return s.length > length ? `${s.slice(0, length).trimEnd()}…` : s
}

export function tagsOf(text: string): string[] {
  const found = new Set<string>()
  for (const m of text.matchAll(/(?:^|[\s(])#([\p{L}\p{N}][\p{L}\p{N}_-]{0,39})/gu)) found.add(m[1]!.toLowerCase())
  return [...found]
}

/** Ids of the notes linked with [[…]] (the editor stores them as note-link chips) */
export function linksOf(html: string): string[] {
  return [...new Set([...html.matchAll(/data-note-link[^>]*?data-id="([^"]+)"|data-id="([^"]+)"[^>]*?data-note-link/g)].map(m => m[1] ?? m[2]!))]
}

export const wordCount = (text: string) => (text.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) ?? []).length
export const readingMinutes = (words: number) => Math.max(1, Math.round(words / 220))

/** Everything derived from the body, recomputed whenever it changes */
export function derive(html: string) {
  const text = htmlToText(html)
  return { text, tags: tagsOf(text), links: linksOf(html) }
}

// ---------- Search ----------

export interface NoteQuery {
  words: string[]
  folder?: string
  tags: string[]
  is: Set<'favorite' | 'archived' | 'pinned'>
  before?: string
  after?: string
}

/**
 * Plain words, plus optional operators: folder:work tag:project is:favorite is:archived
 * before:2026-10-01 after:2026-10-01. Quotes keep a phrase together: "project plan".
 */
export function parseNoteQuery(q: string): NoteQuery {
  const out: NoteQuery = { words: [], tags: [], is: new Set() }
  for (const m of q.matchAll(/(\w+):("[^"]*"|\S+)|"([^"]*)"|(\S+)/g)) {
    const [, key, raw, phrase, word] = m
    if (key) {
      const v = raw!.replace(/^"|"$/g, '').toLowerCase()
      const k = key.toLowerCase()
      if (k === 'folder') out.folder = v
      else if (k === 'tag') out.tags.push(v.replace(/^#/, ''))
      else if (k === 'is' && (v === 'favorite' || v === 'favourite' || v === 'pinned')) out.is.add('favorite')
      else if (k === 'is' && v === 'archived') out.is.add('archived')
      else if (k === 'before' && /^\d{4}-\d{2}-\d{2}$/.test(v)) out.before = v
      else if (k === 'after' && /^\d{4}-\d{2}-\d{2}$/.test(v)) out.after = v
      else out.words.push(`${key}:${raw}`.toLowerCase())
    } else if (phrase !== undefined) {
      if (phrase.trim()) out.words.push(phrase.toLowerCase())
    } else if (word) {
      if (word.startsWith('#') && word.length > 1) out.tags.push(word.slice(1).toLowerCase())
      else out.words.push(word.toLowerCase())
    }
  }
  return out
}

export const hasOperators = (q: NoteQuery) => !!(q.folder || q.tags.length || q.is.size || q.before || q.after)

/** 0 = no match; higher = better (title hits count most) */
export function scoreNote(n: Note, q: NoteQuery, folderPath: string): number {
  if (q.is.has('favorite') && !n.favorite) return 0
  if (q.is.has('archived') && !n.archived) return 0
  if (q.folder && !folderPath.toLowerCase().includes(q.folder)) return 0
  if (q.tags.some(t => !n.tags.includes(t))) return 0
  const day = n.updatedAt.slice(0, 10)
  if (q.before && day >= q.before) return 0
  if (q.after && day <= q.after) return 0
  if (!q.words.length) return 1
  const title = displayTitle(n).toLowerCase()
  const body = n.text.toLowerCase()
  const extra = `${folderPath} ${n.tags.map(t => `#${t}`).join(' ')}`.toLowerCase()
  let score = 0
  for (const w of q.words) {
    if (title.includes(w)) score += title.startsWith(w) ? 6 : 4
    else if (extra.includes(w)) score += 2
    else if (body.includes(w)) score += 1
    else return 0
  }
  return score
}

/** Where a word first appears in the text, with a little context either side (for search results) */
export function snippetAround(text: string, words: string[], length = 120): string {
  const lower = text.toLowerCase()
  const at = Math.min(...words.map(w => lower.indexOf(w)).filter(i => i >= 0))
  if (!Number.isFinite(at)) return ''
  const start = Math.max(0, at - 40)
  const s = text.slice(start, start + length).replace(/\s+/g, ' ').trim()
  return `${start ? '…' : ''}${s}${start + length < text.length ? '…' : ''}`
}

export function sortNotes(list: Note[], sort: NoteSort): Note[] {
  const by = [...list]
  if (sort === 'created') return by.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  if (sort === 'oldest') return by.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  if (sort === 'az') return by.sort((a, b) => displayTitle(a).localeCompare(displayTitle(b)))
  if (sort === 'za') return by.sort((a, b) => displayTitle(b).localeCompare(displayTitle(a)))
  return by.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** "Today", "Yesterday", "Earlier this week", "Earlier" for grouping Recent */
export function dayGroup(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((start(now) - start(d)) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return 'Earlier this week'
  if (days < 31) return 'Earlier this month'
  return 'Older'
}

// ---------- Templates ----------

const tasks = (n: number) => `<ul data-type="taskList">${'<li data-type="taskItem" data-checked="false"><p></p></li>'.repeat(n)}</ul>`

export const BUILT_IN_TEMPLATES: NoteTemplate[] = [
  { id: 'meeting', name: 'Meeting', html: `<h2>Meeting</h2><p><strong>Date:</strong> </p><p><strong>Participants:</strong> </p><h3>Agenda</h3><ul><li><p></p></li></ul><h3>Discussion</h3><p></p><h3>Decisions</h3><ul><li><p></p></li></ul><h3>Action items</h3>${tasks(3)}` },
  { id: 'project', name: 'Project', html: `<h2>Project</h2><p><strong>Objective:</strong> </p><h3>Requirements</h3><ul><li><p></p></li></ul><h3>Tasks</h3>${tasks(3)}<h3>Notes</h3><p></p><h3>Links</h3><ul><li><p></p></li></ul>` },
  { id: 'daily', name: 'Daily note', html: `<h2>Daily note</h2><p><strong>Date:</strong> {{date}}</p><h3>Today’s focus</h3><p></p><h3>Tasks</h3>${tasks(3)}<h3>Notes</h3><p></p><h3>Tomorrow</h3><p></p>` }
]

/** Fill in a template's placeholders ({{date}}) at the moment it's used */
export const fillTemplate = (html: string, now = new Date()) =>
  html.replace(/\{\{date\}\}/g, now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))

// ---------- Export ----------

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** The note's body as Markdown (headings, lists, checklists, quotes, code, links, [[note links]]) */
export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const inline = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').replace(/([*_`[\]\\])/g, '\\$1')
    if (!(node instanceof HTMLElement)) return ''
    const inner = () => [...node.childNodes].map(inline).join('')
    switch (node.tagName) {
      case 'STRONG': case 'B': return `**${inner()}**`
      case 'EM': case 'I': return `*${inner()}*`
      case 'S': case 'DEL': return `~~${inner()}~~`
      case 'U': return `<u>${inner()}</u>`
      case 'CODE': return `\`${node.textContent ?? ''}\``
      case 'A': return `[${inner()}](${node.getAttribute('href') ?? ''})`
      case 'BR': return '  \n'
      case 'IMG': return `![${node.getAttribute('alt') ?? ''}](${node.getAttribute('src') ?? ''})`
      case 'SPAN': return node.hasAttribute('data-note-link') ? `[[${node.textContent ?? ''}]]` : inner()
      default: return inner()
    }
  }
  const block = (node: Node, depth = 0): string => {
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').trim() ? inline(node) : ''
    if (!(node instanceof HTMLElement)) return ''
    const pad = '  '.repeat(depth)
    switch (node.tagName) {
      case 'H1': case 'H2': case 'H3': case 'H4': return `${'#'.repeat(Number(node.tagName[1]))} ${inline(node)}`
      case 'P': return inline(node)
      case 'HR': return '---'
      case 'PRE': return `\`\`\`\n${node.textContent ?? ''}\n\`\`\``
      case 'BLOCKQUOTE': return [...node.children].map(c => block(c)).join('\n\n').split('\n').map(l => `> ${l}`).join('\n')
      case 'UL': case 'OL': {
        const task = node.dataset.type === 'taskList'
        return [...node.children].map((li, i) => {
          const el = li as HTMLElement
          const mark = task ? `- [${el.dataset.checked === 'true' ? 'x' : ' '}] ` : node.tagName === 'OL' ? `${i + 1}. ` : '- '
          const parts = [...el.childNodes].filter(c => !(c instanceof HTMLElement && c.tagName === 'LABEL'))
          const text = parts.filter(c => !(c instanceof HTMLElement && /^(UL|OL)$/.test(c.tagName))).map(c => (c instanceof HTMLElement && c.tagName === 'DIV') ? [...c.childNodes].map(x => block(x)).join(' ') : block(c)).join(' ').trim()
          const nested = parts.filter(c => c instanceof HTMLElement && /^(UL|OL)$/.test(c.tagName)).map(c => block(c, depth + 1)).join('\n')
          return `${pad}${mark}${text}${nested ? `\n${nested}` : ''}`
        }).join('\n')
      }
      case 'DIV': return [...node.childNodes].map(c => block(c, depth)).filter(Boolean).join('\n\n')
      default: return inline(node)
    }
  }
  return [...doc.body.childNodes].map(n => block(n)).filter(s => s.trim()).join('\n\n').trim()
}

const frontMatter = (fields: Record<string, string | string[] | undefined>) =>
  `---\n${Object.entries(fields).filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)).map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.join(', ')}]` : JSON.stringify(v)}`).join('\n')}\n---\n\n`

export function noteToMarkdown(n: Note, folderPath: string) {
  return frontMatter({ title: displayTitle(n), folder: folderPath, tags: n.tags, created: n.createdAt, modified: n.updatedAt, favorite: n.favorite ? 'true' : undefined, archived: n.archived ? 'true' : undefined }) + htmlToMarkdown(n.html)
}

export const noteToText = (n: Note) => `${displayTitle(n)}\n\n${n.title.trim() ? n.text : n.text.split('\n').slice(1).join('\n')}`.trim()

export function noteToHtmlFile(n: Note, folderPath: string) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(displayTitle(n))}</title>
<meta name="created" content="${n.createdAt}">
<meta name="modified" content="${n.updatedAt}">${folderPath ? `\n<meta name="folder" content="${esc(folderPath)}">` : ''}${n.tags.length ? `\n<meta name="keywords" content="${esc(n.tags.join(', '))}">` : ''}
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:46rem;margin:2rem auto;padding:0 1rem;color:#1b1f2a}img{max-width:100%}blockquote{border-left:3px solid #ccc;margin-left:0;padding-left:1rem;color:#555}pre{background:#f3f4f6;padding:1rem;border-radius:8px;overflow:auto}ul[data-type=taskList]{list-style:none;padding-left:0}</style>
</head>
<body>
<h1>${esc(displayTitle(n))}</h1>
${n.html}
</body>
</html>
`
}

export const safeFileName = (s: string) => (s.replace(/[\\/:*?"<>|#\n\r]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'note')

// ---------- Import ----------

export interface ImportedNote {
  title: string
  html: string
  folder?: string
  tags?: string[]
  createdAt?: string
  updatedAt?: string
  favorite?: boolean
  archived?: boolean
}

const inlineMd = (s: string) => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/__([^_]+)__/g, '<strong>$1</strong>')
  .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
  .replace(/(^|[^\w_])_([^_\s][^_]*)_/g, '$1<em>$2</em>')
  .replace(/~~([^~]+)~~/g, '<s>$1</s>')
  .replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/g, '<u>$1</u>')
  .replace(/!\[([^\]]*)\]\(((?:https?:|data:image\/)[^)\s]+)\)/g, '<img src="$2" alt="$1">')
  .replace(/\[([^\]]+)\]\(((?:https?:|mailto:)[^)\s]+)\)/g, '<a href="$2">$1</a>')
  .replace(/\[\[([^\]]+)\]\]/g, '<span data-note-link data-title="$1">$1</span>')
  .replace(/\\([*_`[\]\\])/g, '$1')

/** Markdown into the editor's HTML: headings, lists, checklists, quotes, code, rules, inline marks */
export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  let i = 0
  const list = (start: number, indent: number): [string, number] => {
    const first = lines[start]!.trim()
    const kind = /^[-*+] \[[ xX]\] /.test(first) ? 'task' : /^\d+[.)] /.test(first) ? 'ol' : 'ul'
    const items: string[] = []
    let j = start
    while (j < lines.length) {
      const line = lines[j]!
      const lead = line.match(/^\s*/)![0].length
      const t = line.trim()
      if (!t) {
        j++
        if (j < lines.length && lines[j]!.trim() && lines[j]!.match(/^\s*/)![0].length >= indent && /^([-*+]|\d+[.)]) /.test(lines[j]!.trim())) continue
        break
      }
      if (lead < indent || !/^([-*+]|\d+[.)]) /.test(t)) break
      if (lead > indent) {
        const [nested, next] = list(j, lead)
        if (items.length) items[items.length - 1] = items[items.length - 1]!.replace(/<\/li>$/, `${nested}</li>`)
        j = next
        continue
      }
      const task = t.match(/^[-*+] \[([ xX])\] (.*)$/)
      if (kind === 'task' && task) items.push(`<li data-type="taskItem" data-checked="${task[1] !== ' '}"><p>${inlineMd(task[2]!)}</p></li>`)
      else items.push(`<li><p>${inlineMd(t.replace(/^([-*+]|\d+[.)]) (\[[ xX]\] )?/, ''))}</p></li>`)
      j++
    }
    const open = kind === 'task' ? '<ul data-type="taskList">' : `<${kind}>`
    return [`${open}${items.join('')}</${kind === 'task' ? 'ul' : kind}>`, j]
  }
  while (i < lines.length) {
    const line = lines[i]!
    const t = line.trim()
    if (!t) {
      i++
      continue
    }
    if (t.startsWith('```')) {
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i]!.trim().startsWith('```')) code.push(lines[i++]!)
      i++
      out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`)
      continue
    }
    const h = t.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      out.push(`<h${Math.min(h[1]!.length, 3)}>${inlineMd(h[2]!)}</h${Math.min(h[1]!.length, 3)}>`)
      i++
      continue
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      out.push('<hr>')
      i++
      continue
    }
    if (t.startsWith('>')) {
      const quote: string[] = []
      while (i < lines.length && lines[i]!.trim().startsWith('>')) quote.push(lines[i++]!.trim().replace(/^>\s?/, ''))
      out.push(`<blockquote>${markdownToHtml(quote.join('\n'))}</blockquote>`)
      continue
    }
    if (/^([-*+]|\d+[.)]) /.test(t)) {
      const [html, next] = list(i, line.match(/^\s*/)![0].length)
      out.push(html)
      i = next
      continue
    }
    const para: string[] = []
    while (i < lines.length && lines[i]!.trim() && !/^(#{1,4}\s|```|>|([-*+]|\d+[.)]) |(-{3,}|\*{3,})$)/.test(lines[i]!.trim())) para.push(inlineMd(lines[i++]!.trim()))
    out.push(`<p>${para.join('<br>')}</p>`)
  }
  return out.join('')
}

function readFrontMatter(md: string): [Record<string, string>, string] {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!m) return [{}, md]
  const fields: Record<string, string> = {}
  for (const line of m[1]!.split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/)
    if (!kv) continue
    let v = kv[2]!.trim()
    try {
      if (v.startsWith('"')) v = JSON.parse(v)
    } catch {}
    fields[kv[1]!.toLowerCase()] = v
  }
  return [fields, md.slice(m[0].length)]
}

const isoOrUndefined = (s?: string) => (s && !Number.isNaN(Date.parse(s)) ? new Date(s).toISOString() : undefined)

export function importMarkdown(md: string, fileName = ''): ImportedNote {
  const [fm, body] = readFrontMatter(md)
  let html = markdownToHtml(body)
  let title = fm.title ?? ''
  // A single leading # heading is the title when there's no front matter title
  const h1 = body.trimStart().match(/^#\s+(.+)\n?/)
  if (!title && h1) {
    title = h1[1]!.trim()
    html = markdownToHtml(body.trimStart().slice(h1[0].length))
  }
  return {
    title: title || fileName.replace(/\.(md|markdown|txt)$/i, ''),
    html,
    folder: fm.folder,
    tags: fm.tags ? fm.tags.replace(/^\[|\]$/g, '').split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean) : undefined,
    createdAt: isoOrUndefined(fm.created),
    updatedAt: isoOrUndefined(fm.modified),
    favorite: fm.favorite === 'true',
    archived: fm.archived === 'true'
  }
}

export function importText(txt: string, fileName = ''): ImportedNote {
  const paras = txt.replace(/\r\n?/g, '\n').split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
  return { title: fileName.replace(/\.txt$/i, ''), html: paras.map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('') }
}

export function importHtml(html: string, fileName = ''): ImportedNote {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const meta = (name: string) => doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? undefined
  const h1 = doc.body.querySelector(':scope > h1')
  const title = doc.title || h1?.textContent?.trim() || fileName.replace(/\.html?$/i, '')
  if (h1 && h1.textContent?.trim() === title) h1.remove()
  return {
    title,
    html: doc.body.innerHTML,
    folder: meta('folder'),
    tags: meta('keywords')?.split(',').map(t => t.trim()).filter(Boolean),
    createdAt: isoOrUndefined(meta('created')),
    updatedAt: isoOrUndefined(meta('modified'))
  }
}

/** Our own JSON export (or a plain array of { title, html | text | markdown }) */
export function importJson(json: string): ImportedNote[] {
  const data: unknown = JSON.parse(json)
  const list = Array.isArray(data) ? data : (data as { notes?: unknown[] })?.notes
  if (!Array.isArray(list)) throw new Error('This JSON file doesn’t contain notes.')
  return list.filter((n): n is Record<string, unknown> => !!n && typeof n === 'object').map(n => ({
    title: typeof n.title === 'string' ? n.title : '',
    html: typeof n.html === 'string' ? n.html : typeof n.markdown === 'string' ? markdownToHtml(n.markdown) : typeof n.text === 'string' ? importText(n.text).html : '',
    folder: typeof n.folder === 'string' ? n.folder : undefined,
    tags: Array.isArray(n.tags) ? n.tags.filter((t): t is string => typeof t === 'string') : undefined,
    createdAt: isoOrUndefined(typeof n.createdAt === 'string' ? n.createdAt : undefined),
    updatedAt: isoOrUndefined(typeof n.updatedAt === 'string' ? n.updatedAt : undefined),
    favorite: n.favorite === true,
    archived: n.archived === true
  }))
}
