// Turns contact exports into { name, numbers } pairs. Everything runs in the browser; nothing is uploaded.
export interface RawContact {
  name: string
  numbers: string[]
}

// RFC 4180 CSV: quoted fields may hold commas, doubled quotes and line breaks
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter(r => r.some(f => f.trim()))
}

// Google Contacts export: "First Name"/"Last Name" (or "Name" in older exports), "Phone 1 - Value"…;
// one cell can hold several numbers separated by " ::: "
export function parseGoogleCsv(text: string): RawContact[] {
  const [header, ...rows] = parseCsv(text.replace(/^﻿/, ''))
  if (!header) return []
  const col = (name: string) => header.findIndex(h => h.trim().toLowerCase() === name.toLowerCase())
  const phoneCols = header.flatMap((h, i) => (/^phone \d+ - value$/i.test(h.trim()) ? [i] : []))
  if (!phoneCols.length) throw new Error('No phone columns found. Export from Google Contacts as “Google CSV”.')

  const nameCols = ['Name', 'First Name', 'Middle Name', 'Last Name'].map(col)
  const [full, first, middle, last] = nameCols
  const fallbacks = ['File As', 'Nickname', 'Organization Name', 'Organization 1 - Name'].map(col)

  return rows.flatMap((r) => {
    const get = (i: number) => (i >= 0 ? r[i]?.trim() ?? '' : '')
    const name = get(full!) || [get(first!), get(middle!), get(last!)].filter(Boolean).join(' ') || fallbacks.map(get).find(Boolean) || ''
    const numbers = phoneCols.flatMap(i => get(i).split(':::').map(n => n.trim()).filter(Boolean))
    return numbers.length ? [{ name, numbers }] : []
  })
}

// vCard (.vcf) from a phone or iCloud: FN and TEL lines, with folded continuation lines joined
export function parseVcf(text: string): RawContact[] {
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/)
  const out: RawContact[] = []
  let current: RawContact | undefined
  for (const line of lines) {
    const upper = line.toUpperCase()
    if (upper.startsWith('BEGIN:VCARD')) current = { name: '', numbers: [] }
    else if (upper.startsWith('END:VCARD')) {
      if (current?.numbers.length) out.push(current)
      current = undefined
    } else if (current) {
      const colon = line.indexOf(':')
      if (colon < 0) continue
      const key = upper.slice(0, colon).split(';')[0]!.replace(/^ITEM\d+\./, '')
      const value = line.slice(colon + 1).trim()
      if (key === 'FN') current.name = value.replace(/\\,/g, ',')
      else if (key === 'N' && !current.name) current.name = value.split(';').reverse().filter(Boolean).join(' ')
      else if (key === 'TEL' && value) current.numbers.push(value.replace(/^tel:/i, ''))
    }
  }
  return out
}

export function parseContactFile(name: string, text: string): RawContact[] {
  if (/\.vcf$/i.test(name) || /^\s*BEGIN:VCARD/i.test(text)) return parseVcf(text)
  return parseGoogleCsv(text)
}
