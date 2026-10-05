import { defineEventHandler, HTTPError } from 'h3'

// Mid-market USD→KHR rate from ExchangeRate-API's free endpoint (no key, updates once a day).
// Cached in memory so every visitor doesn't trigger an outside request.
const SOURCE = 'https://open.er-api.com/v6/latest/USD'
const CACHE_MS = 60 * 60 * 1000

interface RateResponse {
  rate: number
  updatedAt: string
  source: string
}

let cached: { value: RateResponse, at: number } | undefined

export default defineEventHandler(async (): Promise<RateResponse> => {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value

  try {
    const res = await fetch(SOURCE, { signal: AbortSignal.timeout(8000) })
    const data = await res.json() as { result?: string, rates?: Record<string, number>, time_last_update_utc?: string }
    const rate = data.rates?.KHR
    if (data.result !== 'success' || !rate) throw new Error('No KHR rate in the response')

    const value = {
      rate,
      updatedAt: new Date(data.time_last_update_utc ?? Date.now()).toISOString(),
      source: 'ExchangeRate-API'
    }
    cached = { value, at: Date.now() }
    return value
  } catch (e) {
    // Serve a stale rate rather than nothing if the provider is briefly down
    if (cached) return cached.value
    throw new HTTPError({ status: 502, message: `Couldn’t get the market rate: ${e instanceof Error ? e.message : 'unknown error'}` })
  }
})
