import { formatMoney, type Currency } from './exchange'
import { CYCLES, STATUS, daysUntil, nextRenewal, occurrenceBefore, statusOf, type Cycle } from './renewals'
import { isoDaysAhead } from './demoDates'
import type { RenewalCategory } from './services'

// Countdown's two tabs, Dates (/countdown) and Renewals (/renewals), are one app: each keeps its own
// records, but both are dates you're waiting for. What they share lives here: the records, their example
// data, how a date repeats, the 30-day timeline and what's due today or tomorrow.

export interface CountdownEvent {
  id: string
  title: string
  date: string // yyyy-mm-dd; for a repeating date, the first time it happens (a birthday can be the birth date)
  time: string // hh:mm, or '' for all day
  createdAt: string // ISO; the progress bar measures the wait from here (or from the last time it came round)
  repeat?: Cycle // missing or 'once' for a date that happens once
  favorite?: boolean // starred: shown on the home page (#66)
}

export interface Renewal {
  id: string
  name: string
  price: number
  currency: Currency
  cycle: Cycle
  nextDate: string // yyyy-mm-dd, as entered; past dates roll forward when shown
  category?: RenewalCategory | '' // optional; suggested from the name (CHECKLIST.md #30)
  icon?: string // '' automatic from the name; 'letter', 'svc:<service>' or an image link chosen by hand (#54)
  favorite?: boolean // starred: shown on the home page (#66)
}

/** A public holiday, as /api/holidays sends it */
export interface HolidayLike { name: string, start: string }

// ---------- Example data (the app icon switches it on; signed out it stays on) ----------

const demoEvent = (title: string, inDays: number, time: string, waitedDays: number, extra: Partial<CountdownEvent> = {}): Omit<CountdownEvent, 'id'> =>
  ({ title, date: isoDaysAhead(inDays), time, createdAt: new Date(Date.now() - waitedDays * 86_400_000).toISOString(), ...extra })

// A few dates started at different times so the bars differ, and a birthday that comes round every year
export const DATES_DEMO = (): Omit<CountdownEvent, 'id'>[] => [
  demoEvent('Trip to Kampot', 9, '07:00', 30, { favorite: true }),
  { ...demoEvent('Mum’s birthday', 23, '', 60), date: shiftYears(isoDaysAhead(23), -58), repeat: 'yearly' },
  demoEvent('Project launch', 4, '09:00', 40),
  demoEvent('Concert in Phnom Penh', 51, '19:30', 14),
  demoEvent('Lease renewal', 120, '', 200)
]

// Everyday subscriptions, a couple renewing this week so the timeline has something to show
export const RENEWALS_DEMO = (): Omit<Renewal, 'id'>[] => [
  { name: 'Netflix', price: 9.99, currency: 'USD', cycle: 'monthly', nextDate: isoDaysAhead(3) },
  { name: 'Spotify', price: 5.99, currency: 'USD', cycle: 'monthly', nextDate: isoDaysAhead(11) },
  { name: 'iCloud+ 200 GB', price: 2.99, currency: 'USD', cycle: 'monthly', nextDate: isoDaysAhead(6) },
  { name: 'ChatGPT Plus', price: 20, currency: 'USD', cycle: 'monthly', nextDate: isoDaysAhead(18) },
  { name: 'Home internet', price: 25, currency: 'USD', cycle: 'monthly', nextDate: isoDaysAhead(1) },
  { name: 'Gym', price: 35, currency: 'USD', cycle: 'monthly', nextDate: isoDaysAhead(24) },
  { name: 'Domain name', price: 12, currency: 'USD', cycle: 'yearly', nextDate: isoDaysAhead(45) },
  { name: 'Phone top-up', price: 20000, currency: 'KHR', cycle: 'weekly', nextDate: isoDaysAhead(2) }
]

function shiftYears(iso: string, years: number) {
  const [y, m, d] = iso.split('-')
  return `${Number(y) + years}-${m}-${d}`
}

// ---------- Repeating dates: the same cycles Renewals bills in ----------

/** How a date can repeat, "Doesn't repeat" first */
export const REPEATS = [...CYCLES.filter(c => c.value === 'once'), ...CYCLES.filter(c => c.value !== 'once')]
  .map(c => ({ value: c.value, label: c.label }))

export const repeatLabel = (repeat?: Cycle) => (!repeat || repeat === 'once' ? '' : CYCLES.find(c => c.value === repeat)!.label.toLowerCase())

const momentOf = (date: string, time: string) => new Date(`${date}T${time || '00:00'}`).getTime()
const dayAfter = (now: number) => {
  const d = new Date(now)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
}

/**
 * When a date happens next: itself, or for a repeating one the next time it comes round. An all-day
 * date stays on its day until the day is over; one with a time moves on once the time has passed.
 * `since` is when the current wait started (the last time it came round), for the progress bar.
 */
export function occurrence(e: Pick<CountdownEvent, 'date' | 'time' | 'repeat'>, now = Date.now()) {
  const repeat = e.repeat ?? 'once'
  if (repeat === 'once') return { date: e.date, at: momentOf(e.date, e.time), since: undefined }
  let date = nextRenewal(e.date, repeat, new Date(now))
  if (e.time && momentOf(date, e.time) <= now) date = nextRenewal(e.date, repeat, dayAfter(now))
  const prev = occurrenceBefore(e.date, repeat, date)
  return { date, at: momentOf(date, e.time), since: prev ? momentOf(prev, e.time) : undefined }
}

// ---------- Due soon: the same words and colours on both tabs ----------

/** The status badge for a date `days` away, worded for a date rather than a bill (Today, Tomorrow, This week) */
export function dateBadge(days: number) {
  if (days < 0 || days > 7) return undefined
  const s = STATUS[statusOf(days)]
  return { badge: s.badge, symbol: s.symbol, label: days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : 'This week' }
}

// ---------- The next 30 days, across both tabs and the holidays ----------

export const UPCOMING_DAYS = 30

export type UpcomingKind = 'date' | 'renewal' | 'holiday'
export interface UpcomingMark {
  id: string
  name: string
  /** A price for a renewal; shown beside the name */
  detail?: string
  day: number
  kind: UpcomingKind
}

/** Every date in the next 30 days: repeating ones as often as they come round (a weekly plan several times) */
export function upcomingMarks(
  { dates = [], renewals = [], holidays = [] }: { dates?: CountdownEvent[], renewals?: Renewal[], holidays?: HolidayLike[] },
  now = new Date()
): UpcomingMark[] {
  const marks: UpcomingMark[] = []
  const series = (anchor: string, cycle: Cycle, add: (day: number) => void) => {
    let from = now
    for (let guard = 0; guard < 10; guard++) {
      if (cycle === 'once' && guard > 0) break
      const next = nextRenewal(anchor, cycle, from)
      const day = daysUntil(next, now)
      if (day > UPCOMING_DAYS || day < 0) break
      add(day)
      from = new Date(`${next}T00:00`)
      from.setDate(from.getDate() + 1)
    }
  }
  for (const r of renewals) {
    series(r.nextDate, r.cycle, day => marks.push({ id: `r-${r.id}-${day}`, name: r.name, detail: formatMoney(r.price, r.currency), day, kind: 'renewal' }))
  }
  for (const e of dates) {
    series(e.date, e.repeat ?? 'once', day => marks.push({ id: `d-${e.id}-${day}`, name: e.title, day, kind: 'date' }))
  }
  for (const h of holidays) {
    const day = daysUntil(h.start, now)
    if (day >= 0 && day <= UPCOMING_DAYS) marks.push({ id: `h-${h.start}`, name: h.name, day, kind: 'holiday' })
  }
  return marks.sort((a, b) => a.day - b.day)
}

// ---------- What's due today or tomorrow, for the reminder ----------

export interface DueItem {
  name: string
  /** "renews", "ends" or "is": read as "Netflix renews tomorrow" */
  verb: string
  days: 0 | 1
  detail?: string
}

export function dueItems(
  { dates = [], renewals = [], holidays = [] }: { dates?: CountdownEvent[], renewals?: Renewal[], holidays?: HolidayLike[] },
  now = new Date()
): DueItem[] {
  const out: DueItem[] = []
  const soon = (days: number): days is 0 | 1 => days === 0 || days === 1
  for (const r of renewals) {
    const days = daysUntil(nextRenewal(r.nextDate, r.cycle, now), now)
    if (soon(days)) out.push({ name: r.name, verb: r.cycle === 'once' ? 'ends' : 'renews', days, detail: `${formatMoney(r.price, r.currency)} ${repeatLabel(r.cycle)}`.trim() })
  }
  for (const e of dates) {
    const o = occurrence(e, now.getTime())
    const days = daysUntil(o.date, now)
    // Today's only while it's still ahead (or all day)
    if (soon(days) && (days === 1 || !e.time || o.at > now.getTime())) out.push({ name: e.title, verb: 'is', days, detail: e.time ? `At ${e.time}` : undefined })
  }
  for (const h of holidays) {
    const days = daysUntil(h.start, now)
    if (soon(days)) out.push({ name: h.name, verb: 'is', days, detail: 'Public holiday' })
  }
  return out.sort((a, b) => a.days - b.days)
}
