import { defineEventHandler, HTTPError } from 'h3'

// Cambodian public holidays from Nager.Date (no key). Lunar holidays like Pchum Ben and the
// Water Festival move every year, so they come from the API rather than a hard-coded list.
// Cached in memory for a day; this year and next are fetched so the list never runs dry in December.
const SOURCE = (year: number) => `https://date.nager.at/api/v3/PublicHolidays/${year}/KH`
const CACHE_MS = 24 * 60 * 60 * 1000

export interface Holiday {
  name: string // English
  localName: string // Khmer
  start: string // yyyy-mm-dd
  end: string // yyyy-mm-dd, same as start for one-day holidays
  days: number
}

interface HolidaysResponse {
  holidays: Holiday[]
  source: string
}

interface NagerHoliday { date: string, name: string, localName: string }

const cache = new Map<number, { value: NagerHoliday[], at: number }>()

async function yearOf(year: number): Promise<NagerHoliday[]> {
  const hit = cache.get(year)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value
  try {
    const res = await fetch(SOURCE(year), { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const value = await res.json() as NagerHoliday[]
    cache.set(year, { value, at: Date.now() })
    return value
  } catch (e) {
    // Serve a stale list rather than nothing if the provider is briefly down
    if (hit) return hit.value
    throw e
  }
}

const dayAfter = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

// Khmer New Year, Pchum Ben and the Water Festival are three days each: fold runs into one entry
function group(list: NagerHoliday[]): Holiday[] {
  const out: Holiday[] = []
  for (const h of [...list].sort((a, b) => a.date.localeCompare(b.date))) {
    const last = out.at(-1)
    if (last && last.name === h.name && dayAfter(last.end) === h.date) {
      last.end = h.date
      last.days++
    } else {
      out.push({ name: h.name, localName: h.localName, start: h.date, end: h.date, days: 1 })
    }
  }
  return out
}

export default defineEventHandler(async (): Promise<HolidaysResponse> => {
  const year = new Date().getFullYear()
  try {
    const lists = await Promise.all([yearOf(year), yearOf(year + 1)])
    return { holidays: group(lists.flat()), source: 'Nager.Date' }
  } catch (e) {
    throw new HTTPError({ status: 502, message: `Couldn’t get the holiday list: ${e instanceof Error ? e.message : 'unknown error'}` })
  }
})
