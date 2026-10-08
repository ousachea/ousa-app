export type Cycle = 'weekly' | 'monthly' | 'quarterly' | 'halfyearly' | 'yearly' | 'once'

export const CYCLES: { value: Cycle, label: string, perMonth: number }[] = [
  { value: 'weekly', label: 'Every week', perMonth: 52 / 12 },
  { value: 'monthly', label: 'Every month', perMonth: 1 },
  { value: 'quarterly', label: 'Every 3 months', perMonth: 1 / 3 },
  { value: 'halfyearly', label: 'Every 6 months', perMonth: 1 / 6 },
  { value: 'yearly', label: 'Every year', perMonth: 1 / 12 },
  // Something that ends rather than renews (a domain you won't keep, a free trial): it can expire
  { value: 'once', label: 'Doesn’t repeat', perMonth: 0 }
]

const parse = (d: string) => {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y!, m! - 1, day!)
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Add one billing cycle. Month maths clamps to the month's last day (Jan 31 -> Feb 28), like real billing.
function step(date: Date, cycle: Cycle, anchorDay: number) {
  if (cycle === 'weekly') return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7)
  const months = cycle === 'monthly' ? 1 : cycle === 'quarterly' ? 3 : cycle === 'halfyearly' ? 6 : 12
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(anchorDay, lastDay))
  return target
}

// The next renewal on or after today, rolling a past date forward by whole cycles
export function nextRenewal(nextDate: string, cycle: Cycle, today = new Date()) {
  // One-off dates don't roll forward; once they've passed, they've expired
  if (cycle === 'once') return nextDate
  const start = parse(nextDate)
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  let d = start
  let guard = 0
  while (d < now && guard++ < 2000) d = step(d, cycle, start.getDate())
  return iso(d)
}

export function daysUntil(date: string, today = new Date()) {
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((parse(date).getTime() - now.getTime()) / 86_400_000)
}

// ---------- Status (CHECKLIST.md #56) ----------

export type RenewalStatus = 'safe' | 'upcoming' | 'soon' | 'due' | 'expired'

// Colour, a symbol and words together, so the status never depends on colour alone
export const STATUS: Record<RenewalStatus, { label: string, symbol: string, badge: string }> = {
  safe: { label: 'Safe', symbol: '✓', badge: 'good' },
  upcoming: { label: 'Upcoming', symbol: '◷', badge: 'info' },
  soon: { label: 'Soon', symbol: '!', badge: 'warn' },
  due: { label: 'Due', symbol: '●', badge: 'bad' },
  expired: { label: 'Expired', symbol: '✕', badge: '' }
}

/** More than a month away is safe; a month to a week upcoming; a week to two days soon; today or tomorrow due */
export function statusOf(days: number): RenewalStatus {
  if (days < 0) return 'expired'
  if (days <= 1) return 'due'
  if (days <= 7) return 'soon'
  if (days <= 30) return 'upcoming'
  return 'safe'
}

// ---------- Countdown (CHECKLIST.md #55) ----------

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`

/** Whole calendar months from `from` to `to`, and what's left after them */
function monthsBetween(from: Date, to: Date) {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  const step = (n: number) => new Date(from.getFullYear(), from.getMonth() + n, from.getDate(), from.getHours(), from.getMinutes(), from.getSeconds())
  if (step(months) > to) months--
  return { months, rest: to.getTime() - step(months).getTime() }
}

export interface Countdown {
  /** The biggest unit, shown large: 2 */
  value: number
  /** Its name: "months" */
  unit: string
  /** The full reading with the next unit: "2 months, 1 week" */
  text: string
  /** Changing every second (under an hour left), so the page should tick each second */
  live: boolean
}

/**
 * Time left until `target`, more precise as it gets closer: months and weeks, then weeks and days,
 * days and hours, hours and minutes, and in the last hour minutes and seconds.
 */
export function countdown(target: Date, now = new Date()): Countdown {
  const ms = target.getTime() - now.getTime()
  if (ms <= 0) return { value: 0, unit: 'now', text: 'now', live: false }
  const MIN = 60_000
  const HOUR = 60 * MIN
  const DAY = 24 * HOUR
  const two = (a: [number, string], b: [number, string]) => ({
    value: a[0],
    unit: a[0] === 1 ? a[1] : `${a[1]}s`,
    text: [plural(...a), b[0] ? plural(...b) : ''].filter(Boolean).join(', ')
  })
  if (ms >= 60 * DAY) {
    const { months, rest } = monthsBetween(now, target)
    return { ...two([months, 'month'], [Math.floor(rest / (7 * DAY)), 'week']), live: false }
  }
  if (ms >= 14 * DAY) return { ...two([Math.floor(ms / (7 * DAY)), 'week'], [Math.floor((ms % (7 * DAY)) / DAY), 'day']), live: false }
  if (ms >= 2 * DAY) return { ...two([Math.floor(ms / DAY), 'day'], [Math.floor((ms % DAY) / HOUR), 'hour']), live: false }
  if (ms >= HOUR) return { ...two([Math.floor(ms / HOUR), 'hour'], [Math.floor((ms % HOUR) / MIN), 'minute']), live: false }
  return { ...two([Math.floor(ms / MIN), 'minute'], [Math.floor((ms % MIN) / 1000), 'second']), live: true }
}

/** The moment a renewal date starts (local midnight) */
export const renewalMoment = (date: string) => parse(date)

// ---------- Equivalent cost (CHECKLIST.md #58) ----------

export const PERIODS = [
  { value: 'day', label: 'Day', perMonth: 12 / 365.25 },
  { value: 'week', label: 'Week', perMonth: 12 / 52.18 },
  { value: 'month', label: 'Month', perMonth: 1 },
  { value: 'quarter', label: 'Quarter', perMonth: 3 },
  { value: 'half', label: 'Half-year', perMonth: 6 },
  { value: 'year', label: 'Year', perMonth: 12 }
] as const
export type Period = (typeof PERIODS)[number]['value']

/** What a price billed every `cycle` works out to per `period`, spread evenly */
export function equivalent(price: number, cycle: Cycle, period: Period) {
  const perMonth = CYCLES.find(c => c.value === cycle)?.perMonth ?? 0
  return price * perMonth * PERIODS.find(p => p.value === period)!.perMonth
}
