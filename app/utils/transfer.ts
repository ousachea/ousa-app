// Files in and out of the apps (CHECKLIST.md #17, #18): CSV and JSON for every tracker, plus the
// whole-app backup. Everything happens in the browser; nothing is uploaded.

/** Save text as a file, named the way people find it later, e.g. renewals-2026-10-08.csv */
export function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export const dated = (base: string, ext: string) => `${base}-${new Date().toISOString().slice(0, 10)}.${ext}`

// ---------- CSV ----------

const csvCell = (v: unknown) => {
  const s = v == null ? '' : Array.isArray(v) ? v.join('; ') : String(v)
  // Quote anything with a comma, quote or line break. Text starting with = + - @ is neutralised so a
  // spreadsheet never runs it as a formula, except plain numbers like -12.5 or +855 12 345 678
  const formulaLike = /^[=@\t\r]/.test(s) || (/^[+\-]/.test(s) && !/^[+\-][\d\s().]+$/.test(s))
  const safe = formulaLike ? `'${s}` : s
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export interface CsvColumn<T> {
  header: string
  get: (row: T) => unknown
}

export function toCSV<T>(rows: T[], columns: CsvColumn<T>[]) {
  const lines = [columns.map(c => csvCell(c.header)).join(',')]
  for (const r of rows) lines.push(columns.map(c => csvCell(c.get(r))).join(','))
  // A BOM so Excel reads Khmer and other non-English text correctly
  return `﻿${lines.join('\r\n')}\r\n`
}

/** Parse CSV text into rows keyed by lower-cased header */
export function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') {
        quoted = false
      } else {
        cell += c
      }
    } else if (c === '"') {
      quoted = true
    } else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += c
    }
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  const [head, ...body] = rows.filter(r => r.some(c => c.trim()))
  if (!head) return []
  const keys = head.map(h => h.trim().toLowerCase())
  return body.map(r => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])))
}

/** Read a cell by any of its likely header names */
export const cellOf = (row: Record<string, string>, ...names: string[]) => {
  for (const n of names) {
    const v = row[n.toLowerCase()]
    if (v !== undefined && v !== '') return v
  }
  return ''
}

export const toNumber = (s: string) => {
  const n = Number(s.replace(/[^\d.\-]/g, ''))
  return Number.isFinite(n) ? n : undefined
}

/** yyyy-mm-dd from most date spellings, or '' */
export function toIsoDate(s: string) {
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Read a picked file as text, refusing anything too big to be a real export */
export async function readTextFile(file: File, maxMb = 20) {
  if (file.size > maxMb * 1024 * 1024) throw new Error(`That file is over ${maxMb} MB, too big to be an export from this app.`)
  return file.text()
}

// ---------- JSON ----------

export interface CollectionExport<T> {
  app: 'ousa-app'
  kind: 'collection'
  collection: string
  version: 1
  exportedAt: string
  items: T[]
}

export const toCollectionJSON = <T>(collection: string, items: T[]) =>
  JSON.stringify({ app: 'ousa-app', kind: 'collection', collection, version: 1, exportedAt: new Date().toISOString(), items } satisfies CollectionExport<T>, null, 2)

/**
 * Items from a JSON file: this app's own export, a full backup (takes the matching collection),
 * or a plain array of records.
 */
export function itemsFromJSON(text: string, collection: string): Record<string, unknown>[] {
  const data: unknown = JSON.parse(text)
  if (Array.isArray(data)) return data.filter(isRecord)
  if (isRecord(data)) {
    if (Array.isArray(data.items)) return data.items.filter(isRecord)
    const fromBackup = (data.collections as Record<string, unknown> | undefined)?.[collection]
    if (Array.isArray(fromBackup)) return fromBackup.filter(isRecord)
  }
  return []
}

export const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
