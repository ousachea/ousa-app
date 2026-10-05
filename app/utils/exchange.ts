// KHR/USD maths. Rates are always "riel per 1 US dollar", the way Cambodian money changers quote them.

export type Currency = 'USD' | 'KHR'
// usd-khr: you hand over dollars and get riel. khr-usd: you hand over riel and get dollars.
export type Direction = 'usd-khr' | 'khr-usd'

export const fromCurrency = (d: Direction): Currency => (d === 'usd-khr' ? 'USD' : 'KHR')
export const toCurrency = (d: Direction): Currency => (d === 'usd-khr' ? 'KHR' : 'USD')

export function convert(amount: number, direction: Direction, rate: number) {
  return direction === 'usd-khr' ? amount * rate : amount / rate
}

// Treat anything within 0.1% of the market as fair; changers round their quotes
const FAIR_BAND = 0.001

export interface Outcome {
  receive: number // what you get, in the "to" currency
  benchmark: number // what you'd get at the comparison rate
  diff: number // receive - benchmark, in the "to" currency (positive = gain)
  diffOther: number // the same difference in the other currency, at the market rate
  percent: number // diff as a share of the benchmark
  verdict: 'gain' | 'loss' | 'fair'
}

function outcome(receive: number, benchmark: number, currency: Currency, market: number): Outcome {
  const diff = receive - benchmark
  const percent = benchmark ? diff / benchmark : 0
  return {
    receive,
    benchmark,
    diff,
    diffOther: currency === 'KHR' ? diff / market : diff * market,
    percent,
    verdict: Math.abs(percent) < FAIR_BAND ? 'fair' : diff > 0 ? 'gain' : 'loss'
  }
}

// Is the rate you're offered better or worse than the market rate?
export function checkOffer(amount: number, direction: Direction, offered: number, market: number): Outcome {
  return outcome(convert(amount, direction, offered), convert(amount, direction, market), toCurrency(direction), market)
}

// You exchanged earlier at `then`. Converting what you got back at today's market rate: gain or loss
// compared with the amount you started with (in your original currency).
export function trackExchange(amount: number, direction: Direction, then: number, market: number): Outcome {
  const held = convert(amount, direction, then)
  const back: Direction = direction === 'usd-khr' ? 'khr-usd' : 'usd-khr'
  return outcome(convert(held, back, market), amount, fromCurrency(direction), market)
}

export function formatMoney(value: number, currency: Currency, { signed = false } = {}) {
  const abs = Math.abs(value)
  const text = currency === 'KHR'
    ? `${Math.round(abs).toLocaleString('en-US')} ៛`
    : `$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (!signed) return value < 0 ? `−${text}` : text
  return `${value < 0 ? '−' : '+'}${text}`
}
