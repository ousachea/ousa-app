// Calendar maths for the Date calculator, on yyyy-mm-dd strings read as UTC days so daylight saving
// and time zones never shift a count.
const DAY = 86_400_000
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`)
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)

export const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(ms(s)) && iso(ms(s)) === s
export const daysBetween = (from: string, to: string) => Math.round((ms(to) - ms(from)) / DAY)
export const addDays = (from: string, n: number) => iso(ms(from) + n * DAY)
export const weekday = (d: string) => new Date(ms(d)).getUTCDay() // 0 Sunday … 6 Saturday

/** Months move to the same day, or the month's last day when it's shorter (31 Jan + 1 month = 28/29 Feb) */
export function addMonths(from: string, n: number) {
  const d = new Date(ms(from))
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + n)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return iso(d.getTime())
}

/** The gap as years, months and days, counted forward from the earlier date */
export function ymdBetween(a: string, b: string) {
  const [from, to] = a <= b ? [a, b] : [b, a]
  let months = 0
  while (addMonths(from, months + 1) <= to) months++
  return { years: Math.floor(months / 12), months: months % 12, days: daysBetween(addMonths(from, months), to) }
}

export interface WorkWeek {
  /** Saturday is a working day (common in Cambodia) */
  saturday: boolean
  /** Public holidays to skip, as yyyy-mm-dd */
  holidays: ReadonlySet<string>
}

export const isWorkDay = (d: string, w: WorkWeek) => {
  const wd = weekday(d)
  return wd !== 0 && (wd !== 6 || w.saturday) && !w.holidays.has(d)
}

/** Working days from `from` up to `to`, not counting `to` itself (the same span as daysBetween) */
export function workDaysBetween(from: string, to: string, w: WorkWeek) {
  const [a, b] = from <= to ? [from, to] : [to, from]
  let n = 0
  for (let d = a; d < b; d = addDays(d, 1)) if (isWorkDay(d, w)) n++
  return from <= to ? n : -n
}

/** The date `n` working days after (or before, for negative n) `from`, which isn't counted */
export function addWorkDays(from: string, n: number, w: WorkWeek) {
  const step = Math.sign(n)
  let d = from
  for (let left = Math.abs(n); left > 0;) {
    d = addDays(d, step)
    if (isWorkDay(d, w)) left--
  }
  return d
}

/** Every day a holiday covers, from /api/holidays' start and end */
export function holidayDays(list: readonly { start: string, end: string }[]) {
  const out = new Set<string>()
  for (const h of list) for (let d = h.start; d <= h.end; d = addDays(d, 1)) out.add(d)
  return out
}

// ---------- Clock times, as "HH:MM" from <input type="time"> ----------
const DAY_MIN = 24 * 60
export const isClock = (s: string) => /^([01]\d|2[0-3]):[0-5]\d/.test(s)
export const clockMinutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))

/** Minutes from `from` to `to`; an end before the start runs past midnight (22:00 to 06:00 is 8 hours) */
export const minutesBetween = (from: string, to: string) => (clockMinutes(to) - clockMinutes(from) + DAY_MIN) % DAY_MIN

/** The clock time `n` minutes later (or earlier), and how many days that moves: +1 is the next day */
export function addMinutes(from: string, n: number) {
  const total = clockMinutes(from) + n
  const m = ((total % DAY_MIN) + DAY_MIN) % DAY_MIN
  return { time: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`, days: Math.floor(total / DAY_MIN) }
}

/** 510 → "8 h 30 min" */
export function fmtDuration(min: number) {
  const sign = min < 0 ? '−' : ''
  const h = Math.floor(Math.abs(min) / 60)
  const m = Math.abs(min) % 60
  return sign + ([h && `${h} h`, (m || !h) && `${m} min`].filter(Boolean).join(' '))
}
