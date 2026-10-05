// Cambodia numbering plan: country code +855, trunk prefix 0.
// Mobile: 2-digit operator prefix + 6 or 7 digits. Fixed line: 2-digit area code + 6 digits.
// Operator prefixes change over time (and numbers can be ported), so treat the operator as a hint.

export interface Operator {
  name: string
  color: string
  prefixes: Record<string, number> // prefix -> subscriber digit count
}

export const OPERATORS: Operator[] = [
  {
    name: 'Cellcard',
    color: '#f7a600',
    prefixes: { 11: 6, 12: 6, 14: 6, 17: 6, 61: 6, 76: 7, 77: 6, 78: 6, 79: 6, 85: 6, 89: 6, 92: 6, 95: 6, 99: 6 }
  },
  {
    name: 'Smart',
    color: '#00a651',
    prefixes: { 10: 6, 15: 6, 16: 6, 69: 6, 70: 6, 81: 6, 86: 6, 87: 6, 93: 6, 96: 7, 98: 6 }
  },
  {
    name: 'Metfone',
    color: '#e31b23',
    prefixes: { 31: 7, 60: 6, 66: 6, 67: 6, 68: 6, 71: 7, 88: 7, 90: 6, 97: 7 }
  },
  { name: 'Seatel', color: '#00a0e3', prefixes: { 18: 7 } },
  { name: 'qb', color: '#8b5cf6', prefixes: { 13: 6, 80: 6, 83: 6, 84: 6 } },
  { name: 'CooTel', color: '#f05a28', prefixes: { 38: 7 } }
]

export const AREA_CODES: Record<string, string> = {
  23: 'Phnom Penh',
  24: 'Kandal',
  25: 'Kampong Speu',
  26: 'Kampong Chhnang',
  32: 'Takeo',
  33: 'Kampot',
  34: 'Preah Sihanouk',
  35: 'Koh Kong',
  36: 'Kep',
  42: 'Kampong Cham',
  43: 'Prey Veng',
  44: 'Svay Rieng',
  52: 'Pursat',
  53: 'Battambang',
  54: 'Banteay Meanchey',
  55: 'Pailin',
  62: 'Kampong Thom',
  63: 'Siem Reap',
  64: 'Preah Vihear',
  65: 'Oddar Meanchey',
  72: 'Kratie',
  73: 'Stung Treng',
  74: 'Ratanakiri',
  75: 'Mondulkiri'
}

// What a known prefix tells us before the number is complete (e.g. someone typed just "96")
export interface PrefixMatch {
  prefix: string // without the leading 0, e.g. "96"
  type: 'mobile' | 'fixed'
  operator?: Operator
  region?: string
  expected: number // digits that follow the prefix
  have: number // digits typed after the prefix so far
}

export type PhoneResult =
  | { valid: false, reason: string, match?: PrefixMatch }
  | {
    valid: true
    type: 'mobile' | 'fixed'
    operator?: Operator
    region?: string
    national: string // 012345678
    international: string // +855 12 345 678
    e164: string // +85512345678
  }

// 345678 -> "345 678", 3456789 -> "345 6789"
const group = (subscriber: string) => `${subscriber.slice(0, 3)} ${subscriber.slice(3)}`

export function lookupPrefix(prefix: string): Omit<PrefixMatch, 'have'> | undefined {
  const operator = OPERATORS.find(op => prefix in op.prefixes)
  if (operator) return { prefix, type: 'mobile', operator, expected: operator.prefixes[prefix]! }
  const region = AREA_CODES[prefix]
  if (region) return { prefix, type: 'fixed', region, expected: 6 }
  return undefined
}

export function checkCambodiaPhone(input: string): PhoneResult {
  const raw = input.trim()
  if (!raw) return { valid: false, reason: 'Enter a phone number' }
  if (/[^\d\s\-+().]/.test(raw)) return { valid: false, reason: 'Contains characters that aren’t digits' }

  let digits = raw.replace(/\D/g, '')
  const hasPlus = raw.startsWith('+') || raw.startsWith('00')
  if (raw.startsWith('00')) digits = digits.slice(2)

  if (digits.startsWith('855')) digits = digits.slice(3)
  else if (hasPlus && digits.length >= 3) return { valid: false, reason: 'Not a Cambodian number (country code must be +855)' }

  // The leading 0 is optional: "12", "012" and "+855 12" all mean the same prefix
  if (digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length < 2) return { valid: false, reason: 'Type at least 2 digits to look up the network' }

  const prefix = digits.slice(0, 2)
  const subscriber = digits.slice(2)
  const known = lookupPrefix(prefix)
  if (!known) return { valid: false, reason: `0${prefix} isn’t a known Cambodian mobile or area prefix` }

  const match: PrefixMatch = { ...known, have: subscriber.length }
  const rule = known.type === 'mobile'
    ? `${known.operator!.name} 0${prefix} numbers have ${known.expected} digits after the prefix`
    : `${known.region} landlines (0${prefix}) have ${known.expected} digits after the area code`

  if (subscriber.length < known.expected) {
    const left = known.expected - subscriber.length
    return {
      valid: false,
      match,
      reason: subscriber.length
        ? `${left} more digit${left === 1 ? '' : 's'} to go`
        : rule
    }
  }
  if (subscriber.length > known.expected) {
    return { valid: false, match, reason: `Too long: ${rule}, this has ${subscriber.length}` }
  }

  return {
    valid: true,
    type: known.type,
    operator: known.operator,
    region: known.region,
    national: `0${digits}`,
    international: `+855 ${prefix} ${group(subscriber)}`,
    e164: `+855${digits}`
  }
}
