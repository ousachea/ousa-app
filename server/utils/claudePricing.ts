// What Claude API tokens cost, in US dollars per million tokens, for estimating Claude Code usage from its
// local logs (which record tokens, not dollars). First-party API list prices as of October 2026; keep in
// step with the pricing page. Cache writes cost 1.25× input for 5 minutes and 2× for an hour.
interface Price { input: number, output: number, cacheRead: number }

const PRICES: [prefix: string, price: Price][] = [
  ['claude-fable-5-1', { input: 10, output: 50, cacheRead: 0.25 }],
  ['claude-mythos-5-1', { input: 10, output: 50, cacheRead: 0.25 }],
  ['claude-fable-5', { input: 10, output: 50, cacheRead: 1 }],
  ['claude-opus-5-5', { input: 4, output: 20, cacheRead: 0.2 }],
  ['claude-opus-5', { input: 5, output: 25, cacheRead: 0.5 }],
  ['claude-opus-4', { input: 5, output: 25, cacheRead: 0.5 }],
  ['claude-sonnet-5-5', { input: 2, output: 10, cacheRead: 0.2 }],
  ['claude-sonnet-5', { input: 2, output: 10, cacheRead: 0.2 }],
  ['claude-sonnet-4', { input: 3, output: 15, cacheRead: 0.3 }],
  ['claude-haiku-5-5', { input: 0.1, output: 0.5, cacheRead: 0.01 }],
  ['claude-haiku-4', { input: 1, output: 5, cacheRead: 0.1 }]
]

export interface TokenCounts {
  input: number
  output: number
  cacheRead: number
  cacheWrite5m: number
  cacheWrite1h: number
}

/** Estimated cost in dollars, or null for a model this table doesn't know. Fast mode costs twice as much. */
export function estimateCost(model: string, t: TokenCounts, fast = false): number | null {
  const price = PRICES.find(([prefix]) => model === prefix || model.startsWith(`${prefix}-`) || model.startsWith(prefix))?.[1]
  if (!price) return null
  const m = 1_000_000
  const cost = (t.input * price.input + t.output * price.output + t.cacheRead * price.cacheRead
    + t.cacheWrite5m * price.input * 1.25 + t.cacheWrite1h * price.input * 2) / m
  return fast ? cost * 2 : cost
}
