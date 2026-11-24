import { defineEventHandler, HTTPError } from 'h3'

// Gold spot price (USD per troy ounce) from gold-api.com's free endpoint, fetched here rather than in the
// browser, so ad blockers and network filters that block the provider can't stop the Gold app getting a price.
// Cached briefly so every visitor doesn't trigger an outside request; the provider updates about every 30 seconds.
const SOURCE = 'https://api.gold-api.com/price/XAU'
const CACHE_MS = 20 * 1000

interface GoldResponse {
  price: number
  updatedAt: string
  source: string
}

let cached: { value: GoldResponse, at: number } | undefined

export default defineEventHandler(async (): Promise<GoldResponse> => {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value

  try {
    const res = await fetch(SOURCE, { signal: AbortSignal.timeout(8000) })
    const data = await res.json() as { price?: number, updatedAt?: string }
    const price = Number(data.price)
    // Same sanity range the page uses, so a broken response never shows as a price
    if (!res.ok || !(price >= 100 && price <= 20000)) throw new Error('No usable price in the response')

    const value = { price, updatedAt: data.updatedAt ?? new Date().toISOString(), source: 'gold-api.com' }
    cached = { value, at: Date.now() }
    return value
  } catch (e) {
    // Serve a stale price rather than nothing if the provider is briefly down
    if (cached) return cached.value
    throw new HTTPError({ status: 502, message: `Couldn’t get the gold price: ${e instanceof Error ? e.message : 'unknown error'}` })
  }
})
