// Calendar dates as YYYY-MM-DD in this device's own time zone. toISOString() would give the UTC date,
// which in Cambodia (UTC+7) is still yesterday until 7 am (CHECKLIST.md #75).
const pad = (n: number) => String(n).padStart(2, '0')
export const localIsoDate = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Dates for demo data, relative to today so the samples never look stale
export const isoDaysAgo = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return localIsoDate(d)
}
export const isoDaysAhead = (days: number) => isoDaysAgo(-days)
