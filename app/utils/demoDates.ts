// Dates for demo data, relative to today so the samples never look stale
const DAY = 86_400_000
export const isoDaysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString().slice(0, 10)
export const isoDaysAhead = (days: number) => isoDaysAgo(-days)
