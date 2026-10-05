export type Cycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export const CYCLES: { value: Cycle, label: string, perMonth: number }[] = [
  { value: 'weekly', label: 'Every week', perMonth: 52 / 12 },
  { value: 'monthly', label: 'Every month', perMonth: 1 },
  { value: 'quarterly', label: 'Every 3 months', perMonth: 1 / 3 },
  { value: 'yearly', label: 'Every year', perMonth: 1 / 12 }
]

const parse = (d: string) => {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y!, m! - 1, day!)
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Add one billing cycle. Month maths clamps to the month's last day (Jan 31 -> Feb 28), like real billing.
function step(date: Date, cycle: Cycle, anchorDay: number) {
  if (cycle === 'weekly') return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7)
  const months = cycle === 'monthly' ? 1 : cycle === 'quarterly' ? 3 : 12
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(anchorDay, lastDay))
  return target
}

// The next renewal on or after today, rolling a past date forward by whole cycles
export function nextRenewal(nextDate: string, cycle: Cycle, today = new Date()) {
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
