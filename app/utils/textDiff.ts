// Word-by-word text comparison (CHECKLIST.md #52), using Myers' diff so long texts stay fast:
// the work grows with how much changed, not with the length squared.
//
// Text is split into words and the spaces/punctuation between them; whitespace is kept as its own
// token so the result reads exactly like the original. A removal followed straight away by an addition
// is reported as a change.

export type Part =
  | { kind: 'same', text: string }
  | { kind: 'added', text: string }
  | { kind: 'removed', text: string }
  | { kind: 'changed', from: string, to: string }

export interface DiffOptions {
  ignoreCase?: boolean
  /** Treat any run of spaces, tabs and line breaks as one space */
  ignoreWhitespace?: boolean
}

// Words (any script, with apostrophes and hyphens inside), runs of whitespace, or single other characters
const TOKEN = /[\p{L}\p{N}\p{M}]+(?:['’\-][\p{L}\p{N}\p{M}]+)*|\s+|[^\s\p{L}\p{N}\p{M}]/gu

export const tokenize = (text: string) => text.match(TOKEN) ?? []

function keyOf(t: string, o: DiffOptions) {
  let k = t
  if (o.ignoreWhitespace && /^\s+$/.test(k)) k = ' '
  if (o.ignoreCase) k = k.toLowerCase()
  return k
}

type Op = { kind: 'same' | 'added' | 'removed', text: string }

// Myers' O((N+M)D) shortest edit script over token keys. Each step keeps only the diagonals it can
// reach (2d+1 numbers), so memory grows with the number of edits squared, not the text length.
function myers(a: string[], b: string[], ka: string[], kb: string[]): Op[] {
  const n = a.length
  const m = b.length
  const trace: Int32Array[] = [] // trace[d][k + d] = furthest x on diagonal k after d edits
  let prev = new Int32Array(1) // d = 0 before following the snake
  let done = false
  for (let d = 0; d <= n + m && !done; d++) {
    const cur = new Int32Array(2 * d + 1)
    for (let k = -d; k <= d; k += 2) {
      // Coming down (an insertion) from k + 1, or across (a deletion) from k - 1
      const fromAbove = d > 0 && (k === -d || (k !== d && at(prev, d - 1, k - 1) < at(prev, d - 1, k + 1)))
      let x = d === 0 ? 0 : fromAbove ? at(prev, d - 1, k + 1) : at(prev, d - 1, k - 1) + 1
      let y = x - k
      while (x < n && y < m && ka[x] === kb[y]) {
        x++
        y++
      }
      cur[k + d] = x
      if (x >= n && y >= m) done = true
    }
    trace.push(cur)
    prev = cur
  }

  // Walk back through the saved steps to recover the edits
  const ops: Op[] = []
  let x = n
  let y = m
  for (let d = trace.length - 1; d >= 0; d--) {
    const k = x - y
    let prevX = 0
    let prevY = 0
    if (d > 0) {
      const p = trace[d - 1]!
      const prevK = k === -d || (k !== d && at(p, d - 1, k - 1) < at(p, d - 1, k + 1)) ? k + 1 : k - 1
      prevX = at(p, d - 1, prevK)
      prevY = prevX - prevK
    }
    // The matching run that ended this step
    while (x > prevX && y > prevY) {
      x--
      y--
      ops.push({ kind: 'same', text: b[y]! })
    }
    if (d === 0) break
    if (x === prevX) {
      y--
      ops.push({ kind: 'added', text: b[y]! })
    } else {
      x--
      ops.push({ kind: 'removed', text: a[x]! })
    }
  }
  return ops.reverse()
}

// Value on diagonal k in a step that covered -d..d
const at = (row: Int32Array, d: number, k: number) => (k < -d || k > d ? -1 : row[k + d]!)

export function diffText(original: string, modified: string, options: DiffOptions = {}): Part[] {
  const a = tokenize(original)
  const b = tokenize(modified)
  const ops = myers(a, b, a.map(t => keyOf(t, options)), b.map(t => keyOf(t, options)))

  // Merge runs of the same kind, then pair a removal directly followed by an addition as a change.
  // Whitespace sandwiched between changed words joins the change so phrases read as one edit.
  const merged: Op[] = []
  for (const op of ops) {
    const last = merged.at(-1)
    if (last && last.kind === op.kind) last.text += op.text
    else merged.push({ ...op })
  }
  const parts: Part[] = []
  for (let i = 0; i < merged.length; i++) {
    const op = merged[i]!
    const next = merged[i + 1]
    if (op.kind === 'removed' && next?.kind === 'added') {
      parts.push({ kind: 'changed', from: op.text, to: next.text })
      i++
    } else if (op.kind === 'added' && next?.kind === 'removed') {
      parts.push({ kind: 'changed', from: next.text, to: op.text })
      i++
    } else {
      parts.push(op)
    }
  }
  return parts
}

const wordsIn = (s: string) => (s.match(/[\p{L}\p{N}]+/gu) ?? []).length

/** Counts for the summary: words added, removed and changed */
export function diffStats(parts: Part[]) {
  let added = 0
  let removed = 0
  let changed = 0
  for (const p of parts) {
    if (p.kind === 'added') added += wordsIn(p.text)
    else if (p.kind === 'removed') removed += wordsIn(p.text)
    else if (p.kind === 'changed') changed += Math.max(wordsIn(p.from), wordsIn(p.to))
  }
  return { added, removed, changed, identical: parts.every(p => p.kind === 'same') }
}
