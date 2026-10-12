// Every number the budget planner shows comes from these functions, so the dashboard, budgets and
// reports always agree. Amounts keep their own currency; `Convert` turns one into the currency the
// totals are shown in, or returns undefined while no exchange rate is known (shown as "…").
import type { BudgetCategory, BudgetLimit, BudgetPeriod, BudgetRecurring, BudgetTransaction, Currency, Cycle } from './types'
import { addDays, addMonths, daysBetween, daysInMonth, dayRange, eachDay, inRange, iso, monthOf, monthRange, parse, weekRange, type DateRange } from './dates'

export type Convert = (amount: number, currency: Currency) => number | undefined

export interface Rate {
  /** Riel per dollar */
  rate?: number
  source: 'live' | 'saved' | 'fixed' | 'fallback' | 'loading'
  /** The day this rate is for */
  date?: string
}

export function converter(to: Currency, rate: Rate): Convert {
  return (amount, from) => {
    if (from === to) return amount
    if (!rate.rate) return undefined
    return to === 'USD' ? amount / rate.rate : amount * rate.rate
  }
}

export interface Total {
  /** In the display currency; undefined until a rate is known (only when currencies are mixed) */
  value: number | undefined
  /** What was entered in each currency, before converting */
  byCurrency: Record<Currency, number>
  count: number
}

export function total(list: { amount: number, currency: Currency }[], conv: Convert): Total {
  const byCurrency: Record<Currency, number> = { USD: 0, KHR: 0 }
  let value: number | undefined = 0
  for (const t of list) {
    byCurrency[t.currency] += t.amount
    const v = conv(t.amount, t.currency)
    value = v === undefined || value === undefined ? undefined : value + v
  }
  return { value, byCurrency, count: list.length }
}

/** True when a total adds up amounts from both currencies, so it should say which rate it used */
export const isMixed = (t: Total) => t.byCurrency.USD !== 0 && t.byCurrency.KHR !== 0

export const expensesIn = (txs: BudgetTransaction[], r: DateRange) => txs.filter(t => t.kind === 'expense' && inRange(t.date, r))
export const incomeIn = (txs: BudgetTransaction[], r: DateRange) => txs.filter(t => t.kind === 'income' && inRange(t.date, r))

export interface CashFlow {
  income: Total
  expenses: Total
  /** income − expenses */
  net: number | undefined
  /** Share of income kept (net / income), when there was income */
  savingsRate: number | undefined
}

export function cashFlow(txs: BudgetTransaction[], r: DateRange, conv: Convert): CashFlow {
  const income = total(incomeIn(txs, r), conv)
  const expenses = total(expensesIn(txs, r), conv)
  const net = income.value === undefined || expenses.value === undefined ? undefined : income.value - expenses.value
  const savingsRate = net !== undefined && income.value ? net / income.value : undefined
  return { income, expenses, net, savingsRate }
}

// ---------- Grouping ----------

export interface Slice {
  key: string
  total: Total
}

/** Sum expenses by a key; each transaction lands in exactly one slice, so slices never double-count */
export function groupTotals(txs: BudgetTransaction[], key: (t: BudgetTransaction) => string, conv: Convert): Slice[] {
  const groups = new Map<string, BudgetTransaction[]>()
  for (const t of txs) {
    const k = key(t)
    groups.set(k, [...(groups.get(k) ?? []), t])
  }
  return [...groups].map(([k, list]) => ({ key: k, total: total(list, conv) }))
    .sort((a, b) => (b.total.value ?? 0) - (a.total.value ?? 0))
}

/** Spending per day across a range, including days with nothing spent */
export function dailyTotals(txs: BudgetTransaction[], r: DateRange, conv: Convert) {
  const byDay = new Map<string, BudgetTransaction[]>()
  for (const t of expensesIn(txs, r)) byDay.set(t.date, [...(byDay.get(t.date) ?? []), t])
  return eachDay(r).map(date => ({ date, total: total(byDay.get(date) ?? [], conv) }))
}

/** One entry per calendar month that overlaps the range, with income and expenses */
export function monthlyFlow(txs: BudgetTransaction[], months: number, endMonth: string, conv: Convert) {
  const out: { month: string, flow: CashFlow }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const r = monthRange(addMonths(endMonth, -i))
    out.push({ month: r.from, flow: cashFlow(txs, r, conv) })
  }
  return out
}

// ---------- Budgets ----------

export const periodRange = (period: BudgetPeriod, date: string, weekStart: 0 | 1): DateRange =>
  period === 'month' ? monthRange(date) : period === 'week' ? weekRange(date, weekStart) : dayRange(date)

/** The transactions a budget counts: overall counts every expense once; a category its own; a subcategory its own */
export function budgetMatches(limit: Pick<BudgetLimit, 'scope' | 'targetId'>, t: BudgetTransaction) {
  if (t.kind !== 'expense') return false
  if (limit.scope === 'overall') return true
  if (limit.scope === 'category') return t.categoryId === limit.targetId
  return t.subcategoryId === limit.targetId
}

export type BudgetLevel = 'ok' | 'warn' | 'reached' | 'over'

export interface BudgetStatus {
  range: DateRange
  limit: number | undefined
  spent: Total
  remaining: number | undefined
  /** spent / limit, 0–∞ */
  share: number | undefined
  level: BudgetLevel
  /** Where this month is heading at the current pace; only once there's enough of the month to go on */
  projected: number | undefined
}

/** Days into a period before a projection means anything */
const PROJECT_AFTER_DAYS = 7

export function budgetStatus(
  limit: BudgetLimit,
  txs: BudgetTransaction[],
  date: string,
  conv: Convert,
  opts: { weekStart: 0 | 1, alerts: number[], overAlert: number, today: string }
): BudgetStatus {
  const range = periodRange(limit.period, date, opts.weekStart)
  const spent = total(txs.filter(t => inRange(t.date, range) && budgetMatches(limit, t)), conv)
  const cap = conv(limit.amount, limit.currency)
  const share = cap && spent.value !== undefined ? spent.value / cap : undefined
  const remaining = cap !== undefined && spent.value !== undefined ? cap - spent.value : undefined
  let level: BudgetLevel = 'ok'
  if (share !== undefined) {
    const pct = share * 100
    if (pct > 100 + (opts.overAlert || 0) && pct > 100) level = 'over'
    else if (pct >= 100) level = 'reached'
    else if (opts.alerts.some(a => pct >= a)) level = 'warn'
  }
  // Pace projection for the month in progress, from the days gone so far
  let projected: number | undefined
  if (limit.period === 'month' && spent.value !== undefined && inRange(opts.today, range)) {
    const elapsed = daysBetween(range.from, opts.today) + 1
    if (elapsed >= PROJECT_AFTER_DAYS) projected = (spent.value / elapsed) * daysInMonth(range.from)
  }
  return { range, limit: cap, spent, remaining, share, level, projected }
}

// ---------- Recurring bills ----------

export const CYCLES: { value: Cycle, label: string, perMonth: number }[] = [
  { value: 'daily', label: 'Every day', perMonth: 365 / 12 },
  { value: 'weekly', label: 'Every week', perMonth: 52 / 12 },
  { value: 'monthly', label: 'Every month', perMonth: 1 },
  { value: 'quarterly', label: 'Every 3 months', perMonth: 1 / 3 },
  { value: 'yearly', label: 'Every year', perMonth: 1 / 12 },
  { value: 'custom', label: 'Every few days', perMonth: 0 }
]

export const perMonth = (r: Pick<BudgetRecurring, 'cycle' | 'every'>) =>
  r.cycle === 'custom' ? 30.4375 / Math.max(1, r.every) : CYCLES.find(c => c.value === r.cycle)!.perMonth

/** The n-th due date after the first. Months clamp to the month's last day (31 Jan → 28 Feb), like real billing. */
export function nthDue(r: Pick<BudgetRecurring, 'cycle' | 'every' | 'startDate'>, n: number) {
  if (r.cycle === 'daily') return addDays(r.startDate, n)
  if (r.cycle === 'weekly') return addDays(r.startDate, 7 * n)
  if (r.cycle === 'custom') return addDays(r.startDate, Math.max(1, r.every) * n)
  const months = r.cycle === 'monthly' ? 1 : r.cycle === 'quarterly' ? 3 : 12
  const start = parse(r.startDate)
  const target = new Date(start.getFullYear(), start.getMonth() + months * n, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(start.getDate(), last))
  return iso(target)
}

/** Due dates within a range (at most `max`) */
export function dueDates(r: Pick<BudgetRecurring, 'cycle' | 'every' | 'startDate'>, range: DateRange, max = 400) {
  const out: string[] = []
  for (let n = 0; out.length < max && n < 5000; n++) {
    const d = nthDue(r, n)
    if (d > range.to) break
    if (d >= range.from) out.push(d)
  }
  return out
}

export type BillState = 'paused' | 'overdue' | 'today' | 'soon' | 'upcoming'

export interface BillStatus {
  /** Due dates gone by without a payment or a skip (oldest first, at most 12) */
  overdue: string[]
  /** The next due date still waiting for a payment */
  next: string | undefined
  state: BillState
  /** Payments recorded for this bill, by due date */
  paid: Map<string, BudgetTransaction>
}

/**
 * Where a bill stands. A due date only counts as paid when a payment was recorded for it (recurringId +
 * occurrence); nothing is ever marked paid on its own. Overdue looks back at most a year.
 */
export function billStatus(r: BudgetRecurring, txs: BudgetTransaction[], day: string): BillStatus {
  const paid = new Map<string, BudgetTransaction>()
  for (const t of txs) if (t.recurringId === r.id && t.occurrence) paid.set(t.occurrence, t)
  const settled = (d: string) => paid.has(d) || r.skipped.includes(d)
  const from = r.startDate > addDays(day, -366) ? r.startDate : addDays(day, -366)
  const overdue = dueDates(r, { from, to: addDays(day, -1) }).filter(d => !settled(d)).slice(-12)
  const next = dueDates(r, { from: day, to: addDays(day, 3660) }, 60).find(d => !settled(d))
  let state: BillState = 'upcoming'
  if (!r.active) state = 'paused'
  else if (overdue.length) state = 'overdue'
  else if (next === day) state = 'today'
  else if (next && daysBetween(day, next) <= 7) state = 'soon'
  return { overdue, next, state, paid }
}

// ---------- Duplicates ----------

/** Same kind, amount, currency and category on the same day: probably logged twice */
export const sameTransaction = (a: Pick<BudgetTransaction, 'kind' | 'amount' | 'currency' | 'categoryId' | 'subcategoryId' | 'date'>, b: typeof a) =>
  a.kind === b.kind && a.amount === b.amount && a.currency === b.currency && a.categoryId === b.categoryId && a.subcategoryId === b.subcategoryId && a.date === b.date

/** A key for import duplicate checks */
export const transactionKey = (t: Pick<BudgetTransaction, 'kind' | 'amount' | 'currency' | 'categoryId' | 'subcategoryId' | 'date' | 'note'>) =>
  [t.kind, t.date, t.amount, t.currency, t.categoryId, t.subcategoryId, t.note.trim().toLowerCase()].join('|')

// ---------- Names ----------

export function categoryPath(id: string, cats: BudgetCategory[]) {
  const c = cats.find(x => x.id === id)
  if (!c) return 'Unknown category'
  const parent = c.parentId ? cats.find(x => x.id === c.parentId) : undefined
  return parent ? `${parent.name} › ${c.name}` : c.name
}

export const monthKey = monthOf
