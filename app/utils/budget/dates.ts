// Calendar days as yyyy-mm-dd in the device's own time zone (never toISOString, which is UTC:
// in Cambodia that's still yesterday until 7 am). Ranges are inclusive at both ends.

export interface DateRange {
  from: string
  to: string
}

const pad = (n: number) => String(n).padStart(2, '0')
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y!, (m ?? 1) - 1, d ?? 1)
}
export const today = () => iso(new Date())

export const addDays = (s: string, n: number) => {
  const d = parse(s)
  d.setDate(d.getDate() + n)
  return iso(d)
}

/** Whole days from a to b (b − a), safe across daylight-saving changes */
export const daysBetween = (a: string, b: string) => Math.round((Date.UTC(...ymd(b)) - Date.UTC(...ymd(a))) / 86_400_000)
const ymd = (s: string): [number, number, number] => {
  const [y, m, d] = s.split('-').map(Number)
  return [y!, m! - 1, d!]
}

export const daysInMonth = (s: string) => {
  const d = parse(s)
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

export const monthOf = (s: string) => s.slice(0, 7)
export const monthRange = (s: string): DateRange => {
  const from = `${monthOf(s)}-01`
  return { from, to: `${monthOf(s)}-${pad(daysInMonth(from))}` }
}
export const addMonths = (s: string, n: number) => {
  const d = parse(`${monthOf(s)}-01`)
  d.setMonth(d.getMonth() + n)
  return iso(d)
}

export const weekRange = (s: string, weekStart: 0 | 1): DateRange => {
  const d = parse(s)
  const back = (d.getDay() - weekStart + 7) % 7
  const from = addDays(s, -back)
  return { from, to: addDays(from, 6) }
}

export const dayRange = (s: string): DateRange => ({ from: s, to: s })

export const inRange = (date: string, r: DateRange) => date >= r.from && date <= r.to

export function eachDay(r: DateRange) {
  const out: string[] = []
  for (let d = r.from; d <= r.to && out.length < 3700; d = addDays(d, 1)) out.push(d)
  return out
}

export const rangeDays = (r: DateRange) => daysBetween(r.from, r.to) + 1

/** The same length of time just before this range */
export const previousRange = (r: DateRange): DateRange => {
  const len = rangeDays(r)
  return { from: addDays(r.from, -len), to: addDays(r.from, -1) }
}

/** A month range shifted by whole months, keeping it a calendar month */
export const previousMonth = (r: DateRange) => monthRange(addMonths(r.from, -1))

export const formatDay = (s: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  parse(s).toLocaleDateString('en-GB', opts)

export const formatMonth = (s: string) => parse(s).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

export function formatRange(r: DateRange) {
  const m = monthRange(r.from)
  if (r.from === m.from && r.to === m.to) return formatMonth(r.from)
  if (r.from === r.to) return formatDay(r.from, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const sameYear = r.from.slice(0, 4) === r.to.slice(0, 4)
  return `${formatDay(r.from, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })} – ${formatDay(r.to, { day: 'numeric', month: 'short', year: 'numeric' })}`
}
