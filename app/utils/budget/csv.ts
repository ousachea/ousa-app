// Budget CSV in and out. Export writes what's on screen (already filtered); import maps a file's
// columns to fields, checks every row and reports problems by row number before anything is saved.
import type { BudgetCategory, BudgetTransaction, Currency, Kind, PaymentMethod } from './types'
import { transactionKey } from './calc'

export interface CsvColumnDef<T> {
  header: string
  get: (row: T) => unknown
}

export function transactionColumns(cats: Map<string, BudgetCategory>, methods: PaymentMethod[]): CsvColumnDef<BudgetTransaction>[] {
  const name = (id: string) => cats.get(id)?.name ?? ''
  return [
    { header: 'Date', get: t => t.date },
    { header: 'Type', get: t => (t.kind === 'income' ? 'Income' : 'Expense') },
    { header: 'Amount', get: t => t.amount },
    { header: 'Currency', get: t => t.currency },
    { header: 'Category', get: t => name(t.categoryId) },
    { header: 'Subcategory', get: t => name(t.subcategoryId) },
    { header: 'Payment method', get: t => methods.find(m => m.id === t.method)?.name ?? '' },
    { header: 'Merchant', get: t => t.merchant },
    { header: 'Note', get: t => t.note },
    { header: 'Tags', get: t => t.tags.join('; ') },
    { header: 'Recurring bill', get: t => (t.recurringId ? 'Yes' : '') }
  ]
}

// ---------- Import ----------

export type ImportField = 'date' | 'amount' | 'type' | 'currency' | 'category' | 'subcategory' | 'method' | 'merchant' | 'note' | 'tags'

export const IMPORT_FIELDS: { value: ImportField, label: string, required?: boolean, guesses: string[] }[] = [
  { value: 'date', label: 'Date', required: true, guesses: ['date', 'day', 'transaction date', 'posted'] },
  { value: 'amount', label: 'Amount', required: true, guesses: ['amount', 'value', 'price', 'total', 'sum'] },
  { value: 'type', label: 'Expense or income', guesses: ['type', 'kind', 'direction'] },
  { value: 'currency', label: 'Currency', guesses: ['currency', 'ccy'] },
  { value: 'category', label: 'Category', required: true, guesses: ['category', 'group'] },
  { value: 'subcategory', label: 'Subcategory', guesses: ['subcategory', 'sub category', 'sub-category'] },
  { value: 'method', label: 'Payment method', guesses: ['payment method', 'method', 'paid with', 'account'] },
  { value: 'merchant', label: 'Merchant', guesses: ['merchant', 'payee', 'shop', 'place', 'location'] },
  { value: 'note', label: 'Note', guesses: ['note', 'notes', 'description', 'memo', 'details'] },
  { value: 'tags', label: 'Tags', guesses: ['tags', 'tag', 'labels'] }
]

/** The header that most likely holds each field */
export function guessMapping(headers: string[]): Partial<Record<ImportField, string>> {
  const out: Partial<Record<ImportField, string>> = {}
  const taken = new Set<string>()
  for (const f of IMPORT_FIELDS) {
    const hit = f.guesses.map(g => headers.find(h => !taken.has(h) && h.toLowerCase() === g)).find(Boolean)
      ?? f.guesses.map(g => headers.find(h => !taken.has(h) && h.toLowerCase().includes(g))).find(Boolean)
    if (hit) {
      out[f.value] = hit
      taken.add(hit)
    }
  }
  return out
}

const pad = (n: number) => String(n).padStart(2, '0')
/** yyyy-mm-dd from 2026-10-12, 12/10/2026 (day first or month first), or "12 Oct 2026" */
export function parseDate(s: string, dayFirst: boolean) {
  const t = s.trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t)
  if (m) return valid(+m[1]!, +m[2]!, +m[3]!)
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(t)
  if (m) {
    const year = m[3]!.length === 2 ? 2000 + +m[3]! : +m[3]!
    return dayFirst ? valid(year, +m[2]!, +m[1]!) : valid(year, +m[1]!, +m[2]!)
  }
  const d = new Date(t)
  return Number.isNaN(d.getTime()) || !/[a-z]/i.test(t) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function valid(y: number, mo: number, d: number) {
  const dt = new Date(y, mo - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? `${y}-${pad(mo)}-${pad(d)}` : ''
}

export interface ImportRow {
  /** 1-based, counting the header as row 1, the way a spreadsheet shows it */
  line: number
  record?: Omit<BudgetTransaction, 'id' | 'createdAt' | 'updatedAt'>
  errors: string[]
  duplicate: boolean
  /** Category or subcategory names that will be created on import */
  creates: string[]
}

export interface ImportOptions {
  mapping: Partial<Record<ImportField, string>>
  dayFirst: boolean
  defaultCurrency: Currency
  createMissing: boolean
  categories: BudgetCategory[]
  methods: PaymentMethod[]
  existing: BudgetTransaction[]
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ')

/**
 * Check every row. Nothing is created here; rows that would need a new category say so in `creates`,
 * and use placeholder ids `new:<kind>:<name>` / `new:<kind>:<parent>:<name>` that the caller swaps in.
 */
export function checkImport(rows: Record<string, string>[], o: ImportOptions): ImportRow[] {
  const get = (row: Record<string, string>, f: ImportField) => (o.mapping[f] ? (row[o.mapping[f]!.toLowerCase()] ?? '').trim() : '')
  const seen = new Set(o.existing.map(transactionKey))
  return rows.map((row, i) => {
    const errors: string[] = []
    const creates: string[] = []
    const date = parseDate(get(row, 'date'), o.dayFirst)
    if (!date) errors.push(get(row, 'date') ? `“${get(row, 'date')}” isn’t a date` : 'No date')

    const rawAmount = get(row, 'amount')
    const num = Number(rawAmount.replace(/[^\d.\-]/g, ''))
    if (!rawAmount || !Number.isFinite(num) || num === 0) errors.push(rawAmount ? `“${rawAmount}” isn’t an amount` : 'No amount')

    const typeText = norm(get(row, 'type'))
    // Income only when the file says so; negative amounts are expenses written with a minus
    const kind: Kind = /income|credit|received|deposit/.test(typeText) ? 'income' : 'expense'

    const curText = get(row, 'currency') + rawAmount
    const currency: Currency = /khr|riel|៛/i.test(curText) ? 'KHR' : /usd|\$/i.test(curText) ? 'USD' : o.defaultCurrency

    const catName = get(row, 'category')
    let categoryId = ''
    let subcategoryId = ''
    if (!catName) {
      errors.push('No category')
    } else {
      const cat = o.categories.find(c => !c.parentId && c.kind === kind && norm(c.name) === norm(catName))
      if (cat) categoryId = cat.id
      else if (o.createMissing) {
        categoryId = `new:${kind}:${catName.trim()}`
        creates.push(catName.trim())
      } else errors.push(`No ${kind === 'income' ? 'income source' : 'category'} called “${catName}”`)

      const subName = kind === 'expense' ? get(row, 'subcategory') : ''
      if (subName && categoryId) {
        const sub = cat && o.categories.find(c => c.parentId === cat.id && norm(c.name) === norm(subName))
        if (sub) subcategoryId = sub.id
        else if (o.createMissing) {
          subcategoryId = `new:${kind}:${catName.trim()}:${subName.trim()}`
          creates.push(`${catName.trim()} › ${subName.trim()}`)
        } else errors.push(`No subcategory “${subName}” in ${cat?.name ?? catName}`)
      }
    }

    const methodText = norm(get(row, 'method'))
    const method = o.methods.find(m => norm(m.name) === methodText || m.id === methodText)?.id ?? (methodText ? 'other' : kind === 'income' ? 'bank' : 'cash')

    const record = errors.length
      ? undefined
      : {
          kind, amount: Math.abs(num), currency, categoryId, subcategoryId, date,
          note: get(row, 'note'), method, merchant: get(row, 'merchant'),
          tags: get(row, 'tags').split(/[;,]/).map(t => t.trim().replace(/^#/, '')).filter(Boolean)
        }
    let duplicate = false
    if (record) {
      const key = transactionKey(record)
      duplicate = seen.has(key)
      seen.add(key)
    }
    return { line: i + 2, record, errors, duplicate, creates }
  })
}
