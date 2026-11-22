/* Reads gold purchases out of pasted text: a shop receipt, a chat message, or a few lines of notes.
   English or Khmer, Khmer digits, compound weights ("1 ដំឡឹង 2 ជី"), USD or riel, and dates day first.
   Each line with a weight starts a purchase; lines without one (a total, a date) belong to the one above,
   and lines before the first weight belong to the first. */

export type GoldUnit = 'li' | 'hun' | 'chi' | 'gram' | 'damlung' | 'troyOz' | 'kg'

export interface PastedPurchase {
  weight: number
  unit: GoldUnit
  price: number | null // USD; riel is converted at the given rate
  date: string | null // yyyy-mm-dd
  fromRiel: boolean
}

const GRAMS: Record<GoldUnit, number> = { li: 0.0375, hun: 0.375, chi: 3.75, gram: 1, damlung: 37.5, troyOz: 31.1034768, kg: 1000 }

// Longest spellings first, so "grams" wins over "g" and "តម្លឹង" isn't cut short
const UNIT_WORDS: [string, GoldUnit][] = [
  ['damlung', 'damlung'], ['dumlung', 'damlung'], ['tael', 'damlung'], ['ដំឡឹង', 'damlung'], ['តម្លឹង', 'damlung'], ['តំលឹង', 'damlung'],
  ['chi', 'chi'], ['ជី', 'chi'],
  ['hun', 'hun'], ['ហ៊ុន', 'hun'], ['ហុន', 'hun'],
  ['li', 'li'], ['លី', 'li'],
  ['grams', 'gram'], ['gram', 'gram'], ['gr', 'gram'], ['g', 'gram'], ['ក្រាម', 'gram'],
  ['troy oz', 'troyOz'], ['ounces', 'troyOz'], ['ounce', 'troyOz'], ['oz', 'troyOz'], ['អោន', 'troyOz'], ['អោនស៍', 'troyOz'],
  ['kilograms', 'kg'], ['kilogram', 'kg'], ['kilos', 'kg'], ['kilo', 'kg'], ['kg', 'kg'], ['គីឡូក្រាម', 'kg'], ['គីឡូ', 'kg']
] satisfies [string, GoldUnit][]
UNIT_WORDS.sort(([a], [b]) => b.length - a.length)

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// A number, then a unit not running on into a Latin word ("2 g" but not "2 gold")
const WEIGHT_RE = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_WORDS.map(u => esc(u[0])).join('|')})(?![a-z])`, 'gi')
const NUM = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?`
const USD_RE = new RegExp(String.raw`(?:\$|usd|us\$|ដុល្លារ)\s*(${NUM})|(${NUM})\s*(?:\$|usd|dollars?|ដុល្លារ)`, 'gi')
const KHR_RE = new RegExp(String.raw`(?:៛|khr|riels?|រៀល)\s*(${NUM})|(${NUM})\s*(?:៛|khr|riels?|រៀល)`, 'gi')
// Lines that name the amount actually paid, which beat a price per chi on another line
const TOTAL_RE = /total|paid|amount|grand|pay|សរុប|បង់|ចំនួនទឹកប្រាក់/i
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const khmerDigits = (s: string) => s.replace(/[០-៩]/g, d => String(d.charCodeAt(0) - 0x17E0))
const money = (s: string) => Number.parseFloat(s.replace(/,/g, ''))
const pad = (n: number) => String(n).padStart(2, '0')

function iso(y: number, m: number, d: number) {
  if (y < 100) y += 2000
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null
  const date = new Date(y, m - 1, d)
  return date.getMonth() === m - 1 ? `${y}-${pad(m)}-${pad(d)}` : null
}

function findDate(line: string) {
  let m = line.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) return iso(+m[1]!, +m[2]!, +m[3]!)
  m = line.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (m) {
    const [a, b] = [+m[1]!, +m[2]!]
    // Cambodia writes the day first; only a second number over 12 means the month came first
    return b > 12 ? iso(+m[3]!, a, b) : iso(+m[3]!, b, a)
  }
  m = line.match(/(\d{1,2})\s+([a-z]{3})[a-z]*\.?,?\s+(\d{4})/i)
  if (m && MONTHS.includes(m[2]!.toLowerCase())) return iso(+m[3]!, MONTHS.indexOf(m[2]!.toLowerCase()) + 1, +m[1]!)
  m = line.match(/([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/i)
  if (m && MONTHS.includes(m[1]!.toLowerCase())) return iso(+m[3]!, MONTHS.indexOf(m[1]!.toLowerCase()) + 1, +m[2]!)
  return null
}

function findWeight(line: string) {
  const parts: { qty: number, unit: GoldUnit }[] = []
  for (const m of line.matchAll(WEIGHT_RE)) {
    const unit = UNIT_WORDS.find(u => u[0].toLowerCase() === m[2]!.toLowerCase())![1]
    const qty = Number.parseFloat(m[1]!.replace(',', '.'))
    if (qty > 0) parts.push({ qty, unit })
  }
  if (!parts.length) return null
  if (parts.length === 1) return { weight: parts[0]!.qty, unit: parts[0]!.unit }
  // "1 damlung 2 chi 5 hun" adds up; say it in chi, the unit shops quote in
  const grams = parts.reduce((s, p) => s + p.qty * GRAMS[p.unit], 0)
  return { weight: Math.round((grams / GRAMS.chi) * 10000) / 10000, unit: 'chi' as GoldUnit }
}

function findPrices(line: string, khrRate: number) {
  // Take weights out first, so "2 chi" next to "$620" can't be read as part of a price
  const bare = line.replace(WEIGHT_RE, ' ')
  const found: { usd: number, fromRiel: boolean }[] = []
  for (const m of bare.matchAll(USD_RE)) found.push({ usd: money(m[1] ?? m[2]!), fromRiel: false })
  for (const m of bare.matchAll(KHR_RE)) found.push({ usd: Math.round((money(m[1] ?? m[2]!) / khrRate) * 100) / 100, fromRiel: true })
  return found.filter(p => p.usd > 0)
}

export function parseGoldPaste(text: string, khrRate = 4100): PastedPurchase[] {
  const lines = khmerDigits(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  type Block = { weight: ReturnType<typeof findWeight>, lines: string[] }
  const blocks: Block[] = []
  const before: string[] = []
  for (const line of lines) {
    const weight = findWeight(line)
    if (weight) blocks.push({ weight, lines: [line] })
    else if (blocks.length) blocks.at(-1)!.lines.push(line)
    else before.push(line)
  }
  if (!blocks.length) return []
  blocks[0]!.lines.unshift(...before)

  return blocks.map(({ weight, lines }) => {
    // The price on a "Total" line if there is one; otherwise the biggest, as a price per chi is smaller than the total
    const tagged = lines.flatMap(l => findPrices(l, khrRate).map(p => ({ ...p, total: TOTAL_RE.test(l) })))
    const pool = tagged.some(p => p.total) ? tagged.filter(p => p.total) : tagged
    const best = pool.reduce<typeof pool[number] | null>((a, p) => (!a || p.usd > a.usd ? p : a), null)
    const date = lines.map(findDate).find(Boolean) ?? null
    return { weight: weight!.weight, unit: weight!.unit, price: best?.usd ?? null, date, fromRiel: best?.fromRiel ?? false }
  })
}
