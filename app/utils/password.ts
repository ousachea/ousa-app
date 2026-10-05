export type CharsetName = 'upper' | 'lower' | 'digits' | 'symbols'

export const CHARSETS: Record<CharsetName, { label: string, example: string, chars: string }> = {
  upper: { label: 'Uppercase', example: 'A–Z', chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
  lower: { label: 'Lowercase', example: 'a–z', chars: 'abcdefghijklmnopqrstuvwxyz' },
  digits: { label: 'Numbers', example: '0–9', chars: '0123456789' },
  symbols: { label: 'Symbols', example: '!@#$', chars: '!@#$%^&*()-_=+[]{};:,.?/~' }
}

// Characters that are easy to misread when typing a password by hand
const LOOK_ALIKES = new Set('Il1O0o|'.split(''))

export interface PasswordOptions {
  length: number
  sets: CharsetName[]
  avoidLookAlikes: boolean
}

function charsFor(set: CharsetName, avoidLookAlikes: boolean) {
  const chars = CHARSETS[set].chars.split('')
  return avoidLookAlikes ? chars.filter(c => !LOOK_ALIKES.has(c)) : chars
}

// Uniform random integer in [0, max) from the platform CSPRNG. Rejection sampling avoids modulo bias.
function randomInt(max: number) {
  const limit = Math.floor(0x100000000 / max) * max
  const buf = new Uint32Array(1)
  do crypto.getRandomValues(buf)
  while (buf[0]! >= limit)
  return buf[0]! % max
}

export function generatePassword({ length, sets, avoidLookAlikes }: PasswordOptions) {
  const groups = sets.map(set => charsFor(set, avoidLookAlikes)).filter(g => g.length)
  if (!groups.length) return ''
  const pool = groups.flat()

  // One character from every chosen set, so the password always meets common "must include" rules
  const chars = groups.slice(0, length).map(g => g[randomInt(g.length)]!)
  while (chars.length < length) chars.push(pool[randomInt(pool.length)]!)

  // Fisher–Yates shuffle so the guaranteed characters aren't always at the start
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j]!, chars[i]!]
  }
  return chars.join('')
}

export function poolSize({ sets, avoidLookAlikes }: Omit<PasswordOptions, 'length'>) {
  return sets.reduce((n, set) => n + charsFor(set, avoidLookAlikes).length, 0)
}

export type Strength = { bits: number, label: 'Weak' | 'Fair' | 'Strong' | 'Very strong', level: 1 | 2 | 3 | 4 }

// Entropy of a random password: length × log2(pool size).
// Thresholds line up with crackTime(): Weak falls within ~2 years, Very strong outlasts the universe.
export function strength(options: PasswordOptions): Strength {
  const size = poolSize(options)
  const bits = size > 1 ? Math.round(options.length * Math.log2(size)) : 0
  if (bits < 60) return { bits, label: 'Weak', level: 1 }
  if (bits < 75) return { bits, label: 'Fair', level: 2 }
  if (bits < 100) return { bits, label: 'Strong', level: 3 }
  return { bits, label: 'Very strong', level: 4 }
}

export function charKind(c: string): CharsetName {
  if (/[A-Z]/.test(c)) return 'upper'
  if (/[a-z]/.test(c)) return 'lower'
  if (/\d/.test(c)) return 'digits'
  return 'symbols'
}

// Worst realistic case: a leaked password database stored with a fast hash, attacked by a GPU rig
export const GUESSES_PER_SECOND = 1e10

const UNIVERSE_AGE_YEARS = 1.38e10
const UNITS: [number, string][] = [
  [60, 'second'],
  [60, 'minute'],
  [24, 'hour'],
  [30.44, 'day'],
  [12, 'month']
]
const BIG_YEARS: [number, string][] = [
  [1e9, 'billion'],
  [1e6, 'million'],
  [1e3, 'thousand']
]

export const crackSeconds = (bits: number, guessesPerSecond = GUESSES_PER_SECOND) => 2 ** Math.max(bits - 1, 0) / guessesPerSecond

// Position on a log scale running from 1 second to the age of the universe, 0–1
const YEAR_S = 31_557_600
export const UNIVERSE_S = UNIVERSE_AGE_YEARS * YEAR_S
export const crackScale = (seconds: number) => Math.min(Math.max(Math.log10(Math.max(seconds, 1)) / Math.log10(UNIVERSE_S), 0), 1)
export const CRACK_TICKS = [
  { label: 'Hour', seconds: 3600 },
  { label: 'Day', seconds: 86_400 },
  { label: 'Year', seconds: YEAR_S },
  { label: '1,000 years', seconds: 1000 * YEAR_S },
  { label: '1M years', seconds: 1e6 * YEAR_S }
].map(t => ({ ...t, at: crackScale(t.seconds) }))

// Average time to guess a random password with this many bits: half of all 2^bits possibilities
export function crackTime(bits: number, guessesPerSecond = GUESSES_PER_SECOND) {
  let value = 2 ** Math.max(bits - 1, 0) / guessesPerSecond
  if (value < 1) return 'Instantly'

  for (const [size, unit] of UNITS) {
    if (value < size) {
      const n = Math.round(value)
      return `${n} ${unit}${n === 1 ? '' : 's'}`
    }
    value /= size
  }

  // value is now in years
  if (value >= UNIVERSE_AGE_YEARS) return 'Longer than the universe has existed'
  for (const [size, word] of BIG_YEARS) {
    if (value >= size) return `${Math.round(value / size)} ${word} years`
  }
  const n = Math.round(value)
  return `${n} year${n === 1 ? '' : 's'}`
}
